# -*- coding: utf-8 -*-
# =====================
#
#
# Author: liumin.423
# Date:   2025/7/7
# =====================
import json
import os
import time

from fastapi import APIRouter
from sse_starlette import ServerSentEvent, EventSourceResponse
from loguru import logger

from genie_tool.model.code import ActionOutput, CodeOuput
from genie_tool.model.protocal import CIRequest, ReportRequest, DeepSearchRequest
from genie_tool.util.file_util import upload_file
from genie_tool.tool.report import report
from genie_tool.tool.code_interpreter import code_interpreter_agent
from genie_tool.util.middleware_util import RequestHandlerRoute
from genie_tool.tool.deepsearch import DeepSearch

router = APIRouter(route_class=RequestHandlerRoute)


@router.post("/code_interpreter")
async def post_code_interpreter(
    body: CIRequest,
):
     # 处理文件路径
    if body.file_names:
        for idx, f_name in enumerate(body.file_names):
            if not f_name.startswith("/") and not f_name.startswith("http"):
                body.file_names[idx] = f"{os.getenv('FILE_SERVER_URL')}/preview/{body.request_id}/{f_name}"

    async def _stream():
        acc_content = ""
        acc_token = 0
        acc_time = time.time()
        async for chunk in code_interpreter_agent(
            task=body.task,
            file_names=body.file_names,
            request_id=body.request_id,
            stream=True,
        ):


            if isinstance(chunk, CodeOuput):
                yield ServerSentEvent(
                    data=json.dumps(
                        {
                            "requestId": body.request_id,
                            "code": chunk.code,
                            "fileInfo": chunk.file_list,
                            "isFinal": False,
                        },
                        ensure_ascii=False,
                    )
                )
            elif isinstance(chunk, ActionOutput):
                yield ServerSentEvent(
                    data=json.dumps(
                        {
                            "requestId": body.request_id,
                            "codeOutput": chunk.content,
                            "fileInfo": chunk.file_list,
                            "isFinal": True,
                        },
                        ensure_ascii=False,
                    )
                )
                yield ServerSentEvent(data="[DONE]")
            else:
                acc_content += chunk
                acc_token += 1
                if body.stream_mode.mode == "general":
                    yield ServerSentEvent(
                        data=json.dumps(
                            {"requestId": body.request_id, "data": chunk, "isFinal": False},
                            ensure_ascii=False,
                        )
                    )
                elif body.stream_mode.mode == "token":
                    if acc_token >= body.stream_mode.token:
                        yield ServerSentEvent(
                            data=json.dumps(
                                {
                                    "requestId": body.request_id,
                                    "data": acc_content,
                                    "isFinal": False,
                                },
                                ensure_ascii=False,
                            )
                        )
                        acc_token = 0
                        acc_content = ""
                elif body.stream_mode.mode == "time":
                    if time.time() - acc_time > body.stream_mode.time:
                        yield ServerSentEvent(
                            data=json.dumps(
                                {
                                    "requestId": body.request_id,
                                    "data": acc_content,
                                    "isFinal": False,
                                },
                                ensure_ascii=False,
                            )
                        )
                        acc_time = time.time()
                        acc_content = ""
                if body.stream_mode.mode in ["time", "token"] and acc_content:
                    yield ServerSentEvent(
                        data=json.dumps(
                            {
                                "requestId": body.request_id,
                                "data": acc_content,
                                "isFinal": False,
                            },
                            ensure_ascii=False,
                        )
                    )
            

    if body.stream:
        return EventSourceResponse(
            _stream(),
            ping_message_factory=lambda: ServerSentEvent(data="heartbeat"),
            ping=15,
        )
    else:
        content = ""
        async for chunk in code_interpreter_agent(
            task=body.task,
            file_names=body.file_names,
            stream=body.stream,
        ):
            content += chunk
        file_info = [
            await upload_file(
                content=content,
                file_name=body.file_name,
                request_id=body.request_id,
                file_type="html" if body.file_type == "ppt" else body.file_type,
            )
        ]
        return {
            "code": 200,
            "data": content,
            "fileInfo": file_info,
            "requestId": body.request_id,
        }


