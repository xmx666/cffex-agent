package com.jd.genie.agent.agent;

import com.jd.genie.agent.dto.Memory;
import com.jd.genie.agent.dto.tool.ToolCall;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;

import java.util.*;
import java.util.regex.Pattern;

@Slf4j
public class TaskCompletionAnalyzer {

    // 任务未完成的关键词模式
    private static final List<Pattern> INCOMPLETE_PATTERNS = Arrays.asList(
        Pattern.compile("需要调用|下一步|继续执行|未完成|需继续", Pattern.CASE_INSENSITIVE),
        Pattern.compile("生成.*文件|创建.*文件|生成.*HTML|创建.*网页", Pattern.CASE_INSENSITIVE),
        Pattern.compile("调用.*工具|使用.*工具|执行.*工具", Pattern.CASE_INSENSITIVE),
        Pattern.compile("获取.*数据|查询.*信息|搜索.*内容", Pattern.CASE_INSENSITIVE),
        Pattern.compile("播客|TTS|音频|视频|图片", Pattern.CASE_INSENSITIVE)
    );

    // 工具调用意图关键词
    private static final List<Pattern> TOOL_INTENT_PATTERNS = Arrays.asList(
        Pattern.compile("调用\\s*(\\w+)\\s*工具", Pattern.CASE_INSENSITIVE),
        Pattern.compile("使用\\s*(\\w+)\\s*来", Pattern.CASE_INSENSITIVE),
        Pattern.compile("通过\\s*(\\w+)\\s*生成", Pattern.CASE_INSENSITIVE),
        Pattern.compile("需要\\s*(\\w+)\\s*功能", Pattern.CASE_INSENSITIVE)
    );

    // 任务完成的关键词模式
    private static final List<Pattern> COMPLETE_PATTERNS = Arrays.asList(
        Pattern.compile("任务完成|已完成|结束|完毕", Pattern.CASE_INSENSITIVE),
        Pattern.compile("没有更多|无需继续|到此为止", Pattern.CASE_INSENSITIVE)
    );

    /**
     * 分析任务是否真正完成
     */
    public static TaskCompletionResult analyze(String lastMessage, String query,
                                            List<ToolCall> toolCalls, AgentContext context, Memory memory) {

        // 1. 基础检查：如果有工具调用，任务肯定未完成
        if (toolCalls != null && !toolCalls.isEmpty()) {
            return TaskCompletionResult.continueTask("检测到工具调用，继续执行");
        }

        // 2. 检查空响应 - 如果LLM返回空响应，需要进一步判断任务是否完成
        if (StringUtils.isBlank(lastMessage)) {
            // 对于空响应，需要检查任务是否真正完成
            boolean taskRequiresTools = isTaskTypeRequiresTools(query);
            boolean hasOutput = hasGeneratedOutput(context, memory);

            if (taskRequiresTools && !hasOutput) {
                return TaskCompletionResult.continueTask("LLM返回空响应，但任务需要工具调用且未检测到输出，继续执行");
            } else {
                return TaskCompletionResult.finishTask("LLM返回空响应，任务可能已完成");
            }
        }

        // 3. 检查明确的完成信号
        if (hasCompleteSignals(lastMessage)) {
            return TaskCompletionResult.finishTask("检测到明确的完成信号");
        }

        // 4. 检查未完成信号
        if (hasIncompleteSignals(lastMessage, query)) {
            return TaskCompletionResult.continueTask("检测到未完成信号，需要继续执行");
        }

        // 5. 检查工具调用意图
        List<String> intendedTools = extractIntendedTools(lastMessage);
        if (!intendedTools.isEmpty()) {
            return TaskCompletionResult.continueTask(
                "检测到工具调用意图但未实际调用: " + String.join(", ", intendedTools));
        }

        // 6. 检查任务类型与完成度匹配
        boolean taskRequiresTools = isTaskTypeRequiresTools(query);
        boolean hasOutput = hasGeneratedOutput(context, memory);
        log.info("TaskCompletionAnalyzer: query={}, taskRequiresTools={}, hasOutput={}",
                query, taskRequiresTools, hasOutput);

        if (taskRequiresTools && !hasOutput) {
            log.info("TaskCompletionAnalyzer: 任务需要工具调用但未检测到输出，建议继续执行");
            return TaskCompletionResult.continueTask("任务类型需要工具调用但未检测到输出");
        }

        // 7. 默认完成
        return TaskCompletionResult.finishTask("未检测到继续执行的信号");
    }

    private static boolean hasCompleteSignals(String message) {
        return COMPLETE_PATTERNS.stream()
            .anyMatch(pattern -> pattern.matcher(message).find());
    }

    private static boolean hasIncompleteSignals(String message, String query) {
        boolean messageIncomplete = INCOMPLETE_PATTERNS.stream()
            .anyMatch(pattern -> pattern.matcher(message).find());
        boolean queryRequiresTools = isTaskTypeRequiresTools(query);
        return messageIncomplete || queryRequiresTools;
    }

