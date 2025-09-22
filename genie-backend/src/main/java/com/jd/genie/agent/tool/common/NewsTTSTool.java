package com.jd.genie.agent.tool.common;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.jd.genie.agent.agent.AgentContext;
import com.jd.genie.agent.tool.BaseTool;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import java.util.Map;
import java.util.HashMap;
import java.util.Base64;
import org.springframework.http.ResponseEntity;
import com.jd.genie.agent.dto.File;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * 新闻TTS音频生成工具
 * 实现BaseTool接口，负责将播客脚本转换为语音文件
 */
@Slf4j
public class NewsTTSTool implements BaseTool {

    private AgentContext agentContext;
    private RestTemplate restTemplate;

    // 内网环境TTS配置
    private static final String TTS_API_URL = "http://172.31.73.27/aihub/gateway/";
    private static final String TTS_MODEL = "tts-0711";
    private static final String TTS_API_KEY = ""; // 内网环境不需要API Key

    // 互联网测试环境TTS配置（注释保留，用于外网测试）
    // private static final String TTS_API_URL = "https://api.siliconflow.cn/v1/audio/speech";
    // private static final String TTS_MODEL = "fnlp/MOSS-TTSD-v0.5";
    // private static final String TTS_API_KEY = "sk-gnerfexlkohrjggyegfxwxtarftimtfllwoekftfvwcdujvj";

    public NewsTTSTool() {
        // 配置 RestTemplate 超时
        this.restTemplate = new RestTemplate();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(30000); // 30秒连接超时
        factory.setReadTimeout(60000);    // 60秒读取超时
        this.restTemplate.setRequestFactory(factory);
    }

    @Override
    public String getName() {
        return "agent_news_tts";
    }

    @Override
    public String getDescription() {
        return "这是一个可以将播客脚本转换为语音文件的智能体，能够为不同主持人设置不同音色，生成专业的播客音频";
    }

    public void setAgentContext(AgentContext agentContext) {
        this.agentContext = agentContext;
    }

    @Override
    public Map<String, Object> toParams() {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> scriptParam = new HashMap<>();
        scriptParam.put("type", "string");
        scriptParam.put("description", "播客脚本内容，包含[女生]和[男生]的对话");
        properties.put("script", scriptParam);

        Map<String, Object> outputFormatParam = new HashMap<>();
        outputFormatParam.put("type", "string");
        outputFormatParam.put("description", "输出音频格式：wav、mp3、skip（跳过TTS）");
        outputFormatParam.put("enum", new String[]{"wav", "mp3", "skip"});
        outputFormatParam.put("default", "wav");
        properties.put("outputFormat", outputFormatParam);

        Map<String, Object> voiceMappingParam = new HashMap<>();
        voiceMappingParam.put("type", "object");
        voiceMappingParam.put("description", "主持人音色映射配置");
        properties.put("voiceMapping", voiceMappingParam);

        Map<String, Object> skipTTSParam = new HashMap<>();
        skipTTSParam.put("type", "boolean");
        skipTTSParam.put("description", "是否跳过TTS音频生成（当TTS服务不可用时）");
        skipTTSParam.put("default", false);
        properties.put("skipTTS", skipTTSParam);

        parameters.put("properties", properties);
        parameters.put("required", new String[]{"script"});

        return parameters;
    }

    @Override
    public Object execute(Object input) {
        try {
            log.info("{} TTS工具接收到输入: {}",
                agentContext != null ? agentContext.getRequestId() : "unknown", input);

            // 智能解析输入参数
            Map<String, Object> inputMap = parseInputParameters(input);
            if (inputMap == null) {
                return "错误：输入参数格式不正确";
            }

            String script = (String) inputMap.get("script");
            String outputFormat = (String) inputMap.getOrDefault("outputFormat", "wav");
            Boolean skipTTS = (Boolean) inputMap.getOrDefault("skipTTS", false);

            log.info("{} 解析参数 - script: {}, outputFormat: {}, skipTTS: {}",
                agentContext != null ? agentContext.getRequestId() : "unknown",
                script != null ? script.substring(0, Math.min(100, script.length())) + "..." : "null",
                outputFormat, skipTTS);

            if (script == null || script.trim().isEmpty()) {
                log.warn("{} 脚本参数为空或无效",
                    agentContext != null ? agentContext.getRequestId() : "unknown");
                return "错误：请提供有效的播客脚本";
            }

            // 检查是否跳过TTS
            if ("skip".equals(outputFormat) || Boolean.TRUE.equals(skipTTS)) {
                log.info("{} 跳过TTS音频生成",
                    agentContext != null ? agentContext.getRequestId() : "unknown");
                return createSkipTTSResponse(script);
            }

            log.info("{} 生成TTS音频，输出格式: {}",
                agentContext != null ? agentContext.getRequestId() : "unknown", outputFormat);

            // 智能处理脚本内容
            String processedScript = processScriptForTTS(script);

            // 生成TTS音频
            return generateTTSAudio(processedScript, outputFormat);
        } catch (Exception e) {
            log.error("{} 生成TTS音频失败",
                agentContext != null ? agentContext.getRequestId() : "unknown", e);
            return "生成TTS音频失败：" + e.getMessage();
        }
    }

    /**
     * 智能处理脚本内容，确保能够生成音频
     */
    private String processScriptForTTS(String script) {
        if (script == null || script.trim().isEmpty()) {
            log.warn("脚本内容为空，返回默认脚本");
            return createDefaultScript("");
        }

        log.info("开始智能处理脚本内容，原始长度: {}", script.length());
        log.debug("原始脚本内容: {}", script);

        // 检查脚本是否可能被截断
        if (isScriptTruncated(script)) {
            log.warn("检测到脚本可能被截断，尝试修复");
            script = repairTruncatedScript(script);
        }

        try {
            // 1. 过滤无效内容
            String cleanedScript = preprocessScript(script);
            log.debug("清理后脚本内容: {}", cleanedScript);

            // 2. 检查是否包含有效的对话内容
            List<DialogueSegment> segments = parseScript(cleanedScript);
            log.info("解析到 {} 个对话段落", segments.size());

            if (segments.isEmpty()) {
                // 如果没有找到有效对话，尝试从其他格式中提取
                log.warn("未找到有效对话内容，尝试智能提取");
                String extractedScript = extractAndFormatScript(cleanedScript);
                if (extractedScript != null && !extractedScript.trim().isEmpty()) {
                    return extractedScript;
                } else {
                    log.warn("智能提取失败，使用默认脚本");
                    return createDefaultScript(script);
                }
            }

            // 3. 重新格式化脚本
            StringBuilder formattedScript = new StringBuilder();
            for (DialogueSegment segment : segments) {
                formattedScript.append("[").append(segment.getHost()).append("]：")
                              .append(segment.getText()).append("\n");
            }

            String result = formattedScript.toString().trim();
            log.info("脚本处理完成，处理后长度: {}", result.length());
            log.debug("处理后的脚本内容: {}", result);

            return result;
        } catch (Exception e) {
            log.error("处理脚本时发生错误: {}", e.getMessage(), e);
            return createDefaultScript(script);
        }
    }

