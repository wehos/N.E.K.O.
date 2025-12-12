# -*- coding: utf-8 -*-
"""
Memory Router

Handles memory-related endpoints including:
- Recent files listing
- Memory review configuration
"""

import os
import json
import glob
import logging
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .shared_state import get_config_manager

router = APIRouter(prefix="/api/memory", tags=["memory"])
logger = logging.getLogger("Main")


@router.get('/recent_files')
async def get_recent_files():
    """获取 memory 目录下所有 recent*.json 文件名列表"""
    _config_manager = get_config_manager()
    files = glob.glob(str(_config_manager.memory_dir / 'recent*.json'))
    file_names = [os.path.basename(f) for f in files]
    return {"files": file_names}


@router.get('/recent_file')
async def get_recent_file(filename: str):
    """获取指定 recent*.json 文件内容"""
    _config_manager = get_config_manager()
    
    # Security: Reject filenames with path separators or parent directory references
    if os.path.sep in filename or '/' in filename or '..' in filename:
        return JSONResponse({"success": False, "error": "文件名不合法: 包含非法路径字符"}, status_code=400)
    
    # Validate filename format
    if not (filename.startswith('recent') and filename.endswith('.json')):
        return JSONResponse({"success": False, "error": "文件名不合法"}, status_code=400)
    
    # Construct and resolve the target path
    memory_dir = Path(_config_manager.memory_dir).resolve()
    file_path = (memory_dir / filename).resolve()
    
    # Security: Verify the resolved path is inside the memory directory
    try:
        if not file_path.is_relative_to(memory_dir):
            return JSONResponse({"success": False, "error": "文件名不合法: 路径遍历被拒绝"}, status_code=400)
    except ValueError:
        # is_relative_to may raise ValueError on some edge cases
        return JSONResponse({"success": False, "error": "文件名不合法: 路径遍历被拒绝"}, status_code=400)
    
    if not file_path.exists():
        return JSONResponse({"success": False, "error": "文件不存在"}, status_code=404)
    
    # Read file with exception handling for IO/Unicode errors
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except (IOError, OSError, UnicodeDecodeError) as e:
        logger.error(f"读取文件失败 {filename}: {e}")
        return JSONResponse({"success": False, "error": "读取文件失败"}, status_code=500)
    
    return {"content": content}


