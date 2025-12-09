from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import threading

from plugin.server_base import state

logger = logging.getLogger("user_plugin_server")

# 插件状态表与锁
_plugin_status: Dict[str, Dict[str, Any]] = {}
_plugin_status_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _apply_status_update(plugin_id: str, status: Dict[str, Any], source: str) -> None:
    """统一落地插件状态的内部工具函数。"""
    if not plugin_id:
        return
    with _plugin_status_lock:
        _plugin_status[plugin_id] = {
            "plugin_id": plugin_id,
            "status": status,
            "updated_at": _now_iso(),
            "source": source,
        }
    logger.info("插件id:%s  插件状态:%s", plugin_id, _plugin_status[plugin_id])


def update_plugin_status(plugin_id: str, status: Dict[str, Any]) -> None:
    """由同进程代码调用：直接在主进程内更新状态。"""
    _apply_status_update(plugin_id, status, source="main_process_direct")


def get_plugin_status(plugin_id: Optional[str] = None) -> Dict[str, Any]:
    """
    在进程内获取当前插件运行状态。
    - plugin_id 为 None：返回 {plugin_id: status, ...}
    - 否则只返回该插件状态（可能为空 dict）
    """
    with _plugin_status_lock:
        if plugin_id is None:
            return {pid: s.copy() for pid, s in _plugin_status.items()}
        return _plugin_status.get(plugin_id, {}).copy()


async def _status_consumer():
    """轮询子进程上报的状态并落库到本进程内存表。"""
    while True:
        for pid, host in state.plugin_hosts.items():
            try:
                while not host.status_queue.empty():
                    msg = host.status_queue.get_nowait()
                    if msg.get("type") == "STATUS_UPDATE":
                        _apply_status_update(
                            plugin_id=msg["plugin_id"],
                            status=msg["data"],
                            source="child_process",
                        )
            except Exception:
                logger.exception("Error consuming status for plugin %s", pid)
        await asyncio.sleep(1)
