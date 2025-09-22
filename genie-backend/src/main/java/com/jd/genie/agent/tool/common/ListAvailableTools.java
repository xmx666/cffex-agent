package com.jd.genie.agent.tool.common;

import com.alibaba.fastjson.JSON;
import com.jd.genie.agent.agent.AgentContext;
import com.jd.genie.agent.tool.BaseTool;
import com.jd.genie.agent.tool.ToolCollection;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;

/**
 * 列出所有可用工具的工具类
 * 包括本地工具和MCP工具
 */
@Slf4j
@Data
public class ListAvailableTools implements BaseTool {

    private AgentContext agentContext;

    public ListAvailableTools() {
        // 不需要super()调用，因为实现的是接口
    }

    @Override
    public String getName() {
        return "_list_available_tools";
    }

    @Override
    public String getDescription() {
        return "列出系统中所有可用的工具，包括本地工具和MCP工具";
    }

    @Override
    public Map<String, Object> toParams() {
        return new HashMap<>();
    }

    @Override
    public Object execute(Object input) {
        try {
            log.info("开始执行工具列表查询");

            // 获取工具集合
            ToolCollection toolCollection = agentContext.getToolCollection();
            if (toolCollection == null) {
                log.error("工具集合为空");
                return "错误: 工具集合未初始化";
            }

            // 获取工具统计信息
            Map<String, Object> stats = toolCollection.getToolStatistics();
            log.info("工具统计信息: {}", stats);

            // 获取所有可用工具
            Map<String, Object> allTools = toolCollection.getAllAvailableTools();
            log.info("获取到 {} 个工具", allTools.size());

            // 构建响应结果
            Map<String, Object> result = new HashMap<>();
            result.put("code", 200);
            result.put("message", "成功获取工具列表");
            result.put("data", allTools);
            result.put("statistics", stats);

            String jsonResult = JSON.toJSONString(result, true);
            log.info("工具列表查询完成，返回 {} 个工具", allTools.size());

            return jsonResult;

        } catch (Exception e) {
            log.error("获取工具列表失败", e);
            
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("code", 500);
            errorResult.put("message", "获取工具列表失败: " + e.getMessage());
            errorResult.put("data", new HashMap<>());
            errorResult.put("statistics", new HashMap<>());
            
            return JSON.toJSONString(errorResult);
        }
    }
} 