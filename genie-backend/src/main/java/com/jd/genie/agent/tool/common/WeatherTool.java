package com.jd.genie.agent.tool.common;

import com.jd.genie.agent.agent.AgentContext;
import com.jd.genie.agent.tool.BaseTool;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;

/**
 * 天气查询工具类
 * 实现BaseTool接口，提供天气查询功能
 */
@Slf4j
@Data
public class WeatherTool implements BaseTool {
    
    private AgentContext agentContext;

    @Override
    public String getName() {
        return "agent_weather";
    }

    @Override
    public String getDescription() {
        return "这是一个可以查询天气的智能体，能够根据提供的地点信息返回天气信息";
    }

    @Override
    public Map<String, Object> toParams() {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        
        Map<String, Object> properties = new HashMap<>();
        
        Map<String, Object> locationParam = new HashMap<>();
        locationParam.put("type", "string");
        locationParam.put("description", "需要查询天气的地点，例如：北京、上海、深圳等");
        properties.put("location", locationParam);
        
        parameters.put("properties", properties);
        parameters.put("required", new String[]{"location"});
        
        return parameters;
    }

    @Override
    public Object execute(Object input) {
        try {
            if (input instanceof Map) {
                Map<String, Object> inputMap = (Map<String, Object>) input;
                String location = (String) inputMap.get("location");
                
                if (location == null || location.trim().isEmpty()) {
                    return "错误：请提供有效的地点信息";
                }
                
                log.info("{} 查询天气信息，地点: {}", 
                    agentContext != null ? agentContext.getRequestId() : "unknown", location);
                
                // 这里可以集成真实的天气API服务
                // 目前返回模拟数据
                return getWeatherInfo(location);
            } else {
                return "错误：输入参数格式不正确，需要提供包含location字段的JSON对象";
            }
        } catch (Exception e) {
            log.error("{} 天气查询失败", 
                agentContext != null ? agentContext.getRequestId() : "unknown", e);
            return "天气查询失败：" + e.getMessage();
        }
    }
    
    /**
     * 获取天气信息（模拟实现）
     * 在实际应用中，这里可以调用真实的天气API服务
     */
    private String getWeatherInfo(String location) {
        // 模拟天气数据
        String[] weatherConditions = {
            "晴朗", "多云", "阴天", "小雨", "中雨", "大雨", "雪", "雾霾"
        };
        
        String[] temperatures = {
            "15°C", "18°C", "22°C", "25°C", "28°C", "30°C", "12°C", "20°C"
        };
        
        int index = Math.abs(location.hashCode()) % weatherConditions.length;
        String weather = weatherConditions[index];
        String temperature = temperatures[index];
        
        return String.format("地点：%s\n天气：%s\n温度：%s\n湿度：65%%\n风力：3级\n空气质量：良好", 
            location, weather, temperature);
    }
} 