@router.post("/report")
async def post_report(
    body: ReportRequest,
):
    # 处理文件路径
    if body.file_names:
        for idx, f_name in enumerate(body.file_names):
            if not f_name.startswith("/") and not f_name.startswith("http"):
                body.file_names[idx] = f"{os.getenv('FILE_SERVER_URL')}/preview/{body.request_id}/{f_name}"
    
    def _parser_html_content(content: str):
        """
        移除markdown代码块标记，保留原始HTML格式
        大模型返回的HTML代码本身是正确的，不需要修复空格
        """
        if content.startswith("```\nhtml"):
            content = content[len("```\nhtml"): ]
        if content.startswith("```html"):
            content = content[len("```html"): ]
        if content.endswith("```"):
            content = content[: -3]
        
        # 只移除markdown代码块标记，不修改HTML内容本身
        # 大模型返回的HTML代码格式是正确的，应该原样保留
        return content

    async def _stream():
        content = ""
        acc_content = ""
        acc_token = 0
        acc_time = time.time()
        # 调试：检查 tool_results 是否接收
        tool_results = getattr(body, 'tool_results', None)
        logger.info(f"post_report 接收到 tool_results: {tool_results is not None}, 数量: {len(tool_results) if tool_results else 0}")
        if tool_results:
            logger.info(f"post_report tool_results 第一个结果长度: {len(tool_results[0]) if tool_results[0] else 0}")
        async for chunk in report(
            task=body.task,
            file_names=body.file_names,
            file_type=body.file_type,
            tool_results=tool_results,
        ):
            content += chunk
            acc_content += chunk
            acc_token += 1
            if body.stream_mode.mode == "general":
                yield ServerSentEvent(
                    data=json.dumps(
                        {"requestId": body.request_id, "data": chunk, "isFinal": False},
                        ensure_ascii=False,
                    )
                )
            elif body.stream_mode.mode == "token":
                if acc_token >= body.stream_mode.token:
                    yield ServerSentEvent(
                        data=json.dumps(
                            {
                                "requestId": body.request_id,
                                "data": acc_content,
                                "isFinal": False,
                            },
                            ensure_ascii=False,
                        )
                    )
                    acc_token = 0
                    acc_content = ""
            elif body.stream_mode.mode == "time":
                if time.time() - acc_time > body.stream_mode.time:
                    yield ServerSentEvent(
                        data=json.dumps(
                            {
                                "requestId": body.request_id,
                                "data": acc_content,
                                "isFinal": False,
                            },
                            ensure_ascii=False,
                        )
                    )
                    acc_time = time.time()
                    acc_content = ""
        if body.stream_mode.mode in ["time", "token"] and acc_content:
            yield ServerSentEvent(
                data=json.dumps({"requestId": body.request_id, "data": acc_content, "isFinal": False},
                                ensure_ascii=False))
        if body.file_type in ["ppt", "html"]:
            content = _parser_html_content(content)
        file_info = [await upload_file(content=content, file_name=body.file_name, request_id=body.request_id,
                                 file_type="html" if body.file_type == "ppt" else body.file_type)]
        yield ServerSentEvent(data=json.dumps(
            {"requestId": body.request_id, "data": content, "fileInfo": file_info,
             "isFinal": True}, ensure_ascii=False))
        yield ServerSentEvent(data="[DONE]")

    if body.stream:
        return EventSourceResponse(
            _stream(),
            ping_message_factory=lambda: ServerSentEvent(data="heartbeat"),
            ping=15,
        )
    else:
        content = ""
        async for chunk in report(
            task=body.task,
            file_names=body.file_names,
            file_type=body.file_type,
            tool_results=getattr(body, 'tool_results', None),
        ):
            content += chunk
        if body.file_type in ["ppt", "html"]:
            content = _parser_html_content(content)
        file_info = [await upload_file(content=content, file_name=body.file_name, request_id=body.request_id,
                                 file_type="html" if body.file_type == "ppt" else body.file_type)]
        return {"code": 200, "data": content, "fileInfo": file_info, "requestId": body.request_id}


@router.post("/deepsearch")
async def post_deepsearch(
    body: DeepSearchRequest,
):
    """深度搜索端点"""
    deepsearch = DeepSearch(engines=body.search_engines)
    async def _stream():
        async for chunk in deepsearch.run(
                query=body.query,
                request_id=body.request_id,
                max_loop=body.max_loop,
                stream=True,
                stream_mode=body.stream_mode,
        ):
            yield ServerSentEvent(data=chunk)
        yield ServerSentEvent(data="[DONE]")

    return EventSourceResponse(_stream(), ping_message_factory=lambda: ServerSentEvent(data="heartbeat"), ping=15)

