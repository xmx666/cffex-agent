package com.jd.genie.controller;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.jd.genie.agent.agent.AgentContext;
import com.jd.genie.agent.printer.Printer;
import com.jd.genie.agent.printer.SSEPrinter;
import com.jd.genie.agent.tool.ToolCollection;
import com.jd.genie.agent.tool.common.CodeInterpreterTool;
import com.jd.genie.agent.tool.common.DeepSearchTool;
import com.jd.genie.agent.tool.common.FileTool;
import com.jd.genie.agent.tool.common.ReportTool;
import com.jd.genie.agent.tool.common.WeatherTool;
import com.jd.genie.agent.tool.common.TranslationTool;
import com.jd.genie.agent.tool.common.CalculatorTool;
import com.jd.genie.agent.tool.common.StockTool;
import com.jd.genie.agent.tool.common.NewsDataFetchTool;
import com.jd.genie.agent.tool.common.NewsContentGeneratorTool;
import com.jd.genie.agent.tool.common.NewsTTSTool;
import com.jd.genie.agent.tool.mcp.McpTool;
import com.jd.genie.agent.util.DateUtil;
import com.jd.genie.agent.util.ThreadUtil;
import com.jd.genie.config.GenieConfig;
import com.jd.genie.model.req.AgentRequest;
import com.jd.genie.model.req.GptQueryReq;
import com.jd.genie.service.AgentHandlerService;
import com.jd.genie.service.IGptProcessService;
import com.jd.genie.service.McpToolSyncService;
import com.jd.genie.service.impl.AgentHandlerFactory;
import com.jd.genie.service.McpServerManagementService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.UnsupportedEncodingException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import com.jd.genie.agent.tool.BaseTool;

@Slf4j
@RestController
@RequestMapping("/")
public class GenieController {
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(5);
    private static final long HEARTBEAT_INTERVAL = 10_000L; // 10秒心跳间隔
    @Autowired
    protected GenieConfig genieConfig;
    @Autowired
    private AgentHandlerFactory agentHandlerFactory;
    @Autowired
    private IGptProcessService gptProcessService;
    @Autowired
    private McpToolSyncService mcpToolSyncService;
    @Autowired
    private McpServerManagementService mcpServerManagementService;

    /**
     * 开启SSE心跳
     * @param emitter
     * @param requestId
     * @return
     */
    private ScheduledFuture<?> startHeartbeat(SseEmitter emitter, String requestId) {
        return executor.scheduleAtFixedRate(() -> {
            try {
                // 发送心跳消息
                log.info("{} send heartbeat", requestId);
                emitter.send("heartbeat");
            } catch (Exception e) {
                // 发送心跳失败，关闭连接
                log.error("{} heartbeat failed, closing connection", requestId, e);
                emitter.completeWithError(e);
            }
        }, HEARTBEAT_INTERVAL, HEARTBEAT_INTERVAL, TimeUnit.MILLISECONDS);
    }

    /**
     * 注册SSE事件
     * @param emitter
     * @param requestId
     * @param heartbeatFuture
     */
    private void registerSSEMonitor(SseEmitter emitter, String requestId, ScheduledFuture<?> heartbeatFuture) {
        // 监听SSE异常事件
        emitter.onCompletion(() -> {
            log.info("{} SSE connection completed normally", requestId);
            heartbeatFuture.cancel(true);
            // 从MCP工具同步服务注销工具集合
            mcpToolSyncService.unregisterToolCollection(requestId);
        });

        // 监听连接超时事件
        emitter.onTimeout(() -> {
            log.info("{} SSE connection timed out", requestId);
            heartbeatFuture.cancel(true);
            emitter.complete();
            // 从MCP工具同步服务注销工具集合
            mcpToolSyncService.unregisterToolCollection(requestId);
        });

        // 监听连接错误事件
        emitter.onError((ex) -> {
            log.info("{} SSE connection error: ", requestId, ex);
            heartbeatFuture.cancel(true);
            emitter.completeWithError(ex);
            // 从MCP工具同步服务注销工具集合
            mcpToolSyncService.unregisterToolCollection(requestId);
        });
    }

