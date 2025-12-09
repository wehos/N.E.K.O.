from dataclasses import dataclass
from datetime import datetime, timezone
import asyncio
import logging
import threading
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI
from plugin.event_base import EventHandler

EVENT_QUEUE_MAX = 1000

@dataclass
class PluginContext:
    plugin_id: str
    config_path: Path
    logger: logging.Logger
    status_queue: Any
    app: Optional[FastAPI] = None

    def update_status(self, status: Dict[str, Any]) -> None:
        """
        子进程 / 插件内部调用：把原始 status 丢到主进程的队列里，由主进程统一整理。
        """
        try:
            payload = {
                "type": "STATUS_UPDATE",
                "plugin_id": self.plugin_id,
                "data": status,
                "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            self.status_queue.put_nowait(payload)
            # 这条日志爱要不要
            self.logger.info(f"Plugin {self.plugin_id} status updated: {payload}")
        except Exception as e:
            self.logger.exception(f"Error updating status for plugin {self.plugin_id}: {e}")


class PluginRuntimeState:
    def __init__(self):
        self.plugins: Dict[str, Dict[str, Any]] = {}
        self.plugin_instances: Dict[str, Any] = {}
        self.event_handlers: Dict[str, EventHandler] = {}
        self.plugin_status: Dict[str, Dict[str, Any]] = {}
        self.plugin_hosts: Dict[str, Any] = {}
        self.plugin_status_lock = threading.Lock()
        self.event_queue: asyncio.Queue = asyncio.Queue(maxsize=EVENT_QUEUE_MAX)


state = PluginRuntimeState()