@router.post('/recent_file/save')
async def save_recent_file(request: Request):
    """保存 recent*.json 文件内容"""
    import os, json
    _config_manager = get_config_manager()
    
    data = await request.json()
    filename = data.get('filename')
    chat = data.get('chat')
    file_path = str(_config_manager.memory_dir / filename)
    if not (filename and filename.startswith('recent') and filename.endswith('.json')):
        return JSONResponse({"success": False, "error": "文件名不合法"}, status_code=400)
    arr = []
    for msg in chat:
        t = msg.get('role')
        text = msg.get('text', '')
        arr.append({
            "type": t,
            "data": {
                "content": text,
                "additional_kwargs": {},
                "response_metadata": {},
                "type": t,
                "name": None,
                "id": None,
                "example": False,
                **({"tool_calls": [], "invalid_tool_calls": [], "usage_metadata": None} if t == "ai" else {})
            }
        })
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(arr, f, ensure_ascii=False, indent=2)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post('/update_catgirl_name')
async def update_catgirl_name(request: Request):
    """
    更新记忆文件中的猫娘名称
    1. 重命名记忆文件
    2. 更新文件内容中的猫娘名称引用
    """
    import os, json
    _config_manager = get_config_manager()
    
    data = await request.json()
    old_name = data.get('old_name')
    new_name = data.get('new_name')
    
    if not old_name or not new_name:
        return JSONResponse({"success": False, "error": "缺少必要参数"}, status_code=400)
    
    try:
        # 1. 重命名记忆文件
        old_filename = f'recent_{old_name}.json'
        new_filename = f'recent_{new_name}.json'
        old_file_path = str(_config_manager.memory_dir / old_filename)
        new_file_path = str(_config_manager.memory_dir / new_filename)
        
        # 检查旧文件是否存在
        if not os.path.exists(old_file_path):
            logger.warning(f"记忆文件不存在: {old_file_path}")
            return JSONResponse({"success": False, "error": f"记忆文件不存在: {old_filename}"}, status_code=404)
        
        # 如果新文件已存在，先删除
        if os.path.exists(new_file_path):
            os.remove(new_file_path)
        
        # 重命名文件
        os.rename(old_file_path, new_file_path)
        
        # 2. 更新文件内容中的猫娘名称引用
        with open(new_file_path, 'r', encoding='utf-8') as f:
            file_content = json.load(f)
        
        # 遍历所有消息，仅在特定字段中更新猫娘名称
        for item in file_content:
            if isinstance(item, dict):
                # 安全的方式：只在特定的字段中替换猫娘名称
                # 避免在整个content中进行字符串替换
                
                # 检查角色名称相关字段
                name_fields = ['speaker', 'author', 'name', 'character', 'role']
                for field in name_fields:
                    if field in item and isinstance(item[field], str) and old_name in item[field]:
                        if item[field] == old_name:  # 完全匹配才替换
                            item[field] = new_name
                            logger.debug(f"更新角色名称字段 {field}: {old_name} -> {new_name}")
                
                # 如果item有data嵌套结构，也检查其中的name字段
                if 'data' in item and isinstance(item['data'], dict):
                    data = item['data']
                    for field in name_fields:
                        if field in data and isinstance(data[field], str) and old_name in data[field]:
                            if data[field] == old_name:  # 完全匹配才替换
                                data[field] = new_name
                                logger.debug(f"更新data中角色名称字段 {field}: {old_name} -> {new_name}")
                    
                    # 对于content字段，使用更保守的方法- 仅在明确标识为角色名称的地方替换
                    if 'content' in data and isinstance(data['content'], str):
                        content = data['content']
                        # 检查是否是明确的角色发言格式，如"小白说："或"小白: "
                        # 这种格式通常表示后面的内容是角色发言
                        patterns = [
                            f"{old_name}说：",  # 中文冒号
                            f"{old_name}说:",   # 英文冒号  
                            f"{old_name}:",     # 纯冒号
                            f"{old_name}->",    # 箭头
                            f"[{old_name}]",    # 方括号
                        ]
                        
                        for pattern in patterns:
                            if pattern in content:
                                new_pattern = pattern.replace(old_name, new_name)
                                content = content.replace(pattern, new_pattern)
                                logger.debug(f"在消息内容中发现角色标识，更新: {pattern} -> {new_pattern}")
                        
                        data['content'] = content
        
        # 保存更新后的内容
        with open(new_file_path, 'w', encoding='utf-8') as f:
            json.dump(file_content, f, ensure_ascii=False, indent=2)
        
        logger.info(f"已更新猫娘名称从 '{old_name}' 到 '{new_name}' 的记忆文件")
        return {"success": True}
    except Exception as e:
        logger.error(f"更新猫娘名称失败: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


@router.get('/review_config')
async def get_review_config():
    """获取记忆整理配置"""
    try:
        _config_manager = get_config_manager()
        config_path = str(_config_manager.get_config_path('core_config.json'))
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
                # 如果配置中没有这个键，默认返回True（开启）
                return {"enabled": config_data.get('recent_memory_auto_review', True)}
        else:
            # 如果配置文件不存在，默认返回True（开启）
            return {"enabled": True}
    except Exception as e:
        logger.error(f"读取记忆整理配置失败: {e}")
        return {"enabled": True}


@router.post('/review_config')
async def update_review_config(request: Request):
    """更新记忆整理配置"""
    try:
        data = await request.json()
        enabled = data.get('enabled', True)
        
        _config_manager = get_config_manager()
        config_path = str(_config_manager.get_config_path('core_config.json'))
        config_data = {}
        
        # 读取现有配置
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
        
        # 更新配置
        config_data['recent_memory_auto_review'] = enabled
        
        # 保存配置
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"记忆整理配置已更新: enabled={enabled}")
        return {"success": True, "enabled": enabled}
    except Exception as e:
        logger.error(f"更新记忆整理配置失败: {e}")
        return {"success": False, "error": str(e)}


