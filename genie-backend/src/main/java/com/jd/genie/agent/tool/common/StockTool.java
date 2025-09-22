package com.jd.genie.agent.tool.common;

import com.jd.genie.agent.agent.AgentContext;
import com.jd.genie.agent.tool.BaseTool;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;

/**
 * 股票查询工具类
 * 实现BaseTool接口，提供股票信息查询功能
 */
@Slf4j
@Data
public class StockTool implements BaseTool {
    
    private AgentContext agentContext;
    private Random random = new Random();

    @Override
    public String getName() {
        return "agent_stock";
    }

    @Override
    public String getDescription() {
        return "这是一个可以查询股票信息的智能体，能够根据股票代码返回股票价格、涨跌幅等信息";
    }

    @Override
    public Map<String, Object> toParams() {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        
        Map<String, Object> properties = new HashMap<>();
        
        Map<String, Object> stockCodeParam = new HashMap<>();
        stockCodeParam.put("type", "string");
        stockCodeParam.put("description", "股票代码，例如：000001（平安银行）、600036（招商银行）等");
        properties.put("stockCode", stockCodeParam);
        
        Map<String, Object> infoTypeParam = new HashMap<>();
        infoTypeParam.put("type", "string");
        infoTypeParam.put("description", "查询信息类型：basic（基本信息）、price（价格信息）、analysis（分析信息）");
        infoTypeParam.put("enum", new String[]{"basic", "price", "analysis"});
        infoTypeParam.put("default", "basic");
        properties.put("infoType", infoTypeParam);
        
        parameters.put("properties", properties);
        parameters.put("required", new String[]{"stockCode"});
        
        return parameters;
    }

    @Override
    public Object execute(Object input) {
        try {
            if (input instanceof Map) {
                Map<String, Object> inputMap = (Map<String, Object>) input;
                String stockCode = (String) inputMap.get("stockCode");
                String infoType = (String) inputMap.getOrDefault("infoType", "basic");
                
                if (stockCode == null || stockCode.trim().isEmpty()) {
                    return "错误：请提供有效的股票代码";
                }
                
                log.info("{} 查询股票信息，股票代码: {}, 信息类型: {}", 
                    agentContext != null ? agentContext.getRequestId() : "unknown", stockCode, infoType);
                
                // 根据信息类型返回不同的股票信息
                switch (infoType) {
                    case "price":
                        return getStockPriceInfo(stockCode);
                    case "analysis":
                        return getStockAnalysisInfo(stockCode);
                    case "basic":
                    default:
                        return getStockBasicInfo(stockCode);
                }
            } else {
                return "错误：输入参数格式不正确，需要提供包含stockCode字段的JSON对象";
            }
        } catch (Exception e) {
            log.error("{} 股票查询失败", 
                agentContext != null ? agentContext.getRequestId() : "unknown", e);
            return "股票查询失败：" + e.getMessage();
        }
    }
    
    /**
     * 获取股票基本信息
     */
    private String getStockBasicInfo(String stockCode) {
        String[] stockNames = {"平安银行", "招商银行", "中国平安", "腾讯控股", "阿里巴巴"};
        String stockName = stockNames[Math.abs(stockCode.hashCode()) % stockNames.length];
        
        return String.format("股票代码：%s\n股票名称：%s\n所属行业：金融科技\n上市时间：2010年\n总股本：100亿股\n流通股本：80亿股", 
            stockCode, stockName);
    }
    
    /**
     * 获取股票价格信息
     */
    private String getStockPriceInfo(String stockCode) {
        double basePrice = 10.0 + random.nextDouble() * 90.0;
        double currentPrice = basePrice + (random.nextDouble() - 0.5) * 5.0;
        double changePercent = ((currentPrice - basePrice) / basePrice) * 100;
        
        return String.format("股票代码：%s\n当前价格：%.2f元\n涨跌幅：%.2f%%\n涨跌额：%.2f元\n成交量：%.0f万手\n成交额：%.2f万元", 
            stockCode, currentPrice, changePercent, currentPrice - basePrice, 
            random.nextDouble() * 1000, currentPrice * random.nextDouble() * 1000);
    }
    
    /**
     * 获取股票分析信息
     */
    private String getStockAnalysisInfo(String stockCode) {
        String[] analysisTypes = {"技术分析", "基本面分析", "资金面分析", "消息面分析"};
        String[] recommendations = {"买入", "持有", "卖出", "观望"};
        
        String analysisType = analysisTypes[random.nextInt(analysisTypes.length)];
        String recommendation = recommendations[random.nextInt(recommendations.length)];
        
        return String.format("股票代码：%s\n分析类型：%s\n投资建议：%s\n目标价格：%.2f元\n风险等级：%s\n分析理由：基于当前市场环境和公司基本面，建议%s", 
            stockCode, analysisType, recommendation, 
            10.0 + random.nextDouble() * 90.0, 
            random.nextBoolean() ? "中等" : "较低", recommendation);
    }
} 