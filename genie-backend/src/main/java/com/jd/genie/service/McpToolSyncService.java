package com.jd.genie.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.jd.genie.agent.tool.ToolCollection;
import com.jd.genie.agent.tool.mcp.McpTool;
import com.jd.genie.config.GenieConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * MCP工具同步服务
 * 定期检查MCP服务器上的新工具并自动添加到系统中
 */
@Slf4j
@Service
public class McpToolSyncService {

    @Autowired
    private GenieConfig genieConfig;

    // 全局工具集合缓存，存储所有活跃的ToolCollection实例
    private final Map<String, ToolCollection> activeToolCollections = new ConcurrentHashMap<>();
    
    // 已知工具缓存，用于检测新工具
    private final Map<String, Set<String>> knownToolsCache = new ConcurrentHashMap<>();

    /**
     * 注册工具集合到同步服务
     */
    public void registerToolCollection(String sessionId, ToolCollection toolCollection) {
        activeToolCollections.put(sessionId, toolCollection);
        log.info("注册工具集合到同步服务: {}", sessionId);
        
        // 初始化已知工具缓存
        initializeKnownToolsCache(sessionId, toolCollection);
    }

    /**
     * 注销工具集合
     */
    public void unregisterToolCollection(String sessionId) {
        activeToolCollections.remove(sessionId);
        knownToolsCache.remove(sessionId);
        log.info("从同步服务注销工具集合: {}", sessionId);
    }

    /**
     * 初始化已知工具缓存
     */
    private void initializeKnownToolsCache(String sessionId, ToolCollection toolCollection) {
        Set<String> knownTools = new CopyOnWriteArraySet<>();
        if (toolCollection.getMcpToolMap() != null) {
            knownTools.addAll(toolCollection.getMcpToolMap().keySet());
        }
        knownToolsCache.put(sessionId, knownTools);
        log.info("初始化工具缓存: {} 个已知MCP工具", knownTools.size());
    }

    /**
     * 定时同步MCP工具 - 每5分钟执行一次
     */
    @Scheduled(fixedRate = 300000) // 5分钟 = 300000毫秒
    public void syncMcpTools() {
        if (activeToolCollections.isEmpty()) {
            log.debug("没有活跃的工具集合，跳过MCP工具同步");
            return;
        }

        log.info("开始定时同步MCP工具，当前活跃会话数: {}", activeToolCollections.size());

        try {
            String[] mcpServerUrls = genieConfig.getMcpServerUrlArr();
            if (mcpServerUrls == null || mcpServerUrls.length == 0) {
                log.debug("没有配置MCP服务器，跳过同步");
                return;
            }

            // 检查每个MCP服务器的工具
            for (String mcpServer : mcpServerUrls) {
                checkAndSyncServerTools(mcpServer);
            }

        } catch (Exception e) {
            log.error("定时同步MCP工具失败", e);
        }
    }

    /**
     * 检查并同步特定服务器的工具
     */
    private void checkAndSyncServerTools(String mcpServer) {
        try {
            log.debug("检查MCP服务器工具: {}", mcpServer);

            McpTool mcpTool = new McpTool();
            String listToolResult = mcpTool.listTool(mcpServer);
            
            if (listToolResult.isEmpty()) {
                log.warn("MCP服务器 {} 返回空响应", mcpServer);
                return;
            }

            JSONObject resp = JSON.parseObject(listToolResult);
            if (resp.getIntValue("code") != 200) {
                log.warn("MCP服务器 {} 响应错误: code={}, message={}", 
                    mcpServer, resp.getIntValue("code"), resp.getString("message"));
                return;
            }

            JSONArray data = resp.getJSONArray("data");
            if (data == null || data.isEmpty()) {
                log.debug("MCP服务器 {} 没有工具", mcpServer);
                return;
            }

            // 检查每个工具是否为新工具
            int newToolsCount = 0;
            for (int i = 0; i < data.size(); i++) {
                JSONObject tool = data.getJSONObject(i);
                String toolName = tool.getString("name");
                String description = tool.getString("description");
                String inputSchema = tool.getString("inputSchema");

                if (isNewTool(toolName)) {
                    // 添加新工具到所有活跃的工具集合
                    addNewToolToAllCollections(toolName, description, inputSchema, mcpServer);
                    markToolAsKnown(toolName);
                    newToolsCount++;
                }
            }

            if (newToolsCount > 0) {
                log.info("从MCP服务器 {} 发现并添加了 {} 个新工具", mcpServer, newToolsCount);
            }

        } catch (Exception e) {
            log.error("检查MCP服务器 {} 工具时发生错误", mcpServer, e);
        }
    }

    /**
     * 检查是否为新工具
     */
    private boolean isNewTool(String toolName) {
        for (Set<String> knownTools : knownToolsCache.values()) {
            if (knownTools.contains(toolName)) {
                return false; // 已知工具
            }
        }
        return true; // 新工具
    }

    /**
     * 将新工具添加到所有活跃的工具集合
     */
    private void addNewToolToAllCollections(String toolName, String description, 
                                          String inputSchema, String mcpServer) {
        for (Map.Entry<String, ToolCollection> entry : activeToolCollections.entrySet()) {
            String sessionId = entry.getKey();
            ToolCollection toolCollection = entry.getValue();
            
            try {
                toolCollection.addMcpTool(toolName, description, inputSchema, mcpServer);
                log.info("为会话 {} 添加新MCP工具: {}", sessionId, toolName);
            } catch (Exception e) {
                log.error("为会话 {} 添加新MCP工具 {} 失败", sessionId, toolName, e);
            }
        }
    }

    /**
     * 标记工具为已知
     */
    private void markToolAsKnown(String toolName) {
        for (Set<String> knownTools : knownToolsCache.values()) {
            knownTools.add(toolName);
        }
    }

    /**
     * 手动触发同步（用于测试或立即同步）
     */
    public void triggerManualSync() {
        log.info("手动触发MCP工具同步");
        syncMcpTools();
    }

    /**
     * 获取当前活跃会话数
     */
    public int getActiveSessionCount() {
        return activeToolCollections.size();
    }

    /**
     * 获取已知工具总数
     */
    public int getTotalKnownToolsCount() {
        return knownToolsCache.values().stream()
                .mapToInt(Set::size)
                .max()
                .orElse(0);
    }
} 