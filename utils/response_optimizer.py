
# -*- coding: utf-8 -*-
"""
Response optimizer for NEKO

功能：
- 对模型生成的回复应用词数/字符数限制
- 去重重复句子与连续重复段落（简单启发式）
- 在输出外层加上统一的格式包裹符（enclosure）以便前端/日志统一展示

配置优先级：环境变量 > 默认值
环境变量：
- `NEKO_RESPONSE_MAX_WORDS` （整数，若为0则不限制）
- `NEKO_RESPONSE_ENC_START` / `NEKO_RESPONSE_ENC_END`（包裹起/止符）

注意：中文文本通常没有空格分词，默认的“词数限制”在中文环境下会退化为字符数限制。
"""
from __future__ import annotations
import os
import re
import logging
from typing import Tuple

# 设置模块日志记录器
logger = logging.getLogger(__name__)


def _safe_get_int_env(env_var: str, default: int) -> int:
    """
    安全地获取整数环境变量值
    
    Args:
        env_var: 环境变量名
        default: 默认值
        
    Returns:
        解析后的整数值，如果解析失败则返回默认值
    """
    value = os.getenv(env_var)
    if value is None:
        return default
    
    # 去除前后空格
    value = value.strip()
    if not value:
        return default
    
    try:
        # 尝试转换为整数
        int_value = int(value)
        # 检查是否为非负整数
        if int_value < 0:
            logger.warning("环境变量 %s 包含负值 %s，使用默认值 %s", env_var, int_value, default)
            return default
        return int_value
    except ValueError as e:
        logger.warning("环境变量 %s 的值 %r 无法解析为整数，使用默认值 %s: %s", env_var, value, default, e)
        return default


# 默认配置
DEFAULT_MAX_WORDS = _safe_get_int_env('NEKO_RESPONSE_MAX_WORDS', 200)
DEFAULT_ENC_START = os.getenv('NEKO_RESPONSE_ENC_START', '【')
DEFAULT_ENC_END = os.getenv('NEKO_RESPONSE_ENC_END', '】')


def _split_sentences(text: str) -> list[str]:
    """
    将文本分割成句子。
    
    参数：
    - text: 输入文本
    
    返回：句子列表
    """
    if not text:
        return []
    
    # 按句子结束符分割，保留结束符
    parts = re.split(r'(?<=[。！？!?\.])\s*', text)
    
    # 过滤空字符串
    return [p for p in parts if p.strip()]


def _count_words_or_chars(text: str) -> int:
    # 如果文本中包含空格，则以空格拆分词计数；否则退化为字符数（适用于中文）
    if not text:
        return 0
    if re.search(r'\s', text):
        return len([w for w in text.split() if w])
    return len(text)


def _get_separator(text: str) -> str:
    """
    根据文本内容智能返回连接符：
    - 如果文本包含拉丁字母或空格，使用空格连接（英文）
    - 否则使用空字符串连接（中文）
    """
    if not text:
        return ''
    
    # 检测文本是否包含拉丁字母（A-Za-z）或空格
    if re.search(r'[A-Za-z]|\s', text):
        return ' '  # 英文文本使用空格连接
    else:
        return ''   # 中文文本使用无空格连接


def _is_english_text(text: str) -> bool:
    """
    检测文本是否为英文文本
    
    Args:
        text: 待检测文本
        
    Returns:
        True 如果是英文文本，False 如果是中文文本
    """
    if not text:
        return False
    
    # 检测文本是否包含拉丁字母（A-Za-z）
    return bool(re.search(r'[A-Za-z]', text))


def _truncate_by_words(text: str, max_words: int) -> str:
    """
    按单词截断英文文本
    
    Args:
        text: 原始文本
        max_words: 最大单词数
        
    Returns:
        截断后的文本
    """
    if not text or max_words <= 0:
        return ''
    
    # 分割单词，保留原始分隔符信息
    words = re.split(r'(\s+)', text)
    
    # 计算实际单词数（忽略纯空格）
    actual_words = [w for w in words if w.strip()]
    
    if len(actual_words) <= max_words:
        return text
    
    # 截取前max_words个单词
    truncated_words = []
    word_count = 0
    
    for word in words:
        if word.strip():  # 如果是实际单词
            if word_count >= max_words:
                break
            truncated_words.append(word)
            word_count += 1
        else:  # 如果是空格分隔符
            truncated_words.append(word)
    
    # 重新组合文本
    truncated_text = ''.join(truncated_words).rstrip()
    
    # 确保以标点符号或空格结尾
    if not re.search(r'[.!?\s]$', truncated_text):
        # 如果截断在单词中间，添加省略号
        truncated_text += '…'
    
    return truncated_text


