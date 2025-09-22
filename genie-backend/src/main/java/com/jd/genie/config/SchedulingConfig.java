package com.jd.genie.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 定时任务配置
 * 启用Spring的定时任务功能，用于MCP工具同步等定时任务
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
} 