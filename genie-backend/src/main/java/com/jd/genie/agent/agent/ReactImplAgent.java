package com.jd.genie.agent.agent;

import com.alibaba.fastjson.JSON;
import com.jd.genie.agent.dto.Memory;
import com.jd.genie.agent.dto.Message;
import com.jd.genie.agent.dto.tool.ToolCall;
import com.jd.genie.agent.dto.tool.ToolChoice;
import com.jd.genie.agent.enums.AgentState;
import com.jd.genie.agent.enums.RoleType;
import com.jd.genie.agent.llm.LLM;
import com.jd.genie.agent.prompt.ToolCallPrompt;
import com.jd.genie.agent.tool.BaseTool;
import com.jd.genie.agent.util.FileUtil;
import com.jd.genie.agent.util.SpringContextHolder;
import com.jd.genie.config.GenieConfig;
import com.jd.genie.model.response.AgentResponse;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.context.ApplicationContext;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.CountDownLatch;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.jd.genie.agent.tool.ToolCollection;

/**
 * ReactImplAgent - 实现ReAct模式的智能体
 * 继承自ReActAgent，提供具体的思考和行为实现
 */
@Slf4j
@Data
@EqualsAndHashCode(callSuper = true)
public class ReactImplAgent extends ReActAgent {

    private List<ToolCall> toolCalls;
    private Integer maxObserve;
    private String systemPromptSnapshot;
    private String nextStepPromptSnapshot;
    public ReactImplAgent(AgentContext context) {
        setName("react");
        setDescription("a react agent that can think and act.");
        setContext(context);
        ApplicationContext applicationContext = SpringContextHolder.getApplicationContext();
        GenieConfig genieConfig = applicationContext.getBean(GenieConfig.class);

        StringBuilder toolPrompt = new StringBuilder();
        for (BaseTool tool : getContext().getToolCollection().getToolMap().values()) {
            toolPrompt.append(String.format("工具名：%s 工具描述：%s\n", tool.getName(), tool.getDescription()));
        }

        String promptKey = "default";
        setSystemPrompt(genieConfig.getReactSystemPromptMap().getOrDefault(promptKey, "超级智能体系统提示词 - 包含思考、行动、观察三个步骤的完整工作流程")
                .replace("{{tools}}", toolPrompt.toString())
                .replace("{{query}}", getContext().getQuery())
                .replace("{{date}}", getContext().getDateInfo())
                .replace("{{sopPrompt}}", getContext().getSopPrompt()));
        setNextStepPrompt(genieConfig.getReactNextStepPromptMap().getOrDefault(promptKey, "根据当前状态和可用工具，确定下一步行动，根据之前的执行结果，继续完成用户的任务：<task>{{query}}</task>，还需要执行什么工具来继续完成任务。")
                .replace("{{tools}}", toolPrompt.toString())
                .replace("{{query}}", getContext().getQuery())
                .replace("{{date}}", getContext().getDateInfo())
                .replace("{{sopPrompt}}", getContext().getSopPrompt()));

        setSystemPromptSnapshot(getSystemPrompt());
        setNextStepPromptSnapshot(getNextStepPrompt());

        setPrinter(getContext().getPrinter());
        setMaxSteps(genieConfig.getReactMaxSteps());
        setLlm(new LLM(genieConfig.getReactModelName(), ""));

        setContext(context);
        setMaxObserve(Integer.parseInt(genieConfig.getMaxObserve()));

        // 初始化工具集合
        availableTools = getContext().getToolCollection();
        setDigitalEmployeePrompt(genieConfig.getDigitalEmployeePrompt());
    }

