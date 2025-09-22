package com.jd.genie.agent.tool.common;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.jd.genie.agent.agent.AgentContext;
import com.jd.genie.agent.tool.BaseTool;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import java.util.concurrent.TimeUnit;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 智能数据查询工具
 * 支持自然语句查询，能够理解用户意图并调用相应的 API 接口
 */
@Slf4j
@Data
public class NewsDataFetchTool implements BaseTool {

    private AgentContext agentContext;
    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build();

    // API 配置
    private static final String API_BASE_URL = "http://172.31.73.27";
    private static final String HEALTH_CHECK_URL = API_BASE_URL + "/health";
    private static final String DATA_STATS_URL = API_BASE_URL + "/v1/data/stats/";
    private static final String DATA_QUERY_URL = API_BASE_URL + "/v1/data/";

    // 支持的数据分类
    private static final String[] SUPPORTED_CATEGORIES = {
        "technology", "internal-events", "internal-announcements",
        "reference-materials", "public-sentiment", "financial-news", "party-bulding"
    };

    @Override
    public String getName() {
        return "agent_news";
    }

    @Override
    public String getDescription() {
        return "这是一个智能数据查询工具，支持自然语句查询。用户可以输入如'查询最新的科技文章'、'获取内部活动信息'、'查看金融新闻'等自然语句，工具会自动理解意图并返回相关数据。支持查询科技文章、内部活动、内部公告、参阅内容、舆情报送、金融新闻、内部党建等分类的数据。";
    }

    @Override
    public Map<String, Object> toParams() {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> queryParam = new HashMap<>();
        queryParam.put("type", "string");
        queryParam.put("description", "自然语句查询，例如：'查询最新的科技文章'、'获取内部活动信息'、'查看金融新闻'、'获取最近的内部公告'等");
        queryParam.put("default", "查询最新的科技文章");
        properties.put("query", queryParam);

        Map<String, Object> limitParam = new HashMap<>();
        limitParam.put("type", "integer");
        limitParam.put("description", "返回数据条数限制，最大1000条");
        limitParam.put("default", 5);
        properties.put("limit", limitParam);

        Map<String, Object> timeRangeParam = new HashMap<>();
        timeRangeParam.put("type", "string");
        timeRangeParam.put("description", "时间范围，例如：'最近一周'、'最近一个月'、'今年'、'2024年'等");
        timeRangeParam.put("default", "最近一个月");
        properties.put("time_range", timeRangeParam);

        parameters.put("properties", properties);
        parameters.put("required", new String[]{"query"});

        return parameters;
    }

    @Override
    public Object execute(Object input) {
        log.info("=== SmartDataQueryTool 开始执行 ===");
        log.info("{} SmartDataQueryTool.execute() 开始执行，输入: {}",
            agentContext != null ? agentContext.getRequestId() : "unknown", input);

        try {
            // 解析输入参数
            String query = "查询最新的科技文章";
            Integer limit = 5;
            String timeRange = "最近一个月";

            if (input instanceof Map) {
                Map<String, Object> inputMap = (Map<String, Object>) input;
                log.info("{} 输入参数解析: {}",
                    agentContext != null ? agentContext.getRequestId() : "unknown", inputMap);

                if (inputMap.containsKey("query")) {
                    query = (String) inputMap.get("query");
                }
                if (inputMap.containsKey("limit")) {
                    limit = (Integer) inputMap.get("limit");
                }
                if (inputMap.containsKey("time_range")) {
                    timeRange = (String) inputMap.get("time_range");
                }
            }

            log.info("{} 智能查询开始，查询语句: {}, 限制条数: {}, 时间范围: {}",
                agentContext != null ? agentContext.getRequestId() : "unknown", query, limit, timeRange);
            log.info("{} 时间范围解析前: {}",
                agentContext != null ? agentContext.getRequestId() : "unknown", timeRange);

            // 智能解析查询意图
            QueryIntent intent = parseQueryIntent(query);
            log.info("{} 解析的查询意图: 分类={}, 关键词={}",
                agentContext != null ? agentContext.getRequestId() : "unknown", intent.category, intent.keywords);

            // 执行查询
            Map<String, Object> result = executeQuery(intent, limit, timeRange);

            log.info("{} 查询执行完成", agentContext != null ? agentContext.getRequestId() : "unknown");
            return result;

        } catch (Exception e) {
            log.error("=== SmartDataQueryTool 执行异常 ===");
            log.error("{} SmartDataQueryTool 执行异常，详细错误: ",
                agentContext != null ? agentContext.getRequestId() : "unknown", e);

            // 返回错误信息和备用数据
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("status", "error");
            errorResult.put("message", "查询执行失败: " + e.getMessage());
            errorResult.put("fallback_data", getFallbackData());
            return errorResult;
        }
    }