def optimize_response(text: str,
                      max_words: int | None = None,
                      enclosure: Tuple[str, str] | None = None) -> str:
    """
    优化回复文本：去重、限制长度、应用包裹符并保证结构清晰。

    参数：
    - text: 原始回复文本
    - max_words: 最大“词”数（中文时为字符数）。为 None 时使用模块默认；为 0 或负数表示不限制。
    - enclosure: (start, end) 包裹符，为 None 时使用模块默认

    返回：处理后的字符串（已被包裹）。
    """
    if text is None:
        return ''
    text = str(text).strip()
    if enclosure is None:
        enclosure = (DEFAULT_ENC_START, DEFAULT_ENC_END)

    if max_words is None:
        max_words = DEFAULT_MAX_WORDS

    # 允许上游误传字符串等，避免直接炸掉喵
    try:
        max_words_int = int(max_words)
    except (TypeError, ValueError) as e:
        logger.warning("max_words=%r 无法解析为整数，回退默认值 %s: %s", max_words, DEFAULT_MAX_WORDS, e)
        max_words_int = DEFAULT_MAX_WORDS

    # 1) 规范空白
    text = re.sub(r'\s+', ' ', text)

    # 2) 切句并去除完全重复的句子
    sentences = _split_sentences(text)
    seen = set()
    deduped = []
    for s in sentences:
        key = s.strip()
        if not key:
            continue
        if key in seen:
            continue
        seen.add(key)
        deduped.append(key)

    # 3) 合并并按照 max_words 限制（统一使用字符计数）
    start, end = enclosure
    
    # 计算有效的最大长度，预留包裹符空间
    if max_words_int > 0:
        maxw = max_words_int
        # 预留包裹符长度
        enclosure_len = len(start) + len(end)
        effective_maxw = maxw - enclosure_len
        if effective_maxw <= 0:
            # 如果包裹符本身已经超过限制，返回空字符串
            return ''
    else:
        maxw = None
        effective_maxw = None

    if maxw and effective_maxw > 0:
        out_parts = []
        total = 0
        # 提前计算分隔符
        separator = _get_separator(text)
        sep_len = len(separator)
        
        for s in deduped:
            s_len = len(s)
            # 计算包含分隔符的总长度
            separator_cost = sep_len if out_parts else 0
            if total + separator_cost + s_len <= effective_maxw:
                out_parts.append(s)
                total += separator_cost + s_len
            else:
                remain = effective_maxw - total
                if remain > 0:
                    # 截断时需要同时考虑"潜在分隔符 + 省略号"占用
                    separator_cost = sep_len if out_parts else 0
                    available = remain - separator_cost
                    if available <= 0:
                        break

                    # 预留省略号空间（避免补 '…' 后超限）
                    need_ellipsis = not s.rstrip().endswith('…')
                    content_budget = available - (1 if need_ellipsis else 0)
                    if content_budget <= 0:
                        truncated = '…'
                    else:
                        truncated = s[:content_budget].rstrip()
                        if need_ellipsis and not truncated.endswith('…'):
                            truncated = truncated + '…'

                    out_parts.append(truncated)
                break
        
        final = separator.join(out_parts).strip()
    else:
        # 智能连接：检测文本是否包含拉丁字母或空格，决定连接方式
        separator = _get_separator(text)
        final = separator.join(deduped).strip()

    # 4) 小幅清理：去除重复的连续标点
    final = re.sub(r'[。]{2,}', '。', final)
    final = final.strip()

    # 5) 应用 enclosure
    # 如果内容为空，返回空字符串而不是包裹符
    if not final:
        return ''
    
    # 只有当包裹符的start和end都非空时才检查是否已被包裹
    if start and end and final.startswith(start) and final.endswith(end):
        return final

    return f"{start}{final}{end}"


