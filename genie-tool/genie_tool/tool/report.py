# -*- coding: utf-8 -*-
# =====================
# 
# 
# Author: liumin.423
# Date:   2025/7/7
# =====================
import os
from datetime import datetime
from typing import Optional, List, Literal, AsyncGenerator

from dotenv import load_dotenv
from jinja2 import Template
from loguru import logger

from genie_tool.util.file_util import download_all_files, truncate_files, flatten_search_file
from genie_tool.util.prompt_util import get_prompt
from genie_tool.util.llm_util import ask_llm
from genie_tool.util.log_util import timer
from genie_tool.model.context import LLMModelInfoFactory

load_dotenv()


@timer(key="enter")
async def report(
        task: str,
        file_names: Optional[List[str]] = tuple(),
        model: str = "gpt-4.1",
        file_type: Literal["markdown", "html", "ppt"] = "markdown",
        tool_results: Optional[List[str]] = None,
) -> AsyncGenerator:
    report_factory = {
        "ppt": ppt_report,
        "markdown": markdown_report,
        "html": html_report,
    }
    model = os.getenv("REPORT_MODEL", "gpt-4.1")
    async for chunk in report_factory[file_type](task, file_names, model, tool_results=tool_results):
        yield chunk


@timer(key="enter")
async def ppt_report(
        task: str,
        file_names: Optional[List[str]] = tuple(),
        model: str = "gpt-4.1",
        temperature: float = None,
        top_p: float = 0.6,
        tool_results: Optional[List[str]] = None,
) -> AsyncGenerator:
    files = await download_all_files(file_names)
    flat_files = []

    # 1. 首先解析 md html 文件，没有这部分文件则使用全部
    filtered_files = [f for f in files if f["file_name"].split(".")[-1] in ["md", "html"]
                      and not f["file_name"].endswith("_搜索结果.md")] or files
    for f in filtered_files:
        # 对于搜索文件有结构，需要重新解析
        if f["file_name"].endswith("_search_result.txt"):
            flat_files.extend(flatten_search_file(f))
        else:
            flat_files.append(f)

    # 添加工具调用结果到上下文（不包含标题，标题由模板统一管理）
    tool_results_text = ""
    if tool_results and len(tool_results) > 0:
        tool_results_text = "\n\n---\n\n".join(tool_results)  # 不包含标题，标题由模板统一管理
        logger.info(f"ppt_report 接收到 {len(tool_results)} 个工具调用结果")

    truncate_flat_files = truncate_files(flat_files,
                                         max_tokens=int(LLMModelInfoFactory.get_context_length(model) * 0.8))
    # 将工具调用结果作为单独参数传递给模板，放在最前面
    prompt = Template(get_prompt("report")["ppt_prompt"]) \
        .render(
        tool_results=tool_results_text if tool_results_text else None,
        task=task,
        files=truncate_flat_files,
        date=datetime.now().strftime("%Y-%m-%d")
    )

    async for chunk in ask_llm(messages=prompt, model=model, stream=True,
                               temperature=temperature, top_p=top_p, only_content=True):
        yield chunk


@timer(key="enter")
async def markdown_report(
        task,
        file_names: Optional[List[str]] = tuple(),
        model: str = "gpt-4.1",
        temperature: float = 0,
        top_p: float = 0.9,
        tool_results: Optional[List[str]] = None,
) -> AsyncGenerator:
    files = await download_all_files(file_names)
    flat_files = []
    for f in files:
        # 对于搜索文件有结构，需要重新解析
        if f["file_name"].endswith("_search_result.txt"):
            flat_files.extend(flatten_search_file(f))
        else:
            flat_files.append(f)

    # 添加工具调用结果到上下文（不包含标题，标题由模板统一管理）
    tool_results_text = ""
    if tool_results and len(tool_results) > 0:
        tool_results_text = "\n\n---\n\n".join(tool_results)  # 不包含标题，标题由模板统一管理
        logger.info(f"markdown_report 接收到 {len(tool_results)} 个工具调用结果")

    truncate_flat_files = truncate_files(flat_files,
                                         max_tokens=int(LLMModelInfoFactory.get_context_length(model) * 0.8))
    # 将工具调用结果作为单独参数传递给模板，放在最前面
    prompt = Template(get_prompt("report")["markdown_prompt"]) \
        .render(
        tool_results=tool_results_text if tool_results_text else None,
        task=task,
        files=truncate_flat_files,
        current_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )

    async for chunk in ask_llm(messages=prompt, model=model, stream=True,
                               temperature=temperature, top_p=top_p, only_content=True, filter_think=True,
                               is_report_generation=True):
        yield chunk