    /**
     * 解析查询意图
     */
    private QueryIntent parseQueryIntent(String query) {
        QueryIntent intent = new QueryIntent();
        intent.originalQuery = query;

        // 转换为小写便于匹配
        String lowerQuery = query.toLowerCase();

        // 分类匹配
        if (lowerQuery.contains("科技") || lowerQuery.contains("技术") || lowerQuery.contains("ai") ||
            lowerQuery.contains("人工智能") || lowerQuery.contains("创新") || lowerQuery.contains("研发")) {
            intent.category = "tech-articles";
        } else if (lowerQuery.contains("活动") || lowerQuery.contains("会议") || lowerQuery.contains("培训") ||
                   lowerQuery.contains("团建") || lowerQuery.contains("聚会")) {
            intent.category = "internal-events";
        } else if (lowerQuery.contains("公告") || lowerQuery.contains("通知") || lowerQuery.contains("声明") ||
                   lowerQuery.contains("政策")) {
            intent.category = "internal-announcements";
        } else if (lowerQuery.contains("参阅") || lowerQuery.contains("参考") || lowerQuery.contains("资料") ||
                   lowerQuery.contains("文档")) {
            intent.category = "reference-materials";
        } else if (lowerQuery.contains("舆情") || lowerQuery.contains("舆论") || lowerQuery.contains("热点") ||
                   lowerQuery.contains("关注")) {
            intent.category = "public-sentiment";
        } else if (lowerQuery.contains("金融") || lowerQuery.contains("财经") || lowerQuery.contains("股票") ||
                   lowerQuery.contains("投资") || lowerQuery.contains("经济")) {
            intent.category = "financial-news";
        } else if (lowerQuery.contains("党建") || lowerQuery.contains("党员") || lowerQuery.contains("组织") ||
                   lowerQuery.contains("政治")) {
            intent.category = "party-bulding";
            } else {
            // 默认查询科技文章
            intent.category = "tech-articles";
        }

        // 提取关键词
        intent.keywords = extractKeywords(query);

        return intent;
    }

    /**
     * 提取关键词
     */
    private String[] extractKeywords(String query) {
        // 简单的关键词提取逻辑
        String[] commonWords = {"查询", "获取", "查看", "搜索", "找", "的", "了", "在", "有", "和", "与", "或", "等", "等等"};
        String[] keywords = query.split("[\\s\\p{Punct}]+");

        // 过滤常见词汇
        java.util.List<String> filteredKeywords = new java.util.ArrayList<>();
        for (String keyword : keywords) {
            if (keyword.length() > 1 && !java.util.Arrays.asList(commonWords).contains(keyword)) {
                filteredKeywords.add(keyword);
            }
        }

        return filteredKeywords.toArray(new String[0]);
    }

    /**
     * 执行查询
     */
    private Map<String, Object> executeQuery(QueryIntent intent, Integer limit, String timeRange) {
        Map<String, Object> result = new HashMap<>();

        try {
            // 直接查询数据，不进行健康检查
            Map<String, Object> data = queryCategoryData(intent.category, limit, timeRange);
            result.put("data", data);

            // 尝试获取统计数据（可选）
            try {
                Map<String, Object> stats = getCategoryStats(intent.category);
                result.put("stats", stats);
            } catch (Exception e) {
                log.warn("获取统计数据失败，继续执行: {}", e.getMessage());
                result.put("stats", new HashMap<>());
            }

            result.put("status", "success");
            result.put("message", "查询执行成功");
            result.put("query_intent", intent);

            // 为播客文本生成工具添加格式化的数据
            String formattedData = formatDataForPodcastGenerator(data);
            result.put("newsData", formattedData);
            result.put("raw_data", formattedData); // 保持向后兼容性

        } catch (Exception e) {
            log.error("查询执行失败: {}", e.getMessage(), e);
            result.put("status", "error");
            result.put("message", "查询执行失败: " + e.getMessage());
            result.put("fallback_data", getFallbackData());
        }

        return result;
    }