    /**
     * 从各种格式中提取并格式化脚本
     */
    private String extractAndFormatScript(String content) {
        if (content == null || content.trim().isEmpty()) {
            log.warn("输入内容为空，返回默认脚本");
            return createDefaultScript("");
        }

        log.debug("开始从内容中提取脚本: {}", content);
        StringBuilder script = new StringBuilder();

        try {
            // 尝试从JSON格式中提取
            String jsonScript = extractScriptFromJson(content);
            if (jsonScript != null && !jsonScript.trim().isEmpty()) {
                log.info("成功从JSON中提取脚本，长度: {}", jsonScript.length());
                return jsonScript;
            }

            // 尝试从普通文本中提取对话
            String[] lines = content.split("\n");
            boolean hasValidContent = false;

            for (String line : lines) {
                line = line.trim();
                if (line.isEmpty()) continue;

                // 检查是否包含主持人标识
                if (line.contains("[女生]") || line.contains("[男生]")) {
                    script.append(line).append("\n");
                    hasValidContent = true;
                    log.debug("找到标准格式对话: {}", line);
                } else if (line.contains("女生") || line.contains("男生")) {
                    // 尝试修复格式
                    String fixedLine = fixDialogueFormat(line);
                    if (!fixedLine.isEmpty()) {
                        script.append(fixedLine).append("\n");
                        hasValidContent = true;
                        log.debug("修复格式后对话: {}", fixedLine);
                    }
                }
            }

            // 如果仍然没有有效内容，创建默认脚本
            if (!hasValidContent) {
                log.warn("无法提取有效对话内容，创建默认脚本");
                return createDefaultScript(content);
            }

            String result = script.toString().trim();
            log.info("成功提取脚本，长度: {}", result.length());
            return result;
        } catch (Exception e) {
            log.error("提取脚本时发生错误: {}", e.getMessage(), e);
            return createDefaultScript(content);
        }
    }

    /**
     * 从JSON格式中提取脚本
     */
    private String extractScriptFromJson(String content) {
        try {
            // 尝试提取JSON部分
            String jsonContent = extractJsonFromContent(content);
            if (jsonContent != null && !jsonContent.isEmpty()) {
                JSONObject jsonObj = JSON.parseObject(jsonContent);

                if (jsonObj.containsKey("news_content")) {
                    Object newsContent = jsonObj.get("news_content");
                    if (newsContent instanceof java.util.List) {
                        java.util.List<?> contentList = (java.util.List<?>) newsContent;
                        StringBuilder scriptBuilder = new StringBuilder();

                        for (Object item : contentList) {
                            if (item instanceof String) {
                                String line = (String) item;
                                if (isValidDialogueLine(line)) {
                                    scriptBuilder.append(line).append("\n");
                                }
                            }
                        }

                        return scriptBuilder.toString().trim();
                    }
                }
            }
        } catch (Exception e) {
            log.warn("从JSON提取脚本失败: {}", e.getMessage());
        }

        return "";
    }

    /**
     * 修复对话格式
     */
    private String fixDialogueFormat(String line) {
        // 尝试修复各种格式
        if (line.contains("女生：") || line.contains("女生:")) {
            return line.replace("女生：", "[女生]：").replace("女生:", "[女生]：");
        } else if (line.contains("男生：") || line.contains("男生:")) {
            return line.replace("男生：", "[男生]：").replace("男生:", "[男生]：");
        } else if (line.contains("女生")) {
            return line.replace("女生", "[女生]：");
        } else if (line.contains("男生")) {
            return line.replace("男生", "[男生]：");
        }

        return "";
    }

    /**
     * 创建默认脚本
     */
    private String createDefaultScript(String content) {
        return "[女生]：欢迎收听今天的播客。\n" +
               "[男生]：今天我们来分享一些有趣的内容。\n" +
               "[女生]：感谢大家的收听。";
    }

    /**
     * 从内容中提取JSON部分
     */
    private String extractJsonFromContent(String content) {
        // 尝试匹配 ```json ... ``` 代码块
        String pattern = "```json\\s*([\\s\\S]*?)\\s*```";
        java.util.regex.Pattern r = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = r.matcher(content);

        if (m.find()) {
            return m.group(1).trim();
        }

        // 尝试匹配 { ... } JSON对象
        int startIndex = content.indexOf("{");
        int endIndex = content.lastIndexOf("}");

        if (startIndex != -1 && endIndex != -1 && endIndex > startIndex) {
            return content.substring(startIndex, endIndex + 1);
        }

        return null;
    }

    /**
     * 智能解析输入参数
     */
    private Map<String, Object> parseInputParameters(Object input) {
        if (input == null) {
            log.warn("输入参数为null");
            return null;
        }

        // 如果已经是Map，检查是否包含必要参数
        if (input instanceof Map) {
            Map<String, Object> inputMap = (Map<String, Object>) input;
            log.debug("输入参数是Map类型，包含字段: {}", inputMap.keySet());

            // 检查是否缺少script参数
            if (!inputMap.containsKey("script") || inputMap.get("script") == null) {
                log.warn("Map中缺少script参数，尝试从其他字段提取");
                // 尝试从其他字段提取script
                String script = extractScriptFromMap(inputMap);
                if (script != null && !script.trim().isEmpty()) {
                    inputMap.put("script", script);
                    log.info("成功从Map中提取script参数");
                }
            }

            return inputMap;
        }

        // 如果是字符串，尝试解析JSON
        if (input instanceof String) {
            String inputStr = (String) input;
            log.debug("尝试解析字符串输入: {}", inputStr);

            try {
                // 尝试直接解析JSON
                Map<String, Object> result = JSON.parseObject(inputStr, Map.class);
                log.debug("JSON解析成功，包含字段: {}", result.keySet());

                // 检查是否缺少script参数
                if (!result.containsKey("script") || result.get("script") == null) {
                    log.warn("解析后的JSON中缺少script参数，尝试从字符串中提取");
                    String script = extractScriptFromString(inputStr);
                    if (script != null && !script.trim().isEmpty()) {
                        result.put("script", script);
                        log.info("成功从字符串中提取script参数");
                    }
                }

                return result;
            } catch (Exception e) {
                log.warn("JSON解析失败，尝试智能提取: {}", e.getMessage());

                // 尝试从字符串中提取参数
                return extractParametersFromString(inputStr);
            }
        }

        log.warn("不支持的输入类型: {}", input.getClass().getSimpleName());
        return null;
    }

    /**
     * 从Map中提取script参数
     */
    private String extractScriptFromMap(Map<String, Object> inputMap) {
        // 尝试从可能的字段中提取script
        String[] possibleFields = {"script", "content", "text", "message", "data"};
        for (String field : possibleFields) {
            Object value = inputMap.get(field);
            if (value instanceof String) {
                String script = (String) value;
                if (script != null && !script.trim().isEmpty()) {
                    log.info("从字段{}中提取script参数，长度: {}", field, script.length());
                    return script;
                }
            }
        }

        // 尝试从voiceMapping中提取（如果voiceMapping包含script信息）
        Object voiceMapping = inputMap.get("voiceMapping");
        if (voiceMapping instanceof String) {
            String voiceMappingStr = (String) voiceMapping;
            // 检查是否包含script内容
            if (voiceMappingStr.contains("script") || voiceMappingStr.contains("播客")) {
                log.info("从voiceMapping中提取可能的script内容");
                return voiceMappingStr;
            }
        }

        return null;
    }

    /**
     * 从字符串中智能提取参数
     */
    private Map<String, Object> extractParametersFromString(String inputStr) {
        Map<String, Object> result = new HashMap<>();

        try {
            // 尝试修复常见的JSON格式错误
            String fixedJson = fixJsonFormat(inputStr);
            log.debug("修复后的JSON: {}", fixedJson);

            // 再次尝试解析
            return JSON.parseObject(fixedJson, Map.class);
        } catch (Exception e) {
            log.warn("修复JSON后仍然解析失败: {}", e.getMessage());

            // 尝试从字符串中提取script内容
            String script = extractScriptFromString(inputStr);
            if (script != null && !script.trim().isEmpty()) {
                result.put("script", script);
                result.put("outputFormat", "wav");
                result.put("skipTTS", false);
                log.info("成功从字符串中提取script参数");
                return result;
            }

            // 尝试从播客文本生成工具的结果中提取script
            script = extractScriptFromGeneratorResult(inputStr);
            if (script != null && !script.trim().isEmpty()) {
                result.put("script", script);
                result.put("outputFormat", "wav");
                result.put("skipTTS", false);
                log.info("成功从播客生成工具结果中提取script参数");
                return result;
            }
        }

        return null;
    }

