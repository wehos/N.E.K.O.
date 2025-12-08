"""
屏幕截图工具库
提供跨平台的屏幕截图功能，支持Windows、macOS和Linux
"""
import platform
import subprocess
import tempfile
import os
import base64
import logging
import sys
import time
import uuid
from typing import Optional, Tuple
import asyncio
from pathlib import Path

logger = logging.getLogger(__name__)

class ScreenshotUtils:
    """屏幕截图工具类"""
    
    def __init__(self):
        self.system = platform.system().lower()
        # 使用N.E.K.O配置文件夹保存截图
        self.screenshot_dir = self._get_neko_screenshots_dir()
        self._ensure_screenshot_dir()
    
    def _get_neko_screenshots_dir(self) -> str:
        """获取N.E.K.O配置文件夹中的截图目录路径"""
        try:
            # 获取用户文档目录
            if sys.platform == "win32":
                # Windows: 使用系统API获取"我的文档"路径
                import ctypes
                from ctypes import windll, wintypes
                
                CSIDL_PERSONAL = 5  # My Documents
                SHGFP_TYPE_CURRENT = 0
                
                buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
                windll.shell32.SHGetFolderPathW(None, CSIDL_PERSONAL, None, SHGFP_TYPE_CURRENT, buf)
                docs_path = Path(buf.value)
            else:
                # macOS/Linux: 使用用户主目录
                docs_path = Path.home() / "Documents"
            
            # N.E.K.O文件夹路径
            neko_dir = docs_path / "N.E.K.O"
            
            # 主动对话截图子目录
            screenshots_dir = neko_dir / "proactive_screenshots"
            
            logger.info(f"N.E.K.O主动对话截图目录: {screenshots_dir}")
            return str(screenshots_dir)
            
        except Exception as e:
            logger.warning(f"获取N.E.K.O目录失败，使用临时目录: {e}")
            # 回退到临时目录
            return os.path.join(tempfile.gettempdir(), 'neko_screenshots')
    
    def _ensure_screenshot_dir(self):
        """确保截图目录存在"""
        if not os.path.exists(self.screenshot_dir):
            os.makedirs(self.screenshot_dir)
            logger.info(f"创建截图目录: {self.screenshot_dir}")
    
    async def capture_screenshot(self) -> Optional[str]:
        """
        捕获屏幕截图
        返回: 截图文件路径，如果失败返回None
        """
        try:
            if self.system == 'windows':
                return await self._capture_windows()
            elif self.system == 'darwin':  # macOS
                return await self._capture_macos()
            elif self.system == 'linux':
                return await self._capture_linux()
            else:
                logger.error(f"不支持的操作系统: {self.system}")
                return None
        except Exception as e:
            logger.error(f"截图失败: {e}")
            return None
    
    async def _capture_windows(self) -> Optional[str]:
        """Windows系统截图"""
        try:
            # 使用PIL库进行截图（如果可用）
            try:
                from PIL import ImageGrab
                screenshot = ImageGrab.grab()
                # 使用时间戳和UUID生成唯一文件名
                timestamp = int(time.time())
                unique_id = uuid.uuid4().hex[:8]
                screenshot_path = os.path.join(self.screenshot_dir, f"screenshot_{timestamp}_{unique_id}.png")
                screenshot.save(screenshot_path, 'PNG')
                logger.info(f"Windows截图成功: {screenshot_path}")
                return screenshot_path
            except ImportError:
                logger.warning("PIL库不可用，尝试使用系统命令")
            
            # 使用Windows系统命令（需要安装nircmd或使用其他工具）
            # 这里使用简单的PowerShell命令
            # 使用时间戳和UUID生成唯一文件名
            timestamp = int(time.time())
            unique_id = uuid.uuid4().hex[:8]
            screenshot_path = os.path.join(self.screenshot_dir, f"screenshot_{timestamp}_{unique_id}.png")
            
            # 使用PowerShell的Add-Type命令进行截图，通过参数传递路径避免注入
            powershell_script = """
param($Path)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bounds = $screen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
"""
            
            # 创建临时PowerShell脚本文件
            with tempfile.NamedTemporaryFile(mode='w', suffix='.ps1', delete=False) as temp_script:
                temp_script.write(powershell_script)
                temp_script_path = temp_script.name
            
            try:
                # 使用subprocess_exec避免shell注入，直接传递参数
                process = await asyncio.create_subprocess_exec(
                    'powershell.exe', '-File', temp_script_path, '-Path', screenshot_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await process.communicate()
                
                if process.returncode == 0 and os.path.exists(screenshot_path):
                    logger.info(f"Windows PowerShell截图成功: {screenshot_path}")
                    return screenshot_path
                else:
                    logger.error(f"Windows截图失败: {stderr.decode() if stderr else '未知错误'}")
                    return None
                    
            finally:
                # 确保临时文件被清理
                try:
                    os.unlink(temp_script_path)
                except Exception as cleanup_error:
                    logger.warning(f"清理临时PowerShell脚本失败: {cleanup_error}")
                
        except Exception as e:
            logger.error(f"Windows截图异常: {e}")
            # 确保异常时也清理临时文件
            try:
                os.unlink(temp_script_path)
            except Exception as cleanup_error:
                logger.warning(f"清理临时PowerShell脚本失败: {cleanup_error}")
            return None
    
    async def _capture_macos(self) -> Optional[str]:
        """macOS系统截图"""
        try:
            # 使用时间戳和UUID生成唯一文件名
            timestamp = int(time.time())
            unique_id = uuid.uuid4().hex[:8]
            screenshot_path = os.path.join(self.screenshot_dir, f"screenshot_{timestamp}_{unique_id}.png")
            
            # 使用macOS的screencapture命令
            process = await asyncio.create_subprocess_shell(
                f"screencapture -x {screenshot_path}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0 and os.path.exists(screenshot_path):
                logger.info(f"macOS截图成功: {screenshot_path}")
                return screenshot_path
            else:
                logger.error(f"macOS截图失败: {stderr.decode() if stderr else '未知错误'}")
                return None
                
        except Exception as e:
            logger.error(f"macOS截图异常: {e}")
            return None
    
    async def _capture_linux(self) -> Optional[str]:
        """Linux系统截图"""
        try:
            # 使用时间戳和UUID生成唯一文件名
            timestamp = int(time.time())
            unique_id = uuid.uuid4().hex[:8]
            screenshot_path = os.path.join(self.screenshot_dir, f"screenshot_{timestamp}_{unique_id}.png")
            
            # 尝试使用不同的Linux截图工具
            tools = [
                ("gnome-screenshot", f"gnome-screenshot -f {screenshot_path}"),
                ("scrot", f"scrot {screenshot_path}"),
                ("import", f"import -window root {screenshot_path}"),  # ImageMagick
            ]
            
            for tool_name, command in tools:
                try:
                    # 检查工具是否可用
                    check_process = await asyncio.create_subprocess_shell(
                        f"which {tool_name}",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    await check_process.communicate()
                    
                    if check_process.returncode == 0:
                        # 工具可用，执行截图
                        process = await asyncio.create_subprocess_shell(
                            command,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE
                        )
                        
                        stdout, stderr = await process.communicate()
                        
                        if process.returncode == 0 and os.path.exists(screenshot_path):
                            logger.info(f"Linux截图成功 ({tool_name}): {screenshot_path}")
                            return screenshot_path
                except Exception as e:
                    logger.warning(f"Linux截图工具 {tool_name} 失败: {e}")
                    continue
            
            logger.error("Linux系统没有可用的截图工具")
            return None
                
        except Exception as e:
            logger.error(f"Linux截图异常: {e}")
            return None
    
    async def get_screenshot_description(self, screenshot_path: str) -> Optional[str]:
        """
        获取屏幕截图的文字描述
        完全依赖AI服务分析截图内容
        
        返回: 截图内容的文字描述，如果AI分析失败则返回None
        """
        try:
            logger.info(f"开始分析截图: {screenshot_path}")
            if not os.path.exists(screenshot_path):
                logger.error(f"截图文件不存在: {screenshot_path}")
                return None
            
            # 完全依赖AI服务分析截图
            description = await self._analyze_screenshot_ai(screenshot_path)
            
            if description:
                logger.info(f"AI截图分析成功: {description[:100]}...")
                return description
            else:
                logger.info("AI截图分析失败，放弃本次主动搭话")
                return None
                
        except Exception as e:
            logger.exception(f"截图分析异常: {e}")
            return None
    

    
    async def _analyze_screenshot_ai(self, screenshot_path: str) -> Optional[str]:
        """使用AI服务分析截图（集成OpenAI Vision API）"""
        try:
            logger.info("开始AI截图分析流程")
            
            # 检查是否配置了API，根据核心API和辅助API厂商选择视觉模型
            from utils.config_manager import get_config_manager
            
            config_manager = get_config_manager()
            core_config = config_manager.get_core_config()
            
            # 获取核心API和辅助API配置
            core_api = core_config.get('coreApi', 'qwen')
            assist_api = core_config.get('assistApi', 'qwen')
            enable_custom_api = core_config.get('enableCustomApi', False)
            
            logger.info(f"配置信息 - 核心API: {core_api}, 辅助API: {assist_api}, 自定义API: {enable_custom_api}")
            
            # 完全分离两种情况：
            # 1. 开启自定义API：只使用自定义配置，不完整时直接失败
            # 2. 未开启自定义API：只使用辅助API和核心API的默认配置
            
            if enable_custom_api:
                # 开启自定义API：只使用自定义配置
                vision_api_key = core_config.get('visionModelApiKey')
                vision_base_url = core_config.get('visionModelUrl')
                vision_model = core_config.get('visionModelId')
                
                logger.info(f"自定义API配置 - 密钥配置: {bool(vision_api_key)}, 端点: {vision_base_url}, 模型: {vision_model}")
                
                if vision_api_key and vision_base_url and vision_model:
                    logger.info("使用自定义API视觉模型配置")
                else:
                    logger.info("自定义API视觉模型配置不完整，跳过AI分析")
                    return None
            else:
                # 未开启自定义API：使用辅助API厂商的默认配置
                if assist_api == 'qwen':
                    vision_api_key = core_config.get('ASSIST_API_KEY_QWEN') or core_config.get('CORE_API_KEY')
                    vision_base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
                    vision_model = "qwen3-vl-plus-2025-09-23"
                elif assist_api == 'openai':
                    vision_api_key = core_config.get('ASSIST_API_KEY_OPENAI') or core_config.get('CORE_API_KEY')
                    vision_base_url = "https://api.openai.com/v1"
                    vision_model = "gpt-4-vision-preview"
                elif assist_api == 'glm':
                    vision_api_key = core_config.get('ASSIST_API_KEY_GLM') or core_config.get('CORE_API_KEY')
                    vision_base_url = "https://open.bigmodel.cn/api/paas/v4"
                    vision_model = "glm-4v-plus-0111"
                elif assist_api == 'step':
                    vision_api_key = core_config.get('ASSIST_API_KEY_STEP') or core_config.get('CORE_API_KEY')
                    vision_base_url = "https://api.stepfun.com/v1"
                    vision_model = "step-1o-turbo-vision"
                elif assist_api == 'silicon':
                    vision_api_key = core_config.get('ASSIST_API_KEY_SILICON') or core_config.get('CORE_API_KEY')
                    vision_base_url = "https://api.siliconflow.cn/v1"
                    vision_model = "Qwen/Qwen3-VL-235B-A22B-Instruct"
                else:  # 默认使用qwen
                    vision_api_key = core_config.get('ASSIST_API_KEY_QWEN') or core_config.get('CORE_API_KEY')
                    vision_base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
                    vision_model = "qwen3-vl-plus-2025-09-23"
            
            logger.info(f"最终配置 - 密钥配置: {bool(vision_api_key)}, 模型: {vision_model}")
            
            if not vision_api_key:
                logger.info("未配置视觉模型API密钥，跳过AI分析")
                return None
            
            # 使用视觉模型API分析图片
            from openai import AsyncOpenAI
            
            logger.info(f"使用视觉模型: {vision_model}, API端点: {vision_base_url}")
            
            client = AsyncOpenAI(
                api_key=vision_api_key,
                base_url=vision_base_url if vision_base_url else None
            )
            
            # 读取图片文件并转换为base64
            logger.info("读取截图文件并转换为base64")
            with open(screenshot_path, "rb") as image_file:
                image_data = base64.b64encode(image_file.read()).decode('utf-8')
            
            # 构建提示词，让AI简洁描述屏幕内容
            try:
                logger.info("发送AI分析请求...")
                response = await client.chat.completions.create(
                    model=vision_model if vision_model else "gpt-4-vision-preview",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "请直接描述这张屏幕截图的内容，不要添加任何开场白或总结。重点关注：主要应用程序、界面布局、文字内容、颜色主题和可能的活动。用简洁的中文描述。"
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{image_data}"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens=800
                )
                
                logger.info(f"AI分析请求完成，响应状态: {response is not None}")
                
                if response and response.choices and len(response.choices) > 0:
                    description = response.choices[0].message.content
                    logger.info(f"AI分析返回内容长度: {len(description) if description else 0}")
                    
                    if description and description.strip():
                        logger.info("AI图像分析成功")
                        # 清理可能的重复内容
                        cleaned_description = description.strip()
                        # 移除可能的开场白和总结文本，使用循环处理多个前缀
                        prefixes = ["这张截图显示", "截图显示", "图片显示"]
                        for prefix in prefixes:
                            if cleaned_description.startswith(prefix):
                                cleaned_description = cleaned_description[len(prefix):].strip()
                                break
                        
                        logger.info(f"清理后的描述: {cleaned_description[:100]}...")
                        return cleaned_description
                    else:
                        logger.warning("AI分析返回空结果")
                        return None
                else:
                    logger.warning("AI分析响应无效")
                    if response:
                        logger.warning(f"响应结构: choices={len(response.choices) if response.choices else 0}")
                    return None
                    
            except Exception as api_error:
                logger.exception(f"AI API调用失败: {api_error}")
                return None
                
        except ImportError:
            logger.warning("OpenAI库不可用，无法进行AI分析")
            return None
        except Exception as e:
            logger.error(f"AI截图分析失败: {e}")
            return None
    
    def cleanup_old_screenshots(self, keep_count: int = 10):
        """清理旧的截图文件"""
        try:
            if not os.path.exists(self.screenshot_dir):
                return
            
            # 获取所有截图文件并按修改时间排序
            screenshot_files = []
            for filename in os.listdir(self.screenshot_dir):
                if filename.startswith('screenshot_') and filename.endswith('.png'):
                    filepath = os.path.join(self.screenshot_dir, filename)
                    screenshot_files.append((filepath, os.path.getmtime(filepath)))
            
            # 按修改时间排序，保留最新的文件
            screenshot_files.sort(key=lambda x: x[1], reverse=True)
            
            # 删除旧文件
            for filepath, _ in screenshot_files[keep_count:]:
                try:
                    os.remove(filepath)
                    logger.info(f"清理旧截图: {filepath}")
                except Exception as e:
                    logger.warning(f"清理截图失败 {filepath}: {e}")
                    
        except Exception as e:
            logger.error(f"清理截图异常: {e}")


# 全局实例
screenshot_utils = ScreenshotUtils()


async def capture_and_analyze_screenshot() -> Optional[str]:
    """
    捕获并分析屏幕截图
    返回: 截图内容的文字描述，如果失败返回None
    """
    try:
        logger.info("开始捕获和分析屏幕截图")
        
        # 捕获截图
        screenshot_path = await screenshot_utils.capture_screenshot()
        if not screenshot_path:
            logger.error("截图捕获失败")
            return None
        
        logger.info(f"截图捕获成功: {screenshot_path}")
        
        # 分析截图内容
        description = await screenshot_utils.get_screenshot_description(screenshot_path)
        
        if description:
            logger.info("截图分析成功，返回描述内容")
        else:
            logger.info("截图分析失败，返回None")
        
        # 清理旧截图
        screenshot_utils.cleanup_old_screenshots()
        
        return description
        
    except Exception as e:
        logger.error(f"截图捕获和分析失败: {e}")
        return None


async def get_latest_screenshot_content() -> Optional[str]:
    """
    获取最新的屏幕截图内容描述
    这是与main_server.py兼容的函数
    
    返回: 截图内容的文字描述，如果失败返回None
    """
    return await capture_and_analyze_screenshot()