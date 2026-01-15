import { useState, useCallback, memo, useEffect } from "react";
import GeneralInput from "@/components/GeneralInput";
import Slogn from "@/components/Slogn";
import ChatView from "@/components/ChatView";
import UserIdentity from "@/components/UserIdentity";
import SettingsModal from "@/components/SettingsModal";
import HistorySidebar from "@/components/HistorySidebar";
import HistoryDetail from "@/components/HistoryDetail";
import TemplateSidebar from "@/components/TemplateSidebar";
import TutorialModal from "@/components/TutorialModal";
import TemplateConfirmModal from "@/components/TemplateConfirmModal/index";
import { productList, defaultProduct } from "@/utils/constants";
import { Button, Tag, message, Modal } from "antd";
import { demoList } from "@/utils/constants";
import { BrowserFingerprint } from "@/utils/browserFingerprint";
import { ChatSession } from "@/utils/historyManager";
import { globalTemplateManager, TemplateConfig } from "@/utils/templateManager";
import "@/styles/history.css";

type HomeProps = Record<string, never>;

const Home: GenieType.FC<HomeProps> = memo(() => {
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>({
    domains: [],
    templateList: []
  });

  // 用户选择的模板（用户级别）
  const [selectedTemplates, setSelectedTemplates] = useState<Array<{ id: string; name: string; domainName?: string }>>([]);
  
  // Confluence搜索结果
  const [confluenceResults, setConfluenceResults] = useState<Array<{ id: string; title: string; content: string; metadata?: any }>>([]);
  
  // Confluence完整内容Modal
  const [confluenceDetailVisible, setConfluenceDetailVisible] = useState(false);
  const [confluenceDetail, setConfluenceDetail] = useState<{ id: string; title: string; content: string } | null>(null);

  // 加载模板配置
  useEffect(() => {
    const loadAll = async () => {
      await loadTemplateConfig();
      loadUserSelectedTemplates();
    };

    loadAll();

    // 定期刷新模板配置（从后端获取最新数据）
    const interval = setInterval(() => {
      loadAll();
    }, 3000); // 每3秒刷新一次

    return () => clearInterval(interval);
  }, []);

  const loadTemplateConfig = async () => {
    try {
      const config = await globalTemplateManager.getTemplateConfig();
      setTemplateConfig(config);
      return config;
    } catch (error) {
      console.error('加载模板配置失败:', error);
      return null;
    }
  };

  const loadUserSelectedTemplates = (config?: TemplateConfig) => {
    const currentConfig = config || templateConfig;
    const selectedIds = globalTemplateManager.getUserSelectedTemplateIds();
    if (selectedIds.length > 0 && currentConfig.templateList.length > 0) {
      const templates = selectedIds
        .map(id => {
          const template = currentConfig.templateList.find(t => t.id === id);
          if (template) {
            const domain = currentConfig.domains.find(d => d.id === template.domainId);
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
    } else if (selectedIds.length === 0) {
      // 只有在确实没有选择模板时才清空
      setSelectedTemplates(prev => {
        if (prev.length > 0) {
          return [];
        }
        return prev;
      });
    }
  };

  // 当模板配置加载完成后，更新用户选择的模板显示
  useEffect(() => {
    if (templateConfig.templateList.length > 0) {
      loadUserSelectedTemplates();
    }
  }, [templateConfig]);
  const [inputInfo, setInputInfo] = useState<CHAT.TInputInfo>({
    message: "",
    deepThink: false,
  });
  const [product, setProduct] = useState(defaultProduct);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [historySidebarVisible, setHistorySidebarVisible] = useState(false);
  const [historyDetailVisible, setHistoryDetailVisible] = useState(false);
  const [templateSidebarVisible, setTemplateSidebarVisible] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [restoreSession, setRestoreSession] = useState<ChatSession | null>(null);
  
  // 一键优化相关状态
  const [templateConfirmVisible, setTemplateConfirmVisible] = useState(false);
  const [recommendedTemplates, setRecommendedTemplates] = useState<Array<{ id: string; name: string; description?: string; domainName?: string }>>([]);
  const [optimizedQuestion, setOptimizedQuestion] = useState<string>('');
  const [optimizedValue, setOptimizedValue] = useState<string>(''); // 优化后的输入框值

  // 初始化用户标识
  useEffect(() => {
    const fingerprint = BrowserFingerprint.getInstance();
    fingerprint.generateFingerprint();
  }, []);

  const changeInputInfo = useCallback((info: CHAT.TInputInfo) => {
    setInputInfo(info);
  }, []);

  // 一键优化处理函数
  const handleOptimize = useCallback(async (optimizedQuestion: string, recommendedTemplateIds: string[], confluenceSearchResults: Array<{ id: string; title: string; content: string; metadata?: any }> = []) => {
    // 只更新输入框的显示值，不更新 inputInfo（不自动发送）
    setOptimizedValue(optimizedQuestion);

    // 保存优化后的问题（用于模板确认Modal显示）
    setOptimizedQuestion(optimizedQuestion);

    // 保存Confluence搜索结果
    setConfluenceResults(confluenceSearchResults);

    // 无论是否有推荐的模板，都显示确认框
    if (recommendedTemplateIds.length > 0) {
      // 获取推荐的模板详细信息
      const recommendedTemplatesInfo = recommendedTemplateIds
        .map(id => {
          const template = templateConfig.templateList.find(t => t.id === id);
          if (template) {
            const domain = templateConfig.domains.find(d => d.id === template.domainId);
            return {
              id: template.id,
              name: template.name,
              description: template.description,
              domainName: domain?.name
            };
          }
          return null;
        })
        .filter(t => t !== null) as Array<{ id: string; name: string; description?: string; domainName?: string }>;

      setRecommendedTemplates(recommendedTemplatesInfo);
    } else {
      // 没有推荐模板时，设置为空数组
      setRecommendedTemplates([]);
    }
    
    // 始终显示确认框
    setTemplateConfirmVisible(true);
  }, [templateConfig]);

  // 处理推荐案例点击，自动触发一键优化
  const handleDemoClick = useCallback(async (question: string) => {
    // 先设置输入框的值
    setOptimizedValue(question);
    
    try {
      // 导入优化工具
      const { optimizeQuestion, recommendTemplates, searchConfluence } = await import('@/utils/llmOptimizer');
      
      // 优化问题
      const optimized = await optimizeQuestion(question);
      
      // 并行执行：推荐模板和搜索Confluence
      // 注意：Confluence搜索失败不影响模板匹配，会返回空数组
      const [recommendedTemplateIds, confluenceSearchResults] = await Promise.allSettled([
        // 推荐模板
        (async () => {
          if (templateConfig.templateList.length > 0) {
            const availableTemplates = templateConfig.templateList.map(t => {
              const domain = templateConfig.domains.find(d => d.id === t.domainId);
              return {
                id: t.id,
                name: t.name,
                description: t.description,
                domainName: domain?.name
              };
            });
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
      
      // 调用优化处理函数，显示模板确认框
      handleOptimize(optimized, templateIds, confluenceResults);
    } catch (error: any) {
      console.error('优化失败:', error);
      message.error(error?.message || '优化失败，请稍后重试');
      // 即使优化失败，也设置输入框的值
      setOptimizedValue(question);
    }
  }, [templateConfig, handleOptimize]);

  // 确认应用模板
  const handleConfirmTemplates = useCallback(() => {
    const recommendedTemplateIds = recommendedTemplates.map(t => t.id);
    
    // 先清除当前模板，再应用新的推荐模板（替换而不是追加）
    // 如果没有推荐模板，则清空所有模板
    globalTemplateManager.setUserSelectedTemplateIds(recommendedTemplateIds);
    
    // 触发模板更新事件
    window.dispatchEvent(new Event('userSelectedTemplatesChange'));
    
    // 刷新模板显示
    loadUserSelectedTemplates();
    
    setTemplateConfirmVisible(false);
    
    // 如果有Confluence搜索结果，将其作为额外输入加入到优化后的问题中
    let finalQuestion = optimizedQuestion;
    if (confluenceResults.length > 0) {
      const confluenceContext = confluenceResults.map((result, index) => {
        return `[Confluence数据${index + 1}]\n标题: ${result.title}\n内容摘要: ${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}`;
      }).join('\n\n');
      
      finalQuestion = `${optimizedQuestion}\n\n---\n相关Confluence知识库数据：\n${confluenceContext}`;
    }
    
    // 设置最终的问题（包含Confluence上下文）
    setOptimizedValue(finalQuestion);
    
    if (recommendedTemplates.length > 0) {
      message.success(`已成功应用 ${recommendedTemplates.length} 个推荐模板${confluenceResults.length > 0 ? `和 ${confluenceResults.length} 条Confluence数据` : ''}`);
    } else {
      message.success(`已清空当前模板${confluenceResults.length > 0 ? `，已添加 ${confluenceResults.length} 条Confluence数据` : ''}`);
    }
  }, [recommendedTemplates, optimizedQuestion, confluenceResults]);

  // 取消应用模板
  const handleCancelTemplates = useCallback(() => {
    setTemplateConfirmVisible(false);
    message.info('已跳过模板应用，您可以稍后在模板设置中手动选择');
    // 清空优化值，避免影响后续输入
    setOptimizedValue('');
  }, []);

  // 监听外部触发查询（localStorage + URL参数）
  useEffect(() => {
    // 处理URL参数触发
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');

    if (query) {
      changeInputInfo({
        message: decodeURIComponent(query),
        deepThink: false
      });
      // 清除URL参数，避免刷新时重复触发
      window.history.replaceState({}, '', window.location.pathname);
    }

    // 监听 localStorage 变化（跨标签页通信）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'genie_trigger_query' && e.newValue) {
        try {
          const queryData = JSON.parse(e.newValue);
          if (queryData.message) {
            // 设置问题并触发执行
            changeInputInfo({
              message: queryData.message,
              deepThink: queryData.deepThink || false,
              outputStyle: queryData.outputStyle,
              files: queryData.files || []
            });
            // 清除标记，避免重复触发
            localStorage.removeItem('genie_trigger_query');
          }
        } catch (error) {
          console.error('解析查询数据失败:', error);
        }
      }
    };

    // 监听同源页面的 localStorage 变化
    window.addEventListener('storage', handleStorageChange);

    // 监听当前页面的 localStorage 变化（用于同页面触发）
    const checkLocalStorage = () => {
      const triggerData = localStorage.getItem('genie_trigger_query');
      if (triggerData) {
        try {
          const queryData = JSON.parse(triggerData);
          if (queryData.message && (!inputInfo.message || inputInfo.message !== queryData.message)) {
            changeInputInfo({
              message: queryData.message,
              deepThink: queryData.deepThink || false,
              outputStyle: queryData.outputStyle,
              files: queryData.files || []
            });
            localStorage.removeItem('genie_trigger_query');
          }
        } catch (error) {
          console.error('解析查询数据失败:', error);
        }
      }
    };

    // 定期检查（用于同页面触发，因为storage事件只在其他标签页触发）
    const interval = setInterval(checkLocalStorage, 500);

    // 监听 postMessage（跨域通信）
    const handleMessage = (event: MessageEvent) => {
      // 安全检查：可以验证 origin
      // if (event.origin !== 'http://允许的域名') return;

      if (event.data && event.data.type === 'GENIE_TRIGGER_QUERY') {
        const { message, deepThink, outputStyle, files } = event.data;
        if (message) {
          changeInputInfo({
            message,
            deepThink: deepThink || false,
            outputStyle,
            files: files || []
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, [changeInputInfo, inputInfo.message]);

  // 处理历史记录选择
  const handleSelectSession = useCallback((session: ChatSession) => {
    setSelectedSession(session);
    setHistoryDetailVisible(true);
  }, []);

  // 处理继续对话
  const handleContinueChat = useCallback((session: ChatSession) => {
    setRestoreSession(session);
    // 设置产品类型
    const selectedProduct = productList.find(p => p.type === session.productType) || defaultProduct;
    setProduct(selectedProduct);
  }, []);

  // 处理会话恢复完成
  const handleSessionRestored = useCallback(() => {
    setRestoreSession(null);
  }, []);


  const renderContent = () => {
    if (inputInfo.message.length === 0) {
      return (
        <div className="pt-[120px] flex flex-col items-center">
          <Slogn />
          <div className="w-640 rounded-xl shadow-[0_18px_39px_0_rgba(198,202,240,0.1)]">
            <GeneralInput
              placeholder={product.placeholder}
              showBtn={true}
              size="big"
              disabled={false}
              product={product}
              send={changeInputInfo}
              onOptimize={(optimized, templateIds, confluenceResults = []) => {
                handleOptimize(optimized, templateIds, confluenceResults);
              }}
              optimizedValue={optimizedValue}
              availableTemplates={templateConfig.templateList.map(t => {
                const domain = templateConfig.domains.find(d => d.id === t.domainId);
                return {
                  id: t.id,
                  name: t.name,
                  description: t.description,
                  domainName: domain?.name
                };
              })}
            />
            {/* 显示已选择的模板（用户级别） */}
            {selectedTemplates.length > 0 && (
              <div className="mt-12 px-12 py-8 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-[12px] text-gray-600 mb-4">已使用的模板：</div>
                <div className="flex flex-wrap gap-4">
                  {selectedTemplates.map(template => (
                    <Tag
                      key={template.id}
                      color="blue"
                      className="text-[12px] cursor-pointer"
                      closable
                      onClose={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // 删除该模板
                        const currentSelectedIds = globalTemplateManager.getUserSelectedTemplateIds();
                        const newSelectedIds = currentSelectedIds.filter(id => id !== template.id);
                        globalTemplateManager.setUserSelectedTemplateIds(newSelectedIds);
                        
                        // 触发模板更新事件
                        window.dispatchEvent(new Event('userSelectedTemplatesChange'));
                        
                        // 刷新模板显示
                        loadUserSelectedTemplates();
                        
                        message.success(`已删除模板：${template.name}`);
                      }}
                    >
                      {template.domainName ? `${template.domainName}: ` : ''}{template.name}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
            
            {/* 显示已使用的Confluence数据 */}
            {confluenceResults.length > 0 && (
              <div className="mt-12 px-12 py-8 bg-green-50 rounded-lg border border-green-200">
                <div className="text-[12px] text-gray-600 mb-4">已使用的Confluence数据：</div>
                <div className="flex flex-wrap gap-4">
                  {confluenceResults.map((result, index) => (
                    <Tag
                      key={result.id || index}
                      color="green"
                      className="text-[12px] cursor-pointer hover:bg-green-200 transition-colors"
                      onClick={async () => {
                        try {
                          const { getConfluenceFullText } = await import('@/utils/llmOptimizer');
                          const fullText = await getConfluenceFullText(result.id);
                          if (fullText) {
                            setConfluenceDetail({
                              id: fullText.id,
                              title: fullText.title,
                              content: fullText.content
                            });
                            setConfluenceDetailVisible(true);
                          } else {
                            // 如果没有获取到完整内容，使用当前结果
                            setConfluenceDetail({
                              id: result.id,
                              title: result.title,
                              content: result.content
                            });
                            setConfluenceDetailVisible(true);
                          }
                        } catch (error) {
                          console.error('获取Confluence完整内容失败:', error);
                          // 使用当前结果作为fallback
                          setConfluenceDetail({
                            id: result.id,
                            title: result.title,
                            content: result.content
                          });
                          setConfluenceDetailVisible(true);
                        }
                      }}
                    >
                      {result.title}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="w-640 flex flex-wrap gap-16 mt-[16px]">
            {productList.map((item, i) => (
              <div
                key={i}
                className={`w-[22%] h-[36px] cursor-pointer flex items-center justify-center border rounded-[8px] ${item.type === product.type ? "border-[#4040ff] bg-[rgba(64,64,255,0.02)] text-[#4040ff]" : "border-[#E9E9F0] text-[#666]"}`}
                onClick={() => setProduct(item)}
              >
                <i className={`font_family ${item.img} ${item.color}`}></i>
                <div className="ml-[6px]">{item.name}</div>
              </div>
            ))}
          </div>
          {/* 使用案例框 */}
          <div className="w-640 mt-24">
            <div className="text-[14px] text-[#666] mb-12 text-center">使用案例</div>
            <div className="grid grid-cols-2 gap-12">
              {demoList.map((question, index) => (
                <div
                  key={index}
                  onClick={() => handleDemoClick(question)}
                  className="p-16 bg-white border border-[#E9E9F0] rounded-[8px] cursor-pointer hover:border-[#4040ff] hover:bg-[#f5f7ff] transition-all duration-200 flex items-center justify-between group"
                >
                  <div className="text-[14px] text-[#27272A] flex-1 pr-12 line-clamp-2 leading-[22px] group-hover:text-[#4040ff] transition-colors">
                    {question}
                  </div>
                  <i className="font_family icon-youjiantou text-[16px] text-[#999] group-hover:text-[#4040ff] transition-colors shrink-0"></i>
                </div>
              ))}
            </div>
          </div>
          {/* 优秀案例 - 暂时隐藏，后续开发中再选择展示 */}
          {/* <div className="mt-80 mb-120">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">优秀案例</h2>
              <p className="text-gray-500">和 Genie 一起提升工作效率</p>
            </div>
            <div className="flex gap-16 mt-24">
              {demoList.map((demo, i) => (
                <CaseCard key={i} {...demo} />
              ))}
            </div>
          </div> */}
        </div>
      );
    }
    return (
      <ChatView
        inputInfo={inputInfo}
        product={product}
        restoreSession={restoreSession ?? undefined}
        onSessionRestored={handleSessionRestored}
        onBackToHome={() => setInputInfo({ message: "", deepThink: inputInfo.deepThink })}
      />
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="w-full flex justify-between items-center p-16 bg-white border-b border-gray-200">
        <div className="flex items-center">
          <div className="text-[16px] font-[500] text-[#27272A]">
            <span
              style={{
                backgroundImage: 'linear-gradient(270deg, rgba(130,45,255,1) 0%,rgba(62,69,255,1) 20.88266611099243%,rgba(60,196,250,1) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent'
              }}
            >Cffex Agent</span>
          </div>
        </div>

        <div className="flex items-center space-x-16">
          <UserIdentity />
          {/* 用户手册按钮 - 突出显示 */}
          <Button
            size="large"
            icon={<i className="font_family icon-wendang text-[18px]"></i>}
            onClick={() => setTutorialVisible(true)}
            className="border-0 shadow-md hover:shadow-lg transition-all"
            style={{
              background: 'linear-gradient(270deg, rgba(64,64,255,1) 0%, rgba(60,196,250,1) 100%)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(270deg, rgba(80,80,255,1) 0%, rgba(76,196,250,1) 100%)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(64,64,255,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(270deg, rgba(64,64,255,1) 0%, rgba(60,196,250,1) 100%)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            }}
          >
            <span className="font-[500]" style={{ color: '#ffffff' }}>用户手册</span>
          </Button>
          <Button
            icon={<i className="font_family icon-lishi"></i>}
            onClick={() => setHistorySidebarVisible(true)}
          >
            历史记录
          </Button>
          <Button
            icon={<i className="font_family icon-wendang"></i>}
            onClick={() => setTemplateSidebarVisible(true)}
          >
            模板设置
          </Button>
          <Button
            icon={<i className="font_family icon-shezhi"></i>}
            onClick={() => setSettingsVisible(true)}
          >
            设置
          </Button>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col items-center">
        {renderContent()}
      </div>

      {/* 设置模态框 */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />

      {/* 历史记录侧边栏 */}
      <HistorySidebar
        visible={historySidebarVisible}
        onClose={() => setHistorySidebarVisible(false)}
        onSelectSession={handleSelectSession}
      />

      {/* 历史记录详情页面 */}
      <HistoryDetail
        session={selectedSession}
        visible={historyDetailVisible}
        onClose={() => {
          setHistoryDetailVisible(false);
          setSelectedSession(null);
        }}
        onContinueChat={handleContinueChat}
      />

      {/* 模板设置侧边栏 */}
      <TemplateSidebar
        visible={templateSidebarVisible}
        onClose={() => setTemplateSidebarVisible(false)}
      />

      {/* 用户手册教程模态框 */}
      <TutorialModal
        visible={tutorialVisible}
        onClose={() => setTutorialVisible(false)}
        tutorialUrl="/CffexAgent_instruction.html" // 使用html文件夹中的教程文件
      />

      {/* Confluence详情Modal */}
      {confluenceDetailVisible && confluenceDetail && (
        <Modal
          title={confluenceDetail.title}
          open={confluenceDetailVisible}
          onCancel={() => setConfluenceDetailVisible(false)}
          footer={[
            <Button key="close" onClick={() => setConfluenceDetailVisible(false)}>
              关闭
            </Button>
          ]}
          width={800}
        >
          <div className="max-h-[600px] overflow-y-auto">
            <div className="mb-4">
              <div className="text-[12px] text-gray-500 mb-2">文档ID: {confluenceDetail.id}</div>
              <div className="text-[14px] text-gray-800 whitespace-pre-wrap break-words">
                {confluenceDetail.content || '暂无内容'}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 模板确认Modal */}
      <TemplateConfirmModal
        visible={templateConfirmVisible}
        templates={recommendedTemplates}
        optimizedQuestion={optimizedQuestion}
        onConfirm={handleConfirmTemplates}
        onCancel={handleCancelTemplates}
      />
    </div>
  );
});

Home.displayName = "Home";

export default Home;