    /**
     * 从播客文本生成工具的结果中提取script内容
     */
    private String extractScriptFromGeneratorResult(String inputStr) {
        if (inputStr == null || inputStr.trim().isEmpty()) {
            return null;
        }

        log.debug("尝试从播客生成工具结果中提取script: {}", inputStr);

        // 查找content字段
        String contentPattern = "\"content\"\\s*:\\s*\"([^\"]*(?:\\\\.[^\"]*)*)\"";
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(contentPattern);
        java.util.regex.Matcher matcher = pattern.matcher(inputStr);

        if (matcher.find()) {
            String content = matcher.group(1);
            // 处理转义字符
            content = content.replace("\\n", "\n").replace("\\\"", "\"");
            log.info("从content字段中提取script内容，长度: {}", content.length());
            return content;
        }

        // 查找script字段
        String scriptPattern = "\"script\"\\s*:\\s*\"([^\"]*(?:\\\\.[^\"]*)*)\"";
        pattern = java.util.regex.Pattern.compile(scriptPattern);
        matcher = pattern.matcher(inputStr);

        if (matcher.find()) {
            String script = matcher.group(1);
            // 处理转义字符
            script = script.replace("\\n", "\n").replace("\\\"", "\"");
            log.info("从script字段中提取内容，长度: {}", script.length());
            return script;
        }

        return null;
    }

    /**
     * 修复常见的JSON格式错误
     */
    private String fixJsonFormat(String jsonStr) {
        if (jsonStr == null || jsonStr.trim().isEmpty()) {
            return jsonStr;
        }

        String fixed = jsonStr.trim();
        log.debug("开始修复JSON格式: {}", fixed);

        // 修复常见的格式错误
        fixed = fixed.replaceAll("\"outputFormp3\"", "\"outputFormat\": \"mp3\"");
        fixed = fixed.replaceAll("\"outputFormwav\"", "\"outputFormat\": \"wav\"");

        // 修复缺少逗号的格式错误（如："kunshan" "outputFormat"）
        fixed = fixed.replaceAll("\"([^\"]+)\"\\s+\"([^\"]+)\"", "\"$1\", \"$2\"");

        // 修复特定的截断格式错误（如："xiaofeng" "outputFormat"）
        fixed = fixed.replaceAll("\"([^\"]+)\"\\s+\"outputFormat\"", "\"$1\", \"outputFormat\"");
        fixed = fixed.replaceAll("\"([^\"]+)\"\\s+\"script\"", "\"$1\", \"script\"");

        // 修复voiceMapping格式错误
        // 将 "voiceMapping": "xiaoyan", "[男生]": "kunshan" 修复为正确的格式
        if (fixed.contains("\"voiceMapping\"") && fixed.contains("\"[男生]\"")) {
            // 提取xiaoyan和kunshan的值
            String xiaoyanValue = extractValueAfterKey(fixed, "\"voiceMapping\"");
            String kunshanValue = extractValueAfterKey(fixed, "\"[男生]\"");

            if (xiaoyanValue != null && kunshanValue != null) {
                // 构建正确的voiceMapping格式
                String correctVoiceMapping = "\"voiceMapping\": {\"女生\": " + xiaoyanValue + ", \"男生\": " + kunshanValue + "}";

                // 替换错误的格式
                String pattern = "\"voiceMapping\"\\s*:\\s*" + xiaoyanValue + "\\s*,\\s*\"\\[男生\\]\"\\s*:\\s*" + kunshanValue;
                fixed = fixed.replaceAll(pattern, correctVoiceMapping);
            }
        }

        // 修复被截断的script内容
        fixed = fixTruncatedScript(fixed);

        // 确保JSON格式完整
        if (!fixed.startsWith("{")) {
            fixed = "{" + fixed;
        }

        // 修复大括号平衡问题 - 处理JSON截断
        fixed = balanceJsonBraces(fixed);

        // 修复不完整的JSON
        if (fixed.contains("}, \"script\"")) {
            // 这种情况说明前面有未完成的参数
            int scriptIndex = fixed.indexOf("\"script\"");
            if (scriptIndex > 0) {
                String beforeScript = fixed.substring(0, scriptIndex);
                String afterScript = fixed.substring(scriptIndex);

                // 检查beforeScript是否以逗号结尾
                if (beforeScript.endsWith(",")) {
                    // 移除多余的逗号
                    beforeScript = beforeScript.substring(0, beforeScript.length() - 1);
                }

                fixed = beforeScript + ", " + afterScript;
            }
        }

        log.debug("修复后的JSON: {}", fixed);
        return fixed;
    }

    /**
     * 修复JSON大括号平衡问题，处理截断的JSON
     */
    private String balanceJsonBraces(String jsonStr) {
        if (jsonStr == null || jsonStr.trim().isEmpty()) {
            return jsonStr;
        }

        log.debug("开始修复JSON大括号平衡: {}", jsonStr);

        int openBraces = 0;
        int openBrackets = 0;
        boolean inString = false;
        boolean escaped = false;

        // 计算需要添加的闭合字符
        for (int i = 0; i < jsonStr.length(); i++) {
            char c = jsonStr.charAt(i);

            if (escaped) {
                escaped = false;
                continue;
            }

            if (c == '\\') {
                escaped = true;
                continue;
            }

            if (c == '"' && !escaped) {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (c == '{') {
                    openBraces++;
                } else if (c == '}') {
                    openBraces--;
                } else if (c == '[') {
                    openBrackets++;
                } else if (c == ']') {
                    openBrackets--;
                }
            }
        }

        // 添加缺失的闭合字符
        StringBuilder balanced = new StringBuilder(jsonStr);

        // 先添加缺失的方括号闭合
        for (int i = 0; i < openBrackets; i++) {
            balanced.append(']');
        }

        // 再添加缺失的大括号闭合
        for (int i = 0; i < openBraces; i++) {
            balanced.append('}');
        }

        String result = balanced.toString();
        log.debug("大括号平衡修复完成: 原始长度={}, 修复后长度={}, 添加了{}个方括号和{}个大括号",
            jsonStr.length(), result.length(), openBrackets, openBraces);

        return result;
    }

