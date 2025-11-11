package com.jd.genie.controller;

import com.jd.genie.model.dto.McpServerConfig;
import com.jd.genie.service.McpServerManagementService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MCP服务器管理控制器
 * 提供MCP服务器的增删改查和状态管理功能
 */
@Slf4j
@RestController
@RequestMapping("/admin/mcp")
public class McpServerManagementController {

    @Autowired
    private McpServerManagementService mcpServerManagementService;

    /**
     * 获取所有MCP服务器配置
     */
    @GetMapping("/servers")
    public ResponseEntity<Map<String, Object>> getAllMcpServers() {
        try {
            List<McpServerConfig> servers = mcpServerManagementService.getAllMcpServers();
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("data", servers);
            result.put("total", servers.size());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("获取MCP服务器列表失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "获取MCP服务器列表失败: " + e.getMessage());
            
            return ResponseEntity.status(500).body(result);
        }
    }

    /**
     * 获取启用的MCP服务器配置
     */
    @GetMapping("/servers/enabled")
    public ResponseEntity<Map<String, Object>> getEnabledMcpServers() {
        try {
            List<McpServerConfig> servers = mcpServerManagementService.getEnabledMcpServers();
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("data", servers);
            result.put("total", servers.size());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("获取启用的MCP服务器列表失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "获取启用的MCP服务器列表失败: " + e.getMessage());
            
            return ResponseEntity.status(500).body(result);
        }
    }

    /**
     * 添加新的MCP服务器
     */
    @PostMapping("/servers")
    public ResponseEntity<Map<String, Object>> addMcpServer(@RequestBody Map<String, String> request) {
        try {
            String name = request.get("name");
            String url = request.get("url");
            String description = request.get("description");
            
            if (name == null || name.trim().isEmpty()) {
                throw new IllegalArgumentException("服务器名称不能为空");
            }
            if (url == null || url.trim().isEmpty()) {
                throw new IllegalArgumentException("服务器地址不能为空");
            }
            
            McpServerConfig config = mcpServerManagementService.addMcpServer(
                name.trim(), url.trim(), description != null ? description.trim() : "");
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("message", "MCP服务器添加成功");
            result.put("data", config);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("添加MCP服务器失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "添加MCP服务器失败: " + e.getMessage());
            
            return ResponseEntity.status(400).body(result);
        }
    }

    /**
     * 更新MCP服务器配置
     */
    @PutMapping("/servers/{id}")
    public ResponseEntity<Map<String, Object>> updateMcpServer(
            @PathVariable String id,
            @RequestBody Map<String, Object> request) {
        try {
            String name = (String) request.get("name");
            String url = (String) request.get("url");
            String description = (String) request.get("description");
            Boolean enabled = (Boolean) request.get("enabled");
            
            if (name == null || name.trim().isEmpty()) {
                throw new IllegalArgumentException("服务器名称不能为空");
            }
            if (url == null || url.trim().isEmpty()) {
                throw new IllegalArgumentException("服务器地址不能为空");
            }
            
            McpServerConfig config = mcpServerManagementService.updateMcpServer(
                id, name.trim(), url.trim(), 
                description != null ? description.trim() : "", 
                enabled != null ? enabled : true);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("message", "MCP服务器更新成功");
            result.put("data", config);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("更新MCP服务器失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "更新MCP服务器失败: " + e.getMessage());
            
            return ResponseEntity.status(400).body(result);
        }
    }

    /**
     * 删除MCP服务器
     */
    @DeleteMapping("/servers/{id}")
    public ResponseEntity<Map<String, Object>> deleteMcpServer(@PathVariable String id) {
        try {
            boolean deleted = mcpServerManagementService.deleteMcpServer(id);
            
            Map<String, Object> result = new HashMap<>();
            if (deleted) {
                result.put("status", "success");
                result.put("message", "MCP服务器删除成功");
            } else {
                result.put("status", "error");
                result.put("message", "MCP服务器不存在或删除失败");
            }
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("删除MCP服务器失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "删除MCP服务器失败: " + e.getMessage());
            
            return ResponseEntity.status(500).body(result);
        }
    }

    /**
     * 启用/禁用MCP服务器
     */
    @PutMapping("/servers/{id}/toggle")
    public ResponseEntity<Map<String, Object>> toggleMcpServer(
            @PathVariable String id,
            @RequestBody Map<String, Boolean> request) {
        try {
            Boolean enabled = request.get("enabled");
            if (enabled == null) {
                throw new IllegalArgumentException("enabled参数不能为空");
            }
            
            McpServerConfig config = mcpServerManagementService.toggleMcpServer(id, enabled);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("message", enabled ? "MCP服务器已启用" : "MCP服务器已禁用");
            result.put("data", config);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("切换MCP服务器状态失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "切换MCP服务器状态失败: " + e.getMessage());
            
            return ResponseEntity.status(400).body(result);
        }
    }

    /**
     * 测试MCP服务器连接
     */
    @PostMapping("/servers/{id}/test")
    public ResponseEntity<Map<String, Object>> testMcpServer(@PathVariable String id) {
        try {
            McpServerConfig config = mcpServerManagementService.testMcpServer(id);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("message", "MCP服务器连接测试完成");
            result.put("data", config);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("测试MCP服务器连接失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "测试MCP服务器连接失败: " + e.getMessage());
            
            return ResponseEntity.status(400).body(result);
        }
    }

    /**
     * 批量测试所有MCP服务器连接
     */
    @PostMapping("/servers/test-all")
    public ResponseEntity<Map<String, Object>> testAllMcpServers() {
        try {
            List<McpServerConfig> servers = mcpServerManagementService.testAllMcpServers();
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("message", "所有MCP服务器连接测试完成");
            result.put("data", servers);
            result.put("total", servers.size());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("批量测试MCP服务器连接失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "批量测试MCP服务器连接失败: " + e.getMessage());
            
            return ResponseEntity.status(500).body(result);
        }
    }

    /**
     * 获取当前生效的MCP服务器URL数组
     */
    @GetMapping("/servers/active-urls")
    public ResponseEntity<Map<String, Object>> getActiveMcpServerUrls() {
        try {
            String[] urls = mcpServerManagementService.getActiveMcpServerUrls();
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("data", urls);
            result.put("total", urls.length);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("获取生效的MCP服务器URL失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "获取生效的MCP服务器URL失败: " + e.getMessage());
            
            return ResponseEntity.status(500).body(result);
        }
    }
}
