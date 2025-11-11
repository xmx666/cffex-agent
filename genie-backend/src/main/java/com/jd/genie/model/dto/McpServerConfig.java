package com.jd.genie.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MCP服务器配置DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpServerConfig {
    
    /**
     * 服务器ID
     */
    private String id;
    
    /**
     * 服务器名称
     */
    private String name;
    
    /**
     * 服务器地址
     */
    private String url;
    
    /**
     * 服务器描述
     */
    private String description;
    
    /**
     * 是否启用
     */
    private Boolean enabled;
    
    /**
     * 创建时间
     */
    private String createdAt;
    
    /**
     * 更新时间
     */
    private String updatedAt;
    
    /**
     * 连接状态（运行时状态）
     */
    private String status;
    
    /**
     * 工具数量
     */
    private Integer toolCount;
}