    /**
     * 从JSON字符串中提取指定键后面的值
     */
    private String extractValueAfterKey(String jsonStr, String key) {
        try {
            int keyIndex = jsonStr.indexOf(key);
            if (keyIndex == -1) return null;

            int colonIndex = jsonStr.indexOf(":", keyIndex);
            if (colonIndex == -1) return null;

            int valueStart = colonIndex + 1;
            while (valueStart < jsonStr.length() && Character.isWhitespace(jsonStr.charAt(valueStart))) {
                valueStart++;
            }

            if (valueStart >= jsonStr.length()) return null;

            char firstChar = jsonStr.charAt(valueStart);
            if (firstChar == '"') {
                // 字符串值
                int valueEnd = jsonStr.indexOf('"', valueStart + 1);
                if (valueEnd == -1) return null;
                return jsonStr.substring(valueStart, valueEnd + 1);
            } else {
                // 其他类型的值，找到下一个逗号或结束
                int valueEnd = valueStart;
                while (valueEnd < jsonStr.length() && jsonStr.charAt(valueEnd) != ',' && jsonStr.charAt(valueEnd) != '}') {
                    valueEnd++;
                }
                return jsonStr.substring(valueStart, valueEnd).trim();
            }
        } catch (Exception e) {
            log.debug("提取值失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 修复被截断的script内容
     */
    private String fixTruncatedScript(String jsonStr) {
        if (jsonStr == null || jsonStr.trim().isEmpty()) {
            return jsonStr;
        }

        // 查找script字段的开始位置
        int scriptStart = jsonStr.indexOf("\"script\": \"");
        if (scriptStart == -1) {
            return jsonStr;
        }

        scriptStart += "\"script\": \"".length();

        // 查找script字段的结束位置
        int scriptEnd = -1;
        int quoteCount = 0;
        boolean inEscape = false;

        for (int i = scriptStart; i < jsonStr.length(); i++) {
            char c = jsonStr.charAt(i);

            if (inEscape) {
                inEscape = false;
                continue;
            }

            if (c == '\\') {
                inEscape = true;
                continue;
            }

            if (c == '"') {
                quoteCount++;
                if (quoteCount % 2 == 0) {
                    // 找到script字段的结束引号
                    scriptEnd = i;
                    break;
                }
            }
        }

        // 如果script字段被截断，尝试修复
        if (scriptEnd == -1 || scriptEnd >= jsonStr.length() - 10) {
            log.warn("检测到script字段被截断，尝试修复");

            // 查找下一个字段的开始位置
            int nextFieldStart = jsonStr.indexOf("\", \"", scriptStart);
            if (nextFieldStart == -1) {
                nextFieldStart = jsonStr.indexOf("\", \"outputFormat\"", scriptStart);
            }
            if (nextFieldStart == -1) {
                nextFieldStart = jsonStr.indexOf("\", \"voiceMapping\"", scriptStart);
            }

            if (nextFieldStart != -1) {
                // 在script内容后添加结束引号
                String beforeScript = jsonStr.substring(0, nextFieldStart);
                String afterScript = jsonStr.substring(nextFieldStart);

                // 确保script内容以引号结束
                if (!beforeScript.endsWith("\"")) {
                    beforeScript += "\"";
                }

                return beforeScript + afterScript;
            } else {
                // 如果找不到下一个字段，在末尾添加结束引号
                if (!jsonStr.endsWith("\"")) {
                    jsonStr += "\"";
                }
                return jsonStr;
            }
        }

        return jsonStr;
    }

    /**
     * 从字符串中提取script内容
     */
    private String extractScriptFromString(String inputStr) {
        if (inputStr == null || inputStr.trim().isEmpty()) {
            return null;
        }

        log.debug("尝试从字符串中提取script内容: {}", inputStr);

        // 首先尝试修复被截断的JSON
        String fixedJson = fixTruncatedScript(inputStr);
        if (!fixedJson.equals(inputStr)) {
            log.info("修复了被截断的JSON，尝试重新解析");
            inputStr = fixedJson;
        }

        // 查找script字段 - 增强版本，支持更复杂的格式
        String scriptPattern = "\"script\"\\s*:\\s*\"([^\"]*(?:\\\\.[^\"]*)*)\"";
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(scriptPattern);
        java.util.regex.Matcher matcher = pattern.matcher(inputStr);

        if (matcher.find()) {
            String script = matcher.group(1);
            // 处理转义字符
            script = script.replace("\\n", "\n").replace("\\\"", "\"");
            log.info("成功从JSON中提取script内容，长度: {}", script.length());
            return script;
        }

        // 尝试更宽松的script字段匹配
        scriptPattern = "\"script\"\\s*:\\s*\"([^\"]*)\"";
        pattern = java.util.regex.Pattern.compile(scriptPattern);
        matcher = pattern.matcher(inputStr);

        if (matcher.find()) {
            String script = matcher.group(1);
            // 处理转义字符
            script = script.replace("\\n", "\n").replace("\\\"", "\"");
            log.info("成功从JSON中提取script内容（宽松匹配），长度: {}", script.length());
            return script;
        }

        // 尝试查找包含"播客"的内容
        if (inputStr.contains("播客")) {
            int podcastIndex = inputStr.indexOf("播客");
            if (podcastIndex != -1) {
                // 向前查找script字段的开始
                int scriptStart = inputStr.lastIndexOf("\"script\"", podcastIndex);
                if (scriptStart != -1) {
                    // 提取script内容
                    String scriptPart = inputStr.substring(scriptStart);
                    int colonIndex = scriptPart.indexOf(":");
                    if (colonIndex != -1) {
                        String scriptContent = scriptPart.substring(colonIndex + 1);
                        // 移除引号和逗号
                        scriptContent = scriptContent.replaceAll("^\\s*\"", "").replaceAll("\"\\s*,?\\s*$", "");
                        if (!scriptContent.trim().isEmpty()) {
                            log.info("成功从播客相关内容中提取script，长度: {}", scriptContent.length());
                            return scriptContent;
                        }
                    }
                }
            }
        }

        // 尝试处理被截断的script字段
        int scriptStart = inputStr.indexOf("\"script\": \"");
        if (scriptStart != -1) {
            scriptStart += "\"script\": \"".length();

            // 查找下一个字段的开始位置
            int nextFieldStart = inputStr.indexOf("\", \"", scriptStart);
            if (nextFieldStart == -1) {
                nextFieldStart = inputStr.indexOf("\", \"outputFormat\"", scriptStart);
            }
            if (nextFieldStart == -1) {
                nextFieldStart = inputStr.indexOf("\", \"voiceMapping\"", scriptStart);
            }

            if (nextFieldStart != -1) {
                String script = inputStr.substring(scriptStart, nextFieldStart);
                script = script.replace("\\n", "\n").replace("\\\"", "\"");
                log.info("从截断的JSON中提取script内容，长度: {}", script.length());
                return script;
            } else {
                // 如果找不到下一个字段，提取到字符串末尾
                String script = inputStr.substring(scriptStart);
                script = script.replace("\\n", "\n").replace("\\\"", "\"");
                log.info("从截断的JSON末尾提取script内容，长度: {}", script.length());
                return script;
            }
        }

        // 如果没有找到JSON格式的script，尝试查找播客脚本内容
        if (inputStr.contains("[女生]") || inputStr.contains("[男生]")) {
            // 提取包含播客脚本的部分
            String[] lines = inputStr.split("\n");
            StringBuilder script = new StringBuilder();
            boolean inScript = false;

            for (String line : lines) {
                if (line.contains("[女生]") || line.contains("[男生]")) {
                    inScript = true;
                }
                if (inScript) {
                    script.append(line).append("\n");
                }
            }

            String result = script.toString().trim();
            if (!result.isEmpty()) {
                log.info("从纯文本中提取script内容，长度: {}", result.length());
                return result;
            }
        }

        log.warn("无法从输入字符串中提取script内容");
        return null;
    }

    /**
     * 检查是否为有效的对话行
     */
    private boolean isValidDialogueLine(String line) {
        if (line == null || line.trim().isEmpty()) {
            return false;
        }

        // 检查是否包含主持人标识
        return line.contains("[女生]") || line.contains("[男生]");
    }

    /**
     * 检查脚本是否可能被截断
     */
    private boolean isScriptTruncated(String script) {
        if (script == null || script.trim().isEmpty()) {
            return false;
        }

        // 检查常见的截断迹象
        String trimmedScript = script.trim();

        // 1. 检查是否以不完整的句子结尾
        if (trimmedScript.endsWith("，") || trimmedScript.endsWith("、") ||
            trimmedScript.endsWith("：") || trimmedScript.endsWith(":") ||
            trimmedScript.endsWith("...") || trimmedScript.endsWith("…")) {
            return true;
        }

        // 2. 检查是否以不完整的主持人标识结尾
        if (trimmedScript.endsWith("[女生]") || trimmedScript.endsWith("[男生]") ||
            trimmedScript.endsWith("女生") || trimmedScript.endsWith("男生")) {
            return true;
        }

        // 3. 检查对话段落数量是否过少（可能被截断）
        String[] lines = script.split("\n");
        int dialogueCount = 0;
        for (String line : lines) {
            if (isValidDialogueLine(line)) {
                dialogueCount++;
            }
        }

        // 如果对话段落少于2个，可能被截断（放宽限制）
        if (dialogueCount < 2) {
            return true;
        }

        // 4. 检查最后一个对话是否完整
        String lastLine = "";
        for (int i = lines.length - 1; i >= 0; i--) {
            if (isValidDialogueLine(lines[i])) {
                lastLine = lines[i];
                break;
            }
        }

        if (!lastLine.isEmpty()) {
            // 检查最后一个对话是否以明显的截断符号结尾
            String content = extractDialogueContent(lastLine);
            if (content != null && !content.isEmpty()) {
                char lastChar = content.trim().charAt(content.trim().length() - 1);
                // 只检查明显的截断迹象，不要求必须以句号结尾
                if (lastChar == '，' || lastChar == '、' || lastChar == '：' || lastChar == ':') {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 修复被截断的脚本
     */
    private String repairTruncatedScript(String script) {
        if (script == null || script.trim().isEmpty()) {
            return createDefaultScript("");
        }

        log.info("开始修复被截断的脚本");

        // 1. 移除不完整的结尾
        String repairedScript = script.trim();

        // 移除不完整的句子结尾
        while (repairedScript.endsWith("，") || repairedScript.endsWith("、") ||
               repairedScript.endsWith("：") || repairedScript.endsWith(":") ||
               repairedScript.endsWith("...") || repairedScript.endsWith("…")) {
            repairedScript = repairedScript.substring(0, repairedScript.length() - 1).trim();
        }

        // 2. 保留所有有效的对话段落，只修复不完整的结尾
        String[] lines = repairedScript.split("\n");
        StringBuilder completeScript = new StringBuilder();
        String lastCompleteDialogue = "";

        for (String line : lines) {
            if (isValidDialogueLine(line)) {
                String content = extractDialogueContent(line);
                if (content != null && !content.isEmpty()) {
                    // 保留所有对话段落，不要求以句号结尾
                    completeScript.append(line).append("\n");
                    lastCompleteDialogue = line;
                }
            } else if (!line.trim().isEmpty()) {
                completeScript.append(line).append("\n");
            }
        }

        // 3. 如果修复后的脚本太短，返回原始脚本
        String result = completeScript.toString().trim();
        if (result.length() < 100) {
            log.warn("修复后的脚本仍然太短，返回原始脚本");
            return script; // 返回原始脚本而不是默认脚本
        } else {
            // 添加一个简单的结尾
            if (!result.endsWith("感谢大家的收听。")) {
                result += "\n[女生]：感谢大家的收听。";
            }
        }

        log.info("脚本修复完成，修复后长度: {}", result.length());
        return result;
    }

    /**
     * 创建跳过TTS的响应
     */
    private Map<String, Object> createSkipTTSResponse(String script) {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "skipped");
        result.put("message", "TTS音频生成已跳过");
        result.put("script_preview", script.length() > 200 ? script.substring(0, 200) + "..." : script);
        result.put("script_length", script.length());
        result.put("note", "播客脚本已生成，但未转换为音频文件。您可以手动阅读脚本或稍后重试TTS功能。");

        List<DialogueSegment> segments = parseScript(script);
        result.put("segments_count", segments.size());
        result.put("dialogue_summary", String.format("包含%d个对话段落，预计播客时长约%d分钟",
            segments.size(), Math.max(1, segments.size() / 2)));

        return result;
    }

    /**
     * 生成TTS音频
     */
    private Map<String, Object> generateTTSAudio(String script, String outputFormat) {
        Map<String, Object> result = new HashMap<>();

        try {
            // 解析脚本，分割对话段落
            List<DialogueSegment> segments = parseScript(script);

            if (segments.isEmpty()) {
                result.put("status", "error");
                result.put("message", "没有找到有效的对话内容");
                return result;
            }

            // 生成音频文件
            String audioPath = generateAudioFiles(segments, outputFormat);

            if (audioPath != null && !audioPath.isEmpty()) {
                result.put("status", "success");
                result.put("message", "TTS音频生成成功");
                result.put("audio_path", audioPath);
                result.put("segments_count", segments.size());
                result.put("output_format", "wav"); // 实际生成的是WAV格式
            } else {
                result.put("status", "error");
                result.put("message", "音频文件生成失败");
            }

        } catch (Exception e) {
            log.error("生成TTS音频时出错", e);
            result.put("status", "error");
            result.put("message", "生成TTS音频时出错: " + e.getMessage());
        }

        return result;
    }

    /**
     * 解析脚本，分割对话段落
     */
    private List<DialogueSegment> parseScript(String script) {
        List<DialogueSegment> segments = new ArrayList<>();

        // 添加调试日志
        log.info("开始解析脚本内容，原始长度: {}", script.length());

        // 预处理脚本，过滤无效内容
        String cleanedScript = preprocessScript(script);
        log.info("脚本预处理完成，清理后长度: {}", cleanedScript.length());

        // 先按对话段落分割，再按行处理
        String[] dialogueSegments = splitDialogueSegments(cleanedScript);
        log.info("对话段落数: {}", dialogueSegments.length);

        String[] lines = dialogueSegments;
        log.info("脚本行数: {}", lines.length);

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) {
                log.debug("跳过空行: 第{}行", i + 1);
                continue;
            }

            log.info("处理第{}行: '{}'", i + 1, line);

            try {
                // 检查是否包含主持人标识
                if (line.contains("[女生]") || line.contains("[男生]")) {
                    log.info("发现对话行: {}", line);

                    // 识别主持人 - 增强版本
                    String host = identifyHost(line);
                    if (host == null) {
                        log.warn("无法识别主持人，跳过此行: {}", line);
                        continue;
                    }

                    log.info("识别主持人: {}", host);

                    // 提取对话内容 - 支持多种格式
                    String dialogue = extractDialogueContent(line);
                    log.info("提取的对话内容: '{}'", dialogue);

                    if (!dialogue.isEmpty()) {
                        boolean isValid = isValidDialogueContent(dialogue);
                        log.info("对话内容验证结果: {}", isValid);

                        if (isValid) {
                            segments.add(new DialogueSegment(host, dialogue));
                            log.info("成功解析对话段落: 主持人={}, 内容='{}'", host, dialogue);
                        } else {
                            log.warn("对话内容验证失败，尝试修复: {}", dialogue);
                            // 尝试修复对话内容
                            String fixedDialogue = fixDialogueContent(dialogue);
                            if (!fixedDialogue.isEmpty() && isValidDialogueContent(fixedDialogue)) {
                                segments.add(new DialogueSegment(host, fixedDialogue));
                                log.info("修复后成功解析对话段落: 主持人={}, 内容='{}'", host, fixedDialogue);
                            } else {
                                log.warn("修复失败，跳过此对话段落: {}", dialogue);
                            }
                        }
                    } else {
                        log.warn("提取的对话内容为空，尝试从原始行提取: {}", line);
                        // 尝试从原始行直接提取
                        String fallbackDialogue = extractFallbackDialogue(line);
                        if (!fallbackDialogue.isEmpty()) {
                            segments.add(new DialogueSegment(host, fallbackDialogue));
                            log.info("使用备用方法成功解析对话段落: 主持人={}, 内容='{}'", host, fallbackDialogue);
                        } else {
                            log.warn("备用方法也失败，跳过此对话段落: {}", line);
                        }
                    }
                } else {
                    log.debug("跳过非对话行: {}", line);
                }
            } catch (Exception e) {
                log.error("解析对话行失败: {}", line, e);
                // 即使出错也继续处理下一行
            }
        }

        log.info("解析完成，共找到 {} 个对话段落", segments.size());
        return segments;
    }

    /**
     * 按对话段落分割脚本 - 增强版本，处理各种边界情况
     */
    private String[] splitDialogueSegments(String script) {
        if (script == null || script.trim().isEmpty()) {
            return new String[0];
        }

        log.debug("开始分割对话段落，原始长度: {}", script.length());

        // 预处理：确保脚本格式正确
        String processedScript = script.trim();

        // 处理可能的格式问题
        // 1. 确保[女生]和[男生]之间有适当的分隔
        processedScript = processedScript.replaceAll("\\]\\s*\\[", "]\n[");

        // 2. 处理可能的连续标识符
        processedScript = processedScript.replaceAll("\\[女生\\]\\s*\\[女生\\]", "[女生]");
        processedScript = processedScript.replaceAll("\\[男生\\]\\s*\\[男生\\]", "[男生]");

        // 3. 处理可能的格式错误
        processedScript = processedScript.replaceAll("\\[女生\\]\\s*\\[男生\\]", "[女生]\n[男生]");
        processedScript = processedScript.replaceAll("\\[男生\\]\\s*\\[女生\\]", "[男生]\n[女生]");

        // 使用多种分割策略
        List<String> segments = new ArrayList<>();

        // 策略1: 按换行符分割
        String[] lines = processedScript.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                segments.add(trimmed);
            }
        }

        // 策略2: 如果按换行符分割后仍然有包含多个标识符的行，进一步分割
        List<String> finalSegments = new ArrayList<>();
        for (String segment : segments) {
            if (segment.contains("[女生]") && segment.contains("[男生]")) {
                // 包含多个标识符，需要进一步分割
                String[] subSegments = splitMultiDialogueLine(segment);
                for (String subSegment : subSegments) {
                    if (!subSegment.trim().isEmpty()) {
                        finalSegments.add(subSegment.trim());
                    }
                }
            } else {
                finalSegments.add(segment);
            }
        }

        // 过滤和验证段落
        List<String> validSegments = new ArrayList<>();
        for (String segment : finalSegments) {
            String trimmed = segment.trim();
            if (!trimmed.isEmpty() && isValidDialogueSegment(trimmed)) {
                validSegments.add(trimmed);
            }
        }

        log.debug("对话段落分割完成，原始段落数: {}, 有效段落数: {}", segments.size(), validSegments.size());
        return validSegments.toArray(new String[0]);
    }

    /**
     * 分割包含多个对话标识符的行
     */
    private String[] splitMultiDialogueLine(String line) {
        List<String> segments = new ArrayList<>();

        // 使用正则表达式分割
        String pattern = "(?=\\[(?:女生|男生)\\])";
        String[] parts = line.split(pattern);

        for (String part : parts) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty() && (trimmed.contains("[女生]") || trimmed.contains("[男生]"))) {
                segments.add(trimmed);
            }
        }

        return segments.toArray(new String[0]);
    }

