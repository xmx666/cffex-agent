package com.jd.genie.agent.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jd.genie.agent.dto.Memory;
import com.jd.genie.agent.dto.Message;
import com.jd.genie.agent.dto.tool.ToolCall;
import com.jd.genie.agent.enums.AgentState;
import com.jd.genie.agent.enums.RoleType;
import com.jd.genie.agent.llm.LLM;
import com.jd.genie.agent.printer.Printer;
import com.jd.genie.agent.tool.ToolCollection;
import com.jd.genie.agent.util.ThreadUtil;
import lombok.Data;
import lombok.experimental.Accessors;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.HashMap;

/**
 * 代理基类 - 管理代理状态和执行的基础类
 */
@Slf4j
@Data
@Accessors(chain = true)
public abstract class BaseAgent {

    // 核心属性
    private String name;
    private String description;
    private String systemPrompt;
    private String nextStepPrompt;
    public ToolCollection availableTools = new ToolCollection();
    private Memory memory = new Memory();
    protected LLM llm;
    protected AgentContext context;

    // 执行控制
    private AgentState state = AgentState.IDLE;
    private int maxSteps = 20;
    private int currentStep = 0;
    private int duplicateThreshold = 2;

    // 工具调用历史记录
    private List<String> recentToolCalls = new ArrayList<>();

    // emitter
    Printer printer;

    // digital employee prompt
    private String digitalEmployeePrompt;

    /**
     * 执行单个步骤
     */
    public abstract String step();

    /**
     * 运行代理主循环
     */
    public String run(String query) {
        setState(AgentState.IDLE);
        clearToolCallHistory(); // 清空工具调用历史

        if (!query.isEmpty()) {
            updateMemory(RoleType.USER, query, null);
        }

        List<String> results = new ArrayList<>();
        try {
            while (currentStep < maxSteps && state != AgentState.FINISHED) {
                currentStep++;
                log.info("{} {} Executing step {}/{}", getContext().getRequestId(), getName(), currentStep, maxSteps);
                String stepResult = step();
                results.add(stepResult);

                // 如果状态变为ERROR，立即退出
                if (state == AgentState.ERROR) {
                    log.error("{} Agent状态变为ERROR，退出执行", getContext().getRequestId());
                    break;
                }

                // 如果返回CONTINUE_EXECUTION标记，继续下一轮循环
                if ("CONTINUE_EXECUTION".equals(stepResult)) {
                    log.info("{} 检测到继续执行标记，继续下一轮循环", getContext().getRequestId());
                    continue;
                }

                // 如果连续多次没有工具调用，可能存在问题
                if (currentStep > 5 && results.size() > 0) {
                    String lastResult = results.get(results.size() - 1);
                    if (lastResult.contains("Thinking complete - no action needed") ||
                        lastResult.contains("思考超时") ||
                        lastResult.contains("Error encountered") ||
                        lastResult.contains("LLM返回空响应，任务结束")) {
                        log.warn("{} 连续多次无有效响应，可能存在问题，退出执行", getContext().getRequestId());
                        break;
                    }
                }

                // 检测连续空响应，防止无限循环
                if (currentStep > 3 && results.size() >= 3) {
                    boolean allEmptyResponses = true;
                    for (int i = results.size() - 3; i < results.size(); i++) {
                        String result = results.get(i);
                        if (!result.contains("LLM返回空响应，任务结束") &&
                            !result.contains("任务未完成，需要继续执行工具调用")) {
                            allEmptyResponses = false;
                            break;
                        }
                    }
                    if (allEmptyResponses) {
                        log.warn("{} 检测到连续空响应循环，强制退出执行", getContext().getRequestId());
                        setState(AgentState.FINISHED);
                        break;
                    }
                }
            }

            if (currentStep >= maxSteps) {
                currentStep = 0;
                state = AgentState.IDLE;
                results.add("Terminated: Reached max steps (" + maxSteps + ")");
            }
        } catch (Exception e) {
            state = AgentState.ERROR;
            throw e;
        }

        return results.isEmpty() ? "No steps executed" : results.get(results.size() - 1);
    }

    /**
     * 检查是否为重复工具调用
     */
    protected boolean isDuplicateToolCall(String toolName, String arguments) {
        String toolCallSignature = toolName + ":" + arguments;

        // 检查最近的工具调用中是否有重复
        int duplicateCount = 0;
        for (String recentCall : recentToolCalls) {
            if (recentCall.equals(toolCallSignature)) {
                duplicateCount++;
            }
        }

        return duplicateCount >= duplicateThreshold;
    }

    /**
     * 记录工具调用
     */
    protected void recordToolCall(String toolName, String arguments) {
        String toolCallSignature = toolName + ":" + arguments;
        recentToolCalls.add(toolCallSignature);

        // 保持历史记录在合理范围内（保留最近10次调用）
        if (recentToolCalls.size() > 10) {
            recentToolCalls.remove(0);
        }
    }

    /**
     * 清空工具调用历史
     */
    protected void clearToolCallHistory() {
        recentToolCalls.clear();
    }

