# -*- coding: utf-8 -*-
# =====================
# 
# 
# Author: liumin.423
# Date:   2025/7/8
# =====================
import json
import os
import re
from typing import List, Any, Optional

from litellm import acompletion

from genie_tool.util.log_util import timer, AsyncTimer
from genie_tool.util.sensitive_detection import SensitiveWordsReplace


def filter_think_content(content: str, is_report_generation: bool = False) -> str:
    """
    过滤模型输出中的think内容
    Args:
        content: 原始内容
        is_report_generation: 是否为报告生成场景
    Returns:
        过滤后的内容
    """
    if not content:
        return content
    
    # 如果是报告生成场景，需要更严格的过滤，但要保留HTML格式
    if is_report_generation:
        # 对于报告生成场景（HTML/PPT/Markdown报告），所有内容都应该保留原始格式
        # 因为报告生成时，大模型返回的代码格式是正确的，不应该被修改
        # 只过滤明显的think标签内容，不进行任何strip操作
        
        think_markers = [
            '思考：', '让我想想', '我需要', '首先', '然后', '接下来',
            'think:', 'thinking:', 'let me think', 'i need to'
        ]
        
        # 只过滤明显的think标签内容，不进行行级别的strip
        patterns = [
            r'<think>.*?</think>',  # <think>标签内容
            r'<thinking>.*?</thinking>',  # <thinking>标签内容
        ]
        
        for pattern in patterns:
            content = re.sub(pattern, '', content, flags=re.DOTALL | re.IGNORECASE)
        
        # 检查是否有明显的think标记行（但不要strip，保留原始格式）
        lines = content.split('\n')
        filtered_lines = []
        
        for line in lines:
            # 对于报告生成场景，不strip，保留原始格式（包括空格）
            # 只跳过明显的思考过程行
            line_lower = line.lower().strip()
            if any(marker in line_lower for marker in think_markers):
                continue
            filtered_lines.append(line)  # 保留原始格式，不strip
        
        return '\n'.join(filtered_lines)
    
    # 通用过滤：移除明显的思考过程标记
    think_markers = [
        '思考：', '让我想想', '我需要', '首先', '然后', '接下来',
        'think:', 'thinking:', 'let me think', 'i need to'
    ]
    
    lines = content.split('\n')
    filtered_lines = []
    
    for line in lines:
        line = line.strip()
        # 跳过明显的思考过程行
        if any(marker in line.lower() for marker in think_markers):
            continue
        # 跳过空行
        if not line:
            continue
        filtered_lines.append(line)
    
    return '\n'.join(filtered_lines)


@timer(key="enter")
async def ask_llm(
        messages: str | List[Any],
        model: str,
        temperature: float = None,
        top_p: float = None,
        stream: bool = False,

        # 自定义字段
        only_content: bool = False,     # 只返回内容
        filter_think: bool = False,     # 是否过滤think内容
        is_report_generation: bool = False,  # 是否为报告生成场景

        extra_headers: Optional[dict] = None,
        **kwargs,
):
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    if os.getenv("SENSITIVE_WORD_REPLACE", "false") == "true":
        for message in messages:
            if isinstance(message.get("content"), str):
                message["content"] = SensitiveWordsReplace.replace(message["content"])
            else:
                message["content"] = json.loads(
                    SensitiveWordsReplace.replace(json.dumps(message["content"], ensure_ascii=False)))
    # 为qwen3模型添加think控制参数
    if "qwen3" in model.lower():
        kwargs["chat_template_kwargs"] = {"enable_thinking": False}
    
    # 如果是报告生成场景，记录完整的消息格式用于调试
    if is_report_generation:
        import json
        from loguru import logger
        logger.info("=" * 80)
        logger.info("ask_llm 最终发送给大模型的完整消息（完整内容，不做拆分）:")
        logger.info("=" * 80)
        logger.info(json.dumps(messages, ensure_ascii=False, indent=2))
        logger.info("=" * 80)
    
    response = await acompletion(
        messages=messages,
        model=model,
        temperature=temperature,
        top_p=top_p,
        stream=stream,
        extra_headers=extra_headers,
        **kwargs
    )
    async with AsyncTimer(key=f"exec ask_llm"):
        if stream:
            async for chunk in response:
                if only_content:
                    if chunk.choices and chunk.choices[0] and chunk.choices[0].delta and chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        if filter_think:
                            content = filter_think_content(content, is_report_generation)
                        yield content
                else:
                    yield chunk
        else:
            content = response.choices[0].message.content if only_content else response
            if only_content and filter_think:
                content = filter_think_content(content, is_report_generation)
            yield content


if __name__ == "__main__":
    pass