    /**
     * 验证是否为有效的对话段落
     */
    private boolean isValidDialogueSegment(String segment) {
        if (segment == null || segment.trim().isEmpty()) {
            return false;
        }

        // 必须包含[女生]或[男生]标识符
        if (!segment.contains("[女生]") && !segment.contains("[男生]")) {
            return false;
        }

        // 不能只包含标识符
        String content = segment.replaceAll("\\[女生\\]", "").replaceAll("\\[男生\\]", "").trim();
        if (content.isEmpty()) {
            return false;
        }

        return true;
    }

    /**
     * 预处理脚本，过滤无效内容
     */
    private String preprocessScript(String script) {
        if (script == null || script.isEmpty()) {
            return script;
        }

        // 过滤掉明显的think标签内容
        script = script.replaceAll("(?i)<think>.*?</think>", "");
        script = script.replaceAll("(?i)<thinking>.*?</thinking>", "");
        script = script.replaceAll("(?i)<reasoning>.*?</reasoning>", "");

        // 过滤掉明显的思考过程标记（移除正常的播客对话词汇）
        String[] thinkMarkers = {
            "思考：", "让我想想", "我需要",
            "think:", "thinking:", "let me think", "i need to",
            "让我分析", "我需要分析", "让我来", "我来"
        };

        String[] lines = script.split("\n");
        StringBuilder cleanedScript = new StringBuilder();

        for (String line : lines) {
            String trimmedLine = line.trim();
            boolean isThinkLine = false;

            // 检查是否包含思考过程标记（只在行首或独立出现时过滤）
            for (String marker : thinkMarkers) {
                String lowerLine = trimmedLine.toLowerCase();
                String lowerMarker = marker.toLowerCase();

                // 只在行首或独立出现时过滤
                if (lowerLine.startsWith(lowerMarker) ||
                    lowerLine.equals(lowerMarker) ||
                    lowerLine.matches(".*\\s+" + lowerMarker + "\\s+.*")) {
                    isThinkLine = true;
                    break;
                }
            }

            // 跳过空行和思考过程行
            if (!isThinkLine && !trimmedLine.isEmpty()) {
                if (cleanedScript.length() > 0) {
                    cleanedScript.append("\n");
                }
                cleanedScript.append(line);
            }
        }

        return cleanedScript.toString();
    }

