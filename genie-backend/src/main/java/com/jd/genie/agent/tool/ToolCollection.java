package com.jd.genie.agent.tool;

import com.alibaba.fastjson.JSONObject;
import com.jd.genie.agent.agent.AgentContext;
import com.jd.genie.agent.dto.tool.McpToolInfo;
import com.jd.genie.agent.tool.mcp.McpTool;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;

/**
 * 工具集合类 - 管理可用的工具
 */
@Data
@Slf4j
public class ToolCollection {
    private Map<String, BaseTool> toolMap;
    private Map<String, McpToolInfo> mcpToolMap;
    private AgentContext agentContext;

    /**
     * 数字员工列表
     * task未并发的情况下
     * 1、每一个task，执行时，数字员工列表就会更新
     * TODO 并发情况下需要处理
     */
    private String currentTask;
    private JSONObject digitalEmployees;

    public ToolCollection() {
        this.toolMap = new HashMap<>();
        this.mcpToolMap = new HashMap<>();
    }

    /**
     * 添加工具
     */
    public void addTool(BaseTool tool) {
        toolMap.put(tool.getName(), tool);
    }

    /**
     * 获取工具
     */
    public BaseTool getTool(String name) {
        return toolMap.get(name);
    }

    /**
     * 添加MCP工具
     */
    public void addMcpTool(String name, String desc, String parameters, String mcpServerUrl) {
        mcpToolMap.put(name, McpToolInfo.builder()
                .name(name)
                .desc(desc)
                .parameters(parameters)
                .mcpServerUrl(mcpServerUrl)
                .build());
    }

    /**
     * 获取MCP工具
     */
    public McpToolInfo getMcpTool(String name) {
        return mcpToolMap.get(name);
    }

    /**
     * 获取所有可用工具列表（本地工具 + MCP工具）
     */
    public Map<String, Object> getAllAvailableTools() {
        Map<String, Object> allTools = new HashMap<>();

        // 添加本地工具
        for (Map.Entry<String, BaseTool> entry : toolMap.entrySet()) {
            BaseTool tool = entry.getValue();
            Map<String, Object> toolInfo = new HashMap<>();
            toolInfo.put("name", tool.getName());
            toolInfo.put("description", tool.getDescription());
            toolInfo.put("parameters", "{}");
            toolInfo.put("type", "local");
            allTools.put(entry.getKey(), toolInfo);
        }

        // 添加MCP工具
        for (Map.Entry<String, McpToolInfo> entry : mcpToolMap.entrySet()) {
            McpToolInfo mcpTool = entry.getValue();
            Map<String, Object> toolInfo = new HashMap<>();
            toolInfo.put("name", mcpTool.getName());
            toolInfo.put("description", mcpTool.getDesc());
            toolInfo.put("parameters", mcpTool.getParameters());
            toolInfo.put("type", "mcp");
            toolInfo.put("mcpServerUrl", mcpTool.getMcpServerUrl());
            allTools.put(entry.getKey(), toolInfo);
        }

        log.info("获取所有可用工具，本地工具: {}, MCP工具: {}, 总计: {}",
            toolMap.size(), mcpToolMap.size(), allTools.size());

        return allTools;
    }

    /**
     * 获取工具统计信息
     */
    public Map<String, Object> getToolStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("localToolsCount", toolMap.size());
        stats.put("mcpToolsCount", mcpToolMap.size());
        stats.put("totalToolsCount", toolMap.size() + mcpToolMap.size());

        // 本地工具名称列表
        List<String> localToolNames = new ArrayList<>(toolMap.keySet());
        stats.put("localToolNames", localToolNames);

        // MCP工具名称列表
        List<String> mcpToolNames = new ArrayList<>(mcpToolMap.keySet());
        stats.put("mcpToolNames", mcpToolNames);

        return stats;
    }


    /**
     * 执行工具
     */
    public Object execute(String name, Object toolInput) {
        log.info("开始执行工具: {}, 输入: {}", name, toolInput);

        try {
            if (toolMap.containsKey(name)) {
                BaseTool tool = getTool(name);
                log.info("找到工具: {}, 开始执行", name);
                Object result = tool.execute(toolInput);
                log.info("工具 {} 执行完成，结果: {}", name, result);
                return result;
            } else if (mcpToolMap.containsKey(name)) {
                McpToolInfo toolInfo = mcpToolMap.get(name);
                McpTool mcpTool = new McpTool();
                mcpTool.setAgentContext(agentContext);
                return mcpTool.callTool(toolInfo.getMcpServerUrl(), name, toolInput);
            } else {
                log.error("错误: 未知工具 {}", name);
                return "错误: 未知工具 " + name;
            }
        } catch (Exception e) {
            log.error("工具 {} 执行异常: ", name, e);
            return "工具 " + name + " 执行失败: " + e.getMessage();
        }
    }

    /**
     * 设置数字员工
     */
    public void updateDigitalEmployee(JSONObject digitalEmployee) {
        if (digitalEmployee == null) {
            log.error("setDigitalEmployee: {}", digitalEmployee);
        }
        setDigitalEmployees(digitalEmployee);
    }

    /**
     * 获取数字员工名称
     */
    public String getDigitalEmployee(String toolName) {
        if (StringUtils.isEmpty(toolName)) {
            return null;
        }

        if (digitalEmployees == null) {
            return null;
        }

        return (String) digitalEmployees.get(toolName);
    }
}