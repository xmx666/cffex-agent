package com.jd.genie.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.jd.genie.agent.tool.mcp.McpTool;
import com.jd.genie.config.GenieConfig;
import com.jd.genie.model.dto.McpServerConfig;
import com.jd.genie.service.McpServerManagementService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * MCP服务器管理服务
 * 提供动态添加、删除、启用、禁用MCP服务器的功能
 */
@Slf4j
@Service
public class McpServerManagementService {

    @Autowired
    private GenieConfig genieConfig;

    // 动态MCP服务器配置存储
    private final Map<String, McpServerConfig> dynamicMcpServers = new ConcurrentHashMap<>();
    
    // 默认MCP服务器配置（从application.yml读取）
    private final Map<String, McpServerConfig> defaultMcpServers = new ConcurrentHashMap<>();

    /**
     * 初始化默认MCP服务器配置
     */
    public void initializeDefaultServers() {
        String[] defaultUrls = genieConfig.getMcpServerUrlArr();
        if (defaultUrls != null && defaultUrls.length > 0) {
            for (int i = 0; i < defaultUrls.length; i++) {
                String url = defaultUrls[i].trim();
                if (!url.isEmpty()) {
                    McpServerConfig config = McpServerConfig.builder()
                            .id("default_" + i)
                            .name("默认MCP服务器" + (i + 1))
                            .url(url)
                            .description("从application.yml配置的默认MCP服务器")
                            .enabled(true)
                            .createdAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                            .updatedAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                            .status("unknown")
                            .toolCount(0)
                            .build();
                    defaultMcpServers.put(config.getId(), config);
                }
            }
        }
        log.info("初始化默认MCP服务器配置完成，共{}个", defaultMcpServers.size());
    }

    /**
     * 获取所有MCP服务器配置（默认+动态）
     */
    public List<McpServerConfig> getAllMcpServers() {
        List<McpServerConfig> allServers = new ArrayList<>();
        
        // 添加默认服务器
        allServers.addAll(defaultMcpServers.values());
        
        // 添加动态服务器
        allServers.addAll(dynamicMcpServers.values());
        
        // 按创建时间排序
        allServers.sort(Comparator.comparing(McpServerConfig::getCreatedAt));
        
        return allServers;
    }

    /**
     * 获取启用的MCP服务器配置
     */
    public List<McpServerConfig> getEnabledMcpServers() {
        return getAllMcpServers().stream()
                .filter(McpServerConfig::getEnabled)
                .toList();
    }

    /**
     * 添加新的MCP服务器
     */
    public McpServerConfig addMcpServer(String name, String url, String description) {
        // 验证URL格式
        if (!isValidUrl(url)) {
            throw new IllegalArgumentException("无效的URL格式: " + url);
        }
        
        // 检查URL是否已存在
        if (isUrlExists(url)) {
            throw new IllegalArgumentException("MCP服务器地址已存在: " + url);
        }
        
        String id = "dynamic_" + System.currentTimeMillis();
        McpServerConfig config = McpServerConfig.builder()
                .id(id)
                .name(name)
                .url(url)
                .description(description)
                .enabled(true)
                .createdAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .updatedAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .status("unknown")
                .toolCount(0)
                .build();
        
        dynamicMcpServers.put(id, config);
        log.info("添加新的MCP服务器: {} - {}", name, url);
        
        return config;
    }

    /**
     * 更新MCP服务器配置
     */
    public McpServerConfig updateMcpServer(String id, String name, String url, String description, Boolean enabled) {
        McpServerConfig config = dynamicMcpServers.get(id);
        if (config == null) {
            throw new IllegalArgumentException("MCP服务器不存在: " + id);
        }
        
        // 验证URL格式
        if (!isValidUrl(url)) {
            throw new IllegalArgumentException("无效的URL格式: " + url);
        }
        
        // 检查URL是否被其他服务器使用
        if (!url.equals(config.getUrl()) && isUrlExists(url)) {
            throw new IllegalArgumentException("MCP服务器地址已被其他服务器使用: " + url);
        }
        
        config.setName(name);
        config.setUrl(url);
        config.setDescription(description);
        config.setEnabled(enabled);
        config.setUpdatedAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        
        log.info("更新MCP服务器配置: {} - {}", name, url);
        return config;
    }

    /**
     * 删除MCP服务器
     */
    public boolean deleteMcpServer(String id) {
        McpServerConfig config = dynamicMcpServers.remove(id);
        if (config != null) {
            log.info("删除MCP服务器: {} - {}", config.getName(), config.getUrl());
            return true;
        }
        return false;
    }

    /**
     * 启用/禁用MCP服务器
     */
    public McpServerConfig toggleMcpServer(String id, Boolean enabled) {
        McpServerConfig config = dynamicMcpServers.get(id);
        if (config == null) {
            throw new IllegalArgumentException("MCP服务器不存在: " + id);
        }
        
        config.setEnabled(enabled);
        config.setUpdatedAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        
        log.info("{}MCP服务器: {} - {}", enabled ? "启用" : "禁用", config.getName(), config.getUrl());
        return config;
    }

    /**
     * 测试MCP服务器连接
     */
    public McpServerConfig testMcpServer(String id) {
        McpServerConfig config = getAllMcpServers().stream()
                .filter(s -> s.getId().equals(id))
                .findFirst()
                .orElse(null);
        
        if (config == null) {
            throw new IllegalArgumentException("MCP服务器不存在: " + id);
        }
        
        try {
            McpTool mcpTool = new McpTool();
            String listToolResult = mcpTool.listTool(config.getUrl());
            
            if (listToolResult.isEmpty()) {
                config.setStatus("error");
                config.setToolCount(0);
            } else {
                JSONObject resp = JSON.parseObject(listToolResult);
                if (resp.getIntValue("code") == 200) {
                    JSONArray data = resp.getJSONArray("data");
                    config.setStatus("connected");
                    config.setToolCount(data != null ? data.size() : 0);
                } else {
                    config.setStatus("error");
                    config.setToolCount(0);
                }
            }
        } catch (Exception e) {
            log.error("测试MCP服务器连接失败: {}", config.getUrl(), e);
            config.setStatus("error");
            config.setToolCount(0);
        }
        
        config.setUpdatedAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return config;
    }

    /**
     * 批量测试所有MCP服务器连接
     */
    public List<McpServerConfig> testAllMcpServers() {
        List<McpServerConfig> allServers = getAllMcpServers();
        for (McpServerConfig config : allServers) {
            testMcpServer(config.getId());
        }
        return allServers;
    }

    /**
     * 获取当前生效的MCP服务器URL数组
     */
    public String[] getActiveMcpServerUrls() {
        return getEnabledMcpServers().stream()
                .map(McpServerConfig::getUrl)
                .toArray(String[]::new);
    }

    /**
     * 验证URL格式
     */
    private boolean isValidUrl(String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }
        return url.startsWith("http://") || url.startsWith("https://");
    }

    /**
     * 检查URL是否已存在
     */
    private boolean isUrlExists(String url) {
        return getAllMcpServers().stream()
                .anyMatch(config -> config.getUrl().equals(url));
    }
}
