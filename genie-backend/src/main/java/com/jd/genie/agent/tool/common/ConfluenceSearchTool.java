package com.jd.genie.agent.tool.common;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.jd.genie.agent.agent.AgentContext;
import com.jd.genie.agent.tool.BaseTool;
import com.jd.genie.agent.util.SpringContextHolder;
import com.jd.genie.config.GenieConfig;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.context.ApplicationContext;

import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Data
public class ConfluenceSearchTool implements BaseTool {

    private AgentContext agentContext;

    @Override
    public String getName() {
        return "confluence_search";
    }

    @Override
    public String getDescription() {
        return "这是一个Confluence知识库搜索工具，可以通过关键词向量检索Confluence文档，支持按标题筛选";
    }

    @Override
    public Map<String, Object> toParams() {
        Map<String, Object> queryParam = new HashMap<>();
        queryParam.put("type", "string");
        queryParam.put("description", "需要搜索的查询文本");

        Map<String, Object> topkParam = new HashMap<>();
        topkParam.put("type", "integer");
        topkParam.put("description", "返回结果数量，默认为3");
        topkParam.put("default", 3);

        Map<String, Object> titleContainsParam = new HashMap<>();
        titleContainsParam.put("type", "string");
        titleContainsParam.put("description", "可选的标题筛选条件，只返回标题包含此关键词的结果");

        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        Map<String, Object> properties = new HashMap<>();
        properties.put("query", queryParam);
        properties.put("topk", topkParam);
        properties.put("title_contains", titleContainsParam);
        parameters.put("properties", properties);
        parameters.put("required", Collections.singletonList("query"));

        return parameters;
    }

    @Override
    public Object execute(Object input) {
        long startTime = System.currentTimeMillis();
        String requestId = agentContext != null ? agentContext.getRequestId() : "confluence-search";

        try {
            GenieConfig genieConfig = SpringContextHolder.getApplicationContext().getBean(GenieConfig.class);
            Map<String, Object> params = (Map<String, Object>) input;
            String query = (String) params.get("query");
            Integer topk = params.get("topk") != null ? (Integer) params.get("topk") : 3;
            String titleContains = (String) params.get("title_contains");

            if (query == null || query.trim().isEmpty()) {
                log.error("{} confluence_search: query参数不能为空", requestId);
                return createErrorResponse("query参数不能为空");
            }

            // 获取SeekDB URL配置
            String seekDbUrl = genieConfig.getSeekDbUrl();
            if (seekDbUrl == null || seekDbUrl.isEmpty()) {
                log.error("{} confluence_search: SeekDB URL未配置", requestId);
                return createErrorResponse("SeekDB URL未配置");
            }

            // 构建请求payload
            JSONObject payload = new JSONObject();
            payload.put("query", query);
            payload.put("top_k", topk);
            
            if (titleContains != null && !titleContains.trim().isEmpty()) {
                JSONObject where = new JSONObject();
                JSONObject titleFilter = new JSONObject();
                titleFilter.put("$contains", titleContains);
                where.put("title", titleFilter);
                payload.put("where", where);
            }

            log.info("{} confluence_search request: {}", requestId, payload.toJSONString());

            // 调用SeekDB API
            OkHttpClient client = new OkHttpClient.Builder()
                    .connectTimeout(10, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .build();

            RequestBody body = RequestBody.create(
                    MediaType.parse("application/json; charset=utf-8"),
                    payload.toJSONString()
            );

            Request request = new Request.Builder()
                    .url(seekDbUrl + "/search")
                    .post(body)
                    .addHeader("Content-Type", "application/json")
                    .build();

            try (Response response = client.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    log.error("{} confluence_search failed: HTTP {}", requestId, response.code());
                    return createErrorResponse("SeekDB API请求失败: HTTP " + response.code());
                }

                String responseBody = response.body() != null ? response.body().string() : "";
                JSONObject result = JSON.parseObject(responseBody);

                log.info("{} confluence_search response: {} results", requestId, 
                        result.getJSONArray("results") != null ? result.getJSONArray("results").size() : 0);

                long duration = System.currentTimeMillis() - startTime;
                log.info("{} confluence_search completed in {}ms", requestId, duration);

                return result;
            }

        } catch (IOException e) {
            log.error("{} confluence_search IO error", requestId, e);
            return createErrorResponse("网络请求失败: " + e.getMessage());
        } catch (Exception e) {
            log.error("{} confluence_search error", requestId, e);
            return createErrorResponse("搜索失败: " + e.getMessage());
        }
    }

    /**
     * 根据文章ID获取完整内容
     */
    public Object getFullText(String articleId) {
        String requestId = agentContext != null ? agentContext.getRequestId() : "confluence-fulltext";

        try {
            GenieConfig genieConfig = SpringContextHolder.getApplicationContext().getBean(GenieConfig.class);
            String seekDbUrl = genieConfig.getSeekDbUrl();
            
            if (seekDbUrl == null || seekDbUrl.isEmpty()) {
                log.error("{} confluence_fulltext: SeekDB URL未配置", requestId);
                return createErrorResponse("SeekDB URL未配置");
            }

            JSONObject payload = new JSONObject();
            payload.put("id", articleId);

            log.info("{} confluence_fulltext request: {}", requestId, payload.toJSONString());

            OkHttpClient client = new OkHttpClient.Builder()
                    .connectTimeout(10, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .build();

            RequestBody body = RequestBody.create(
                    MediaType.parse("application/json; charset=utf-8"),
                    payload.toJSONString()
            );

            Request request = new Request.Builder()
                    .url(seekDbUrl + "/fulltext")
                    .post(body)
                    .addHeader("Content-Type", "application/json")
                    .build();

            try (Response response = client.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    log.error("{} confluence_fulltext failed: HTTP {}", requestId, response.code());
                    return createErrorResponse("SeekDB API请求失败: HTTP " + response.code());
                }

                String responseBody = response.body() != null ? response.body().string() : "";
                JSONObject result = JSON.parseObject(responseBody);

                log.info("{} confluence_fulltext completed", requestId);
                return result;
            }

        } catch (Exception e) {
            log.error("{} confluence_fulltext error", requestId, e);
            return createErrorResponse("获取完整内容失败: " + e.getMessage());
        }
    }

    private JSONObject createErrorResponse(String message) {
        JSONObject error = new JSONObject();
        error.put("status", "error");
        error.put("message", message);
        error.put("results", Collections.emptyList());
        return error;
    }
}

