from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from config import USER_PLUGIN_SERVER_PORT
from pathlib import Path
import importlib
import inspect
from event_base import EventHandler 
# Python 3.11 有 tomllib；低版本可用 tomli 兼容
try:
    import tomllib  # type: ignore[attr-defined]
except ImportError:  # pragma: no cover
    import tomli as tomllib  # type: ignore[no-redef]

app = FastAPI(title="N.E.K.O User Plugin Server")

logger = logging.getLogger("user_plugin_server")
logging.basicConfig(level=logging.INFO)

# In-memory plugin registry (initially empty). Plugins are dicts with keys:
# { "id": str, "name": str, "description": str, "endpoint": str, "input_schema": dict }
# Registration endpoints are intentionally not implemented now.
_plugins: Dict[str, Dict[str, Any]] = {}
# In-memory plugin instances (id -> instance)
_plugin_instances: Dict[str, Any] = {}
_event_handlers: Dict[str, EventHandler] = {}
# Where to look for plugin.toml files: ./plugins/<any>/plugin.toml
PLUGIN_CONFIG_ROOT = Path(__file__).parent / "plugins"
# Simple bounded in-memory event queue for inspection
EVENT_QUEUE_MAX = 1000
_event_queue: asyncio.Queue = asyncio.Queue(maxsize=EVENT_QUEUE_MAX)

def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

@app.get("/health")
async def health():
    return {"status": "ok", "time": _now_iso()}

@app.get("/available")
async def available():
    """Return availability and basic stats."""
    return {
        "status": "ok",
        "available": True,
        "plugins_count": len(_plugins),
        "time": _now_iso()
    }
@app.get("/plugins")
async def list_plugins():
    """
    Return the list of known plugins.
    Each plugin item contains at least: id, name, description, input_schema, endpoint (if any).
    If registry is empty, expose a minimal test plugin so task_executor can run a simple end-to-end test.
    """
    try:
        if _plugins:
            logger.info("加载插件列表成功")
            # 已加载的插件（来自 TOML），直接返回
            result = []
            for plugin_id, plugin_meta in _plugins.items():
                plugin_info = plugin_meta.copy()  # Make a copy to modify
                plugin_info["entries"] = []
                # 处理每个 plugin 的 method，添加描述
                seen = set()  # 用于去重 (event_type, id)
                for key, eh in _event_handlers.items():
                    if not (key.startswith(f"{plugin_id}.") or key.startswith(f"{plugin_id}:plugin_entry:")):
                        continue
                    if eh.meta.event_type != "plugin_entry":
                        continue
                    # 去重判定键：优先使用 meta.id，再退回到 key
                    eid = getattr(eh.meta, "id", None) or key
                    dedup_key = (eh.meta.event_type, eid)
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)
                    # 增加返回消息字段：若 EventMeta 有 return_message 属性则暴露，否则默认空字符串
                    returned_message = getattr(eh.meta, "return_message", "") if hasattr(eh, "meta") else ""
                    plugin_info["entries"].append({
                        "id": eh.meta.id,
                        "name": eh.meta.name,
                        "description": eh.meta.description,
                        "event_key": key,
                        "input_schema": eh.meta.input_schema,
                        "return_message": returned_message,
                    })
                result.append(plugin_info)
            logger.info(result)
            return result
        else:
            logger.info("No plugins registered.")
            return {"plugins": [], "message": "No plugins available."}
    except Exception as e:
        logger.exception("Failed to list plugins")
        raise HTTPException(status_code=500, detail=str(e))

# Utility to allow other parts of the application (same process) to query plugin list
def get_plugins() -> List[Dict[str, Any]]:
    """Return list of plugin dicts (in-process access)."""
    return list(_plugins.values())

# Utility to register a plugin programmatically (internal use only)
def _register_plugin(plugin: Dict[str, Any]) -> None:
    """Internal helper to insert plugin into registry (not exposed as HTTP)."""
    pid = plugin.get("id")
    if not pid:
        raise ValueError("plugin must have id")
    _plugins[pid] = plugin

