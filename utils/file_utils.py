"""
文件工具函数
提供文件名生成、目录管理等工具函数
"""

import os
import datetime
import uuid
import base64
from pathlib import Path


def generate_unique_filename(header: str, extension: str = None, include_timestamp: bool = True) -> str:
    """
    生成唯一的文件名
    
    Args:
        header: 文件名前缀
        extension: 文件扩展名，如果为None则根据header自动推断
        include_timestamp: 是否包含时间戳
    
    Returns:
        唯一的文件名
    """
    # 生成时间戳（包含微秒）
    if include_timestamp:
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')  # 包含微秒
    else:
        timestamp = ""
    
    # 生成UUID（只取前8位以保持文件名简洁）
    unique_id = str(uuid.uuid4())[:8]
    
    # 根据header推断扩展名
    if extension is None:
        if 'png' in header:
            ext = 'png'
        elif 'jpeg' in header:
            ext = 'jpeg'
        elif 'gif' in header:
            ext = 'gif'
        else:
            ext = 'jpg'  # 默认扩展名
    else:
        ext = extension
    
    # 构建文件名
    if include_timestamp and timestamp:
        filename = f"{header}_{timestamp}_{unique_id}.{ext}"
    else:
        filename = f"{header}_{unique_id}.{ext}"
    
    return filename


def ensure_directory_exists(dir_path: str) -> str:
    """
    确保目录存在，如果不存在则创建
    
    Args:
        dir_path: 目录路径
    
    Returns:
        验证过的目录路径
    """
    try:
        os.makedirs(dir_path, exist_ok=True)
        # 测试目录是否可写
        testfile = os.path.join(dir_path, '.nkatest')
        with open(testfile, 'w') as f:
            f.write('ok')
        os.remove(testfile)
        return dir_path
    except Exception:
        return None


def get_screenshot_save_directory(config_manager, app_name: str = "APP_NAME") -> str:
    """
    获取截图保存目录
    
    Args:
        config_manager: 配置管理器实例
        app_name: 应用名称
    
    Returns:
        保存目录路径，如果无法创建则返回None
    """
    target_dir = None
    
    # 首先尝试根据配置的 live2d 目录推导保存位置
    try:
        live2d_dir = getattr(config_manager, 'live2d_dir', None)
        if live2d_dir:
            p = Path(live2d_dir)
            parent = p.parent
            candidate = parent / 'Pictures'
            target_dir = ensure_directory_exists(str(candidate))
    except Exception:
        target_dir = None
    
    # 如果未成功确定目标目录，使用平台回退策略
    if not target_dir:
        home = os.path.expanduser('~')
        candidate = os.path.join(home, app_name, 'Pictures')
        target_dir = ensure_directory_exists(candidate)
    
    return target_dir


def schedule_auto_delete(file_path: str, delay_days: int = 7, logger=None):
    """
    安排文件自动删除任务
    
    Args:
        file_path: 要删除的文件路径
        delay_days: 延迟删除的天数
        logger: 日志记录器
    """
    try:
        import asyncio
        
        # 转换天数为秒
        delay_seconds = delay_days * 24 * 3600
        
        async def _delayed_remove(path, delay):
            try:
                await asyncio.sleep(delay)
                if os.path.exists(path):
                    os.remove(path)
                    if logger:
                        logger.info(f"Auto-deleted file: {path}")
                    else:
                        print(f"Auto-deleted file: {path}")
            except Exception as e:
                if logger:
                    logger.error(f"Failed to auto-delete file {path}: {e}")
                else:
                    print(f"Failed to auto-delete file {path}: {e}")
        
        # 创建异步任务
        asyncio.create_task(_delayed_remove(file_path, delay_seconds))
        
    except Exception as e:
        if logger:
            logger.warning(f"无法安排文件自动删除任务: {e}")
        else:
            print(f"无法安排文件自动删除任务: {e}")


def save_base64_image(data_url: str, config_manager, app_name: str = "APP_NAME", 
                     filename_prefix: str = "screenshot", auto_delete_days: int = 7,
                     logger=None) -> tuple[bool, str, str]:
    """
    保存base64格式的图像数据到文件
    
    Args:
        data_url: base64编码的数据URL
        config_manager: 配置管理器实例
        app_name: 应用名称
        filename_prefix: 文件名前缀
        auto_delete_days: 自动删除的延迟天数（设为0禁用自动删除）
        logger: 日志记录器
    
    Returns:
        (是否成功, 保存路径, 错误信息)
    """
    try:
        # 解析data URL
        if ',' not in data_url:
            return False, "", "无效的data URL格式"
        
        header, b64 = data_url.split(',', 1)
        
        # 获取保存目录
        target_dir = get_screenshot_save_directory(config_manager, app_name)
        if not target_dir:
            return False, "", "无法确定保存目录"
        
        # 生成唯一文件名
        filename = generate_unique_filename(filename_prefix)
        file_path = os.path.join(target_dir, filename)
        
        # 保存文件
        image_data = base64.b64decode(b64)
        with open(file_path, 'wb') as f:
            f.write(image_data)
        
        # 安排自动删除任务
        if auto_delete_days > 0:
            schedule_auto_delete(file_path, auto_delete_days, logger)
        
        return True, file_path, ""
        
    except Exception as e:
        error_msg = f"保存图像失败: {str(e)}"
        if logger:
            logger.error(error_msg)
        return False, "", error_msg