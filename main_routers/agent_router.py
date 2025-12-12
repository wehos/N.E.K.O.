# -*- coding: utf-8 -*-
"""
Agent Router

Handles agent-related endpoints including:
- Agent flags
- Health checks
- Task status
- Admin control
"""

import logging

from fastapi import APIRouter, Request, Body
from fastapi.responses import JSONResponse
import httpx

from .shared_state import get_session_manager, get_config_manager
from config import TOOL_SERVER_PORT, USER_PLUGIN_SERVER_PORT
from datetime import datetime

router = APIRouter(prefix="/api/agent", tags=["agent"])
logger = logging.getLogger("Main")


# Key mappings: frontend ↔ internal
# Frontend uses: enable_cu, enable_mcp, enable_up
# Internal uses: computer_use_enabled, mcp_enabled, agent_enabled
FRONTEND_TO_INTERNAL = {
    'enable_cu': 'computer_use_enabled',
    'enable_mcp': 'mcp_enabled',
    'enable_up': 'agent_enabled',
    # Also accept internal keys directly for new clients
    'computer_use_enabled': 'computer_use_enabled',
    'mcp_enabled': 'mcp_enabled',
    'agent_enabled': 'agent_enabled',
}

INTERNAL_TO_FRONTEND = {
    'computer_use_enabled': 'enable_cu',
    'mcp_enabled': 'enable_mcp',
    'agent_enabled': 'enable_up',
}


@router.post('/flags')
async def update_agent_flags(request: Request):
    """来自前端的Agent开关更新，级联到各自的session manager。"""
    session_manager = get_session_manager()
    _config_manager = get_config_manager()
    
    try:
        data = await request.json()
        _, her_name_current, _, _, _, _, _, _, _, _ = _config_manager.get_character_data()
        lanlan = data.get('lanlan_name') or her_name_current
        flags = data.get('flags') or {}
        mgr = session_manager.get(lanlan)
        if not mgr:
            return JSONResponse({"success": False, "error": "lanlan not found"}, status_code=404)
        # Update core flags first
        mgr.update_agent_flags(flags)
        # Forward to tool server for MCP/Computer-Use flags
        try:
            forward_payload = {}
            if 'mcp_enabled' in flags:
                forward_payload['mcp_enabled'] = bool(flags['mcp_enabled'])
            if 'computer_use_enabled' in flags:
                forward_payload['computer_use_enabled'] = bool(flags['computer_use_enabled'])
            # Forward user_plugin_enabled as well so agent_server receives UI toggles
            if 'user_plugin_enabled' in flags:
                forward_payload['user_plugin_enabled'] = bool(flags['user_plugin_enabled'])
            if forward_payload:
                async with httpx.AsyncClient(timeout=0.7) as client:
                    r = await client.post(f"http://localhost:{TOOL_SERVER_PORT}/agent/flags", json=forward_payload)
                    if not r.is_success:
                        raise Exception(f"tool_server responded {r.status_code}")
        except Exception as e:
            # On failure, reset flags in core to safe state (include user_plugin flag)
            mgr.update_agent_flags({'agent_enabled': False, 'computer_use_enabled': False, 'mcp_enabled': False, 'user_plugin_enabled': False})
            return JSONResponse({"success": False, "error": f"tool_server forward failed: {e}"}, status_code=502)
        return {"success": True}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


@router.get('/flags')
async def get_agent_flags():
    """获取当前 agent flags 状态（供前端同步）"""
    try:
        async with httpx.AsyncClient(timeout=0.7) as client:
            r = await client.get(f"http://localhost:{TOOL_SERVER_PORT}/agent/flags")
            if not r.is_success:
                return JSONResponse({"success": False, "error": "tool_server down"}, status_code=502)
            return r.json()
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=502)


@router.get('/health')
async def agent_health():
    """Check tool_server health via main_server proxy."""
    try:
        async with httpx.AsyncClient(timeout=0.7) as client:
            r = await client.get(f"http://localhost:{TOOL_SERVER_PORT}/health")
            if not r.is_success:
                return JSONResponse({"status": "down"}, status_code=502)
            data = {}
            try:
                data = r.json()
            except Exception:
                pass
            return {"status": "ok", **({"tool": data} if isinstance(data, dict) else {})}
    except Exception:
        return JSONResponse({"status": "down"}, status_code=502)


@router.get('/computer_use/availability')
async def proxy_cu_availability():
    """Check Computer Use availability"""
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            r = await client.get(f"http://localhost:{TOOL_SERVER_PORT}/computer_use/availability")
            if not r.is_success:
                return JSONResponse({"ready": False, "reasons": [f"tool_server responded {r.status_code}"]}, status_code=502)
            return r.json()
    except Exception as e:
        return JSONResponse({"ready": False, "reasons": [f"proxy error: {e}"]}, status_code=502)