    @Override
    public boolean think() {
        // 获取文件内容
        String filesStr = FileUtil.formatFileInfo(getContext().getProductFiles(), true);
        setSystemPrompt(getSystemPromptSnapshot().replace("{{files}}", filesStr));
        setNextStepPrompt(getNextStepPromptSnapshot().replace("{{files}}", filesStr));

        if (!getMemory().getLastMessage().getRole().equals(RoleType.USER)) {
            Message userMsg = Message.userMessage(getNextStepPrompt(), null);
            getMemory().addMessage(userMsg);
        }

        try {
            // 获取带工具选项的响应
            getContext().setStreamMessageType("tool_thought");
            
            log.info("{} 开始调用LLM，等待响应...", getContext().getRequestId());

            CompletableFuture<LLM.ToolCallResponse> future = getLlm().askTool(
                    context,
                    getMemory().getMessages(),
                    Message.systemMessage(getSystemPrompt(), null),
                    availableTools,
                    ToolChoice.AUTO, null, false, 300
            );

            // 使用较短的超时时间，避免长时间等待
            LLM.ToolCallResponse response = future.get(30, TimeUnit.SECONDS); // 30秒超时
            
            log.info("{} LLM响应完成，工具调用数量：{}，响应内容长度：{}", getContext().getRequestId(), 
                    response.getToolCalls() != null ? response.getToolCalls().size() : 0,
                    response.getContent() != null ? response.getContent().length() : 0);

            setToolCalls(response.getToolCalls());

            // 记录响应信息
            if (!getContext().getIsStream() && response.getContent() != null && !response.getContent().isEmpty()) {
                getPrinter().send("tool_thought", response.getContent());
            }


            // 创建并添加助手消息
            Message assistantMsg = response.getToolCalls() != null && !response.getToolCalls().isEmpty() && !"struct_parse".equals(getLlm().getFunctionCallType()) ?
                    Message.fromToolCalls(response.getContent(), response.getToolCalls()) :
                    Message.assistantMessage(response.getContent(), null);
            getMemory().addMessage(assistantMsg);

        } catch (TimeoutException e) {
            log.error("{} react think timeout after 30 seconds", getContext().getRequestId(), e);
            getMemory().addMessage(Message.assistantMessage(
                    "思考超时，请重试", null));
            setState(AgentState.ERROR);
            return false;
        } catch (Exception e) {
            log.error("{} react think error", getContext().getRequestId(), e);
            getMemory().addMessage(Message.assistantMessage(
                    "Error encountered while processing: " + e.getMessage(), null));
            setState(AgentState.FINISHED);
            return false;
        }

        return true;
    }

    @Override
    public String act() {
        if (toolCalls == null || toolCalls.isEmpty()) {
            // 没有工具调用，任务完成
            setState(AgentState.FINISHED);
            return "任务已完成";
        }
        
        log.info("{} 准备执行工具调用，工具数量：{}", getContext().getRequestId(), toolCalls.size());
        return executeToolCalls();
    }

    /**
     * 执行工具调用
     */
    private String executeToolCalls() {
        if (toolCalls == null || toolCalls.isEmpty()) {
            return "没有工具调用需要执行";
        }
        
        try {
            log.info("{} 开始执行工具调用，工具数量：{}", getContext().getRequestId(), toolCalls.size());
            
            // 记录所有工具调用的详细信息
            for (ToolCall command : toolCalls) {
                log.info("{} 准备执行工具：{}，参数：{}", getContext().getRequestId(), 
                    command.getFunction().getName(), command.getFunction().getArguments());
            }
            
            // 执行工具调用
            Map<String, String> toolResults = executeTools(toolCalls);
            
            // 发送工具调用结果到前端
            for (ToolCall command : toolCalls) {
                String result = toolResults.get(command.getId());
                String toolName = command.getFunction().getName();
                log.info("{} 工具 {} 执行结果：{}", getContext().getRequestId(), toolName, result);
                
                if (result != null) {
                    getPrinter().send("tool_result", AgentResponse.ToolResult.builder()
                            .toolName(toolName)
                            .toolParam(JSON.parseObject(command.getFunction().getArguments(), Map.class))
                            .toolResult(result)
                            .build(), null);
                    
                    // 添加工具响应到记忆
                    if ("struct_parse".equals(getLlm().getFunctionCallType())) {
                        String content = getMemory().getLastMessage().getContent();
                        getMemory().getLastMessage().setContent(content + "\n 工具执行结果为:\n" + result);
                    } else { // function_call
                        Message toolMsg = Message.toolMessage(
                                result,
                                command.getId(),
                                null
                        );
                        getMemory().addMessage(toolMsg);
                    }
                } else {
                    log.warn("{} 工具 {} 执行结果为空", getContext().getRequestId(), toolName);
                }
            }
            
            String result = String.join("\n", toolResults.values());
            
            // 清空工具调用，避免重复执行
            toolCalls = null;
            
            log.info("{} 工具调用执行完成，结果已添加到memory", getContext().getRequestId());
            return result;
        } catch (Exception e) {
            log.error("{} 执行工具调用失败", getContext().getRequestId(), e);
            toolCalls = null; // 清空工具调用
            return "工具执行失败: " + e.getMessage();
        }
    }

    @Override
    public String run(String request) {
        return super.run(request);
    }
}