    /**
     * 提取对话内容，支持多种格式 - 增强版本
     */
    private String extractDialogueContent(String line) {
        if (line == null || line.trim().isEmpty()) {
            return "";
        }

        String dialogue = "";
        String trimmedLine = line.trim();

        log.debug("提取对话内容，输入: {}", trimmedLine);

        // 策略1: 优先处理标准格式: [女生]：内容 或 [女生]: 内容
        if (trimmedLine.contains("]：")) {
            String[] parts = trimmedLine.split("]：", 2);
            if (parts.length > 1) {
                dialogue = parts[1].trim();
            }
        } else if (trimmedLine.contains("]:")) {
            String[] parts = trimmedLine.split("]:", 2);
            if (parts.length > 1) {
                dialogue = parts[1].trim();
            }
        } else if (trimmedLine.contains("]")) {
            // 策略2: 格式: [女生]内容 (没有冒号)
            int endBracket = trimmedLine.indexOf("]");
            if (endBracket + 1 < trimmedLine.length()) {
                dialogue = trimmedLine.substring(endBracket + 1).trim();
            }
        } else {
            // 策略3: 没有方括号，可能是纯文本
            dialogue = trimmedLine;
        }

        // 清理对话内容
        if (!dialogue.isEmpty()) {
            dialogue = cleanDialogueContent(dialogue);
        }

        log.debug("提取的对话内容: '{}'", dialogue);
        return dialogue;
    }

    /**
     * 清理对话内容，移除标识符和多余字符
     */
    private String cleanDialogueContent(String dialogue) {
        if (dialogue == null || dialogue.trim().isEmpty()) {
            return "";
        }

        String cleaned = dialogue.trim();

        // 1. 移除开头的冒号
        cleaned = cleaned.replaceFirst("^：+", "").trim();
        cleaned = cleaned.replaceFirst("^:+", "").trim();

        // 2. 移除方括号标识符
        cleaned = cleaned.replaceAll("\\[女生\\]", "").trim();
        cleaned = cleaned.replaceAll("\\[男生\\]", "").trim();

        // 3. 移除纯文本标识符（但要小心，避免误删正常内容中的"女生"、"男生"）
        // 只在特定位置移除，避免误删
        cleaned = cleaned.replaceAll("^女生\\s*", "").trim();
        cleaned = cleaned.replaceAll("^男生\\s*", "").trim();
        cleaned = cleaned.replaceAll("\\s+女生\\s*$", "").trim();
        cleaned = cleaned.replaceAll("\\s+男生\\s*$", "").trim();

        // 4. 清理多余的空格和标点
        cleaned = cleaned.replaceAll("\\s+", " ").trim();

        // 5. 移除开头和结尾的多余标点
        cleaned = cleaned.replaceAll("^[：:，,。.]+", "").trim();
        cleaned = cleaned.replaceAll("[：:，,。.]+$", "").trim();

        return cleaned;
    }

    /**
     * 识别主持人 - 增强版本
     */
    private String identifyHost(String line) {
        if (line == null || line.trim().isEmpty()) {
            return null;
        }

        // 优先匹配[女生]
        if (line.contains("[女生]")) {
            return "女生";
        }

        // 其次匹配[男生]
        if (line.contains("[男生]")) {
            return "男生";
        }

        // 如果都没有，返回null
        return null;
    }

    /**
     * 修复对话内容
     */
    private String fixDialogueContent(String dialogue) {
        if (dialogue == null || dialogue.trim().isEmpty()) {
            return "";
        }

        String fixed = dialogue.trim();

        // 移除明显的错误字符
        fixed = fixed.replaceAll("^[：:，,。.]+", "").trim();
        fixed = fixed.replaceAll("[：:，,。.]+$", "").trim();

        // 移除多余的标识符
        fixed = fixed.replaceAll("\\[女生\\]", "").trim();
        fixed = fixed.replaceAll("\\[男生\\]", "").trim();

        // 清理空格
        fixed = fixed.replaceAll("\\s+", " ").trim();

        return fixed;
    }