    private static List<String> extractIntendedTools(String message) {
        List<String> tools = new ArrayList<>();
        for (Pattern pattern : TOOL_INTENT_PATTERNS) {
            java.util.regex.Matcher matcher = pattern.matcher(message);
            while (matcher.find()) {
                if (matcher.groupCount() > 0) {
                    String toolName = matcher.group(1);
                    if (StringUtils.isNotBlank(toolName)) {
                        tools.add(toolName);
                    }
                }
            }
        }
        return tools;
    }

    private static boolean isTaskTypeRequiresTools(String query) {
        if (StringUtils.isBlank(query)) return false;
        String lowerQuery = query.toLowerCase();
        return lowerQuery.contains("生成") || lowerQuery.contains("创建") ||
               lowerQuery.contains("获取") || lowerQuery.contains("查询") ||
               lowerQuery.contains("搜索") || lowerQuery.contains("分析") ||
               lowerQuery.contains("计算") || lowerQuery.contains("处理") ||
               lowerQuery.contains("html") || lowerQuery.contains("网页") ||
               lowerQuery.contains("文件") || lowerQuery.contains("数据");
    }

    private static boolean hasGeneratedOutput(AgentContext context, Memory memory) {
        // 检查是否有产品文件或者有任务产品文件
        boolean hasProductFiles = context.getProductFiles() != null && !context.getProductFiles().isEmpty();
        boolean hasTaskProductFiles = context.getTaskProductFiles() != null && !context.getTaskProductFiles().isEmpty();

        log.info("hasGeneratedOutput: hasProductFiles={}, hasTaskProductFiles={}", hasProductFiles, hasTaskProductFiles);

        // 如果有产品文件，说明任务已完成
        if (hasProductFiles || hasTaskProductFiles) {
            log.info("hasGeneratedOutput: 检测到产品文件，任务已完成");
            return true;
        }

        // 对于需要生成报告的任务，检查是否真正生成了最终输出文件
        if (isTaskTypeRequiresTools(context.getQuery())) {
            log.info("hasGeneratedOutput: 任务需要工具调用，检查工具执行结果");

            // 检查是否有工具执行结果
            if (memory != null && memory.getMessages() != null) {
                boolean hasToolResults = memory.getMessages().stream()
                    .anyMatch(msg -> msg.getRole() != null &&
                             msg.getRole().name().equals("TOOL") &&
                             msg.getContent() != null &&
                             !msg.getContent().trim().isEmpty());

                log.info("hasGeneratedOutput: hasToolResults={}", hasToolResults);

                // 如果有工具执行结果但没有产品文件，说明任务未完成
                if (hasToolResults && !hasProductFiles && !hasTaskProductFiles) {
                    log.info("hasGeneratedOutput: 有工具执行结果但没有产品文件，任务未完成");
                    return false;
                }

                // 检查是否有助手消息包含工具调用
                boolean hasAssistantToolCalls = memory.getMessages().stream()
                    .anyMatch(msg -> msg.getRole() != null &&
                             msg.getRole().name().equals("ASSISTANT") &&
                             msg.getContent() != null &&
                             msg.getContent().contains("tool_calls"));

                log.info("hasGeneratedOutput: hasAssistantToolCalls={}", hasAssistantToolCalls);

                // 如果有助手工具调用但没有产品文件，说明任务未完成
                if (hasAssistantToolCalls && !hasProductFiles && !hasTaskProductFiles) {
                    log.info("hasGeneratedOutput: 有助手工具调用但没有产品文件，任务未完成");
                    return false;
                }

                // 检查是否有助手消息包含工具调用结果
                boolean hasAssistantToolResults = memory.getMessages().stream()
                    .anyMatch(msg -> msg.getRole() != null &&
                             msg.getRole().name().equals("ASSISTANT") &&
                             msg.getContent() != null &&
                             (msg.getContent().contains("工具执行结果为") ||
                              msg.getContent().contains("工具") && msg.getContent().contains("结果")));

                log.info("hasGeneratedOutput: hasAssistantToolResults={}", hasAssistantToolResults);

                // 如果有助手工具调用结果但没有产品文件，说明任务未完成
                if (hasAssistantToolResults && !hasProductFiles && !hasTaskProductFiles) {
                    log.info("hasGeneratedOutput: 有助手工具调用结果但没有产品文件，任务未完成");
                    return false;
                }
            }
        }

        log.info("hasGeneratedOutput: 默认返回false");
        return false;
    }
    
    public static class TaskCompletionResult {
        private final boolean shouldContinue;
        private final String reason;
        
        private TaskCompletionResult(boolean shouldContinue, String reason) {
            this.shouldContinue = shouldContinue;
            this.reason = reason;
        }
        
        public static TaskCompletionResult continueTask(String reason) {
            return new TaskCompletionResult(true, reason);
        }
        
        public static TaskCompletionResult finishTask(String reason) {
            return new TaskCompletionResult(false, reason);
        }
        
        public boolean shouldContinue() { return shouldContinue; }
        public String getReason() { return reason; }
    }
}