    /**
     * 执行智能体调度
     * @param request
     * @return
     * @throws UnsupportedEncodingException
     */
    @PostMapping("/AutoAgent")
    public SseEmitter AutoAgent(@RequestBody AgentRequest request) throws UnsupportedEncodingException {

        log.info("{} auto agent request: {}", request.getRequestId(), JSON.toJSONString(request));

        Long AUTO_AGENT_SSE_TIMEOUT = 60 * 60 * 1000L;

        SseEmitter emitter = new SseEmitter(AUTO_AGENT_SSE_TIMEOUT);
        // SSE心跳
        ScheduledFuture<?> heartbeatFuture = startHeartbeat(emitter, request.getRequestId());
        // 监听SSE事件
        registerSSEMonitor(emitter, request.getRequestId(), heartbeatFuture);
        // 拼接输出类型
        request.setQuery(handleOutputStyle(request));
        // 执行调度引擎
        ThreadUtil.execute(() -> {
            try {
                Printer printer = new SSEPrinter(emitter, request, request.getAgentType());
                AgentContext agentContext = AgentContext.builder()
                        .requestId(request.getRequestId())
                        .sessionId(request.getRequestId())
                        .printer(printer)
                        .query(request.getQuery())
                        .task("")
                        .dateInfo(DateUtil.CurrentDateInfo())
                        .productFiles(new ArrayList<>())
                        .taskProductFiles(new ArrayList<>())
                        .sopPrompt(request.getSopPrompt())
                        .basePrompt(request.getBasePrompt())
                        .agentType(request.getAgentType())
                        .isStream(Objects.nonNull(request.getIsStream()) ? request.getIsStream() : false)
                        .build();

                // 构建工具列表
                agentContext.setToolCollection(buildToolCollection(agentContext, request));
                // 根据数据类型获取对应的处理器
                AgentHandlerService handler = agentHandlerFactory.getHandler(agentContext, request);
                // 执行处理逻辑
                handler.handle(agentContext, request);
                // 关闭连接
                emitter.complete();

            } catch (Exception e) {
                log.error("{} auto agent error", request.getRequestId(), e);
            }
        });

        return emitter;
    }


    /**
     * html模式： query+以 html展示
     * docs模式：query+以 markdown展示
     * table 模式: query+以 excel 展示
     */
    private String handleOutputStyle(AgentRequest request) {
        String query = request.getQuery();
        Map<String, String> outputStyleMap = genieConfig.getOutputStylePrompts();
        if (!StringUtils.isEmpty(request.getOutputStyle())) {
            query += outputStyleMap.computeIfAbsent(request.getOutputStyle(), k -> "");
        }
        return query;
    }


