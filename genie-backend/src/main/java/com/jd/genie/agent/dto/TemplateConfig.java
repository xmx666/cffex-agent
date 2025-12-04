package com.jd.genie.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * 模板配置DTO
 * 用于前后端数据传输
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateConfig {
    
    /**
     * 模板领域列表
     */
    private List<TemplateDomain> domains;
    
    /**
     * 模板列表
     */
    private List<Template> templateList;
    
    // selectedTemplateIds 已移除，改为用户级别存储（前端localStorage）

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TemplateDomain {
        private String id;
        private String name;
        private String description;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Template {
        private String id;
        private String name;
        private String description;
        private String content;
        private String domainId;
        private Boolean enabled;
        private Long createdAt;
        private Long updatedAt;
    }

    /**
     * 获取默认配置
     */
    public static TemplateConfig getDefault() {
        List<TemplateDomain> defaultDomains = new ArrayList<>();
        defaultDomains.add(TemplateDomain.builder().id("default").name("通用").build());
        defaultDomains.add(TemplateDomain.builder().id("data-analysis").name("数据分析").build());
        defaultDomains.add(TemplateDomain.builder().id("content-creation").name("内容创作").build());
        defaultDomains.add(TemplateDomain.builder().id("code-optimization").name("代码优化").build());
        defaultDomains.add(TemplateDomain.builder().id("problem-solving").name("问题解决").build());

        return TemplateConfig.builder()
                .domains(defaultDomains)
                .templateList(new ArrayList<>())
                .build();
    }
}