class GenerationTruncated(Exception):
    """
    Exception raised when generation is truncated by constraints.
    Attributes:
        reason: short string reason code ('hard_limit', 'fence', 'word_limit')
        discard_output: whether caller should discard accumulated output (True for hard limit)
        partial_content: allowed content before truncation (for fence detection)
    """
    def __init__(self, reason: str, discard_output: bool = False, partial_content: str = ""):
        super().__init__(f"Generation truncated: {reason}")
        self.reason = reason
        self.discard_output = discard_output
        self.partial_content = partial_content


def init_stream_state(max_words: int | None = None, hard_char_limit: int = 100, fence_char: str = '|') -> dict:
    """Initialize a streaming constraint state dict."""
    return {
        'max_words': max_words if max_words is not None else DEFAULT_MAX_WORDS,
        'hard_char_limit': int(hard_char_limit),
        'fence_char': fence_char,
        'chars': 0,
        'words': 0,
        'terminated': False,
    }


def _count_words_for_state(text: str) -> int:
    return _count_words_or_chars(text)


def process_stream_chunk(state: dict, chunk: str) -> str:
    """
    Process a single incoming generated chunk under constraints.

    Behavior:
    - If fence_char appears anywhere in chunk -> raise GenerationTruncated(reason='fence', discard_output=False) and stop further processing.
    - If adding the chunk would cause cumulative chars > hard_char_limit -> raise GenerationTruncated(reason='hard_limit', discard_output=True).
    - If adding the chunk would cause words > max_words -> truncate the chunk to fit and mark terminated (raise GenerationTruncated with reason='word_limit', discard_output=False) AFTER returning the truncated piece.

    Returns the (possibly truncated) chunk to be emitted. If a GenerationTruncated is raised, caller must handle accordingly.
    """
    if not chunk:
        return ''

    fence = state.get('fence_char', '|')
    hard_limit = int(state.get('hard_char_limit', 100))
    max_words = state.get('max_words')

    # 1) Fence detection: if present anywhere, truncate up to first occurrence and then raise
    if fence in chunk:
        # Truncate chunk before fence and raise
        pos = chunk.find(fence)
        allowed = chunk[:pos]
        if allowed:
            # check hard limit before returning
            if state['chars'] + len(allowed) > hard_limit:
                raise GenerationTruncated('hard_limit', discard_output=True)
            state['chars'] += len(allowed)
            state['words'] += _count_words_for_state(allowed)
        # Store allowed content in exception for caller to use
        exc = GenerationTruncated('fence', discard_output=False, partial_content=allowed)
        raise exc

    # 2) Hard char limit: if adding chunk would exceed, raise and ask to discard output
    if state['chars'] + len(chunk) > hard_limit:
        raise GenerationTruncated('hard_limit', discard_output=True)

    # 3) Word count enforcement: if max_words >0 and adding chunk would exceed, truncate to fit
    if max_words and max_words > 0:
        incoming_words = _count_words_for_state(chunk)
        if state['words'] + incoming_words > max_words:
            # Need to trim chunk to fit remaining word budget
            remain = max_words - state['words']
            if remain <= 0:
                # no budget left, terminate without emitting this chunk
                state['terminated'] = True
                return ''

            # For english-like text split by whitespace, else fall back to char truncation
            if re.search(r'\s', chunk):
                parts = chunk.split()
                if not parts:
                    state['terminated'] = True
                    return ''
                allowed_parts = parts[:remain]
                truncated = ' '.join(allowed_parts)
            else:
                # Chinese/no-space: truncate by characters
                truncated = chunk[:remain]

            # update state with truncated
            state['chars'] += len(truncated)
            state['words'] += _count_words_for_state(truncated)
            # After emitting truncated piece, signal termination
            state['terminated'] = True
            return truncated

    # Normal case: accept whole chunk
    state['chars'] += len(chunk)
    state['words'] += _count_words_for_state(chunk)
    return chunk


if __name__ == '__main__':
    # 简单示例
    demo = "你好！这是第一句。你好！这是第一句。这里有很多无关的重复。这里有很多无关的重复。最后一句。"
    print(optimize_response(demo, max_words=30))
