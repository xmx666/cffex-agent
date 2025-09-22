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
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * 新闻内容生成工具
 * 实现BaseTool接口，负责使用大模型生成新闻摘要和播客脚本
 */
@Slf4j
public class NewsContentGeneratorTool implements BaseTool {

    private AgentContext agentContext;
    private RestTemplate restTemplate;

    // 内部模型配置
    private static final String INTERNAL_API_URL = "http://172.31.73.27/futuremaas/v1/chat/completions";
    private static final String INTERNAL_API_KEY = "cffex-pnnpdqex7gv9gt1m";
    private static final String INTERNAL_MODEL_NAME = "qwen3-next-80b-local";

    public NewsContentGeneratorTool() {
        // 配置 RestTemplate 超时
        this.restTemplate = new RestTemplate();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(30000); // 30秒连接超时
        factory.setReadTimeout(60000);    // 60秒读取超时
        this.restTemplate.setRequestFactory(factory);
    }

    @Override
    public String getName() {
        return "agent_news_generator";
    }

    @Override
    public String getDescription() {
        return "这是一个可以生成新闻摘要和播客脚本的智能体，能够使用大模型从原始新闻数据中提取关键信息并生成结构化的播客脚本";
    }

    public void setAgentContext(AgentContext agentContext) {
        this.agentContext = agentContext;
    }

    private Map<String, Object> parseInputParameters(Object input) {
        if (input instanceof Map) {
            return (Map<String, Object>) input;
        }
        return null;
    }

    @Override
    public Map<String, Object> toParams() {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> newsDataParam = new HashMap<>();
        newsDataParam.put("type", "string");
        newsDataParam.put("description", "原始新闻数据内容");
        properties.put("newsData", newsDataParam);

        Map<String, Object> newsCountParam = new HashMap<>();
        newsCountParam.put("type", "integer");
        newsCountParam.put("description", "需要提取的新闻条数");
        newsCountParam.put("default", 5);
        newsCountParam.put("minimum", 1);
        newsCountParam.put("maximum", 10);
        properties.put("newsCount", newsCountParam);

        Map<String, Object> focusAreaParam = new HashMap<>();
        focusAreaParam.put("type", "string");
        focusAreaParam.put("description", "重点关注领域：tech（技术）、finance（金融）、ai（人工智能）、general（综合）");
        focusAreaParam.put("enum", new String[]{"tech", "finance", "ai", "general"});
        focusAreaParam.put("default", "tech");
        properties.put("focusArea", focusAreaParam);

        Map<String, Object> checkTTSParam = new HashMap<>();
        checkTTSParam.put("type", "boolean");
        checkTTSParam.put("description", "是否检查TTS服务可用性");
        checkTTSParam.put("default", true);
        properties.put("checkTTS", checkTTSParam);

        parameters.put("properties", properties);
        parameters.put("required", new String[]{"newsData"});

        return parameters;
    }

    @Override
    public Object execute(Object input) {
        try {
            // 解析输入参数
            Map<String, Object> params = parseInputParameters(input);
            if (params == null) {
                return "输入参数解析失败";
            }

            String newsData = (String) params.get("newsData");
            if (newsData == null || newsData.trim().isEmpty()) {
                return "新闻数据不能为空";
            }

            // 生成播客脚本
            String script = generatePodcastScript(newsData);

            log.info("{} 播客脚本生成成功", agentContext.getRequestId());
            return script;

        } catch (Exception e) {
            log.error("{} 生成播客脚本失败", agentContext.getRequestId(), e);
            return "生成播客脚本失败: " + e.getMessage();
        }
    }

    /**
     * 生成播客脚本
     */
    private String generatePodcastScript(String newsData) {
        try {
            // 使用内部模型生成播客脚本
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", INTERNAL_MODEL_NAME);
            requestBody.put("messages", new Object[]{
                new HashMap<String, Object>() {{
                    put("role", "system");
                    put("content", "你是一个专业的播客脚本生成器，能够将新闻内容转换为有趣的播客对话脚本。请生成包含[女生]和[男生]对话的播客脚本。");
                }},
                new HashMap<String, Object>() {{
                    put("role", "user");
                    put("content", "请根据以下新闻内容生成播客脚本：\n\n" + newsData);
                }}
            });
            requestBody.put("temperature", 0.7);
            requestBody.put("max_tokens", 2000);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + INTERNAL_API_KEY);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(INTERNAL_API_URL, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                // 解析响应并提取内容
                String responseBody = response.getBody();
                if (responseBody != null && responseBody.contains("\"content\"")) {
                    // 简单的JSON解析，提取content字段
                    int contentStart = responseBody.indexOf("\"content\":\"") + 11;
                    int contentEnd = responseBody.indexOf("\"", contentStart);
                    if (contentStart > 10 && contentEnd > contentStart) {
                        return responseBody.substring(contentStart, contentEnd).replace("\\n", "\n").replace("\\\"", "\"");
                    }
                }
                return responseBody;
            } else {
                throw new RuntimeException("内部模型调用失败: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("{} 使用内部模型生成播客脚本失败", agentContext.getRequestId(), e);
            // 返回默认脚本
            return generateDefaultScript(newsData);
        }
    }

    /**
     * 生成默认播客脚本
     */
    private String generateDefaultScript(String newsData) {
        return "# 舆情新闻播客脚本\n\n" +
               "## 新闻摘要\n\n" +
               newsData + "\n\n" +
               "## 播客对话\n\n" +
               "[女生] 大家好，欢迎收听今天的舆情新闻播客。\n\n" +
               "[男生] 今天我们来聊聊最近三个月的舆情热点。\n\n" +
               "[女生] 让我们一起来看看都有哪些重要新闻。\n\n" +
               "[男生] 首先，我们来看一下最新的舆情动态...\n\n" +
               "## 总结\n\n" +
               "以上就是今天的主要内容，感谢大家的收听。";
    }
} 