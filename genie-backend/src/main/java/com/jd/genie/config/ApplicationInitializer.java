package com.jd.genie.config;

import com.jd.genie.service.McpServerManagementService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 应用启动初始化器
 * 在应用启动时初始化MCP服务器配置
 */
@Slf4j
@Component
public class ApplicationInitializer implements ApplicationRunner {

    @Autowired
    private McpServerManagementService mcpServerManagementService;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        log.info("开始初始化应用配置...");
        
        try {
            // 初始化默认MCP服务器配置
            mcpServerManagementService.initializeDefaultServers();
            log.info("MCP服务器配置初始化完成");
        } catch (Exception e) {
            log.error("MCP服务器配置初始化失败", e);
        }
        
        log.info("应用配置初始化完成");
    }
}
