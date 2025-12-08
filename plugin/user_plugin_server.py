from dataclasses import dataclass
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.responses import JSONResponse
import asyncio
import threading
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from config import USER_PLUGIN_SERVER_PORT
from pathlib import Path
import importlib
import inspect
import multiprocessing
import traceback
from multiprocessing import Queue
from queue import Empty
import uuid
import time

from plugin.event_base import EventHandler,EVENT_META_ATTR
# Python 3.11 有 tomllib；低版本可用 tomli 兼容
try:
    import tomllib  # type: ignore[attr-defined]
except ImportError:  # pragma: no cover
    import tomli as tomllib  # type: ignore[no-redef]

app = FastAPI(title="N.E.K.O User Plugin Server")

logger = logging.getLogger("user_plugin_server")

@dataclass
class PluginContext:
    plugin_id: str
    config_path: Path
    logger:logging.Logger
    app: Optional[FastAPI] = None

# In-memory plugin registry (initially empty). Plugins are dicts with keys:
# { "id": str, "name": str, "description": str, "endpoint": str, "input_schema": dict }
# Registration endpoints are intentionally not implemented now.
_plugins: Dict[str, Dict[str, Any]] = {}
# In-memory plugin instances (id -> instance)
_plugin_instances: Dict[str, Any] = {}
_event_handlers: Dict[str, EventHandler] = {}
_plugin_status: Dict[str, Dict[str, Any]] = {}
_plugin_status_lock = threading.Lock()
# Mapping from (plugin_id, entry_id) -> actual python method name on the instance.
# Populated during plugin load to help server-side fallback when EventHandler lookup fails.
_timer_stop_flags: Dict[str, threading.Event] = {}
_plugin_entry_method_map: Dict[tuple, str] = {}
# Where to look for plugin.toml files: ./plugins/<any>/plugin.toml
PLUGIN_CONFIG_ROOT = Path(__file__).parent / "plugins"
# Simple bounded in-memory event queue for inspection
EVENT_QUEUE_MAX = 1000
_event_queue: asyncio.Queue = asyncio.Queue(maxsize=EVENT_QUEUE_MAX)

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

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

def update_plugin_status(plugin_id: str, status: Dict[str, Any]) -> None:
    """
    由插件调用：上报自己的运行状态（全量覆盖该插件的当前状态快照）。
    线程安全：支持在插件内部线程（比如 Tk 线程）里调用。
    """
    if not plugin_id:
        return
    with _plugin_status_lock:
        _plugin_status[plugin_id] = {
            **status,
            "plugin_id": plugin_id,
            "updated_at": _now_iso(),
        }
    logger.info(f"插件id:{plugin_id}  插件状态:{_plugin_status[plugin_id]}")
def get_plugin_status(plugin_id: Optional[str] = None) -> Dict[str, Any]:
    """
    在进程内获取当前插件运行状态。
    - plugin_id 为 None：返回 {plugin_id: status, ...}
    - 否则只返回该插件状态（可能为空 dict）
    """
    with _plugin_status_lock:
        if plugin_id is None:
            # 返回一份拷贝，避免外部意外修改
            return {pid: s.copy() for pid, s in _plugin_status.items()}
        return _plugin_status.get(plugin_id, {}).copy()
    
@app.get("/plugin/status")
async def plugin_status(plugin_id: Optional[str] = Query(default=None)):
    """
    查询插件运行状态：
    - GET /plugin/status                -> 所有插件状态
    - GET /plugin/status?plugin_id=xxx  -> 指定插件状态
    """
    try:
        if plugin_id:
            return {
                "plugin_id": plugin_id,
                "status": get_plugin_status(plugin_id),
                "time": _now_iso(),
            }
        else:
            return {
                "plugins": get_plugin_status(),  # {pid: status}
                "time": _now_iso(),
            }
    except Exception as e:
        logger.exception("Failed to get plugin status")
        raise HTTPException(status_code=500, detail=str(e)) from e
