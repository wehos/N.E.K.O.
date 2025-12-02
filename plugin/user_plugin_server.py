from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from config import USER_PLUGIN_SERVER_PORT
app = FastAPI(title="N.E.K.O User Plugin Server")

logger = logging.getLogger("user_plugin_server")
logging.basicConfig(level=logging.INFO)

# In-memory plugin registry (initially empty). Plugins are dicts with keys:
# { "id": str, "name": str, "description": str, "endpoint": str, "input_schema": dict }
# Registration endpoints are intentionally not implemented now.
_plugins: Dict[str, Dict[str, Any]] = {}

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
        # If no plugins registered, expose a simple test plugin for local testing (testUserPlugin)
        # if not _plugins:
        test_plugin = {
                "id": "testPlugin",
                "name": "Test Plugin",
                "description": "testUserPlugin: minimal plugin used for local testing — will respond with an ERROR-level notice when called",
                "endpoint": f"http://localhost:{USER_PLUGIN_SERVER_PORT}/plugin/testPlugin",
                "input_schema": {"type": "object", "properties": {"message": {"type": "string"}}}}
        return [test_plugin]
        #return {"plugins": list(_plugins.values()), "count": len(_plugins)}
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
    Accepts JSON with keys: plugin_id (str) and args (object, optional).
    Special-case: if plugin_id == "testPlugin", immediately forward the call to /plugin/testPlugin
    and include that plugin's response (if any) in the returned JSON (best-effort).
    """
    try:
        client_host = request.client.host if request.client else None
        plugin_id = None
        args = None
        task_id = None
        if isinstance(payload, dict):
            plugin_id = payload.get("plugin_id") or payload.get("id")
            args = payload.get("args") or {}
            task_id = payload.get("task_id") or payload.get("id") or None
        if not plugin_id or not isinstance(plugin_id, str):
            raise HTTPException(status_code=400, detail="plugin_id (string) required")
        # Build event
        event = {
            "type": "plugin_triggered",
            "plugin_id": plugin_id,
            "args": args,
            "task_id": task_id,
            "client": client_host,
            "received_at": _now_iso()
        }
        # Enqueue with bounded queue behavior (drop oldest if full)
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

        # If this is the testPlugin, do a best-effort immediate internal forward to /plugin/testPlugin
        plugin_response = None
        plugin_error = None
        if plugin_id == "testPlugin":
            try:
                import httpx
                forward_payload = {}
                # Prefer sending explicit "message" if present in args, otherwise send {"task_id","args"}
                if isinstance(args, dict) and "message" in args:
                    forward_payload = {"message": args.get("message")}
                else:
                    forward_payload = {"task_id": task_id, "args": args}
                internal_url = f"http://localhost:{USER_PLUGIN_SERVER_PORT}/plugin/testPlugin"
                logger.info("plugin_trigger: forwarding to internal testPlugin at %s with payload %s", internal_url, forward_payload)
                timeout = httpx.Timeout(3.0, connect=1.0)
                async with httpx.AsyncClient(timeout=timeout) as client:
                    r = await client.post(internal_url, json=forward_payload)
                    try:
                        plugin_response = r.json()
                    except Exception:
                        plugin_response = {"raw_text": r.text}
                    if not (200 <= r.status_code < 300):
                        plugin_error = {"status_code": r.status_code, "text": r.text}
            except Exception as e:
                plugin_error = {"error": str(e)}
                logger.warning("plugin_trigger: internal forward to testPlugin failed: %s", e)

        resp = {"success": True, "plugin_id": plugin_id, "args": args, "received_at": event["received_at"]}
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
