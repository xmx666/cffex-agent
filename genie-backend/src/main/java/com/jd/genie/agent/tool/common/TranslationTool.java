package com.jd.genie.agent.tool.common;

import com.jd.genie.agent.agent.AgentContext;
import com.jd.genie.agent.tool.BaseTool;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;

/**
 * 翻译工具类
 * 实现BaseTool接口，提供多语言翻译功能
 */
@Slf4j
@Data
public class TranslationTool implements BaseTool {
    
    private AgentContext agentContext;

    @Override
    public String getName() {
        return "agent_translation";
    }

    @Override
    public String getDescription() {
        return "这是一个多语言翻译智能体，能够将文本在不同语言之间进行翻译，支持中英文互译";
    }

    @Override
    public Map<String, Object> toParams() {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        
        Map<String, Object> properties = new HashMap<>();
        
        Map<String, Object> textParam = new HashMap<>();
        textParam.put("type", "string");
        textParam.put("description", "需要翻译的文本内容");
        properties.put("text", textParam);
        
        Map<String, Object> targetLangParam = new HashMap<>();
        targetLangParam.put("type", "string");
        targetLangParam.put("description", "目标语言，例如：中文、英文、日文、韩文等");
        targetLangParam.put("enum", new String[]{"中文", "英文", "日文", "韩文", "法文", "德文", "西班牙文"});
        properties.put("target_language", targetLangParam);
        
        Map<String, Object> sourceLangParam = new HashMap<>();
        sourceLangParam.put("type", "string");
        sourceLangParam.put("description", "源语言，如果不指定则自动检测");
        sourceLangParam.put("enum", new String[]{"自动检测", "中文", "英文", "日文", "韩文", "法文", "德文", "西班牙文"});
        properties.put("source_language", sourceLangParam);
        
        parameters.put("properties", properties);
        parameters.put("required", new String[]{"text", "target_language"});
        
        return parameters;
    }

    @Override
    public Object execute(Object input) {
        try {
            if (input instanceof Map) {
                Map<String, Object> inputMap = (Map<String, Object>) input;
                String text = (String) inputMap.get("text");
                String targetLanguage = (String) inputMap.get("target_language");
                String sourceLanguage = (String) inputMap.get("source_language");
                
                if (text == null || text.trim().isEmpty()) {
                    return "错误：请提供需要翻译的文本内容";
                }
                
                if (targetLanguage == null || targetLanguage.trim().isEmpty()) {
                    return "错误：请指定目标语言";
                }
                
                log.info("{} 执行翻译任务，文本: {}, 目标语言: {}, 源语言: {}", 
                    agentContext != null ? agentContext.getRequestId() : "unknown", 
                    text, targetLanguage, sourceLanguage != null ? sourceLanguage : "自动检测");
                
                // 这里可以集成真实的翻译API服务
                // 目前返回模拟翻译结果
                return performTranslation(text, targetLanguage, sourceLanguage);
            } else {
                return "错误：输入参数格式不正确，需要提供包含text和target_language字段的JSON对象";
            }
        } catch (Exception e) {
            log.error("{} 翻译任务失败", 
                agentContext != null ? agentContext.getRequestId() : "unknown", e);
            return "翻译失败：" + e.getMessage();
        }
    }
    
    /**
     * 执行翻译（模拟实现）
     * 在实际应用中，这里可以调用真实的翻译API服务，如Google Translate、百度翻译等
     */
    private String performTranslation(String text, String targetLanguage, String sourceLanguage) {
        // 模拟翻译结果
        Map<String, Map<String, String>> translationMap = new HashMap<>();
        
        // 中英文互译示例
        Map<String, String> chineseToEnglish = new HashMap<>();
        chineseToEnglish.put("你好", "Hello");
        chineseToEnglish.put("谢谢", "Thank you");
        chineseToEnglish.put("再见", "Goodbye");
        chineseToEnglish.put("早上好", "Good morning");
        chineseToEnglish.put("晚上好", "Good evening");
        
        Map<String, String> englishToChinese = new HashMap<>();
        englishToChinese.put("Hello", "你好");
        englishToChinese.put("Thank you", "谢谢");
        englishToChinese.put("Goodbye", "再见");
        englishToChinese.put("Good morning", "早上好");
        englishToChinese.put("Good evening", "晚上好");
        
        translationMap.put("英文", chineseToEnglish);
        translationMap.put("中文", englishToChinese);
        
        // 尝试查找翻译
        String translatedText = null;
        if ("英文".equals(targetLanguage) && translationMap.get("英文").containsKey(text)) {
            translatedText = translationMap.get("英文").get(text);
        } else if ("中文".equals(targetLanguage) && translationMap.get("中文").containsKey(text)) {
            translatedText = translationMap.get("中文").get(text);
        }
        
        if (translatedText != null) {
            return String.format("翻译结果：\n原文：%s\n译文：%s\n目标语言：%s", 
                text, translatedText, targetLanguage);
        } else {
            // 如果没有找到预定义的翻译，返回模拟结果
            String mockTranslation = generateMockTranslation(text, targetLanguage);
            return String.format("翻译结果：\n原文：%s\n译文：%s\n目标语言：%s\n\n注意：这是模拟翻译结果，实际使用时请集成真实的翻译API", 
                text, mockTranslation, targetLanguage);
        }
    }
    
    /**
     * 生成模拟翻译结果
     */
    private String generateMockTranslation(String text, String targetLanguage) {
        if ("英文".equals(targetLanguage)) {
            return "[英文翻译] " + text;
        } else if ("中文".equals(targetLanguage)) {
            return "[中文翻译] " + text;
        } else if ("日文".equals(targetLanguage)) {
            return "[日文翻译] " + text;
        } else if ("韩文".equals(targetLanguage)) {
            return "[韩文翻译] " + text;
        } else {
            return "[" + targetLanguage + "翻译] " + text;
        }
    }
} 