# --- 子进程运行函数 (独立运行在另一个进程空间) ---
def _plugin_process_runner(plugin_id: str, entry_point: str, config_path: Path, 
                           cmd_queue: Queue, res_queue: Queue, status_queue: Queue): # noqa: ARG001 - status_queue reserved for future use

    # 重新配置 Logger
    logging.basicConfig(level=logging.INFO, format=f'[Proc-{plugin_id}] %(message)s')
    logger = logging.getLogger(f"plugin.{plugin_id}")

    try:
        # 1. 动态加载
        module_path, class_name = entry_point.split(":", 1)
        mod = importlib.import_module(module_path)
        cls = getattr(mod, class_name)

        # 2. 实例化 (传入精简版 Context)
        ctx = PluginContext(plugin_id=plugin_id, logger=logger,config_path=config_path)
        instance = cls(ctx)
        entry_map = {}
        events_by_type: dict[str, dict[str, Any]] = {}
        logger.info(f"Plugin instance created. Waiting for commands.")
                # 1. 扫描装饰器 (@EventHandler)
        for name, member in inspect.getmembers(instance, predicate=callable):
            # 忽略私有方法，除非它是明确被装饰的
            if name.startswith("_") and not hasattr(member, EVENT_META_ATTR):
                continue

            # 获取元数据
            event_meta = getattr(member, EVENT_META_ATTR, None)
            if not event_meta and hasattr(member, "__wrapped__"):
                 event_meta = getattr(member.__wrapped__, EVENT_META_ATTR, None)

            if event_meta:
                
                # 如果有装饰器，用装饰器里的 ID (例如 "open")
                eid = getattr(event_meta, "id", name)
                entry_map[eid] = member
                # 新增：按 event_type 分组
                etype = getattr(event_meta, "event_type", "plugin_entry")
                events_by_type.setdefault(etype, {})
                events_by_type[etype][eid] = member
                
                logger.debug(f"Mapped entry '{eid}' -> method '{name}'")
            else:
                # 如果没有装饰器，也把方法名本身作为 ID 存进去，方便直接调用
                entry_map[name] = member

        logger.info(f"Plugin instance created. Mapped entries: {list(entry_map.keys())}")
        # ==========================================
        # ========== 2. 生命周期事件：startup ==========
        lifecycle_events = events_by_type.get("lifecycle", {})
        startup_fn = lifecycle_events.get("startup")
        if startup_fn:
            logger.info("Calling lifecycle.startup()")
            try:
                if asyncio.iscoroutinefunction(startup_fn):
                    asyncio.run(startup_fn())
                else:
                    startup_fn()
            except Exception as e:
                logger.exception(f"Error in lifecycle.startup: {e}")

        # ========== 3. 定时任务：timer ==========
        def _run_timer_interval(fn, interval_seconds: int, fn_name: str, stop_event: threading.Event):
            while not stop_event.is_set():
                try:
                    if asyncio.iscoroutinefunction(fn):
                        asyncio.run(fn())
                    else:
                        fn()
                except Exception as e:
                    logger.exception("Timer '%s' failed", fn_name)
                # 用 wait 方便将来优雅停止喵
                stop_event.wait(interval_seconds)

        timer_events = events_by_type.get("timer", {})
        for eid, fn in timer_events.items():
            meta = getattr(fn, EVENT_META_ATTR, None)
            if not meta:
                continue
            if not getattr(meta, "auto_start", False):
                continue
            mode = getattr(meta, "extra", {}).get("mode")
            if mode == "interval":
                seconds = getattr(meta, "extra", {}).get("seconds", 0)
                if seconds > 0:
                    stop_event = threading.Event()
                    # 这里如果需要的话也可以记到 _timer_stop_flags 里备用喵：
                    # _timer_stop_flags[f"{plugin_id}.{eid}"] = stop_event
                    t = threading.Thread(
                        target=_run_timer_interval,
                        args=(fn, seconds, eid, stop_event),
                        daemon=True,
                    )
                    t.start()
                    logger.info(f"Started timer '{eid}' every {seconds}s")
            # 如果以后要支持 cron，可以在这里加 mode == "cron" 的分支
        # 3. 命令循环
        while True:
            try:
                msg = cmd_queue.get(timeout=1.0)
            except Empty:
                continue

            if msg['type'] == 'STOP':
                break
            
            if msg['type'] == 'TRIGGER':
                # 执行具体方法...
                entry_id = msg['entry_id']
                args = msg['args']
                req_id = msg['req_id']
                
                method = entry_map.get(entry_id)
                # 简单反射查找方法
                if not method:
                    method = getattr(instance, entry_id, None)
                if not method:
                    # 尝试 fallback 命名
                    method = getattr(instance, f"entry_{entry_id}", None)

                ret_payload = {"req_id": req_id, "success": False, "data": None, "error": None}
                
                try:
                    if not method:
                        raise AttributeError(f"Method {entry_id} not found in plugin")
                    logger.info(f"Executing entry '{entry_id}' using method '{method.__name__}'")
                    if asyncio.iscoroutinefunction(method):
                        res = asyncio.run(method(**args))
                    else:
                        # 简单的参数调用尝试
                        try:
                            res = method(**args)
                        except TypeError:
                            res = method(args)
                    
                    ret_payload["success"] = True
                    ret_payload["data"] = res
                except Exception as e:
                    logger.exception(f"Error executing {entry_id}: {e}")
                    ret_payload["error"] = str(e)
                
                res_queue.put(ret_payload)

    except Exception as e:
        logger.exception("Process crashed")