    /**
     * 检查 API 健康状态
     */
    private boolean checkApiHealth() {
        try {
            Request request = new Request.Builder()
                    .url(HEALTH_CHECK_URL)
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    JSONObject healthData = JSON.parseObject(response.body().string());
                    return "healthy".equals(healthData.getString("status")) &&
                           "connected".equals(healthData.getString("database"));
                }
            }
        } catch (Exception e) {
            log.warn("API 健康检查失败: {}", e.getMessage());
        }
        return false;
    }

    /**
     * 获取分类统计数据
     */
    private Map<String, Object> getCategoryStats(String category) {
        Map<String, Object> stats = new HashMap<>();

        try {
            String url = DATA_STATS_URL + category;
            Request request = new Request.Builder()
                    .url(url)
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                log.info("统计接口响应码: {}", response.code());

                if (response.isSuccessful() && response.body() != null) {
                    String responseBody = response.body().string();
                    log.info("统计接口响应体: {}", responseBody);

                    JSONObject statsData = JSON.parseObject(responseBody);
                    log.info("统计接口解析结果: {}", statsData);

                    stats.put("total_records", statsData.getInteger("total_records"));
                    stats.put("last_update", statsData.getString("last_update"));
                    stats.put("category", statsData.getString("category"));

                    log.info("统计数据处理完成: {}", stats);
                }
            }
        } catch (Exception e) {
            log.warn("获取统计数据失败: {}", e.getMessage());
            stats.put("error", "获取统计数据失败: " + e.getMessage());
        }

        return stats;
    }

    /**
     * 查询分类数据
     */
    private Map<String, Object> queryCategoryData(String category, Integer limit, String timeRange) {
        Map<String, Object> data = new HashMap<>();
        String url = null; // 声明在方法开始处

        try {
            // 构建查询参数
            StringBuilder urlBuilder = new StringBuilder(DATA_QUERY_URL + category);
            urlBuilder.append("?limit=").append(Math.min(limit, 1000));

            // 添加时间范围参数
            String[] timeParams = parseTimeRange(timeRange);
            if (timeParams[0] != null) {
                urlBuilder.append("&start_time=").append(timeParams[0]);
            }
            if (timeParams[1] != null) {
                urlBuilder.append("&end_time=").append(timeParams[1]);
            }

            url = urlBuilder.toString(); // 赋值
            log.info("查询 URL: {}", url);

            log.info("使用OkHttp3客户端发送请求: {}", url);

            // 使用OkHttp3发送请求
            Request request = new Request.Builder()
                    .url(url)
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                log.info("OkHttp3响应码: {}", response.code());
                log.info("OkHttp3响应头: {}", response.headers());

                if (response.isSuccessful() && response.body() != null) {
                    String responseBody = response.body().string();
                    log.info("OkHttp3响应体长度: {}", responseBody.length());
                    log.info("OkHttp3完整响应体: {}", responseBody);

                    // 检查响应体是否为空或null
                    if (responseBody == null || responseBody.trim().isEmpty()) {
                        log.warn("响应体为空或null");
                        data.put("error", "响应体为空");
                        return data;
                    }

                    try {
                        JSONObject responseData = JSON.parseObject(responseBody);
                        log.info("解析后的JSON数据: {}", responseData);

                        // 检查关键字段
                        String responseCategory = responseData.getString("category");
                        Integer count = responseData.getInteger("count");
                        JSONArray records = responseData.getJSONArray("data");

                        log.info("解析结果 - category: {}, count: {}, records: {}", responseCategory, count, records);

                        data.put("category", responseCategory);
                        data.put("count", count);
                        data.put("records", records);

                        // 格式化数据
                        formatResponseData(data);

                        log.info("数据处理完成，最终结果: {}", data);

                    } catch (Exception parseException) {
                        log.error("JSON解析失败: {}", parseException.getMessage(), parseException);
                        data.put("error", "JSON解析失败: " + parseException.getMessage());
                    }
                } else {
                    log.warn("请求不成功 - 状态码: {}, 响应体: {}", response.code(), response.body());
                    data.put("error", "OkHttp3请求失败，状态码: " + response.code());
                }
            } catch (Exception e) {
                log.error("OkHttp3请求异常: {}", e.getMessage(), e);
                data.put("error", "请求异常: " + e.getMessage());
            }

        } catch (Exception e) {
            log.error("查询分类数据失败: {}", e.getMessage(), e);
            data.put("error", "查询失败: " + e.getMessage());
        }

        return data;
    }

    /**
     * 解析时间范围
     */
    private String[] parseTimeRange(String timeRange) {
        String[] result = new String[2]; // [start_time, end_time]

        try {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime startTime = null;
            LocalDateTime endTime = null;

            if ("今天".equals(timeRange) || "today".equals(timeRange)) {
                startTime = now.toLocalDate().atStartOfDay();
                endTime = now.toLocalDate().atTime(23, 59, 59);
            } else if ("最近一周".equals(timeRange) || "last_week".equals(timeRange)) {
                startTime = now.minusDays(7).toLocalDate().atStartOfDay();
                endTime = now;
            } else if ("最近一个月".equals(timeRange) || "last_month".equals(timeRange)) {
                startTime = now.minusMonths(1).toLocalDate().atStartOfDay();
                endTime = now;
            } else if ("今年".equals(timeRange) || "this_year".equals(timeRange)) {
                startTime = now.toLocalDate().withDayOfYear(1).atStartOfDay();
                endTime = now;
            } else if (timeRange.matches("\\d{4}年")) {
                int year = Integer.parseInt(timeRange.replace("年", ""));
                startTime = LocalDate.of(year, 1, 1).atStartOfDay();
                endTime = LocalDate.of(year, 12, 31).atTime(23, 59, 59);
            }

            if (startTime != null) {
                result[0] = startTime.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            }
            if (endTime != null) {
                result[1] = endTime.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            }

        } catch (Exception e) {
            log.warn("时间范围解析失败: {}", e.getMessage());
        }

        return result;
    }

    /**
     * 格式化响应数据
     */
    private void formatResponseData(Map<String, Object> data) {
        try {
            JSONArray records = (JSONArray) data.get("records");
            if (records != null) {
                for (int i = 0; i < records.size(); i++) {
                    JSONObject record = records.getJSONObject(i);

                    // 格式化时间
                    if (record.containsKey("publish_time") && record.get("publish_time") != null) {
                        String publishTime = record.getString("publish_time");
                        if (publishTime.length() > 19) {
                            record.put("publish_time", publishTime.substring(0, 19));
                        }
                    }

                    if (record.containsKey("insert_time") && record.get("insert_time") != null) {
                        String insertTime = record.getString("insert_time");
                        if (insertTime.length() > 19) {
                            record.put("insert_time", insertTime.substring(0, 19));
                        }
                    }

                    // 处理 metadata
                    if (record.containsKey("metadata") && record.get("metadata") != null) {
                        try {
                            if (record.get("metadata") instanceof String) {
                                JSONObject metadata = JSON.parseObject(record.getString("metadata"));
                                record.put("metadata", metadata);
                            }
                        } catch (Exception e) {
                            log.warn("Metadata 解析失败: {}", e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("数据格式化失败: {}", e.getMessage());
        }
    }

    /**
     * 为播客文本生成工具格式化数据
     * 将API返回的JSON数据转换为播客文本生成工具期望的格式
     */
    private String formatDataForPodcastGenerator(Map<String, Object> data) {
        try {
            StringBuilder formattedData = new StringBuilder();

            // 添加分类信息
            String category = (String) data.get("category");
            if (category != null) {
                formattedData.append("分类：").append(category).append("\n");
            }

            // 添加记录数量
            Integer count = (Integer) data.get("count");
            if (count != null) {
                formattedData.append("记录数量：").append(count).append("条\n");
            }

            formattedData.append("新闻内容：\n");

            // 处理记录数据
            JSONArray records = (JSONArray) data.get("records");
            if (records != null && records.size() > 0) {
                for (int i = 0; i < records.size(); i++) {
                    JSONObject record = records.getJSONObject(i);

                    // 添加标题
                    String title = record.getString("title");
                    if (title != null && !title.trim().isEmpty()) {
                        formattedData.append("标题：").append(title).append("\n");
                    }

                    // 添加内容
                    String content = record.getString("content");
                    if (content != null && !content.trim().isEmpty()) {
                        // 限制内容长度，避免过长
                        if (content.length() > 500) {
                            content = content.substring(0, 500) + "...";
                        }
                        formattedData.append("内容：").append(content).append("\n");
                    }

                    // 添加发布时间
                    String publishTime = record.getString("publish_time");
                    if (publishTime != null && !publishTime.trim().isEmpty()) {
                        formattedData.append("发布时间：").append(publishTime).append("\n");
                    }

                    // 添加来源
                    String source = record.getString("source");
                    if (source != null && !source.trim().isEmpty()) {
                        formattedData.append("来源：").append(source).append("\n");
                    }

                    // 添加分隔符（除了最后一条记录）
                    if (i < records.size() - 1) {
                        formattedData.append("\n");
                    }
                }
            } else {
                formattedData.append("暂无相关新闻数据");
            }

            return formattedData.toString();

        } catch (Exception e) {
            log.error("格式化播客数据失败: {}", e.getMessage(), e);
            return "数据格式化失败: " + e.getMessage();
        }
    }

    /**
     * 获取备用数据
     */
    private Map<String, Object> getFallbackData() {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("message", "API 服务不可用，返回备用数据");
        fallback.put("sample_data", "API 服务不可用，返回备用数据");
        fallback.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return fallback;
    }


    /**
     * 查询意图类
     */
    private static class QueryIntent {
        String originalQuery;
        String category;
        String[] keywords;

        @Override
        public String toString() {
            return String.format("QueryIntent{originalQuery='%s', category='%s', keywords=%s}",
                originalQuery, category, java.util.Arrays.toString(keywords));
        }
    }
} 