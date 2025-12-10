"""
Pydantic 模型定义：用于 API 请求/响应和核心数据结构。
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


# API 请求/响应模型
class PluginTriggerRequest(BaseModel):
    """插件触发请求"""
    plugin_id: str
    entry_id: str
    args: Dict[str, Any] = {}
    task_id: Optional[str] = None


class PluginTriggerResponse(BaseModel):
    """插件触发响应"""
    success: bool
    plugin_id: str
    executed_entry: str
    args: Dict[str, Any]
    plugin_response: Any
    received_at: str
    plugin_forward_error: Optional[Dict[str, Any]] = None


# 核心数据结构
class PluginMeta(BaseModel):
    """插件元数据"""
    id: str
    name: str
    description: str = ""
    version: str = "0.1.0"
    input_schema: Dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})


class HealthCheckResponse(BaseModel):
    """健康检查响应"""
    alive: bool
    exitcode: Optional[int] = None
    pid: Optional[int] = None
    status: Literal["running", "stopped", "crashed"]
    communication: Dict[str, Any]

