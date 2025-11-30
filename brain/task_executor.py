# -*- coding: utf-8 -*-
"""
DirectTaskExecutor: 合并 Analyzer + Planner 的功能
并行评估 MCP 和 ComputerUse 可行性（两个独立 LLM 调用）
优先使用 MCP，其次使用 ComputerUse
"""
import json
import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from openai import AsyncOpenAI, APIConnectionError, InternalServerError, RateLimitError
from config import MODELS_WITH_EXTRA_BODY
from utils.config_manager import get_config_manager
from .mcp_client import McpRouterClient, McpToolCatalog
from .computer_use import ComputerUseAdapter

logger = logging.getLogger(__name__)


@dataclass
class TaskResult:
    """任务执行结果"""
    task_id: str
    has_task: bool = False
    task_description: str = ""
    execution_method: str = "none"  # "mcp" | "computer_use" | "none"
    success: bool = False
    result: Any = None
    error: Optional[str] = None
    tool_name: Optional[str] = None
    tool_args: Optional[Dict] = None
    reason: str = ""


@dataclass
class McpDecision:
    """MCP 可行性评估结果"""
    has_task: bool = False
    can_execute: bool = False
    task_description: str = ""
    tool_name: Optional[str] = None
    tool_args: Optional[Dict] = None
    reason: str = ""


@dataclass
class ComputerUseDecision:
    """ComputerUse 可行性评估结果"""
    has_task: bool = False
    can_execute: bool = False
    task_description: str = ""
    reason: str = ""