@router.get('/mcp/availability')
async def proxy_mcp_availability():
    """Check MCP availability"""
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            r = await client.get(f"http://localhost:{TOOL_SERVER_PORT}/mcp/availability")
            if not r.is_success:
                return JSONResponse({"ready": False, "reasons": [f"tool_server responded {r.status_code}"]}, status_code=502)
            return r.json()
    except Exception as e:
        return JSONResponse({"ready": False, "reasons": [f"proxy error: {e}"]}, status_code=502)


@router.get('/user_plugin/availability')
async def proxy_up_availability():
    """Check User Plugin availability"""
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            r = await client.get(f"http://localhost:{USER_PLUGIN_SERVER_PORT}/available")
            if r.is_success:
                return JSONResponse({"ready": True, "reasons": ["user_plugin server reachable"]}, status_code=200)
            else:
                return JSONResponse({"ready": False, "reasons": [f"user_plugin server responded {r.status_code}"]}, status_code=502)
    except Exception as e:
        return JSONResponse({"ready": False, "reasons": [f"proxy error: {e}"]}, status_code=502)


@router.get('/tasks')
async def proxy_tasks():
    """Get all tasks from tool server via main_server proxy."""
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            r = await client.get(f"http://localhost:{TOOL_SERVER_PORT}/tasks")
            if not r.is_success:
                return JSONResponse({"tasks": [], "error": f"tool_server responded {r.status_code}"}, status_code=502)
            return r.json()
    except Exception as e:
        return JSONResponse({"tasks": [], "error": f"proxy error: {e}"}, status_code=502)


@router.get('/tasks/{task_id}')
async def proxy_task_detail(task_id: str):
    """Get specific task details from tool server via main_server proxy."""
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            r = await client.get(f"http://localhost:{TOOL_SERVER_PORT}/tasks/{task_id}")
            if not r.is_success:
                return JSONResponse({"error": f"tool_server responded {r.status_code}"}, status_code=502)
            return r.json()
    except Exception as e:
        return JSONResponse({"error": f"proxy error: {e}"}, status_code=502)


@router.get('/task_status')
async def get_task_status():
    """Get current task status for frontend polling - returns all tasks with their current status."""
    try:
        # Get tasks from tool server using async client with increased timeout
        async with httpx.AsyncClient(timeout=2.5) as client:
            r = await client.get(f"http://localhost:{TOOL_SERVER_PORT}/tasks")
            if not r.is_success:
                return JSONResponse({"tasks": [], "error": f"tool_server responded {r.status_code}"}, status_code=502)
            
            tasks_data = r.json()
            tasks = tasks_data.get("tasks", [])
            debug_info = tasks_data.get("debug", {})
            
            # Enhance task data with additional information if needed
            enhanced_tasks = []
            for task in tasks:
                enhanced_task = {
                    "id": task.get("id"),
                    "status": task.get("status", "unknown"),
                    "type": task.get("type", "unknown"),
                    "lanlan_name": task.get("lanlan_name"),
                    "start_time": task.get("start_time"),
                    "end_time": task.get("end_time"),
                    "params": task.get("params", {}),
                    "result": task.get("result"),
                    "error": task.get("error"),
                    "source": task.get("source", "unknown")
                }
                enhanced_tasks.append(enhanced_task)
            
            return {
                "success": True,
                "tasks": enhanced_tasks,
                "total_count": len(enhanced_tasks),
                "running_count": len([t for t in enhanced_tasks if t.get("status") == "running"]),
                "queued_count": len([t for t in enhanced_tasks if t.get("status") == "queued"]),
                "completed_count": len([t for t in enhanced_tasks if t.get("status") == "completed"]),
                "failed_count": len([t for t in enhanced_tasks if t.get("status") == "failed"]),
                "timestamp": datetime.now().isoformat(),
                "debug": debug_info
            }
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "tasks": [],
            "error": f"Failed to fetch task status: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }, status_code=500)


@router.post('/admin/control')
async def proxy_admin_control(payload: dict = Body(...)):
    """Proxy admin control commands to tool server."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(f"http://localhost:{TOOL_SERVER_PORT}/admin/control", json=payload)
            if not r.is_success:
                return JSONResponse({"success": False, "error": f"tool_server responded {r.status_code}"}, status_code=502)
            
            result = r.json()
            logger.info(f"Admin control result: {result}")
            return result
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": f"Failed to execute admin control: {str(e)}"
        }, status_code=500)