@timer(key="enter")
async def html_report(
        task,
        file_names: Optional[List[str]] = tuple(),
        model: str = "gpt-4.1",
        temperature: float = 0,
        top_p: float = 0.9,
        tool_results: Optional[List[str]] = None,
) -> AsyncGenerator:
    files = await download_all_files(file_names)
    key_files = []
    flat_files = []
    # 对于搜索文件有结构，需要重新解析
    for f in files:
        fpath = f["file_name"]
        fname = os.path.basename(fpath)
        if fname.split(".")[-1] in ["md", "txt", "csv"]:
            # CI 输出结果
            if "代码输出" in fname:
                key_files.append({"content": f["content"], "description": fname, "type": "txt", "link": fpath})
            # 搜索文件
            elif fname.endswith("_search_result.txt"):
                try:
                    flat_files.extend([{
                        "content": tf["content"],
                        "description": tf.get("title") or tf["content"][:20],
                        "type": "txt",
                        "link": tf.get("link"),
                    } for tf in flatten_search_file(f)
                    ])
                except Exception as e:
                    logger.warning(f"html_report parser file [{fpath}] error: {e}")
            # 其他文件
            else:
                flat_files.append({
                    "content": f["content"],
                    "description": fname,
                    "type": "txt",
                    "link": fpath
                })

    # 添加工具调用结果到上下文（不包含标题，标题由模板统一管理）
    tool_results_text = ""
    logger.info(
        f"html_report 接收参数: tool_results={tool_results is not None}, 数量={len(tool_results) if tool_results else 0}")
    if tool_results and len(tool_results) > 0:
        tool_results_text = "\n\n---\n\n".join(tool_results)  # 不包含标题，标题由模板统一管理
        logger.info(f"html_report 接收到 {len(tool_results)} 个工具调用结果，总长度: {len(tool_results_text)}")
        logger.debug(f"html_report 第一个工具结果预览: {tool_results[0][:200] if tool_results[0] else 'None'}...")
    else:
        logger.warning(f"html_report 未接收到工具调用结果！tool_results={tool_results}")

    discount = int(LLMModelInfoFactory.get_context_length(model) * 0.8)
    key_files = truncate_files(key_files, max_tokens=discount)
    flat_files = truncate_files(flat_files, max_tokens=discount - sum([len(f["content"]) for f in key_files]))

    report_prompts = get_prompt("report")
    # 将工具调用结果作为单独参数传递给模板，放在最前面
    task_prompt = Template(report_prompts["html_task"]) \
        .render(
        tool_results=tool_results_text if tool_results_text else None,
        task=task,
        key_files=key_files,
        files=flat_files,
        date=datetime.now().strftime('%Y年%m月%d日')
    )

    # 将网页生成要求和格式规范放在最后，避免prompt太长影响大模型对任务的理解
    system_prompt = report_prompts["html_prompt"]
    # 组合完整的 user prompt：任务内容在前，格式规范在后
    full_user_prompt = task_prompt + "\n\n===\n\n" + system_prompt

    # 输出最终发送给大模型的完整 prompt（完整输出，不做拆分，保证和最终给的输入一模一样）
    logger.info("=" * 80)
    logger.info("html_report 最终发送给大模型的完整 USER PROMPT（完整内容，不做拆分）:")
    logger.info("=" * 80)
    logger.info(full_user_prompt)
    logger.info("=" * 80)
    logger.info(f"html_report prompt统计: 总长度={len(full_user_prompt)}")

    async for chunk in ask_llm(
            messages=[{"role": "user", "content": full_user_prompt}],
            model=model, stream=True, temperature=temperature, top_p=top_p, only_content=True, filter_think=True,
            is_report_generation=True):
        yield chunk


if __name__ == "__main__":
    pass