# --- 主进程控制类 ---
class PluginProcessHost:
    def __init__(self, plugin_id: str, entry_point: str, config_path: Path):
        self.plugin_id = plugin_id
        self.cmd_queue = multiprocessing.Queue()
        self.res_queue = multiprocessing.Queue()
        self.status_queue = multiprocessing.Queue()
        self._pending_results: Dict[str, Any] = {}
        self.process = multiprocessing.Process(
            target=_plugin_process_runner,
            args=(plugin_id, entry_point, config_path, 
                  self.cmd_queue, self.res_queue, self.status_queue),
            daemon=False
        )
        self.process.start()
    def shutdown(self, timeout: float = 5.0):
        """优雅关闭插件进程"""
        try:
            # 发送 STOP 命令通知插件进程停止
            self.cmd_queue.put({"type": "STOP"}, timeout=1.0)
            
            # 等待插件进程退出，给它一个合理的超时时间
            self.process.join(timeout=timeout)
            
            # 如果子进程还在运行，则强制终止
            if self.process.is_alive():
                logger.warning(f"Plugin {self.plugin_id} didn't stop gracefully, terminating")
                self.process.terminate()
                self.process.join(timeout=1.0)
        except Exception:
            logger.exception(f"Error shutting down plugin {self.plugin_id}")

    async def trigger(self, entry_id: str, args: dict, timeout: float = 10.0):
        req_id = str(uuid.uuid4())
        self.cmd_queue.put({
            "type": "TRIGGER", "req_id": req_id, 
            "entry_id": entry_id, "args": args
        })
        
        # 轮询获取结果 (为了不阻塞 EventLoop，使用 run_in_executor)
        loop = asyncio.get_running_loop()
        start = time.time()
        
        while time.time() - start < timeout:
            # 先看缓存：有没有别的协程已经帮我们把这个 req_id 的结果塞进来了喵
            cached = self._pending_results.pop(req_id, None)
            if cached is not None:
                if cached["success"]:
                    return cached["data"]
                raise Exception(cached["error"])

            try:
                # 再尝试从子进程队列捞一条新结果喵
                res = await loop.run_in_executor(None, self._get_result_safe)
                if not res:
                    continue

                if res["req_id"] == req_id:
                    if res["success"]:
                        return res["data"]
                    raise Exception(res["error"])

                # 不是当前请求的，就缓存起来给对应的 trigger 用
                self._pending_results[res["req_id"]] = res
            except Empty:
                await asyncio.sleep(0.05)
        raise TimeoutError("Plugin execution timed out")

    def _get_result_safe(self):
        try:
            return self.res_queue.get_nowait()
        except Empty:
            return None