    /**
     * 构建工具列表
     *
     * @param agentContext
     * @param request
     * @return
     */
    private ToolCollection buildToolCollection(AgentContext agentContext, AgentRequest request) {

        ToolCollection toolCollection = new ToolCollection();
        toolCollection.setAgentContext(agentContext);
        // file
        FileTool fileTool = new FileTool();
        fileTool.setAgentContext(agentContext);
        toolCollection.addTool(fileTool);

        // default tool
        List<String> agentToolList = Arrays.asList(genieConfig.getMultiAgentToolListMap()
                .getOrDefault("default", "search,code,report").split(","));
        if (!agentToolList.isEmpty()) {
            if (agentToolList.contains("code")) {
                CodeInterpreterTool codeTool = new CodeInterpreterTool();
                codeTool.setAgentContext(agentContext);
                toolCollection.addTool(codeTool);
            }
            if (agentToolList.contains("report")) {
                ReportTool htmlTool = new ReportTool();
                htmlTool.setAgentContext(agentContext);
                toolCollection.addTool(htmlTool);
            }
            // 内网环境禁用deep_search工具，避免网络连接错误
            // if (agentToolList.contains("search")) {
            //     DeepSearchTool deepSearchTool = new DeepSearchTool();
            //     deepSearchTool.setAgentContext(agentContext);
            //     toolCollection.addTool(deepSearchTool);
            // }
        }

        // 自定义Agent工具
//         WeatherTool weatherTool = new WeatherTool();
//         weatherTool.setAgentContext(agentContext);
//         toolCollection.addTool(weatherTool);

        TranslationTool translationTool = new TranslationTool();
        translationTool.setAgentContext(agentContext);
        toolCollection.addTool(translationTool);

        CalculatorTool calculatorTool = new CalculatorTool();
        calculatorTool.setAgentContext(agentContext);
        toolCollection.addTool(calculatorTool);

        // 新增新闻查询工具（带容错机制）
        NewsDataFetchTool newsDataFetchTool = new NewsDataFetchTool();
        newsDataFetchTool.setAgentContext(agentContext);
        toolCollection.addTool(newsDataFetchTool);
        log.info("{} 成功注册新闻工具: agent_news", agentContext.getRequestId());

        // 立即验证工具注册
        BaseTool registeredTool = toolCollection.getTool("agent_news");
        if (registeredTool != null) {
            log.info("{} 验证成功: agent_news 工具已注册，工具名称: {}",
                agentContext.getRequestId(), registeredTool.getName());
        } else {
            log.error("{} 验证失败: agent_news 工具注册失败！", agentContext.getRequestId());
        }

        // 新增股票查询工具
//         StockTool stockTool = new StockTool();
//         stockTool.setAgentContext(agentContext);
//         toolCollection.addTool(stockTool);
//         log.info("{} 成功注册股票工具: agent_stock", agentContext.getRequestId());

        // 新增新闻内容生成工具
        NewsContentGeneratorTool newsContentGeneratorTool = new NewsContentGeneratorTool();
        newsContentGeneratorTool.setAgentContext(agentContext);
        toolCollection.addTool(newsContentGeneratorTool);

        // 新增新闻TTS工具
        NewsTTSTool newsTTSTool = new NewsTTSTool();
        newsTTSTool.setAgentContext(agentContext);
        toolCollection.addTool(newsTTSTool);

        // mcp tool
        try {
            McpTool mcpTool = new McpTool();
            mcpTool.setAgentContext(agentContext);

            // 使用动态MCP服务器配置
            String[] activeMcpServerUrls = mcpServerManagementService.getActiveMcpServerUrls();
            if (activeMcpServerUrls.length == 0) {
                // 如果没有动态配置，回退到默认配置
                activeMcpServerUrls = genieConfig.getMcpServerUrlArr();
            }

            for (String mcpServer : activeMcpServerUrls) {
                String listToolResult = mcpTool.listTool(mcpServer);
                if (listToolResult.isEmpty()) {
                    log.error("{} mcp server {} invalid", agentContext.getRequestId(), mcpServer);
                    continue;
                }

                JSONObject resp = JSON.parseObject(listToolResult);
                if (resp.getIntValue("code") != 200) {
                    log.error("{} mcp serve {} code: {}, message: {}", agentContext.getRequestId(), mcpServer,
                            resp.getIntValue("code"), resp.getString("message"));
                    continue;
                }
                JSONArray data = resp.getJSONArray("data");
                if (data.isEmpty()) {
                    log.error("{} mcp serve {} code: {}, message: {}", agentContext.getRequestId(), mcpServer,
                            resp.getIntValue("code"), resp.getString("message"));
                    continue;
                }
                for (int i = 0; i < data.size(); i++) {
                    JSONObject tool = data.getJSONObject(i);
                    String method = tool.getString("name");
                    String description = tool.getString("description");
                    String inputSchema = tool.getString("inputSchema");
                    toolCollection.addMcpTool(method, description, inputSchema, mcpServer);
                }
            }

            // 注册工具集合到MCP同步服务
            mcpToolSyncService.registerToolCollection(agentContext.getRequestId(), toolCollection);

        } catch (Exception e) {
            log.error("{} add mcp tool failed", agentContext.getRequestId(), e);
        }

        // 工具注册完成，显示总结
        log.info("{} 工具注册完成，共注册 {} 个工具",
            agentContext.getRequestId(), toolCollection.getToolMap().size());
        for (BaseTool tool : toolCollection.getToolMap().values()) {
            log.info("{} 已注册工具: {}", agentContext.getRequestId(), tool.getName());
        }

        return toolCollection;
    }

    /**
     * 探活接口
     *
     * @return
     */
    @RequestMapping(value = "/web/health", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("ok");
    }


    /**
     * 处理Agent流式增量查询请求，返回SSE事件流
     * @param params 查询请求参数对象，包含GPT查询所需信息
     * @return 返回SSE事件发射器，用于流式传输增量响应结果
     */
    @RequestMapping(value = "/web/api/v1/gpt/queryAgentStreamIncr", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter queryAgentStreamIncr(@RequestBody GptQueryReq params) {
        return gptProcessService.queryMultiAgentIncrStream(params);
    }

    /**
     * 手动触发MCP工具同步
     * @return 同步结果信息
     */
    @PostMapping("/admin/mcp/sync")
    public ResponseEntity<Map<String, Object>> triggerMcpToolSync() {
        try {
            mcpToolSyncService.triggerManualSync();

            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("message", "MCP工具同步已触发");
            result.put("activeSessionCount", mcpToolSyncService.getActiveSessionCount());
            result.put("totalKnownToolsCount", mcpToolSyncService.getTotalKnownToolsCount());
            result.put("timestamp", LocalDateTime.now().toString());

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("手动触发MCP工具同步失败", e);

            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "MCP工具同步失败: " + e.getMessage());
            result.put("timestamp", LocalDateTime.now().toString());

            return ResponseEntity.status(500).body(result);
        }
    }

    /**
     * 获取MCP工具同步状态
     * @return 同步状态信息
     */
    @RequestMapping("/admin/mcp/status")
    public ResponseEntity<Map<String, Object>> getMcpToolSyncStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("activeSessionCount", mcpToolSyncService.getActiveSessionCount());
        status.put("totalKnownToolsCount", mcpToolSyncService.getTotalKnownToolsCount());
        status.put("timestamp", LocalDateTime.now().toString());
        status.put("syncInterval", "5 minutes");

        return ResponseEntity.ok(status);
    }

}
    