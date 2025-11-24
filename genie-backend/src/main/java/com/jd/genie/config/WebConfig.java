package com.jd.genie.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web配置类 - 配置静态资源访问
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 配置工作空间文件访问 - 使用/static/workspace前缀完全避免路由冲突
        String workspacePath = System.getProperty("user.dir") + "/workspace";
        registry.addResourceHandler("/static/workspace/**")
                .addResourceLocations("file:" + workspacePath + "/")
                .setCachePeriod(0); // 禁用缓存，确保文件更新后能立即访问

        // 配置本地静态资源访问 - 用于提供本地部署的CSS/JS文件
        String staticResourcesPath = System.getProperty("user.dir") + "/static-resources";
        registry.addResourceHandler("/static-resources/**")
                .addResourceLocations("file:" + staticResourcesPath + "/")
                .setCachePeriod(3600); // 缓存1小时，静态资源更新频率低
    }
} 