    /**
     * 修复被截断的JSON参数
     */
    private String fixTruncatedJson(String jsonStr) {
        if (jsonStr == null || jsonStr.trim().isEmpty()) {
            return jsonStr;
        }

        String fixed = jsonStr.trim();

        // 如果JSON没有以{开头，添加它
        if (!fixed.startsWith("{")) {
            fixed = "{" + fixed;
        }

        // 计算大括号和方括号的平衡
        int openBraces = 0;
        int openBrackets = 0;
        boolean inString = false;
        boolean escaped = false;

        for (int i = 0; i < fixed.length(); i++) {
            char c = fixed.charAt(i);

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
        StringBuilder balanced = new StringBuilder(fixed);

        // 先添加缺失的方括号闭合
        for (int i = 0; i < openBrackets; i++) {
            balanced.append(']');
        }

        // 再添加缺失的大括号闭合
        for (int i = 0; i < openBraces; i++) {
            balanced.append('}');
        }

        String result = balanced.toString();
        log.debug("{} JSON修复完成: 原始长度={}, 修复后长度={}, 添加了{}个方括号和{}个大括号",
            getContext() != null ? getContext().getRequestId() : "unknown",
            jsonStr.length(), result.length(), openBrackets, openBraces);

        return result;
    }

    /**
     * 更新代理记忆
     */
    public void updateMemory(RoleType role, String content, String base64Image, Object... args) {
        Message message;
        switch (role) {
            case USER:
                message = Message.userMessage(content, base64Image);
                break;
            case SYSTEM:
                message = Message.systemMessage(content, base64Image);
                break;
            case ASSISTANT:
                message = Message.assistantMessage(content, base64Image);
                break;
            case TOOL:
                message = Message.toolMessage(content, (String) args[0], base64Image);
                break;
            default:
                throw new IllegalArgumentException("Unsupported role type: " + role);
        }
        memory.addMessage(message);
    }

    public String executeTool(ToolCall command) {
        if (command == null || command.getFunction() == null || command.getFunction().getName() == null) {
            return "Error: Invalid function call format";
        }

        String name = command.getFunction().getName();
        try {
            // 解析参数
            ObjectMapper mapper = new ObjectMapper();
            String argumentsStr = command.getFunction().getArguments();

            // 尝试修复可能被截断的JSON参数
            // 处理空参数的情况
            Object args = null;
            if (argumentsStr != null && !argumentsStr.trim().isEmpty()) {
                // 尝试修复可能被截断的JSON参数
                String fixedArguments = fixTruncatedJson(argumentsStr);
                args = mapper.readValue(fixedArguments, Object.class);
            } else {
                // 参数为空时，使用空的Map作为默认参数
                args = new java.util.HashMap<>();
                log.info("{} 工具 {} 参数为空，使用默认空参数", getContext().getRequestId(), name);
            }
            // 执行工具
            Object result = availableTools.execute(name, args);
            log.info("{} execute tool: {} {} result {}", getContext().getRequestId(), name, args, result);

            // 格式化结果
            if (result != null) {
                if (result instanceof String) {
                    return (String) result;
                } else {
                    // 如果不是String，转换为String
                    return result.toString();
                }
            } else {
                log.warn("{} tool {} returned null result", getContext().getRequestId(), name);
                return "工具 " + name + " 返回空结果";
            }
        } catch (Exception e) {
            log.error("{} execute tool {} failed ", getContext().getRequestId(), name, e);
            return "工具 " + name + " 执行失败: " + e.getMessage();
        }
    }

    /**
     * 并发执行多个工具调用命令并返回执行结果
     *
     * @param commands 工具调用命令列表
     * @return 返回工具执行结果映射，key为工具ID，value为执行结果
     */
    public Map<String, String> executeTools(List<ToolCall> commands) {
        Map<String, String> result = new ConcurrentHashMap<>();
        CountDownLatch taskCount = ThreadUtil.getCountDownLatch(commands.size());

        log.info("{} 准备并发执行 {} 个工具调用", getContext().getRequestId(), commands.size());

        for (ToolCall tooCall : commands) {
            log.info("{} 提交工具调用任务：{}", getContext().getRequestId(), tooCall.getFunction().getName());
            ThreadUtil.execute(() -> {
                try {
                    String toolResult = executeTool(tooCall);
                    result.put(tooCall.getId(), toolResult);
                    log.info("{} 工具 {} 执行完成，结果长度：{}", getContext().getRequestId(),
                        tooCall.getFunction().getName(), toolResult != null ? toolResult.length() : 0);
                } catch (Exception e) {
                    log.error("{} 工具 {} 执行异常", getContext().getRequestId(), tooCall.getFunction().getName(), e);
                    result.put(tooCall.getId(), "工具执行异常: " + e.getMessage());
                } finally {
                    taskCount.countDown();
                }
            });
        }

        log.info("{} 等待所有工具调用完成...", getContext().getRequestId());
        ThreadUtil.await(taskCount);
        log.info("{} 所有工具调用完成，结果数量：{}", getContext().getRequestId(), result.size());

        return result;
    }



}