package com.jd.genie.agent.agent;

import com.jd.genie.agent.dto.File;
import com.jd.genie.agent.dto.Message;
import com.jd.genie.agent.dto.TaskSummaryResult;
import com.jd.genie.agent.enums.RoleType;
import com.jd.genie.agent.llm.LLM;
import com.jd.genie.agent.util.SpringContextHolder;
import com.jd.genie.config.GenieConfig;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.context.ApplicationContext;
import org.springframework.util.CollectionUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;

@Data
@Slf4j
@EqualsAndHashCode(callSuper = true)
public class SummaryAgent extends BaseAgent {
    private String requestId;
    private Integer messageSizeLimit;
    public static final String logFlag = "summaryTaskResult";

    public SummaryAgent(AgentContext context) {
        ApplicationContext applicationContext = SpringContextHolder.getApplicationContext();
        GenieConfig genieConfig = applicationContext.getBean(GenieConfig.class);
        setSystemPrompt(genieConfig.getSummarySystemPrompt());

        setContext(context);
        setRequestId(context.getRequestId());
        setLlm(new LLM(context.getAgentType() == 3 ? genieConfig.getPlannerModelName() : genieConfig.getReactModelName(), ""));
        setMessageSizeLimit(genieConfig.getMessageSizeLimit());
    }

    /**
     * 执行单个步骤
     */
    public String step() {
        return "";
    }

    // 构造文件信息
    private String createFileInfo() {
        List<File> files = context.getProductFiles();
        if (CollectionUtils.isEmpty(files)) {
            log.info("requestId: {} no files found in context", requestId);
            return "";
        }
        log.info("requestId: {} {} product files:{}", requestId, logFlag, files);
        String result = files.stream()
                .filter(file -> !Boolean.TRUE.equals(file.getIsInternalFile())) // 过滤内部文件
                .map(file -> file.getFileName() + " : " + file.getDescription())
                .collect(Collectors.joining("\n"));

        log.info("requestId: {} generated file info: {}", requestId, result);
        return result;
    }

    // 提取系统提示格式化逻辑
    private String formatSystemPrompt(String taskHistory, String query) {
        String systemPrompt = getSystemPrompt();
        if (systemPrompt == null) {
            log.error("requestId: {} {} systemPrompt is null", requestId, logFlag);
            throw new IllegalStateException("System prompt is not configured");
        }

        // 替换占位符
        return systemPrompt
                .replace("{{taskHistory}}", taskHistory)
                .replace("{{fileNameDesc}}", createFileInfo())
                .replace("{{query}}", query);
    }

    // 提取消息创建逻辑
    private Message createSystemMessage(String content) {
        return Message.userMessage(content, null); // 如果需要更复杂的消息构建，可扩展
    }

    /**
     * 解析LLM响应并处理文件关联
     */
    private TaskSummaryResult parseLlmResponse(String llmResponse) {
        if (StringUtils.isEmpty(llmResponse)) {
            log.error("requestId: {} pattern matcher failed for response is null", requestId);
        }

        String[] parts1 = llmResponse.split("\\$\\$\\$");
        if (parts1.length < 2) {
            return TaskSummaryResult.builder().taskSummary(parts1[0]).build();
        }

        String summary = parts1[0];
        String fileNames = parts1[1];

        List<File> files = context.getProductFiles();
        if (!CollectionUtils.isEmpty(files)) {
            Collections.reverse(files);
        } else {
            log.warn("requestId: {} llmResponse:{} productFile list is empty", requestId, llmResponse);
            // 文件列表为空时，检查LLM是否提到了文件名
            if (StringUtils.isNotBlank(fileNames) && !fileNames.trim().equals("无")) {
                // 如果LLM提到了文件名但实际没有文件，说明任务可能没有完成
                String enhancedSummary = summary + "\n\n注意：任务可能尚未完全完成，建议继续执行相关工具调用以生成所需文件。";
                return TaskSummaryResult.builder().taskSummary(enhancedSummary).build();
            } else {
                // 如果LLM没有提到文件名，说明任务确实完成了
                return TaskSummaryResult.builder().taskSummary(summary).build();
            }
        }
        List<File> product = new ArrayList<>();
        String[] items = fileNames.split("、");
        for (String item : items) {
            String trimmedItem = item.trim();
            if (StringUtils.isBlank(trimmedItem)) {
                continue;
            }
            for (File file : files) {
                if (item.contains(file.getFileName().trim())) {
                    log.info("requestId: {} add file:{}", requestId, file);
                    product.add(file);
                    break;
                }
            }
        }

        return TaskSummaryResult.builder().taskSummary(summary).files(product).build();
    }


    // 总结任务
    public TaskSummaryResult summaryTaskResult(List<Message> messages, String query) {
        long startTime = System.currentTimeMillis();
        // 1. 参数校验（可选）
        if (CollectionUtils.isEmpty(messages) || StringUtils.isEmpty(query)) {
            log.warn("requestId: {}  summaryTaskResult messages:{}  or query:{} is empty", requestId, messages, query);
            return TaskSummaryResult.builder().taskSummary("").build();
        }

        try {
            // 2. 构建系统消息（提取为独立方法）
            log.info("requestId: {} summaryTaskResult: messages:{}", requestId, messages.size());
            StringBuilder sb = new StringBuilder();
            // 只使用TOOL角色的消息content（工具调用结果）进行总结，避免上下文过长
            int toolMessageCount = 0;
            for (Message message : messages) {
                // 只提取TOOL角色的消息
                if (message.getRole() == RoleType.TOOL) {
                String content = message.getContent();
                    if (content != null && !content.trim().isEmpty()) {
                        // 不限制工具结果的长度，避免重要信息缺失
                        sb.append(String.format("工具执行结果 %d:\n%s\n\n", ++toolMessageCount, content));
                    }
                }
            }
            log.info("requestId: {} summaryTaskResult: 提取了 {} 个工具调用结果用于总结", requestId, toolMessageCount);
            // 如果没有工具调用结果，使用空字符串，LLM会根据query生成总结
            String taskHistory = sb.toString();
            if (toolMessageCount == 0) {
                log.warn("requestId: {} summaryTaskResult: 没有找到工具调用结果，将使用空的任务历史", requestId);
            }
            String formattedPrompt = formatSystemPrompt(taskHistory, query);
            Message userMessage = createSystemMessage(formattedPrompt);

            // 3. 调用LLM并处理结果
            CompletableFuture<String> summaryFuture = getLlm().ask(
                    context,
                    Collections.singletonList(userMessage),
                    Collections.emptyList(),
                    false,
                    0.01);

            // 5. 解析响应（设置超时时间避免无限等待）
            String llmResponse = summaryFuture.get(300, java.util.concurrent.TimeUnit.SECONDS);
            log.info("requestId: {} summaryTaskResult: {}", requestId, llmResponse);

            return parseLlmResponse(llmResponse);
        } catch (Exception e) {
            log.error("requestId: {} in summaryTaskResult failed,", requestId, e);

            return TaskSummaryResult.builder().taskSummary("任务执行失败，请联系管理员！").build();
        }
    }
}