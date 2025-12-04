package com.jd.genie.controller;

import com.jd.genie.model.dto.TemplateConfig;
import com.jd.genie.service.TemplateManagementService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 模板管理控制器
 * 提供模板配置的API接口
 */
@Slf4j
@RestController
@RequestMapping("/api/templates")
public class TemplateManagementController {

    @Autowired
    private TemplateManagementService templateManagementService;

    /**
     * 获取全局模板配置
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getTemplateConfig() {
        try {
            TemplateConfig config = templateManagementService.getGlobalTemplateConfig();
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("data", config);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("获取模板配置失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "获取模板配置失败: " + e.getMessage());
            
            return ResponseEntity.status(500).body(result);
        }
    }

    /**
     * 保存全局模板配置
     */
    @PostMapping("/config")
    public ResponseEntity<Map<String, Object>> saveTemplateConfig(@RequestBody TemplateConfig config) {
        try {
            templateManagementService.saveGlobalTemplateConfig(config);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("message", "模板配置已保存");
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("保存模板配置失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "保存模板配置失败: " + e.getMessage());
            
            return ResponseEntity.status(500).body(result);
        }
    }

    /**
     * 更新模板列表
     */
    @PutMapping("/list")
    public ResponseEntity<Map<String, Object>> updateTemplateList(@RequestBody List<TemplateConfig.Template> templateList) {
        try {
            templateManagementService.updateTemplateList(templateList);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("message", "模板列表已更新");
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("更新模板列表失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "更新模板列表失败: " + e.getMessage());
            
            return ResponseEntity.status(500).body(result);
        }
    }

    /**
     * 更新领域列表
     */
    @PutMapping("/domains")
    public ResponseEntity<Map<String, Object>> updateDomains(@RequestBody List<TemplateConfig.TemplateDomain> domains) {
        try {
            templateManagementService.updateDomains(domains);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("message", "领域列表已更新");
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("更新领域列表失败", e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "更新领域列表失败: " + e.getMessage());
            
            return ResponseEntity.status(500).body(result);
        }
    }

    // updateSelectedTemplateIds 接口已移除，selectedTemplateIds改为用户级别存储（前端localStorage）
}

