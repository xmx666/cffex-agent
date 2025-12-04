package com.jd.genie.service;

import com.alibaba.fastjson.JSON;
import com.jd.genie.model.dto.TemplateConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/**
 * 模板管理服务
 * 提供模板配置的持久化存储（使用文件存储）
 */
@Slf4j
@Service
public class TemplateManagementService {
    
    private static final String TEMPLATE_CONFIG_FILE = "templates_config.json";
    private static final String CONFIG_DIR = "config";
    
    /**
     * 获取配置文件路径
     */
    private String getConfigFilePath() {
        String userDir = System.getProperty("user.dir");
        Path configDir = Paths.get(userDir, CONFIG_DIR);
        
        // 确保配置目录存在
        try {
            if (!Files.exists(configDir)) {
                Files.createDirectories(configDir);
                log.info("创建配置目录: {}", configDir);
            }
        } catch (IOException e) {
            log.error("创建配置目录失败", e);
        }
        
        return Paths.get(configDir.toString(), TEMPLATE_CONFIG_FILE).toString();
    }
    
    /**
     * 获取全局模板配置
     */
    public TemplateConfig getGlobalTemplateConfig() {
        String filePath = getConfigFilePath();
        File configFile = new File(filePath);
        
        // 如果文件不存在，返回默认配置
        if (!configFile.exists()) {
            log.info("模板配置文件不存在，返回默认配置: {}", filePath);
            return TemplateConfig.getDefault();
        }
        
        try {
            // 读取文件内容
            String content = new String(Files.readAllBytes(Paths.get(filePath)), StandardCharsets.UTF_8);
            
            if (content == null || content.trim().isEmpty()) {
                log.warn("模板配置文件为空，返回默认配置");
                return TemplateConfig.getDefault();
            }
            
            // 解析JSON
            TemplateConfig config = JSON.parseObject(content, TemplateConfig.class);
            
            // 确保所有字段不为null
            if (config.getDomains() == null) {
                config.setDomains(TemplateConfig.getDefault().getDomains());
            }
            if (config.getTemplateList() == null) {
                config.setTemplateList(new ArrayList<>());
            }

            log.info("成功加载模板配置，领域数: {}, 模板数: {}",
                    config.getDomains().size(),
                    config.getTemplateList().size());

            return config;
        } catch (Exception e) {
            log.error("读取模板配置文件失败: {}", filePath, e);
            return TemplateConfig.getDefault();
        }
    }

    /**
     * 保存全局模板配置
     */
    public void saveGlobalTemplateConfig(TemplateConfig config) {
        String filePath = getConfigFilePath();

        try {
            // 确保配置目录存在
            File configFile = new File(filePath);
            File parentDir = configFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            // 转换为JSON并保存
            String jsonContent = JSON.toJSONString(config, true);

            try (FileWriter writer = new FileWriter(configFile, StandardCharsets.UTF_8)) {
                writer.write(jsonContent);
                writer.flush();
            }

            log.info("成功保存模板配置到文件: {}", filePath);
            log.info("配置内容 - 领域数: {}, 模板数: {}",
                    config.getDomains() != null ? config.getDomains().size() : 0,
                    config.getTemplateList() != null ? config.getTemplateList().size() : 0);
        } catch (Exception e) {
            log.error("保存模板配置文件失败: {}", filePath, e);
            throw new RuntimeException("保存模板配置失败: " + e.getMessage(), e);
        }
    }

    /**
     * 更新模板列表
     */
    public void updateTemplateList(List<TemplateConfig.Template> templateList) {
        TemplateConfig config = getGlobalTemplateConfig();
        config.setTemplateList(templateList != null ? templateList : new ArrayList<>());
        saveGlobalTemplateConfig(config);
    }

    /**
     * 更新领域列表
     */
    public void updateDomains(List<TemplateConfig.TemplateDomain> domains) {
        TemplateConfig config = getGlobalTemplateConfig();
        config.setDomains(domains != null ? domains : TemplateConfig.getDefault().getDomains());
        saveGlobalTemplateConfig(config);
    }

    // updateSelectedTemplateIds 已移除，selectedTemplateIds改为用户级别存储（前端localStorage）
}

