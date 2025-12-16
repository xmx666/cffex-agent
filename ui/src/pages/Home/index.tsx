import { useState, useCallback, memo, useEffect } from "react";
import GeneralInput from "@/components/GeneralInput";
import Slogn from "@/components/Slogn";
import ChatView from "@/components/ChatView";
import UserIdentity from "@/components/UserIdentity";
import SettingsModal from "@/components/SettingsModal";
import HistorySidebar from "@/components/HistorySidebar";
import HistoryDetail from "@/components/HistoryDetail";
import TemplateSidebar from "@/components/TemplateSidebar";
import { productList, defaultProduct } from "@/utils/constants";
import { Image, Button, Tag } from "antd";
import { demoList } from "@/utils/constants";
import { BrowserFingerprint } from "@/utils/browserFingerprint";
import { SimpleHistoryManager, ChatSession } from "@/utils/historyManager";
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
  const [videoModalOpen, setVideoModalOpen] = useState();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [historySidebarVisible, setHistorySidebarVisible] = useState(false);
  const [historyDetailVisible, setHistoryDetailVisible] = useState(false);
  const [templateSidebarVisible, setTemplateSidebarVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [restoreSession, setRestoreSession] = useState<ChatSession | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // 初始化用户标识
  useEffect(() => {
    const fingerprint = BrowserFingerprint.getInstance();
    fingerprint.generateFingerprint();
  }, []);

  const changeInputInfo = useCallback((info: CHAT.TInputInfo) => {
    setInputInfo(info);
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
    setIsRestoring(true);
    setRestoreSession(session);
    // 设置产品类型
    const selectedProduct = productList.find(p => p.type === session.productType) || defaultProduct;
    setProduct(selectedProduct);
  }, []);

  // 处理会话恢复完成
  const handleSessionRestored = useCallback(() => {
    setIsRestoring(false);
    setRestoreSession(null);
  }, []);

  const CaseCard = ({ title, description, tag, image, url, videoUrl }: any) => {
    return (
      <div className="group flex flex-col rounded-lg bg-white pt-16 px-16 shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.1)] hover:-translate-y-[5px] transition-all duration-300 ease-in-out cursor-pointer w-full max-w-xs border border-[rgba(233,233,240,1)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] font-bold truncate">{title}</div>
          <div className="shrink-0 inline-block bg-gray-100 text-gray-600 px-[6px] leading-[20px] text-[12px] rounded-[4px]">
            {tag}
          </div>
        </div>
        <div className="text-[12px] text-[#71717a] h-40 line-clamp-2 leading-[20px]">
          {description}
        </div>
        <div
          className="text-[#4040ff] group-hover:text-[#656cff] text-[12px] flex items-center mb-6 cursor-pointer transition-colors duration-200"
          onClick={() => window.open(url)}
        >
          <span className="mr-1">查看报告</span>
          <i className="font_family icon-xinjianjiantou"></i>
        </div>
        <div className="relative rounded-t-[10px] overflow-hidden h-100 group-hover:scale-105 transition-transform duration-500 ease">
          <Image
            style={{ display: "none" }}
            preview={{
              visible: videoModalOpen === videoUrl,
              destroyOnHidden: true,
              imageRender: () => (
                <video muted width="80%" controls autoPlay src={videoUrl} />
              ),
              toolbarRender: () => null,
              onVisibleChange: () => {
                setVideoModalOpen(undefined);
              },
            }}
            src={image}
          />
          <img
            src={image}
            className="w-full h-full rounded-t-[10px] mt-[-20px]"
          ></img>
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer rounded-t-[10px] group hover:bg-[rgba(0,0,0,0.6)] border border-[#ededed]"
            onClick={() => setVideoModalOpen(videoUrl)}
          >
            <i className="font_family icon-bofang hidden group-hover:block text-[#fff] text-[24px]"></i>
          </div>
        </div>
      </div>
    );
  };

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
            />
            {/* 显示已选择的模板（用户级别） */}
            {selectedTemplates.length > 0 && (
              <div className="mt-12 px-12 py-8 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-[12px] text-gray-600 mb-4">已使用的模板：</div>
                <div className="flex flex-wrap gap-4">
                  {selectedTemplates.map(template => (
                    <Tag key={template.id} color="blue" className="text-[12px]">
                      {template.domainName ? `${template.domainName}: ` : ''}{template.name}
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
        restoreSession={restoreSession}
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
        onClose={() => setHistoryDetailVisible(false)}
        onContinueChat={handleContinueChat}
      />

      {/* 模板设置侧边栏 */}
      <TemplateSidebar
        visible={templateSidebarVisible}
        onClose={() => setTemplateSidebarVisible(false)}
      />
    </div>
  );
});

Home.displayName = "Home";

export default Home;
