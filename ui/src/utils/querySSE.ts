import { fetchEventSource, EventSourceMessage } from '@microsoft/fetch-event-source';

const customHost = window.SERVICE_BASE_URL || 'http://172.31.73.223:8080';
const DEFAULT_SSE_URL = `${customHost}/web/api/v1/gpt/queryAgentStreamIncr`;

const SSE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Accept': 'text/event-stream',
};

interface SSEConfig {
  body: any;
  handleMessage: (data: any) => void;
  handleError: (error: Error) => void;
  handleClose: () => void;
}

/**
 * 创建服务器发送事件（SSE）连接
 * @param config SSE 配置
 * @param url 可选的自定义 URL
 */
export default (config: SSEConfig, url: string = DEFAULT_SSE_URL): void => {
  const { body = null, handleMessage, handleError, handleClose } = config;

  console.log('🔗 正在连接到SSE服务器:', url);

  fetchEventSource(url, {
    method: 'POST',
    credentials: 'include',
    headers: SSE_HEADERS,
    body: JSON.stringify(body),
    openWhenHidden: true,
    onmessage(event: EventSourceMessage) {
      if (event.data) {
        try {
          const parsedData = JSON.parse(event.data);
          handleMessage(parsedData);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
          handleError(new Error('Failed to parse SSE message'));
        }
      }
    },
    onerror(error: Error) {
      console.error('SSE连接错误:', error);
      console.error('连接URL:', url);
      console.error('请求体:', body);
      handleError(error);
    },
    onclose() {
      console.log('SSE连接已关闭');
      handleClose();
    }
  }).catch((error: Error) => {
    console.error('fetchEventSource失败:', error);
    console.error('连接URL:', url);
    handleError(error);
  });
};