    /**
     * 备用对话提取方法
     */
    private String extractFallbackDialogue(String line) {
        if (line == null || line.trim().isEmpty()) {
            return "";
        }

        // 尝试直接提取方括号后的内容
        String pattern = "\\[.*?\\]\\s*([：:]?\\s*.*)";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(line);

        if (m.find()) {
            String content = m.group(1).trim();
            return cleanDialogueContent(content);
        }

        return "";
    }

    /**
     * 检查是否为有效的对话内容
     */
    private boolean isValidDialogueContent(String dialogue) {
        if (dialogue == null || dialogue.trim().isEmpty()) {
            return false;
        }

        String trimmedDialogue = dialogue.trim();

        // 只过滤掉明显无效的内容
        String[] invalidMarkers = {
            "```", "json", "xml", "html", "css", "javascript",
            "function", "class", "import", "export", "require"
        };

        String lowerDialogue = trimmedDialogue.toLowerCase();
        for (String marker : invalidMarkers) {
            if (lowerDialogue.contains(marker)) {
                log.debug("对话内容包含无效标记 '{}': {}", marker, dialogue);
                return false;
            }
        }

        // 放宽长度限制，只过滤明显异常的内容
        if (trimmedDialogue.length() < 2) {
            log.debug("对话内容太短: {}", dialogue);
            return false;
        }

        // 增加长度限制到1000字符，避免过长内容
        if (trimmedDialogue.length() > 1000) {
            log.debug("对话内容太长: {} 字符", trimmedDialogue.length());
            return false;
        }

        // 检查是否只包含标点符号或特殊字符
        String contentOnly = trimmedDialogue.replaceAll("[\\p{Punct}\\s]", "");
        if (contentOnly.isEmpty()) {
            log.debug("对话内容只包含标点符号: {}", dialogue);
            return false;
        }

        log.debug("对话内容验证通过: {}", dialogue);
        return true;
    }

    /**
     * 生成音频文件
     */
    private String generateAudioFiles(List<DialogueSegment> segments, String outputFormat) {
        try {
            // 生成输出文件名 - 修复：TTS API返回WAV格式，所以文件扩展名应该是wav
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String actualFormat = "wav"; // TTS API固定返回WAV格式
            String outputFileName = String.format("news_audio_%s.%s", timestamp, actualFormat);

            // 主持人音色映射
            Map<String, String> voiceMapping = new HashMap<>();
            voiceMapping.put("女生", "podcast_female");
            voiceMapping.put("男生", "podcast_male");

            // 为每个段落生成音频
            List<byte[]> audioDataList = new ArrayList<>();

            for (DialogueSegment segment : segments) {
                log.info("开始为段落生成音频: 主持人={}, 内容长度={}", segment.getHost(), segment.getText().length());
                byte[] audioData = generateSegmentAudio(segment, voiceMapping.get(segment.getHost()));
                if (audioData != null) {
                    audioDataList.add(audioData);
                    log.info("段落音频生成成功: {} ({} bytes)", segment.getHost(), audioData.length);
                } else {
                    log.warn("段落音频生成失败: {}", segment.getHost());
                }
            }

            if (audioDataList.isEmpty()) {
                log.error("所有段落音频生成都失败了");
                return null;
            }

                        // 合并音频数据并保存到文件
            try {
                byte[] combinedAudio = combineAudioData(audioDataList);
                if (combinedAudio != null && combinedAudio.length > 0) {
                    // 直接保存到工作空间，模拟其他工具的文件存储方式
                    String workspaceDir = System.getProperty("user.dir") + "/workspace/audio";
                    java.nio.file.Path workspacePath = java.nio.file.Path.of(workspaceDir);
                    if (!java.nio.file.Files.exists(workspacePath)) {
                        java.nio.file.Files.createDirectories(workspacePath);
                    }

                    String filePath = workspaceDir + "/" + outputFileName;
                    java.nio.file.Files.write(java.nio.file.Path.of(filePath), combinedAudio);
                    log.info("音频文件保存到工作空间: {} ({} bytes)", filePath, combinedAudio.length);

                    // 添加到产品文件列表，让前端能够看到工作空间中的文件
                    if (agentContext != null) {
                        com.jd.genie.agent.dto.File file = com.jd.genie.agent.dto.File.builder()
                                .fileName(outputFileName)
                                .fileSize(combinedAudio.length)
                                .ossUrl("/api/audio/" + outputFileName)
                                .domainUrl("/api/audio/" + outputFileName)
                                .description("TTS生成的播客音频文件，格式：" + outputFormat)
                                .isInternalFile(false)
                                .build();

                        agentContext.getProductFiles().add(file);
                        agentContext.getTaskProductFiles().add(file);

                        log.info("音频文件已添加到产品文件列表: {}", outputFileName);
                    }

                    return "workspace/audio/" + outputFileName;
                } else {
                    log.error("音频数据合并失败");
                    return null;
                }
            } catch (Exception e) {
                log.error("保存音频文件失败", e);
                return null;
            }

        } catch (Exception e) {
            log.error("生成音频文件失败", e);
            return null;
        }
    }

    /**
     * 合并音频数据 - 修复版本，正确处理WAV文件合并
     */
    private byte[] combineAudioData(List<byte[]> audioDataList) {
        try {
            if (audioDataList == null || audioDataList.isEmpty()) {
                log.warn("音频数据列表为空，无法合并");
                return null;
            }

            // 过滤掉无效的音频数据 - 修复：不修改原始音频数据
            List<byte[]> validAudioDataList = new ArrayList<>();
            for (int i = 0; i < audioDataList.size(); i++) {
                byte[] audioData = audioDataList.get(i);
                if (audioData != null && audioData.length > 0) {
                    // 记录原始音频数据大小
                    log.debug("原始音频数据[{}]: {} bytes", i, audioData.length);

                    // 检查音频数据是否有效（WAV文件头检查）
                    if (isValidWavData(audioData)) {
                        validAudioDataList.add(audioData);
                        log.debug("有效音频数据[{}]: {} bytes", i, audioData.length);
                    } else {
                        log.warn("跳过无效音频数据[{}]: {} bytes", i, audioData.length);
                    }
                } else {
                    log.warn("跳过空音频数据[{}]", i);
                }
            }

            if (validAudioDataList.isEmpty()) {
                log.error("没有有效的音频数据可以合并");
                return null;
            }

            if (validAudioDataList.size() == 1) {
                log.info("只有一个音频段落，直接返回");
                return validAudioDataList.get(0);
            }

            log.info("开始合并 {} 个有效音频段落", validAudioDataList.size());

            // 使用改进的WAV文件合并方法
            return combineWavFiles(validAudioDataList);

        } catch (Exception e) {
            log.error("合并音频数据失败", e);
            return null;
        }
    }

