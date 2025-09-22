# -*- coding: utf-8 -*-
# =====================
# 自定义OpenAI格式接口LLM工具类
# 支持自定义模型名称和自定义接口
# =====================
import json
import os
from typing import List, Any, Optional, Dict

from litellm import acompletion

from genie_tool.util.log_util import timer, AsyncTimer
from genie_tool.util.sensitive_detection import SensitiveWordsReplace


class CustomLLMConfig:
    """自定义LLM配置类"""
    
    def __init__(self):
        self.api_key = os.getenv("CUSTOM_OPENAI_API_KEY", "")
        self.base_url = os.getenv("CUSTOM_OPENAI_BASE_URL", "")
        self.model_name = os.getenv("CUSTOM_MODEL_NAME", "deepseek-ai/DeepSeek-R1")
        self.extra_headers = self._parse_extra_headers()
    
    def _parse_extra_headers(self) -> Dict[str, str]:
        """解析额外的请求头"""
        headers_str = os.getenv("CUSTOM_OPENAI_EXTRA_HEADERS", "{}")
        try:
            return json.loads(headers_str)
        except json.JSONDecodeError:
            return {}
    
    def is_configured(self) -> bool:
        """检查配置是否完整"""
        return bool(self.api_key and self.base_url and self.model_name)
    
    def get_litellm_model_name(self) -> str:
        """获取litellm格式的模型名称"""
        # 格式：openai/custom_model_name
        return f"openai/{self.model_name}"


@timer(key="enter")
async def ask_custom_llm(
        messages: str | List[Any],
        model: str = None,
        temperature: float = None,
        top_p: float = None,
        stream: bool = False,
        only_content: bool = False,
        **kwargs,
):
    """
    使用自定义OpenAI格式接口调用LLM
    
    Args:
        messages: 消息列表或字符串
        model: 模型名称（可选，默认使用配置中的模型）
        temperature: 温度参数
        top_p: top_p参数
        stream: 是否流式响应
        only_content: 是否只返回内容
        **kwargs: 其他参数
    """
    config = CustomLLMConfig()
    
    if not config.is_configured():
        raise ValueError(
            "自定义LLM未配置完整，请检查以下环境变量：\n"
            "- CUSTOM_OPENAI_API_KEY\n"
            "- CUSTOM_OPENAI_BASE_URL\n"
            "- CUSTOM_MODEL_NAME"
        )
    
    # 格式化消息
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    
    # 敏感词过滤
    if os.getenv("SENSITIVE_WORD_REPLACE", "false") == "true":
        for message in messages:
            if isinstance(message.get("content"), str):
                message["content"] = SensitiveWordsReplace.replace(message["content"])
            else:
                message["content"] = json.loads(
                    SensitiveWordsReplace.replace(json.dumps(message["content"], ensure_ascii=False))
                )
    
    # 使用配置的模型名称
    model_to_use = model or config.model_name
    
    # 准备litellm参数
    litellm_params = {
        "messages": messages,
        "model": config.get_litellm_model_name(),
        "temperature": temperature,
        "top_p": top_p,
        "stream": stream,
        "api_base": config.base_url,
        "api_key": config.api_key,
    }
    
    # 添加额外的请求头
    if config.extra_headers:
        litellm_params["extra_headers"] = config.extra_headers
    
    # 添加其他参数
    litellm_params.update(kwargs)
    
    try:
        response = await acompletion(**litellm_params)
        
        async with AsyncTimer(key=f"exec ask_custom_llm"):
            if stream:
                async for chunk in response:
                    if only_content:
                        if chunk.choices and chunk.choices[0] and chunk.choices[0].delta and chunk.choices[0].delta.content:
                            yield chunk.choices[0].delta.content
                    else:
                        yield chunk
            else:
                # 修复：处理响应内容
                if hasattr(response, 'choices') and response.choices:
                    if only_content:
                        content = response.choices[0].message.content if hasattr(response.choices[0].message, 'content') else str(response.choices[0])
                        yield content
                    else:
                        yield response
                else:
                    yield str(response) if only_content else response
                    
    except Exception as e:
        raise Exception(f"调用自定义LLM失败: {str(e)}")


async def test_custom_llm_connection():
    """测试自定义LLM连接"""
    try:
        config = CustomLLMConfig()
        if not config.is_configured():
            return False, "配置不完整"
        
        # 发送测试消息
        test_message = "你好，这是一个连接测试。"
        async for response in ask_custom_llm(test_message, only_content=True):
            if response:
                return True, "连接成功"
        
        return False, "未收到响应"
        
    except Exception as e:
        return False, f"连接失败: {str(e)}"


def get_custom_llm_info() -> Dict[str, Any]:
    """获取自定义LLM配置信息"""
    config = CustomLLMConfig()
    return {
        "configured": config.is_configured(),
        "model_name": config.model_name,
        "base_url": config.base_url,
        "api_key": "***" if config.api_key else "",
        "extra_headers": config.extra_headers,
        "litellm_model_name": config.get_litellm_model_name() if config.is_configured() else ""
    }


if __name__ == "__main__":
    import asyncio
    
    async def main():
        # 测试连接
        success, message = await test_custom_llm_connection()
        print(f"连接测试: {message}")
        
        # 显示配置信息
        info = get_custom_llm_info()
        print(f"配置信息: {json.dumps(info, ensure_ascii=False, indent=2)}")
    
    asyncio.run(main()) 