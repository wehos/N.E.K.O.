from __future__ import annotations

import asyncio
import importlib
import inspect
import logging
import multiprocessing
import threading
import uuid
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict
from multiprocessing import Queue
from queue import Empty

from plugin.event_base import EVENT_META_ATTR
from plugin.server_base import PluginContext


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _plugin_process_runner(
    plugin_id: str,
    entry_point: str,
    config_path: Path,
    cmd_queue: Queue,
    res_queue: Queue,
    status_queue: Queue,
) -> None:
    """
    独立进程中的运行函数，负责加载插件、映射入口、处理命令并返回结果。
    """
    logging.basicConfig(level=logging.INFO, format=f"[Proc-{plugin_id}] %(message)s")
    logger = logging.getLogger(f"plugin.{plugin_id}")

    try:
        module_path, class_name = entry_point.split(":", 1)
        mod = importlib.import_module(module_path)
        cls = getattr(mod, class_name)

        ctx = PluginContext(
            plugin_id=plugin_id,
            logger=logger,
            config_path=config_path,
            status_queue=status_queue,
        )
        instance = cls(ctx)

        entry_map: Dict[str, Any] = {}
        events_by_type: Dict[str, Dict[str, Any]] = {}

        # 扫描方法映射
        for name, member in inspect.getmembers(instance, predicate=callable):
            if name.startswith("_") and not hasattr(member, EVENT_META_ATTR):
                continue
            event_meta = getattr(member, EVENT_META_ATTR, None)
            if not event_meta and hasattr(member, "__wrapped__"):
                event_meta = getattr(member.__wrapped__, EVENT_META_ATTR, None)

            if event_meta:
                eid = getattr(event_meta, "id", name)
                entry_map[eid] = member
                etype = getattr(event_meta, "event_type", "plugin_entry")
                events_by_type.setdefault(etype, {})
                events_by_type[etype][eid] = member
            else:
                entry_map[name] = member

        logger.info("Plugin instance created. Mapped entries: %s", list(entry_map.keys()))

        # 生命周期：startup
        lifecycle_events = events_by_type.get("lifecycle", {})
        startup_fn = lifecycle_events.get("startup")
        if startup_fn:
            try:
                if asyncio.iscoroutinefunction(startup_fn):
                    asyncio.run(startup_fn())
                else:
                    startup_fn()
            except Exception:
                logger.exception("Error in lifecycle.startup")

        # 定时任务：timer auto_start interval
        def _run_timer_interval(fn, interval_seconds: int, fn_name: str, stop_event: threading.Event):
            while not stop_event.is_set():
                try:
                    if asyncio.iscoroutinefunction(fn):
                        asyncio.run(fn())
                    else:
                        fn()
                except Exception:
                    logger.exception("Timer '%s' failed", fn_name)
                stop_event.wait(interval_seconds)

        timer_events = events_by_type.get("timer", {})
        for eid, fn in timer_events.items():
            meta = getattr(fn, EVENT_META_ATTR, None)
            if not meta or not getattr(meta, "auto_start", False):
                continue
            mode = getattr(meta, "extra", {}).get("mode")
            if mode == "interval":
                seconds = getattr(meta, "extra", {}).get("seconds", 0)
                if seconds > 0:
                    stop_event = threading.Event()
                    t = threading.Thread(
                        target=_run_timer_interval,
                        args=(fn, seconds, eid, stop_event),
                        daemon=True,
                    )
                    t.start()
                    logger.info("Started timer '%s' every %ss", eid, seconds)

        # 命令循环
        while True:
            try:
                msg = cmd_queue.get(timeout=1.0)
            except Empty:
                continue

            if msg["type"] == "STOP":
                break

            if msg["type"] == "TRIGGER":
                entry_id = msg["entry_id"]
                args = msg["args"]
                req_id = msg["req_id"]
                method = entry_map.get(entry_id) or getattr(instance, entry_id, None) or getattr(
                    instance, f"entry_{entry_id}", None
                )

                ret_payload = {"req_id": req_id, "success": False, "data": None, "error": None}

                try:
                    if not method:
                        raise AttributeError(f"Method {entry_id} not found in plugin")
                    logger.info("Executing entry '%s' using method '%s'", entry_id, getattr(method, "__name__", entry_id))
                    if asyncio.iscoroutinefunction(method):
                        res = asyncio.run(method(**args))
                    else:
                        try:
                            res = method(**args)
                        except TypeError:
                            res = method(args)
                    ret_payload["success"] = True
                    ret_payload["data"] = res
                except Exception as e:
                    logger.exception("Error executing %s", entry_id)
                    ret_payload["error"] = str(e)

                res_queue.put(ret_payload)

    except Exception:
        logging.getLogger("user_plugin_server").exception("Process crashed")


class PluginProcessHost:
    """负责启动/管理插件子进程并通过队列通信。"""

    def __init__(self, plugin_id: str, entry_point: str, config_path: Path):
        self.plugin_id = plugin_id
        self.cmd_queue: Queue = multiprocessing.Queue()
        self.res_queue: Queue = multiprocessing.Queue()
        self.status_queue: Queue = multiprocessing.Queue()
        self._pending_results: Dict[str, Any] = {}
        self.process = multiprocessing.Process(
            target=_plugin_process_runner,
            args=(plugin_id, entry_point, config_path, self.cmd_queue, self.res_queue, self.status_queue),
            daemon=False,
        )
        self.process.start()

    def shutdown(self, timeout: float = 5.0) -> None:
        """优雅关闭插件进程。"""
        try:
            self.cmd_queue.put({"type": "STOP"}, timeout=1.0)
            self.process.join(timeout=timeout)
            if self.process.is_alive():
                logging.getLogger("user_plugin_server").warning(
                    "Plugin %s didn't stop gracefully, terminating", self.plugin_id
                )
                self.process.terminate()
                self.process.join(timeout=1.0)
        except Exception:
            logging.getLogger("user_plugin_server").exception("Error shutting down plugin %s", self.plugin_id)

    async def trigger(self, entry_id: str, args: dict, timeout: float = 10.0):
        """发送 TRIGGER 命令到子进程并等待结果。"""
        req_id = str(uuid.uuid4())
        self.cmd_queue.put({"type": "TRIGGER", "req_id": req_id, "entry_id": entry_id, "args": args})

        loop = asyncio.get_running_loop()
        start = time.time()

        while time.time() - start < timeout:
            cached = self._pending_results.pop(req_id, None)
            if cached is not None:
                if cached["success"]:
                    return cached["data"]
                raise Exception(cached["error"])

            try:
                res = await loop.run_in_executor(None, self._get_result_safe)
                if not res:
                    continue

                if res["req_id"] == req_id:
                    if res["success"]:
                        return res["data"]
                    raise Exception(res["error"])

                self._pending_results[res["req_id"]] = res
            except Empty:
                await asyncio.sleep(0.05)
        raise TimeoutError("Plugin execution timed out")

    def _get_result_safe(self):
        try:
            return self.res_queue.get_nowait()
        except Empty:
            return None