def _load_plugins_from_toml() -> None:
    """
    扫描 ./plugins/*/plugin.toml，按配置加载插件类并实例化。
    每个 plugin.toml 形如：

        [plugin]
        id = "testPlugin"
        name = "Test Plugin"
        description = "Minimal plugin used for local testing"
        version = "0.1.0"
        entry = "plugins.hello:HelloPlugin"
    """
    if not PLUGIN_CONFIG_ROOT.exists():
        logger.info("No plugin config directory %s, skipping TOML loading", PLUGIN_CONFIG_ROOT)
        return

    logger.info("Loading plugins from %s", PLUGIN_CONFIG_ROOT)
    for toml_path in PLUGIN_CONFIG_ROOT.glob("*/plugin.toml"):
        try:
            with toml_path.open("rb") as f:
                conf = tomllib.load(f)
            pdata = conf.get("plugin") or {}
            pid = pdata.get("id")
            if not pid:
                logger.warning("plugin.toml %s missing [plugin].id, skipping", toml_path)
                continue

            name = pdata.get("name", pid)
            desc = pdata.get("description", "")
            version = pdata.get("version", "0.1.0")
            entry = pdata.get("entry")
            if not entry or ":" not in entry:
                logger.warning("plugin.toml %s has invalid entry=%r, skipping", toml_path, entry)
                continue

            module_path, class_name = entry.split(":", 1)
            mod = importlib.import_module(module_path)
            cls = getattr(mod, class_name)

            # 实例化插件；如果将来想传 ctx，可以改成 cls(ctx)
            instance = cls()

            # 插件 HTTP endpoint 统一为 /plugin/<id>
            endpoint = f"http://localhost:{USER_PLUGIN_SERVER_PORT}/plugin/{pid}"

            meta = {
                "id": pid,
                "name": name,
                "description": desc,
                "version": version,
                # 不再填充 endpoint 字段，避免暴露本地地址/端口
                # "endpoint": endpoint,
                # 短期：如果插件类上有 input_schema 属性，就用；否则给个空 schema
                "input_schema": getattr(instance, "input_schema", {}) or {
                    "type": "object",
                    "properties": {}
                },
            }

            _plugin_instances[pid] = instance
            _register_plugin(meta)

            # 自动扫描实例的方法，查找 EventMeta 并将对应的 EventHandler 注册到 _event_handlers
            # 使用 event_base.py 中约定的 EVENT_META_ATTR（如果插件方法被装饰器标注了元信息）
            try:
                from event_base import EVENT_META_ATTR, EventHandler as _EB_EventHandler
                for name, member in inspect.getmembers(instance, predicate=callable):
                    # 忽略私有方法
                    if name.startswith("_"):
                        continue
                    meta = getattr(member, EVENT_META_ATTR, None)
                    if meta is None:
                        # 有些装饰器可能将 meta 绑定到函数的 __wrapped__（例如 functools.wraps 情况），尝试获取
                        wrapped = getattr(member, "__wrapped__", None)
                        if wrapped is not None:
                            meta = getattr(wrapped, EVENT_META_ATTR, None)
                    if meta is None:
                        continue
                    # 仅关注 plugin_entry 类型
                    try:
                        if getattr(meta, "event_type", None) != "plugin_entry":
                            continue
                    except Exception:
                        continue
                    # 兼容两种 key 约定： "pid.<id>" 和 "pid:plugin_entry:<id>"
                    try:
                        eid = getattr(meta, "id", name)
                    except Exception:
                        eid = name
                    key1 = f"{pid}.{eid}"
                    key2 = f"{pid}:plugin_entry:{eid}"
                    # 构造 EventHandler 并注册（最后注册的覆盖同名）
                    _event_handlers[key1] = _EB_EventHandler(meta=meta, handler=member)
                    _event_handlers[key2] = _EB_EventHandler(meta=meta, handler=member)

            except Exception:
                logger.exception("Failed to auto-register EventMeta handlers for plugin %s", pid)

            logger.info("Loaded plugin %s from %s (%s)", pid, toml_path, entry)
        except Exception as e:
            logger.exception("Failed to load plugin from %s: %s", toml_path, e)
# NOTE: Registration endpoints are intentionally not exposed per request.
# The server exposes plugin listing and event ingestion endpoints and a small in-process helper
# so task_executor can either call GET /plugins remotely or import main_helper.user_plugin_server.get_plugins
# if running in the same process.

