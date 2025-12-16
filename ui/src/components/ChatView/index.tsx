import { useEffect, useState, useRef, useMemo } from "react";
import { getUniqId, scrollToTop, ActionViewItemEnum, getSessionId } from "@/utils";
import querySSE from "@/utils/querySSE";
import {  handleTaskData, combineData } from "@/utils/chat";
import Dialogue from "@/components/Dialogue";
import GeneralInput from "@/components/GeneralInput";
import ActionView from "@/components/ActionView";
import { RESULT_TYPES } from '@/utils/constants';
import { useMemoizedFn } from "ahooks";
import classNames from "classnames";
import Logo from "../Logo";
import { Modal } from "antd";
import { SimpleHistoryManager, ChatSession, ToolCallRecord, ChatMessage, ChatFile } from "@/utils/historyManager";
import { FileManager } from "@/utils/fileManager";
import { usePrompt } from "@/hooks/usePrompt";
import { getSelectedTemplateContentsAsync } from "@/utils/promptBuilder";
import { globalTemplateManager } from "@/utils/templateManager";
import { Tag } from "antd";

type Props = {
  inputInfo: CHAT.TInputInfo;
  product?: CHAT.Product;
  // 新增：历史记录恢复
  restoreSession?: ChatSession;
  onSessionRestored?: () => void;
  // 新增：返回主页面回调
  onBackToHome?: () => void;
};

