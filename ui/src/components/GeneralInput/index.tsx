import React, { useMemo, useRef, useState, useEffect } from "react";
import { Input, Button, Tooltip, message, Spin } from "antd";
import classNames from "classnames";
import { TextAreaRef } from "antd/es/input/TextArea";
import { getOS } from "@/utils";

const { TextArea } = Input;

type Props = {
  placeholder: string;
  showBtn: boolean;
  disabled: boolean;
  size: string;
  product?: CHAT.Product;
  send: (p: CHAT.TInputInfo) => void;
  onOptimize?: (optimizedQuestion: string, recommendedTemplates: string[], confluenceResults?: Array<{ id: string; title: string; content: string; metadata?: any }>) => void;
  availableTemplates?: Array<{ id: string; name: string; description?: string; domainName?: string }>;
  optimizedValue?: string; // 优化后的值，用于更新输入框
};

const GeneralInput: GenieType.FC<Props> = (props) => {
  const { placeholder, showBtn, disabled, product, send, onOptimize, availableTemplates, optimizedValue } = props;
  const [question, setQuestion] = useState<string>("");
  const [deepThink, setDeepThink] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const textareaRef = useRef<TextAreaRef>(null);
  const tempData = useRef<{
    cmdPress?: boolean;
    compositing?: boolean;
  }>({});

  // 当 optimizedValue 变化时，更新输入框的值
  useEffect(() => {
    if (optimizedValue !== undefined && optimizedValue !== '' && optimizedValue !== question) {
      setQuestion(optimizedValue);
    }
  }, [optimizedValue]);

  const questionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value);
  };

  const changeThinkStatus = () => {
    setDeepThink(!deepThink);
  };

  // 一键优化功能
  const handleOptimize = async () => {
    if (!question.trim() || isOptimizing || disabled) {
      return;
    }

    setIsOptimizing(true);
    try {
      const { optimizeQuestion, recommendTemplates, searchConfluence } = await import('@/utils/llmOptimizer');
      
      // 优化问题
      const optimized = await optimizeQuestion(question);
      
      // 并行执行：推荐模板和搜索Confluence
      // 注意：Confluence搜索失败不影响模板匹配，会返回空数组
      const [recommendedTemplateIds, confluenceSearchResults] = await Promise.allSettled([
        // 推荐模板
        (async () => {
          if (availableTemplates && availableTemplates.length > 0) {
            return await recommendTemplates(optimized, availableTemplates);
          }
          return [];
        })(),
        // 搜索Confluence（top2），失败时返回空数组
        searchConfluence(optimized, 2).catch(() => [])
      ]);

      // 提取结果，确保即使失败也有默认值
      const templateIds = recommendedTemplateIds.status === 'fulfilled' 
        ? recommendedTemplateIds.value 
        : [];
      const confluenceResults = confluenceSearchResults.status === 'fulfilled' 
        ? confluenceSearchResults.value 
        : [];
      
      // 如果Confluence搜索失败或没有结果，给出友好提示（但不影响流程）
      if (confluenceSearchResults.status === 'rejected') {
        console.info('Confluence搜索失败，将继续进行模板匹配');
      } else if (confluenceSearchResults.status === 'fulfilled' && confluenceResults.length === 0 && optimized.trim()) {
        console.info('未找到Confluence相关内容，将继续进行模板匹配');
      }

      // 调用回调函数
      if (onOptimize) {
        onOptimize(optimized, recommendedTemplateIds, confluenceSearchResults);
      } else {
        // 如果没有提供回调，直接更新输入框
        setQuestion(optimized);
        if (recommendedTemplateIds.length > 0) {
          message.success(`已优化问题，推荐了 ${recommendedTemplateIds.length} 个模板`);
        } else {
          message.success('问题已优化');
        }
      }
    } catch (error: any) {
      console.error('优化失败:', error);
      message.error(error?.message || '优化失败，请稍后重试');
    } finally {
      setIsOptimizing(false);
    }
  };

  const pressEnter: React.KeyboardEventHandler<HTMLTextAreaElement> = () => {
    if (tempData.current.compositing) {
      return;
    }
    // 按住command 回车换行逻辑
    if (tempData.current.cmdPress) {
      const textareaDom = textareaRef.current?.resizableTextArea?.textArea;
      if (!textareaDom) {
        return;
      }
      const { selectionStart, selectionEnd } = textareaDom || {};
      const newValue =
        question.substring(0, selectionStart) +
        '\n' + // 插入换行符
        question.substring(selectionEnd!);

      setQuestion(newValue);
      setTimeout(() => {
        textareaDom.selectionStart = selectionStart! + 1;
        textareaDom.selectionEnd = selectionStart! + 1;
        textareaDom.focus();
      }, 20);
      return;
    }
    // 屏蔽状态，不发
    if (!question || disabled) {
      return;
    }
    send({
      message: question,
      outputStyle: product?.type,
      deepThink,
    });
    setQuestion("");
  };

  const sendMessage = () => {
    send({
      message: question,
      outputStyle: product?.type,
      deepThink,
    });
    setQuestion("");
  };

  const enterTip = useMemo(() => {
    return `⏎发送，${getOS() === 'Mac' ? '⌘' : '^'} + ⏎ 换行`;
  }, []);

  return (
    <div
      className={
        showBtn
          ? "rounded-[12px] bg-[linear-gradient(to_bottom_right,#4040ff,#ff49fd,#d763fc,#3cc4fa)] p-1"
          : ""
      }
    >
      <div className="rounded-[12px] border border-[#E9E9F0] overflow-hidden p-[12px] bg-[#fff]">
        <div className="relative">
          <TextArea
            ref={textareaRef}
            value={question}
            placeholder={placeholder}
            className={classNames(
              "h-62 no-border-textarea border-0 resize-none p-[0px] focus:border-0 bg-[#fff]",
              showBtn && product ? "indent-86" : ""
            )}
            onChange={questionChange}
            onPressEnter={pressEnter}
            onKeyDown={(event) => {
              tempData.current.cmdPress = event.metaKey || event.ctrlKey;
            }}
            onKeyUp={() => {
              tempData.current.cmdPress = false;
            }}
            onCompositionStart={() => {
              tempData.current.compositing = true;
            }}
            onCompositionEnd={() => {
              tempData.current.compositing = false;
            }}
          />
          {showBtn && product ? (
            <div className="h-[24px] w-[80px] absolute top-0 left-0 flex items-center justify-center rounded-[6px] bg-[#f4f4f9] text-[12px] ">
              <i className={`font_family ${product.img} ${product.color} text-14`}></i>
              <div className="ml-[6px]">{product.name}</div>
            </div>
          ) : null}
        </div>
        <div className="h-30 flex justify-between items-center mt-[6px]">
          {showBtn ? (
            <div className="flex items-center gap-8">
              <Button
                type="default"
                className={classNames(
                  "text-[12px] p-[8px] h-[28px] transition-all hover:text-[#333] hover:bg-[rgba(64,64,255,0.02)] hover:border-[rgba(64,64,255,0.2)]",
                  isOptimizing && 'opacity-50 cursor-not-allowed'
                )}
                onClick={handleOptimize}
                disabled={isOptimizing || !question.trim() || disabled}
              >
                {isOptimizing ? (
                  <>
                    <Spin size="small" className="mr-2" />
                    <span className="ml-[-4px]">优化中...</span>
                  </>
                ) : (
                  <>
                    <i className="font_family icon-yijianyouhua"></i>
                    <span className="ml-[-4px]">一键优化</span>
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div></div>
          )}
          <div className="flex items-center">
            <span className="text-[12px] text-gray-300 mr-8 flex items-center">
              {enterTip}
            </span>
            <Tooltip title="发送">
              <i
                className={`font_family icon-fasongtianchong ${!question || disabled ? "cursor-not-allowed text-[#ccc] pointer-events-none" : "cursor-pointer"}`}
                onClick={sendMessage}
              ></i>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralInput;