@app.post("/plugin/testPlugin")
async def plugin_test_plugin(payload: Dict[str, Any], request: Request):
    """
    Minimal test plugin endpoint used for local testing (testUserPlugin).
    When invoked it emits an ERROR-level log so it's obvious in console output,
    and returns a clear JSON response for the caller.
    """
    try:
        # Log invocation at INFO level and avoid sending an ERROR; we'll forward the received message instead
        logger.info("testUserPlugin: testPlugin was invoked. client=%s", request.client.host if request.client else None)
        # Enqueue an event for inspection
        event = {
            "type": "plugin_invoked",
            "plugin_id": "testPlugin",
            "payload": payload,
            "client": request.client.host if request.client else None,
            "received_at": _now_iso()
        }
        try:
            _event_queue.put_nowait(event)
        except asyncio.QueueFull:
            try:
                _ = _event_queue.get_nowait()
            except Exception:
                pass
            try:
                _event_queue.put_nowait(event)
            except Exception:
                logger.warning("testUserPlugin: failed to enqueue plugin event")
        # Prepare message to forward: prefer explicit "message" field, otherwise forward full payload
        forwarded = payload.get("message") if isinstance(payload, dict) and "message" in payload else payload
        return JSONResponse({"success": True, "forwarded_message": forwarded, "received": payload})
    except Exception as e:
        logger.exception("testUserPlugin: plugin handler error")
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("startup")
async def _startup_load_plugins():
    """
    服务启动时，从 TOML 配置加载插件。
    """
    _load_plugins_from_toml()
    logger.info("Plugin registry after startup: %s", list(_plugins.keys()))

# New endpoint: /plugin/trigger
# This endpoint is intended to be called by TaskExecutor (or other components) when a plugin should be triggered.
# Expected JSON body:
#   {
#       "plugin_id": "thePluginId",
#       "args": { ... }    # optional object with plugin-specific arguments
#   }
#
# Behavior:
# - Validate plugin_id presence
# - Enqueue a standardized event into _event_queue for inspection/processing
# - Return JSON response summarizing the accepted event
@app.post("/plugin/trigger")
async def plugin_trigger(payload: Dict[str, Any], request: Request):
    """
    Endpoint for receiving plugin trigger requests from TaskExecutor.
    """
    try:
        client_host = request.client.host if request.client else None

        if isinstance(payload, dict):
            plugin_id = payload.get("plugin_id") or payload.get("id")
            args = payload.get("args") or {}
            task_id = payload.get("task_id") or payload.get("id") or None
        if not plugin_id or not isinstance(plugin_id, str):
            raise HTTPException(status_code=400, detail="plugin_id (string) required")

        # 构建事件
        event = {
            "type": "plugin_triggered",
            "plugin_id": plugin_id,
            "args": args,
            "task_id": task_id,
            "client": client_host,
            "received_at": _now_iso()
        }

        # Enqueue with bounded queue behavior
        try:
            _event_queue.put_nowait(event)
        except asyncio.QueueFull:
            try:
                _ = _event_queue.get_nowait()
            except Exception:
                pass
            try:
                _event_queue.put_nowait(event)
            except Exception:
                logger.warning("plugin_trigger: failed to enqueue event for plugin_id=%s", plugin_id)
                return JSONResponse({"success": False, "error": "event queue full"}, status_code=503)
        logger.info("plugin_trigger: enqueued event for plugin_id=%s from client=%s", plugin_id, client_host)
        logger.info(f"details:{event}")
        plugin_response: Any = None
        plugin_error: Optional[Dict[str, Any]] = None

        # 查找插件实例并调用方法
        instance = _plugin_instances.get(plugin_id)
        if instance is not None:
            try:
                handler = getattr(instance, "run", None)
                if callable(handler):
                    if inspect.iscoroutinefunction(handler):
                        plugin_response = await handler(**(args or {}))
                    else:
                        plugin_response = handler(**(args or {}))
                else:
                    logger.warning("plugin_trigger: plugin %s has no callable .run, skipping in-process call", plugin_id)
            except Exception as e:
                logger.exception("plugin_trigger: error calling in-process plugin %s", plugin_id)
                plugin_error = {"error": str(e)}

        resp: Dict[str, Any] = {
            "success": True,
            "plugin_id": plugin_id,
            "args": args,
            "received_at": event["received_at"],
        }

        if plugin_response is not None:
            resp["plugin_response"] = plugin_response
        if plugin_error is not None:
            resp["plugin_forward_error"] = plugin_error

        return JSONResponse(resp)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("plugin_trigger: unexpected error")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=USER_PLUGIN_SERVER_PORT)