_plugin_hosts: Dict[str, PluginProcessHost] = {} 
@app.get("/plugins")
async def list_plugins():
    """
    Return the list of known plugins.
    统一返回结构：
    {
        "plugins": [ ... ],
        "message": "..."
    }
    """
    try:
        result = []

        if _plugins:
            logger.info("加载插件列表成功")
            # 已加载的插件（来自 TOML），直接返回
            for plugin_id, plugin_meta in _plugins.items():
                plugin_info = plugin_meta.copy()  # Make a copy to modify
                plugin_info["entries"] = []
                # 处理每个 plugin 的 method，添加描述
                seen = set()  # 用于去重 (event_type, id)
                for key, eh in _event_handlers.items():
                    if not (key.startswith(f"{plugin_id}.") or key.startswith(f"{plugin_id}:plugin_entry:")):
                        continue
                    if getattr(eh.meta, "event_type", None) != "plugin_entry":
                        continue
                    # 去重判定键：优先使用 meta.id，再退回到 key
                    eid = getattr(eh.meta, "id", None) or key
                    dedup_key = (getattr(eh.meta, "event_type", "plugin_entry"), eid)
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)
                    # 安全获取各字段，避免缺属性时报错
                    returned_message = getattr(eh.meta, "return_message", "")
                    plugin_info["entries"].append({
                        "id": getattr(eh.meta, "id", eid),
                        "name": getattr(eh.meta, "name", ""),
                        "description": getattr(eh.meta, "description", ""),
                        "event_key": key,
                        "input_schema": getattr(eh.meta, "input_schema", {}),
                        "return_message": returned_message,
                    })
                result.append(plugin_info)

            logger.debug("Loaded plugins: %s", result)

            return {"plugins": result, "message": ""}

        else:
            logger.info("No plugins registered.")
            return {
                "plugins": [],
                "message": "no plugins registered"
            }

    except Exception as e:
        logger.exception("Failed to list plugins")
        raise HTTPException(status_code=500, detail=str(e)) from e


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
    扫描插件配置，启动子进程，并静态扫描元数据用于注册列表。
    """
    if not PLUGIN_CONFIG_ROOT.exists():
        logger.info("No plugin config directory %s, skipping", PLUGIN_CONFIG_ROOT)
        return

    logger.info("Loading plugins from %s", PLUGIN_CONFIG_ROOT)
    for toml_path in PLUGIN_CONFIG_ROOT.glob("*/plugin.toml"):
        try:
            # 1. 解析 TOML
            with toml_path.open("rb") as f:
                conf = tomllib.load(f)
            pdata = conf.get("plugin") or {}
            pid = pdata.get("id")
            if not pid: continue
            
            entry = pdata.get("entry") # e.g. "plugins.demo:DemoPlugin"
            if not entry or ":" not in entry: continue

            # 2. 静态导入类 (用于提取元数据，不实例化)
            module_path, class_name = entry.split(":", 1)
            try:
                mod = importlib.import_module(module_path)
                cls = getattr(mod, class_name)
            except Exception as e:
                logger.exception(f"Failed to import plugin class {entry}: {e}")
                continue

            # 3. [关键步骤] 启动子进程宿主
            # 我们把 entry 字符串和配置路径传进去，让子进程自己去 import 和实例化
            try:
                host = PluginProcessHost(
                    plugin_id=pid,
                    entry_point=entry,
                    config_path=toml_path
                )
                _plugin_hosts[pid] = host
            except Exception as e:
                logger.exception(f"Failed to start process for plugin {pid}")
                continue

            # 4. [关键步骤] 静态扫描类中的元数据
            # 目的：填充 _event_handlers，这样 /plugins 接口依然能显示插件有哪些功能
            # 注意：这里的 handler 只是未绑定的函数，主进程绝对不能调用它！
            _scan_static_metadata(pid, cls, conf, pdata)

            # 5. 注册基础插件信息
            plugin_meta = {
                "id": pid,
                "name": pdata.get("name", pid),
                "description": pdata.get("description", ""),
                "version": pdata.get("version", "0.1.0"),
                # 如果类上有静态属性 input_schema，尝试获取，否则为空
                "input_schema": getattr(cls, "input_schema", {}) or {"type": "object", "properties": {}},
            }
            _register_plugin(plugin_meta)

            logger.info(f"Loaded plugin {pid} (Process PID: {host.process.pid})")

        except Exception:
            logger.exception("Failed to load plugin from %s", toml_path)
@dataclass
class SimpleEntryMeta:
    event_type: str = "plugin_entry"
    id: str = ""
    name: str = ""
    description: str = ""
    input_schema: dict = None
    
    def __post_init__(self):
        if self.input_schema is None:
            self.input_schema = {}
def _scan_static_metadata(pid: str, cls: type, conf: dict, pdata: dict):
    """
    辅助函数：在不实例化的情况下，扫描类属性获取 EventHandler 信息
    """
    # A. 扫描装饰器标记的方法 (@EventHandler)
    # inspect.getmembers 对类使用时，得到的是 Unbound Function
    for name, member in inspect.getmembers(cls):
        # 尝试获取装饰器留下的元数据
        event_meta = getattr(member, EVENT_META_ATTR, None)
        
        # 处理 functools.wraps 的情况
        if event_meta is None and hasattr(member, "__wrapped__"):
             event_meta = getattr(member.__wrapped__, EVENT_META_ATTR, None)

        if event_meta and getattr(event_meta, "event_type", None) == "plugin_entry":
            eid = getattr(event_meta, "id", name)
            
            # 注册到全局表 (用于 list_plugins 显示)
            # 注意：handler=member 此时是未绑定的函数，不能直接调用
            handler_obj = EventHandler(meta=event_meta, handler=member)
            _event_handlers[f"{pid}.{eid}"] = handler_obj
            _event_handlers[f"{pid}:plugin_entry:{eid}"] = handler_obj
            
            # 记录映射，方便 debug
            _plugin_entry_method_map[(pid, str(eid))] = name

    # B. 扫描 TOML 中的显式 entries 配置 (保持原逻辑兼容)
    entries = conf.get("entries") or pdata.get("entries") or []
    for ent in entries:
        try:
            eid = ent.get("id") if isinstance(ent, dict) else str(ent)
            if not eid: continue
            
            # 尝试看类里有没有对应名字的方法
            handler_fn = getattr(cls, eid, None)
            
            # 构造虚拟 Meta

            entry_meta = SimpleEntryMeta(
                id=eid,
                name=ent.get("name", "") if isinstance(ent, dict) else "",
                description=ent.get("description", "") if isinstance(ent, dict) else "",
                input_schema=ent.get("input_schema", {}) if isinstance(ent, dict) else {},
            )
            # 即使 handler_fn 为 None (纯配置定义)，我们也注册，保证 /plugins 能看到
            eh = EventHandler(meta=entry_meta, handler=handler_fn) 
            _event_handlers[f"{pid}.{eid}"] = eh
            _event_handlers[f"{pid}:plugin_entry:{eid}"] = eh
        except Exception:
            logger.exception(f"Error parsing entry {ent} for {pid}")

# NOTE: Registration endpoints are intentionally not exposed per request.
# The server exposes plugin listing and event ingestion endpoints and a small in-process helper
# so task_executor can either call GET /plugins remotely or import main_helper.user_plugin_server.get_plugins
# if running in the same process.

@app.on_event("startup")
async def _startup_load_plugins():
    """
    服务启动时，从 TOML 配置加载插件。
    """
    _load_plugins_from_toml()
    logger.info("Plugin registry after startup: %s", list(_plugins.keys()))
    # Startup diagnostics: list available plugin instances and their public methods to aid debugging
    try:
        if _plugin_instances:
            logger.info(f"startup-diagnostics: plugin instances loaded: {list(_plugin_instances.keys())}")
            for pid, pobj in list(_plugin_instances.items()):
                try:
                    methods = [m for m in dir(pobj) if callable(getattr(pobj, m)) and not m.startswith('_')]
                except Exception:
                    methods = []
                logger.info(f"startup-diagnostics: instance '{pid}' methods: {methods}")
        else:
            logger.info("startup-diagnostics: no plugin instances loaded")
    except Exception:
        logger.exception("startup-diagnostics: failed to enumerate plugin instances")

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

@app.on_event("shutdown")
async def shutdown_plugins():
    """在应用关闭时，优雅地关闭所有插件"""
    for plugin_host in _plugin_hosts.values():
        plugin_host.shutdown(timeout=5.0)
    logger.info("All plugins have been gracefully shutdown.")

@app.post("/plugin/trigger")
async def plugin_trigger(payload: Dict[str, Any], request: Request):
    """
    触发指定插件的指定 entry（前端约定只会传以下结构）：
    {
        "task_id": "xxx",          # 可选
        "plugin_id": "tkWindow",   # 必填
        "entry_id": "open",        # 必填：要调用的插件 entry id
        "args": { ... }            # 可选：entry 需要的参数
    }
    """
    try:
        # --- 1. 基础校验 (保持不变) ---
        client_host = request.client.host if request.client else None

        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="JSON body must be an object")

        plugin_id = payload.get("plugin_id")
        if not plugin_id or not isinstance(plugin_id, str):
            raise HTTPException(status_code=400, detail="plugin_id (string) required")

        entry_id = payload.get("entry_id")
        if not entry_id or not isinstance(entry_id, str):
            raise HTTPException(status_code=400, detail="entry_id (string) required")

        args = payload.get("args") or {}
        if not isinstance(args, dict):
            raise HTTPException(status_code=400, detail="args must be an object")

        task_id = payload.get("task_id")

        logger.info(
            "[plugin_trigger] plugin_id=%s entry_id=%s task_id=%s args=%s",
            plugin_id, entry_id, task_id, args
        )

        # --- 2. 审计日志/事件队列 (保持不变) ---
        event = {
            "type": "plugin_triggered",
            "plugin_id": plugin_id,
            "entry_id": entry_id,
            "args": args,
            "task_id": task_id,
            "client": client_host,
            "received_at": _now_iso(),
        }
        try:
            if _event_queue: # 简单判空防止未初始化报错
                _event_queue.put_nowait(event)
        except asyncio.QueueFull:
            try:
                _event_queue.get_nowait()
                _event_queue.put_nowait(event)
            except Exception:
                logger.debug("Event queue operation failed, event dropped")
        except Exception:
            # 队列报错不应影响主流程
            logger.debug("Event queue error, continuing without queueing")
        # --- 3. [核心修改] 使用 ProcessHost 进行跨进程调用 ---
        
        # 不再查找 _plugin_instances，而是查找进程宿主 _plugin_hosts
        host = _plugin_hosts.get(plugin_id)
        if not host:
            raise HTTPException(status_code=404, detail=f"Plugin '{plugin_id}' is not running/loaded")

        plugin_response: Any = None
        plugin_error: Optional[Dict[str, Any]] = None

        try:
            # 调用宿主对象的 trigger 方法，它会负责将消息发送给子进程并等待结果
            # 注意：参数校验、反射调用、sync/async 兼容处理都在子进程里完成了
            plugin_response = await host.trigger(entry_id, args, timeout=30.0) 

        except TimeoutError:
             plugin_error = {"error": "Plugin execution timed out"}
             logger.error(f"Plugin {plugin_id} entry {entry_id} timed out")
        except Exception as e:
            # 这里的异常可能是 host.trigger 抛出的（子进程报错传回来的，或者通信错误）
            logger.exception(
                "plugin_trigger: error invoking plugin %s via IPC",
                plugin_id
            )
            plugin_error = {"error": str(e)}

        # --- 4. 构造响应 (保持原有格式兼容) ---
        resp: Dict[str, Any] = {
            "success": plugin_error is None,
            "plugin_id": plugin_id,
            "executed_entry": entry_id,
            "args": args,
            "plugin_response": plugin_response,
            "received_at": event["received_at"],
        }
        if plugin_error:
            resp["plugin_forward_error"] = plugin_error

        return JSONResponse(resp)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("plugin_trigger: unexpected error")
        raise HTTPException(status_code=500, detail=str(e)) from e
if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.DEBUG)
    host = "127.0.0.1"  # 默认只暴露本机喵
    uvicorn.run(app, host=host, port=USER_PLUGIN_SERVER_PORT)