    /**
     * 合并多个WAV文件 - 正确处理WAV文件格式
     */
    private byte[] combineWavFiles(List<byte[]> wavFiles) {
        try {
            if (wavFiles.size() == 1) {
                return wavFiles.get(0);
            }

            // 提取第一个文件的头部信息
            byte[] firstWav = wavFiles.get(0);
            if (firstWav.length < 44) {
                log.error("第一个WAV文件太短，无法提取头部信息");
                return null;
            }

            // 计算所有音频数据的总长度（不包括头部）
            int totalAudioDataLength = 0;
            for (byte[] wavFile : wavFiles) {
                if (wavFile.length > 44) {
                    totalAudioDataLength += (wavFile.length - 44);
                }
            }

            log.info("总音频数据长度: {} bytes", totalAudioDataLength);

            // 创建新的WAV文件
            byte[] combinedWav = new byte[44 + totalAudioDataLength];

            // 复制第一个文件的头部（前44字节）
            System.arraycopy(firstWav, 0, combinedWav, 0, 44);

            // 更新文件大小（总长度 - 8）
            int totalFileSize = combinedWav.length - 8;
            combinedWav[4] = (byte) (totalFileSize & 0xFF);
            combinedWav[5] = (byte) ((totalFileSize >> 8) & 0xFF);
            combinedWav[6] = (byte) ((totalFileSize >> 16) & 0xFF);
            combinedWav[7] = (byte) ((totalFileSize >> 24) & 0xFF);

            // 更新数据块大小（音频数据长度）- 修复：data块大小字段位置
            // WAV文件格式：RIFF(4) + 文件大小(4) + WAVE(4) + fmt块 + data块
            // data块大小字段位置需要动态计算
            int dataChunkSizeOffset = findDataChunkSizeOffset(combinedWav);
            if (dataChunkSizeOffset > 0) {
                combinedWav[dataChunkSizeOffset] = (byte) (totalAudioDataLength & 0xFF);
                combinedWav[dataChunkSizeOffset + 1] = (byte) ((totalAudioDataLength >> 8) & 0xFF);
                combinedWav[dataChunkSizeOffset + 2] = (byte) ((totalAudioDataLength >> 16) & 0xFF);
                combinedWav[dataChunkSizeOffset + 3] = (byte) ((totalAudioDataLength >> 24) & 0xFF);
                log.info("更新data块大小字段，位置: {}, 大小: {}", dataChunkSizeOffset, totalAudioDataLength);
            } else {
                log.warn("未找到data块大小字段位置，使用默认位置40");
                // 回退到默认位置
                combinedWav[40] = (byte) (totalAudioDataLength & 0xFF);
                combinedWav[41] = (byte) ((totalAudioDataLength >> 8) & 0xFF);
                combinedWav[42] = (byte) ((totalAudioDataLength >> 16) & 0xFF);
                combinedWav[43] = (byte) ((totalAudioDataLength >> 24) & 0xFF);
            }

            // 合并所有音频数据（跳过每个文件的头部）
            int offset = 44;
            for (int i = 0; i < wavFiles.size(); i++) {
                byte[] wavFile = wavFiles.get(i);
                if (wavFile.length > 44) {
                    int audioDataLength = wavFile.length - 44;
                    System.arraycopy(wavFile, 44, combinedWav, offset, audioDataLength);
                    offset += audioDataLength;
                    log.debug("合并第 {} 个音频段落: {} bytes", i + 1, audioDataLength);
                }
            }

            log.info("WAV文件合并完成，总长度: {} bytes", combinedWav.length);
            return combinedWav;

        } catch (Exception e) {
            log.error("合并WAV文件失败", e);
            return null;
        }
    }

    /**
     * 查找WAV文件中data块大小字段的位置
     */
    private int findDataChunkSizeOffset(byte[] wavData) {
        try {
            // 查找"data"块标识
            for (int i = 0; i < wavData.length - 8; i++) {
                if (wavData[i] == 'd' && wavData[i+1] == 'a' &&
                    wavData[i+2] == 't' && wavData[i+3] == 'a') {
                    // 找到data块，大小字段在data标识后4字节
                    return i + 4;
                }
            }
        } catch (Exception e) {
            log.warn("查找data块大小字段位置失败", e);
        }
        return -1;
    }

    /**
     * 检查是否为有效的WAV音频数据
     */
    private boolean isValidWavData(byte[] audioData) {
        if (audioData == null || audioData.length < 44) {
            log.debug("音频数据为空或太短: {} bytes", audioData != null ? audioData.length : 0);
            return false;
        }

        // 检查WAV文件头 - 更严格的验证
        // WAV文件应该以"RIFF"开头
        if (audioData[0] != 'R' || audioData[1] != 'I' ||
            audioData[2] != 'F' || audioData[3] != 'F') {
            log.debug("音频数据不以RIFF开头");
            return false;
        }

        // 检查是否包含"WAVE"标识（通常在位置8-11）
        if (audioData.length < 12) {
            log.debug("音频数据太短，无法检查WAVE标识");
            return false;
        }

        if (audioData[8] != 'W' || audioData[9] != 'A' ||
            audioData[10] != 'V' || audioData[11] != 'E') {
            log.debug("音频数据不包含WAVE标识");
            return false;
        }

        // 检查是否包含"data"块
        boolean hasDataChunk = false;
        for (int i = 0; i < audioData.length - 8; i++) {
            if (audioData[i] == 'd' && audioData[i+1] == 'a' &&
                audioData[i+2] == 't' && audioData[i+3] == 'a') {
                hasDataChunk = true;
                break;
            }
        }

        if (!hasDataChunk) {
            log.debug("音频数据不包含data块");
            return false;
        }

        log.debug("WAV文件验证通过: {} bytes", audioData.length);
        return true;
    }

    /**
     * 生成单个段落的音频
     */
    private byte[] generateSegmentAudio(DialogueSegment segment, String voice) {
        int maxRetries = 3;
        int retryDelay = 1000; // 1秒

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                log.info("尝试生成音频段落 (第{}次): 主持人={}, 内容长度={}",
                    attempt, segment.getHost(), segment.getText().length());

                // 内网环境TTS API调用方式
                HttpHeaders headers = new HttpHeaders();
                headers.set("X-TC-Action", "/v1/audio/speech");
                headers.set("X-TC-Service", "tts-0711");
                headers.set("X-TC-Version", "2020-10-01");
                headers.setContentType(MediaType.APPLICATION_JSON);

                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("model", TTS_MODEL);
                requestBody.put("input", segment.getText());
                requestBody.put("voice", voice);
                requestBody.put("response_format", "wav");

                HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

                log.debug("调用内网TTS API: URL={}, 模型={}, 内容长度={}",
                    TTS_API_URL, TTS_MODEL, segment.getText().length());

                byte[] response = restTemplate.postForObject(TTS_API_URL, request, byte[].class);

                if (response != null && response.length > 0) {
                    // 验证音频数据有效性
                    if (isValidWavData(response)) {
                        log.info("成功生成音频段落: {} ({} bytes)", segment.getHost(), response.length);
                        return response;
                    } else {
                        log.warn("音频段落数据无效: {} - 数据长度: {} bytes", segment.getHost(), response.length);
                        if (attempt < maxRetries) {
                            log.info("等待 {}ms 后重试...", retryDelay);
                            Thread.sleep(retryDelay);
                            continue;
                        }
                    }
                } else {
                    log.warn("音频段落生成失败: {} - API返回空响应 (第{}次尝试)", segment.getHost(), attempt);
                    if (attempt < maxRetries) {
                        log.info("等待 {}ms 后重试...", retryDelay);
                        Thread.sleep(retryDelay);
                        continue;
                    }
                }

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.error("音频生成被中断: {}", segment.getHost(), e);
                return null;
            } catch (Exception e) {
                log.error("生成音频段落失败: {} - 异常详情: {} (第{}次尝试)",
                    segment.getHost(), e.getMessage(), attempt, e);

                if (attempt < maxRetries) {
                    try {
                        log.info("等待 {}ms 后重试...", retryDelay);
                        Thread.sleep(retryDelay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return null;
                    }
                }
            }
        }

        log.error("音频段落生成最终失败: {} - 已尝试 {} 次", segment.getHost(), maxRetries);
        return null;
    }

    /**
     * 内网环境音色映射
     * 内网TTS接口支持podcast_female和podcast_male音色
     */
    private String mapVoiceToInternal(String originalVoice) {
        // 内网TTS接口音色映射
        switch (originalVoice) {
            case "podcast_female":
                log.info("使用内网TTS接口，音色: {}", originalVoice);
                return "podcast_female";  // 内网支持的女性音色
            case "podcast_male":
                log.info("使用内网TTS接口，音色: {}", originalVoice);
                return "podcast_male";  // 内网支持的男性音色
            default:
                log.info("使用内网TTS接口，音色: {} -> podcast_female (默认)", originalVoice);
                return "podcast_female";  // 默认使用女性音色
            }
    }



    /**
     * 对话段落内部类
     */
    private static class DialogueSegment {
        private final String host;
        private final String text;

        public DialogueSegment(String host, String text) {
            this.host = host;
            this.text = text;
        }

        public String getHost() {
            return host;
        }

        public String getText() {
            return text;
        }
    }
} 