class DirectTaskExecutor:
    """
    直接任务执行器：并行评估 MCP 和 ComputerUse 可行性
    
    流程:
    1. 并行调用两个 LLM：一个评估 MCP，一个评估 ComputerUse
    2. 优先使用 MCP（如果可行）
    3. 其次使用 ComputerUse（如果 MCP 不可行但 ComputerUse 可行）
    4. 执行选中的方法
    """
    
    def __init__(self, computer_use: Optional[ComputerUseAdapter] = None):
        self.router = McpRouterClient()
        self.catalog = McpToolCatalog(self.router)
        self.computer_use = computer_use or ComputerUseAdapter()
        self._config_manager = get_config_manager()
    
    def _get_client(self):
        """动态获取 OpenAI 客户端"""
        core_config = self._config_manager.get_core_config()
        return AsyncOpenAI(
            api_key=core_config['OPENROUTER_API_KEY'],
            base_url=core_config['OPENROUTER_URL']
        )
    
    def _get_model(self):
        """获取模型名称"""
        core_config = self._config_manager.get_core_config()
        return core_config['SUMMARY_MODEL']
    
    def _format_messages(self, messages: List[Dict[str, str]]) -> str:
        """格式化对话消息"""
        lines = []
        for m in messages[-10:]:  # 最多取最近10条
            role = m.get('role', 'user')
            text = m.get('text', '')
            if text:
                lines.append(f"{role}: {text}")
        return "\n".join(lines)
    
    def _format_tools(self, capabilities: Dict[str, Dict[str, Any]]) -> str:
        """格式化工具列表供 LLM 参考"""
        if not capabilities:
            return "No MCP tools available."
        
        lines = []
        for tool_name, info in capabilities.items():
            desc = info.get('description', 'No description')
            schema = info.get('input_schema', {})
            params = schema.get('properties', {})
            required = schema.get('required', [])
            param_desc = []
            for p_name, p_info in params.items():
                p_type = p_info.get('type', 'any')
                is_required = '(required)' if p_name in required else '(optional)'
                param_desc.append(f"    - {p_name}: {p_type} {is_required}")
            
            lines.append(f"- {tool_name}: {desc}")
            if param_desc:
                lines.extend(param_desc)
        
        return "\n".join(lines)
    
    async def _assess_mcp(
        self, 
        conversation: str, 
        capabilities: Dict[str, Dict[str, Any]]
    ) -> McpDecision:
        """
        独立评估 MCP 可行性（专注于 MCP 工具）
        """
        if not capabilities:
            return McpDecision(has_task=False, can_execute=False, reason="No MCP tools available")
        
        tools_desc = self._format_tools(capabilities)
        
        system_prompt = f"""You are an MCP tool selection agent. Your ONLY job is to determine if the user's request can be handled by the available MCP tools.

AVAILABLE MCP TOOLS:
{tools_desc}

INSTRUCTIONS:
1. Analyze if the conversation contains an actionable task request
2. If yes, determine if ANY of the available MCP tools can handle it
3. If a tool can handle it, provide the exact tool name and arguments
4. Be precise with the tool arguments - they must match the tool's schema

OUTPUT FORMAT (strict JSON):
{{
    "has_task": boolean,
    "can_execute": boolean,
    "task_description": "brief description of the task",
    "tool_name": "exact_tool_name or null",
    "tool_args": {{...}} or null,
    "reason": "why this decision"
}}"""

        user_prompt = f"Conversation:\n{conversation}"
        
        # Retry策略：重试2次，间隔1秒、2秒
        max_retries = 3
        retry_delays = [1, 2]
        
        for attempt in range(max_retries):
            try:
                client = self._get_client()
                model = self._get_model()
                
                request_params = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0,
                    "max_tokens": 600
                }
                
                if model in MODELS_WITH_EXTRA_BODY:
                    request_params["extra_body"] = {"enable_thinking": False}
                
                response = await client.chat.completions.create(**request_params)
                text = response.choices[0].message.content.strip()
                
                logger.debug(f"[MCP Assessment] Raw response: {text[:200]}...")
                
                # 解析 JSON
                if text.startswith("```"):
                    text = text.replace("```json", "").replace("```", "").strip()
                decision = json.loads(text)
                
                return McpDecision(
                    has_task=decision.get('has_task', False),
                    can_execute=decision.get('can_execute', False),
                    task_description=decision.get('task_description', ''),
                    tool_name=decision.get('tool_name'),
                    tool_args=decision.get('tool_args'),
                    reason=decision.get('reason', '')
                )
                
            except (APIConnectionError, InternalServerError, RateLimitError) as e:
                if attempt < max_retries - 1:
                    wait_time = retry_delays[attempt]
                    logger.warning(f"[MCP Assessment] 调用失败 (尝试 {attempt + 1}/{max_retries})，{wait_time}秒后重试: {e}")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"[MCP Assessment] Failed after {max_retries} attempts: {e}")
                    return McpDecision(has_task=False, can_execute=False, reason=f"Assessment error after {max_retries} attempts: {e}")
            except Exception as e:
                logger.error(f"[MCP Assessment] Failed: {e}")
                return McpDecision(has_task=False, can_execute=False, reason=f"Assessment error: {e}")
    
    async def _assess_computer_use(
        self, 
        conversation: str,
        cu_available: bool
    ) -> ComputerUseDecision:
        """
        独立评估 ComputerUse 可行性（专注于 GUI 操作）
        """
        if not cu_available:
            return ComputerUseDecision(
                has_task=False, 
                can_execute=False, 
                reason="ComputerUse not available"
            )
        
        system_prompt = """You are a GUI automation assessment agent. Your ONLY job is to determine if the user's request requires GUI/desktop automation.

GUI AUTOMATION CAPABILITIES:
- Control mouse (click, move, drag)
- Control keyboard (type, hotkeys)
- Open/close applications
- Browse the web
- Interact with Windows UI elements

INSTRUCTIONS:
1. Analyze if the conversation contains an actionable task request
2. Determine if the task REQUIRES GUI interaction (e.g., opening apps, clicking buttons, web browsing)
3. Tasks like "open Chrome", "click on X", "type something" require GUI
4. Tasks that can be done via API/tools (file operations, data queries) do NOT need GUI

OUTPUT FORMAT (strict JSON):
{
    "has_task": boolean,
    "can_execute": boolean,
    "task_description": "brief description of the task",
    "reason": "why this decision"
}"""

        user_prompt = f"Conversation:\n{conversation}"
        
        # Retry策略：重试2次，间隔1秒、2秒
        max_retries = 3
        retry_delays = [1, 2]
        
        for attempt in range(max_retries):
            try:
                client = self._get_client()
                model = self._get_model()
                
                request_params = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0,
                    "max_tokens": 400
                }
                
                if model in MODELS_WITH_EXTRA_BODY:
                    request_params["extra_body"] = {"enable_thinking": False}
                
                response = await client.chat.completions.create(**request_params)
                text = response.choices[0].message.content.strip()
                
                logger.debug(f"[ComputerUse Assessment] Raw response: {text[:200]}...")
                
                # 解析 JSON
                if text.startswith("```"):
                    text = text.replace("```json", "").replace("```", "").strip()
                decision = json.loads(text)
                
                return ComputerUseDecision(
                    has_task=decision.get('has_task', False),
                    can_execute=decision.get('can_execute', False),
                    task_description=decision.get('task_description', ''),
                    reason=decision.get('reason', '')
                )
                
            except (APIConnectionError, InternalServerError, RateLimitError) as e:
                if attempt < max_retries - 1:
                    wait_time = retry_delays[attempt]
                    logger.warning(f"[ComputerUse Assessment] 调用失败 (尝试 {attempt + 1}/{max_retries})，{wait_time}秒后重试: {e}")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"[ComputerUse Assessment] Failed after {max_retries} attempts: {e}")
                    return ComputerUseDecision(has_task=False, can_execute=False, reason=f"Assessment error after {max_retries} attempts: {e}")
            except Exception as e:
                logger.error(f"[ComputerUse Assessment] Failed: {e}")
                return ComputerUseDecision(has_task=False, can_execute=False, reason=f"Assessment error: {e}")
    
    async def analyze_and_execute(
        self, 
        messages: List[Dict[str, str]], 
        lanlan_name: Optional[str] = None,
        agent_flags: Optional[Dict[str, bool]] = None
    ) -> Optional[TaskResult]:
        """
        并行评估 MCP 和 ComputerUse，然后执行任务
        
        优先级: MCP > ComputerUse
        """
        import uuid
        task_id = str(uuid.uuid4())
        
        if agent_flags is None:
            agent_flags = {"mcp_enabled": False, "computer_use_enabled": False}
        
        mcp_enabled = agent_flags.get("mcp_enabled", False)
        computer_use_enabled = agent_flags.get("computer_use_enabled", False)
        
        # 如果两个功能都没开启，直接返回
        if not mcp_enabled and not computer_use_enabled:
            logger.debug("[TaskExecutor] Both MCP and ComputerUse disabled, skipping")
            return None
        
        # 格式化对话
        conversation = self._format_messages(messages)
        if not conversation.strip():
            return None
        
        # 准备并行评估任务
        assessment_tasks = []
        
        # MCP 评估任务
        capabilities = {}
        if mcp_enabled:
            try:
                capabilities = await self.catalog.get_capabilities(force_refresh=True)
                logger.info(f"[TaskExecutor] Found {len(capabilities)} MCP tools")
            except Exception as e:
                logger.warning(f"[TaskExecutor] Failed to get MCP capabilities: {e}")
        
        # ComputerUse 可用性检查
        cu_available = False
        if computer_use_enabled:
            try:
                cu_status = self.computer_use.is_available()
                cu_available = cu_status.get('ready', False)
                logger.info(f"[TaskExecutor] ComputerUse available: {cu_available}")
            except Exception as e:
                logger.warning(f"[TaskExecutor] Failed to check ComputerUse: {e}")
        
        # 并行执行评估
        mcp_decision = None
        cu_decision = None
        
        if mcp_enabled and capabilities:
            assessment_tasks.append(('mcp', self._assess_mcp(conversation, capabilities)))
        
        if computer_use_enabled and cu_available:
            assessment_tasks.append(('cu', self._assess_computer_use(conversation, cu_available)))
        
        if not assessment_tasks:
            logger.debug("[TaskExecutor] No assessment tasks to run")
            return None
        
        # 并行执行所有评估
        logger.info(f"[TaskExecutor] Running {len(assessment_tasks)} assessments in parallel...")
        
        results = await asyncio.gather(
            *[task[1] for task in assessment_tasks],
            return_exceptions=True
        )
        
        # 收集结果
        for i, (task_type, _) in enumerate(assessment_tasks):
            result = results[i]
            if isinstance(result, Exception):
                logger.error(f"[TaskExecutor] {task_type} assessment failed: {result}")
                continue
            
            if task_type == 'mcp':
                mcp_decision = result
                logger.info(f"[MCP] has_task={mcp_decision.has_task}, can_execute={mcp_decision.can_execute}, reason={mcp_decision.reason}")
            elif task_type == 'cu':
                cu_decision = result
                logger.info(f"[ComputerUse] has_task={cu_decision.has_task}, can_execute={cu_decision.can_execute}, reason={cu_decision.reason}")
        
        # 决策逻辑：MCP 优先
        # 1. 如果 MCP 可以执行，使用 MCP
        if mcp_decision and mcp_decision.has_task and mcp_decision.can_execute:
            logger.info(f"[TaskExecutor] ✅ Using MCP: {mcp_decision.task_description}")
            return await self._execute_mcp(
                task_id=task_id,
                decision=mcp_decision
            )
        
        # 2. 如果 MCP 不行，但 ComputerUse 可以，返回 ComputerUse 任务
        if cu_decision and cu_decision.has_task and cu_decision.can_execute:
            logger.info(f"[TaskExecutor] ✅ Using ComputerUse: {cu_decision.task_description}")
            return TaskResult(
                task_id=task_id,
                has_task=True,
                task_description=cu_decision.task_description,
                execution_method='computer_use',
                success=False,  # 标记为待执行
                reason=cu_decision.reason
            )
        
        # 3. 两者都不行
        reason_parts = []
        if mcp_decision:
            reason_parts.append(f"MCP: {mcp_decision.reason}")
        if cu_decision:
            reason_parts.append(f"ComputerUse: {cu_decision.reason}")
        
        # 检查是否有任务但无法执行
        has_any_task = (mcp_decision and mcp_decision.has_task) or (cu_decision and cu_decision.has_task)
        if has_any_task:
            task_desc = (mcp_decision.task_description if mcp_decision and mcp_decision.has_task 
                        else cu_decision.task_description if cu_decision else "")
            logger.info(f"[TaskExecutor] Task detected but cannot execute: {task_desc}")
            return TaskResult(
                task_id=task_id,
                has_task=True,
                task_description=task_desc,
                execution_method='none',
                success=False,
                reason=" | ".join(reason_parts) if reason_parts else "No suitable method"
            )
        
        # 没有检测到任务
        logger.debug("[TaskExecutor] No task detected")
        return None
    
    async def _execute_mcp(
        self, 
        task_id: str, 
        decision: McpDecision
    ) -> TaskResult:
        """执行 MCP 工具调用"""
        tool_name = decision.tool_name
        tool_args = decision.tool_args or {}
        
        if not tool_name:
            return TaskResult(
                task_id=task_id,
                has_task=True,
                task_description=decision.task_description,
                execution_method='mcp',
                success=False,
                error="No tool name provided",
                reason=decision.reason
            )
        
        logger.info(f"[TaskExecutor] Executing MCP tool: {tool_name} with args: {tool_args}")
        
        try:
            result = await self.router.call_tool(tool_name, tool_args)
            
            if result.get('success'):
                logger.info(f"[TaskExecutor] ✅ MCP tool {tool_name} succeeded")
                return TaskResult(
                    task_id=task_id,
                    has_task=True,
                    task_description=decision.task_description,
                    execution_method='mcp',
                    success=True,
                    result=result.get('result'),
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=decision.reason
                )
            else:
                logger.error(f"[TaskExecutor] ❌ MCP tool {tool_name} failed: {result.get('error')}")
                return TaskResult(
                    task_id=task_id,
                    has_task=True,
                    task_description=decision.task_description,
                    execution_method='mcp',
                    success=False,
                    error=result.get('error', 'Tool execution failed'),
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=decision.reason
                )
        except Exception as e:
            logger.error(f"[TaskExecutor] MCP tool execution error: {e}")
            return TaskResult(
                task_id=task_id,
                has_task=True,
                task_description=decision.task_description,
                execution_method='mcp',
                success=False,
                error=str(e),
                tool_name=tool_name,
                tool_args=tool_args,
                reason=decision.reason
            )
    
    async def refresh_capabilities(self) -> Dict[str, Dict[str, Any]]:
        """刷新并返回 MCP 工具能力列表"""
        return await self.catalog.get_capabilities(force_refresh=True)
