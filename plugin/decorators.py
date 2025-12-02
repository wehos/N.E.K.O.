# neko_plugin_core/decorators.py
from typing import Type, Callable
from .plugin_base import PluginMeta, NEKO_PLUGIN_META_ATTR
from .entry_base import EntryMeta

# def plugin_entry(
#     id: str,
#     name: str,
#     description: str = "",
#     input_schema: dict | None = None,
#     kind: str = "action",      # "action" 或 "service"
#     auto_start: bool = False,
# ):
#     """给插件内部的方法打入口标记."""
#     def decorator(fn: Callable):
#         meta = EntryMeta(
#             id=id,
#             name=name,
#             description=description,
#             input_schema=input_schema or {},
#             kind=kind,              # "service" or "action"
#             auto_start=auto_start,
#         )
#         setattr(fn, "__neko_entry_meta__", meta)
#         return fn
#     return decorator

NEKO_PLUGIN_TAG = "__neko_plugin__"

def neko_plugin(cls):
    """
    简单版插件装饰器：
    - 不接收任何参数
    - 只给类打一个标记，方便将来校验 / 反射
    元数据（id/name/description/version 等）全部从 plugin.toml 读取。
    """
    setattr(cls, NEKO_PLUGIN_TAG, True)
    return cls