const ChatView: GenieType.FC<Props> = (props) => {
  const { inputInfo: inputInfoProp, product, restoreSession, onSessionRestored, onBackToHome } = props;

  const [chatTitle, setChatTitle] = useState("");
  const [taskList, setTaskList] = useState<MESSAGE.Task[]>([]);
  const chatList = useRef<CHAT.ChatItem[]>([]);
  const [activeTask, setActiveTask] = useState<CHAT.Task>();
  const [plan, setPlan] = useState<CHAT.Plan>();
  const [showAction, setShowAction] = useState(false);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLInputElement>(null);
  const actionViewRef = ActionView.useActionView();
  const sessionId = useMemo(() => getSessionId(), []);
  const [modal, contextHolder] = Modal.useModal();
  const historyManager = useMemo(() => new SimpleHistoryManager(), []);
  const fileManager = useMemo(() => FileManager.getInstance(), []);

  // 用户选择的模板
  const [selectedTemplates, setSelectedTemplates] = useState<Array<{ id: string; name: string; domainName?: string }>>([]);

  // 加载用户选择的模板
  useEffect(() => {
    const loadSelectedTemplates = async () => {
      const selectedIds = globalTemplateManager.getUserSelectedTemplateIds();
      if (selectedIds.length > 0) {
        const config = await globalTemplateManager.getTemplateConfig();
        const templates = selectedIds
          .map(id => {
            const template = config.templateList.find(t => t.id === id);
            if (template) {
              const domain = config.domains.find(d => d.id === template.domainId);
              return {
                id: template.id,
                name: template.name,
                domainName: domain?.name
              };
            }
            return null;
          })
          .filter(t => t !== null) as Array<{ id: string; name: string; domainName?: string }>;
        // 只在模板列表真正变化时才更新状态，避免闪烁
        setSelectedTemplates(prev => {
          const prevIds = prev.map(t => t.id).sort().join(',');
          const newIds = templates.map(t => t.id).sort().join(',');
          if (prevIds !== newIds) {
            return templates;
          }
          return prev;
        });
      } else {
        // 只有在确实没有选择模板时才清空
        setSelectedTemplates(prev => {
          if (prev.length > 0) {
            return [];
          }
          return prev;
        });
      }
    };

    loadSelectedTemplates();

    // 监听自定义事件（当用户在模板设置页面修改选择时）
    const handleUserSelectedChange = () => {
      loadSelectedTemplates();
    };

    window.addEventListener('userSelectedTemplatesChange', handleUserSelectedChange);
    // 定期检查（因为storage事件只在其他标签页触发）
    const interval = setInterval(loadSelectedTemplates, 2000); // 改为2秒，减少刷新频率

    return () => {
      window.removeEventListener('userSelectedTemplatesChange', handleUserSelectedChange);
      clearInterval(interval);
    };
  }, []);

  // 使用Prompt配置
  const {
    systemPrompt,
    buildUserPrompt,
    buildTaskPrompt,
    buildSummaryPrompt,
    buildPlanningPrompt,
    enabledPrompts
  } = usePrompt();

  const combineCurrentChat = (
    inputInfo: CHAT.TInputInfo,
    sessionId: string,
    requestId: string
  ): CHAT.ChatItem => {
    return {
      query: inputInfo.message!,
      files: inputInfo.files!,
      responseType: "txt",
      sessionId,
      requestId,
      loading: true,
      forceStop: false,
      tasks: [],
      thought: "",
      response: "",
      taskStatus: 0,
      tip: "已接收到你的任务，将立即开始处理...",
      multiAgent: {tasks: []},
    };
  };

  const sendMessage = useMemoizedFn(async (inputInfo: CHAT.TInputInfo) => {
    const {message, deepThink, outputStyle} = inputInfo;
    const requestId = getUniqId();
    let currentChat = combineCurrentChat(inputInfo, sessionId, requestId);
    chatList.current =  [...chatList.current, currentChat];
    if (!chatTitle) {
      setChatTitle(message!);
    }
    setLoading(true);

    // 构建各级别的追加Prompt（不替换原始Prompt）
    const systemPromptAppend = systemPrompt; // 系统级追加
    const taskPromptAppend = buildTaskPrompt(); // 任务级追加
    const summaryPromptAppend = buildSummaryPrompt(); // 总结级追加
    const userPromptAppend = buildUserPrompt(message!); // 用户级追加（不包含模板）
    const planningPromptAppend = buildPlanningPrompt(); // 规划级追加

    // 从后端异步获取模板内容并拼接到用户输入中
    let finalQuery = message!;
    try {
      const templateContents = await getSelectedTemplateContentsAsync();
      if (templateContents && templateContents.trim()) {
        // 如果有多个模板，用换行符拼接
        finalQuery = `${templateContents}\n\n${message!}`;
      }
    } catch (error) {
      console.error('获取模板内容失败，使用原始输入:', error);
      // 如果获取失败，使用原始输入
      finalQuery = message!;
    }

    // 调试信息：显示应用的Prompt追加配置
    console.log('🔧 应用的Prompt追加配置:', {
      systemPromptAppend,
      taskPromptAppend,
      summaryPromptAppend,
      userPromptAppend,
      planningPromptAppend,
      originalQuery: message!,
      finalQuery,
      enabledPrompts: enabledPrompts
    });

    // 构建请求参数
    const params = {
      sessionId: sessionId,
      requestId: requestId,
      query: finalQuery, // 包含模板内容的完整用户输入
      deepThink: deepThink ? 1 : 0,
      outputStyle,
      // 添加各级别的Prompt追加内容（让后端追加到对应位置）
      promptAppends: {
        systemPrompt: systemPromptAppend, // 追加到系统Prompt
        taskPrompt: taskPromptAppend, // 追加到任务执行前
        summaryPrompt: summaryPromptAppend, // 追加到结果总结时
        userPrompt: userPromptAppend, // 追加到用户输入前（不包含模板，模板已在query中）
        planningPrompt: planningPromptAppend // 追加到任务规划时
      }
    };
    const handleMessage = (data: MESSAGE.Answer) => {
      const { finished, resultMap, packageType, status } = data;
      if (status === "tokenUseUp") {
        modal.info({
          title: '您的试用次数已用尽',
          content: '如需额外申请，请联系 liyang.1236@jd.com',
        });
        const taskData = handleTaskData(
          currentChat,
          deepThink,
          currentChat.multiAgent
        );
        currentChat.loading = false;
        setLoading(false);

        setTaskList(taskData.taskList);
        return;
      }
      if (packageType !== "heartbeat") {
        requestAnimationFrame(() => {
          if (resultMap?.eventData) {
            currentChat = combineData(resultMap.eventData || {}, currentChat);
            const taskData = handleTaskData(
              currentChat,
              deepThink,
              currentChat.multiAgent
            );
            setTaskList(taskData.taskList);
            updatePlan(taskData.plan!);
            openAction(taskData.taskList);
            if (finished) {
              currentChat.loading = false;
              setLoading(false);

              // 提取工具调用记录
              const toolCallRecords: ToolCallRecord[] = [];
              const generatedFiles: ChatFile[] = [];

              console.log('保存历史记录 - taskList:', taskList);
              console.log('保存历史记录 - currentChat:', currentChat);
              console.log('保存历史记录 - currentChat.multiAgent:', currentChat.multiAgent);

              // 从currentChat.multiAgent.tasks中提取工具调用和文件信息
              if (currentChat.multiAgent?.tasks) {
                currentChat.multiAgent.tasks.forEach((taskGroup: any[], groupIndex: number) => {
                  console.log(`任务组 ${groupIndex}:`, taskGroup);

                  taskGroup.forEach((task: any, taskIndex: number) => {
                    console.log(`任务 ${groupIndex}-${taskIndex}:`, task);

                    // 检查工具结果
                    if (task.toolResult) {
                      console.log('找到工具结果:', task.toolResult);
                      toolCallRecords.push({
                        id: task.taskId || `tool_${groupIndex}_${taskIndex}`,
                        toolName: task.toolResult.toolName,
                        toolParam: task.toolResult.toolParam || {},
                        toolResult: task.toolResult.toolResult,
                        timestamp: new Date(),
                        status: 'success',
                        files: []
                      });
                    }

                    // 检查文件信息
                    if (task.resultMap?.fileInfo) {
                      console.log('找到文件信息:', task.resultMap.fileInfo);
                      task.resultMap.fileInfo.forEach((fileInfo: any) => {
                        generatedFiles.push({
                          name: fileInfo.fileName || 'unknown',
                          url: fileInfo.domainUrl || '',
                          type: fileInfo.fileType || 'txt',
                          size: fileInfo.fileSize || 0,
                          path: `geniesession-${sessionId}/${fileInfo.fileName}`
                        });
                      });
                    }

                    // 检查其他可能的文件信息位置
                    if (task.resultMap?.fileList) {
                      console.log('找到文件列表:', task.resultMap.fileList);
                      task.resultMap.fileList.forEach((file: any) => {
                        generatedFiles.push({
                          name: file.fileName || file.name || 'unknown',
                          url: file.fileUrl || file.url || '',
                          type: file.fileType || file.type || 'txt',
                          size: file.fileSize || file.size || 0,
                          path: `geniesession-${sessionId}/${file.fileName || file.name}`
                        });
                      });
                    }
                  });
                });
              }

              // 也从taskList中提取（作为备用）
              taskList.forEach((task, index) => {
                console.log(`备用任务 ${index}:`, task);

                if (task.toolResult) {
                  console.log('备用找到工具结果:', task.toolResult);
                  toolCallRecords.push({
                    id: task.id || `backup_tool_${index}`,
                    toolName: task.toolResult.toolName,
                    toolParam: task.toolResult.toolParam || {},
                    toolResult: task.toolResult.toolResult,
                    timestamp: new Date(),
                    status: 'success',
                    files: []
                  });
                }

                if (task.resultMap?.fileInfo) {
                  console.log('备用找到文件信息:', task.resultMap.fileInfo);
                  task.resultMap.fileInfo.forEach((fileInfo: any) => {
                    generatedFiles.push({
                      name: fileInfo.fileName || 'unknown',
                      url: fileInfo.domainUrl || '',
                      type: fileInfo.fileType || 'txt',
                      size: fileInfo.fileSize || 0,
                      path: `geniesession-${sessionId}/${fileInfo.fileName}`
                    });
                  });
                }
              });

              console.log('提取的工具调用记录:', toolCallRecords);
              console.log('提取的生成文件:', generatedFiles);

              // 构建对话消息
              const messages: ChatMessage[] = [];

              // 添加用户消息
              chatList.current.forEach(chat => {
                messages.push({
                  id: chat.requestId,
                  type: 'user',
                  content: chat.query,
                  timestamp: new Date(),
                  files: chat.files || []
                });
              });

              // 添加助手回复
              messages.push({
                id: currentChat.requestId + '_response',
                type: 'assistant',
                content: currentChat.response || currentChat.tip || '对话完成',
                timestamp: new Date(),
                files: [],
                toolCalls: toolCallRecords
              });

              // 保存会话到历史记录
              const session: ChatSession = {
                id: sessionId,
                title: chatTitle || currentChat.query.substring(0, 50) + '...',
                createdAt: new Date(),
                updatedAt: new Date(),
                messageCount: chatList.current.length,
                productType: product?.type || 'html',
                deepThink: inputInfoProp.deepThink || false,
                preview: currentChat.query.substring(0, 100) + '...',
                sessionId: sessionId,
                requestId: currentChat.requestId,
                // 新增：对话详情
                messages: messages,
                // 新增：生成的文件
                generatedFiles: generatedFiles,
                // 新增：任务执行结果
                tasks: currentChat.multiAgent?.tasks?.flat()?.map((task: any, index: number) => ({
                  id: task.taskId || `task_${index}`,
                  name: task.messageType || '未知任务',
                  status: task.resultMap?.isFinal ? 'completed' : 'running',
                  result: task.resultMap?.codeOutput || task.toolResult?.toolResult || '',
                  files: task.resultMap?.fileInfo?.map((fileInfo: any) => ({
                    name: fileInfo.fileName || 'unknown',
                    url: fileInfo.domainUrl || '',
                    type: fileInfo.fileType || 'txt',
                    size: fileInfo.fileSize || 0,
                    path: `geniesession-${sessionId}/${fileInfo.fileName}`
                  })) || []
                })) || [],
                // 新增：完整的对话状态，用于恢复对话
                chatState: {
                  chatList: [...chatList.current],
                  taskList: currentChat.multiAgent?.tasks || [],
                  plan: currentChat.plan || plan,
                  activeTask: activeTask
                }
              };
              historyManager.saveSession(session);
            }
            const newChatList = [...chatList.current];
            newChatList.splice(newChatList.length - 1, 1, currentChat);
            chatList.current = newChatList;
          }
        });
        scrollToTop(chatRef.current!);
      }
    };

    const openAction = (taskList:MESSAGE.Task[]) =>{
      if (taskList.filter((t)=>!RESULT_TYPES.includes(t.messageType)).length) {
        setShowAction(true);
      }
    };

    const handleError = (error: unknown) => {
      console.error('SSE连接错误:', error);
      setLoading(false);

      // 显示用户友好的错误消息
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
          modal.error({
            title: '连接失败',
            content: '无法连接到后端服务器，请检查后端服务是否正在运行。',
          });
        } else {
          modal.error({
            title: '请求失败',
            content: error.message || '未知错误',
          });
        }
      } else {
        modal.error({
          title: '请求失败',
          content: '网络连接异常，请稍后重试。',
        });
      }
    };

    const handleClose = () => {
      console.log('🚀 ~ close');
    };

    querySSE({
      body: params,
      handleMessage,
      handleError,
      handleClose,
    });
  });

  const changeTask = (task: CHAT.Task) => {
    actionViewRef.current?.changeActionView(ActionViewItemEnum.follow);
    changeActionStatus(true);
    setActiveTask(task);
  };

  const updatePlan = (plan: CHAT.Plan) => {
    setPlan(plan);
  };

  const changeFile = (file: CHAT.TFile) => {
    changeActionStatus(true);
    actionViewRef.current?.setFilePreview(file);
  };

  const changePlan = () => {
    changeActionStatus(true);
    actionViewRef.current?.openPlanView();
  };

  const changeActionStatus = (status: boolean) => {
    setShowAction(status);
  };

  // 恢复历史记录会话
  useEffect(() => {
    if (restoreSession && restoreSession.chatState) {
      const { chatList: restoredChatList, taskList: restoredTaskList, plan: restoredPlan, activeTask: restoredActiveTask } = restoreSession.chatState;

      // 恢复聊天列表
      chatList.current = restoredChatList || [];

      // 恢复任务列表
      setTaskList(restoredTaskList || []);

      // 恢复计划
      if (restoredPlan) {
        setPlan(restoredPlan);
      }

      // 恢复活动任务
      if (restoredActiveTask) {
        setActiveTask(restoredActiveTask);
      }

      // 设置标题
      setChatTitle(restoreSession.title);

      // 通知父组件恢复完成
      onSessionRestored?.();
    }
  }, [restoreSession, onSessionRestored]);

  useEffect(() => {
    if (inputInfoProp.message?.length !== 0) {
      sendMessage(inputInfoProp);
    }
  }, [inputInfoProp, sendMessage]);

  return (
    <div className="h-full w-full flex justify-center">
      <div
        className={classNames("p-24 flex flex-col flex-1 w-0", { 'max-w-[1200px]': !showAction })}
        id="chat-view"
      >
        {/* 显示已使用的模板 */}
        {selectedTemplates.length > 0 && (
          <div className="mb-16 px-12 py-8 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-[12px] text-gray-600 mb-4">当前使用的模板：</div>
            <div className="flex flex-wrap gap-4">
              {selectedTemplates.map(template => (
                <Tag key={template.id} color="blue" className="text-[12px]">
                  {template.domainName ? `${template.domainName}: ` : ''}{template.name}
                </Tag>
              ))}
            </div>
          </div>
        )}

        <div className="w-full flex justify-between">
          <div className="w-full flex items-center pb-8">
            {onBackToHome && (
              <button
                onClick={onBackToHome}
                className="mr-12 p-4 hover:bg-gray-100 rounded-[4px] transition-colors flex items-center justify-center"
                title="返回主页面"
              >
                <i className="font_family icon-fanhui text-[16px] text-[#27272A]"></i>
              </button>
            )}
            <Logo />
            <div className="overflow-hidden whitespace-nowrap text-ellipsis text-[16px] font-[500] text-[#27272A] mr-8">
              {chatTitle}
            </div>
            {inputInfoProp.deepThink && <div className="rounded-[4px] px-6 border-1 border-solid border-gray-300 flex items-center shrink-0">
              <i className="font_family icon-shendusikao mr-6 text-[12px]"></i>
              <span className="ml-[-4px]">深度研究</span>
            </div>}
          </div>
        </div>
        <div
          className="w-full flex-1 overflow-auto no-scrollbar mb-[36px]"
          ref={chatRef}
        >
          {chatList.current.map((chat) => {
            return <div key={chat.requestId}>
              <Dialogue
                chat={chat}
                deepThink={inputInfoProp.deepThink}
                changeTask={changeTask}
                changeFile={changeFile}
                changePlan={changePlan}
              />
            </div>;
          })}
        </div>
        <GeneralInput
          placeholder={loading ? "任务进行中" : "希望 Genie 为你做哪些任务呢？"}
          showBtn={false}
          size="medium"
          disabled={loading}
          product={product}
          // 多轮问答也不支持切换deepThink，使用传进来的
          send={(info) => sendMessage({
            ...info,
            deepThink: inputInfoProp.deepThink
          })}
        />
      </div>
      {contextHolder}
      <div className={classNames('transition-all w-0', {
        'opacity-0 overflow-hidden': !showAction,
        'flex-1': showAction,
      })}>
        <ActionView
          activeTask={activeTask}
          taskList={taskList}
          plan={plan}
          ref={actionViewRef}
          onClose={() => changeActionStatus(false)}
        />
      </div>
    </div>
  );
};

export default ChatView;
