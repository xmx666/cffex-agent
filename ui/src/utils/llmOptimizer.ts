/**
 * LLM优化工具
 * 使用与后端相同的LLM配置来优化用户问题和推荐模板
 */

interface LLMConfig {
  base_url: string;
  apikey: string;
  interface_url: string;
  model: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
}

// 与后端配置保持一致（从application.yml）
const LLM_CONFIG: LLMConfig = {
  base_url: 'http://172.26.36.12:80/futuremaas/v1',
  apikey: 'cffex-pnnpdqex7gv9gt1m',
  interface_url: '/chat/completions',
  model: 'qwen3-next-80b-fp8-local',
  temperature: 0,
  top_p: 0.1,
  max_tokens: 100000
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 获取API基础URL（优先使用后端代理）
 */
function getApiBaseUrl(): string {
  // @ts-ignore 打包注入的全局常量
  const injected = typeof SERVICE_BASE_URL !== 'undefined' ? SERVICE_BASE_URL : '';
  const winVal = (window as any).SERVICE_BASE_URL || '';
  return injected || winVal || '';
}

/**
 * 调用LLM API（优先使用后端代理）
 */
async function callLLM(messages: ChatMessage[]): Promise<string> {
  const backendBaseUrl = getApiBaseUrl();
  
  // 如果配置了后端URL，使用后端代理API（推荐，更安全）
  if (backendBaseUrl) {
    try {
      const response = await fetch(`${backendBaseUrl}/api/optimize/question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          messages: messages
        })
      });

      if (!response.ok) {
        throw new Error(`后端API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status === 'error') {
        throw new Error(data.message || '后端API返回错误');
      }
      
      return data.optimizedQuestion || data.result || '';
    } catch (error) {
      console.warn('后端代理API调用失败，尝试直接调用LLM:', error);
      // 如果后端代理失败，继续使用直接调用方式
    }
  }

  // 直接调用LLM API（备用方案）
  const url = `${LLM_CONFIG.base_url}${LLM_CONFIG.interface_url}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_CONFIG.apikey}`
    },
    body: JSON.stringify({
      model: LLM_CONFIG.model,
      messages: messages,
      temperature: LLM_CONFIG.temperature,
      top_p: LLM_CONFIG.top_p,
      max_tokens: LLM_CONFIG.max_tokens
    })
  });

  if (!response.ok) {
    throw new Error(`LLM API请求失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * 优化用户问题
 */
export async function optimizeQuestion(userQuestion: string): Promise<string> {
  if (!userQuestion || !userQuestion.trim()) {
    throw new Error('问题不能为空');
  }

  const prompt = `你是一个问题优化助手。你的任务是根据用户输入的问题，优化问题表述，使其更加清晰、具体、易于理解和回答。

优化原则：
1. 保持原问题的核心意图不变
2. 使问题更加具体和明确
3. 补充必要的上下文信息
4. 使用清晰的语言表达
5. 如果问题涉及特定领域，使用该领域的专业术语

用户原始问题：
${userQuestion}

请输出优化后的问题（只输出优化后的问题，不要添加任何解释）：`;

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    const optimizedQuestion = await callLLM(messages);
    // 清理可能的格式问题
    return optimizedQuestion.trim().replace(/^优化后的问题[：:]\s*/i, '').trim();
  } catch (error) {
    console.error('优化问题失败:', error);
    throw error;
  }
}

/**
 * Confluence搜索结果接口
 */
export interface ConfluenceSearchResult {
  id: string;
  title?: string;
  content?: string;
  metadata?: Record<string, any>;
  distance?: number;
}

/**
 * 搜索Confluence数据
 * 注意：即使搜索失败也会返回空数组，不会抛出异常，确保不影响其他流程
 */
export async function searchConfluence(
  query: string,
  topk: number = 2
): Promise<ConfluenceSearchResult[]> {
  if (!query || !query.trim()) {
    return [];
  }

  const backendBaseUrl = getApiBaseUrl();
  
  if (!backendBaseUrl) {
    console.warn('后端URL未配置，无法搜索Confluence');
    return [];
  }

  try {
    // 通过后端API调用Confluence搜索工具
    const response = await fetch(`${backendBaseUrl}/api/tool/confluence-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        query: query,
        topk: topk
      }),
      // 设置超时，避免长时间等待
      signal: AbortSignal.timeout(10000) // 10秒超时
    });

    if (!response.ok) {
      console.warn(`Confluence搜索失败: ${response.status} ${response.statusText}`);
      // 返回空数组，不抛出异常
      return [];
    }

    const data = await response.json();
    
    // 处理返回结果
    if (data.status === 'error') {
      console.warn('Confluence搜索返回错误:', data.message);
      // 返回空数组，不抛出异常
      return [];
    }

    // 解析SeekDB返回的结果格式
    const results = data.results || [];
    if (Array.isArray(results) && results.length > 0) {
      return results.slice(0, topk).map((item: any) => {
        // SeekDB返回格式: { id, metadata: { title, content, ... }, distance }
        const metadata = item.metadata || {};
        return {
          id: item.id || '',
          title: metadata.title || metadata.name || '无标题',
          content: metadata.content || metadata.text || '',
          metadata: metadata,
          distance: item.distance
        };
      });
    }

    // 如果没有结果，返回空数组（不抛出异常）
    return [];
  } catch (error: any) {
    // 捕获所有错误（网络错误、超时、解析错误等），返回空数组
    console.warn('Confluence搜索失败（不影响其他流程）:', error?.message || error);
    // 不抛出异常，返回空数组，确保不影响模板匹配等其他流程
    return [];
  }
}

/**
 * 获取Confluence完整内容
 */
export async function getConfluenceFullText(articleId: string): Promise<ConfluenceSearchResult | null> {
  if (!articleId) {
    return null;
  }

  const backendBaseUrl = getApiBaseUrl();
  
  if (!backendBaseUrl) {
    console.warn('后端URL未配置，无法获取Confluence完整内容');
    return null;
  }

  try {
    const response = await fetch(`${backendBaseUrl}/api/tool/confluence-fulltext`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        id: articleId
      })
    });

    if (!response.ok) {
      console.warn(`获取Confluence完整内容失败: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.status === 'error') {
      console.warn('获取Confluence完整内容返回错误:', data.message);
      return null;
    }

    // 解析返回结果
    const result = data.result || data;
    if (result && result.id) {
      const metadata = result.metadata || {};
      return {
        id: result.id,
        title: metadata.title || metadata.name || '无标题',
        content: metadata.content || metadata.text || result.content || '',
        metadata: metadata
      };
    }

    return null;
  } catch (error) {
    console.error('获取Confluence完整内容失败:', error);
    return null;
  }
}

/**
 * 推荐相关模板
 */
export async function recommendTemplates(
  optimizedQuestion: string,
  availableTemplates: Array<{ id: string; name: string; description?: string; domainName?: string }>
): Promise<string[]> {
  if (availableTemplates.length === 0) {
    return [];
  }

  if (!optimizedQuestion || !optimizedQuestion.trim()) {
    return [];
  }

  const templateList = availableTemplates.map(t => 
    `- ID: ${t.id}, 名称: ${t.name}, 领域: ${t.domainName || '通用'}, 描述: ${t.description || '无'}`
  ).join('\n');

  const prompt = `你是一个模板推荐助手。根据用户的问题，从以下模板列表中选择最相关的模板（可以多选，用逗号分隔模板ID）。

可用模板列表：
${templateList}

用户问题：
${optimizedQuestion}

请分析问题类型和需求，推荐最相关的模板ID（只输出模板ID，多个用逗号分隔，如：template1,template2，如果没有合适的模板则输出"无"）：`;

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    const backendBaseUrl = getApiBaseUrl();
    
    // 如果配置了后端URL，使用后端代理API
    if (backendBaseUrl) {
      try {
        const response = await fetch(`${backendBaseUrl}/api/optimize/recommend-templates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            question: optimizedQuestion,
            templates: availableTemplates
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.templateIds) {
            return Array.isArray(data.templateIds) ? data.templateIds : [];
          }
        }
      } catch (error) {
        console.warn('后端代理API调用失败，尝试直接调用LLM:', error);
      }
    }

    // 直接调用LLM API
    const result = await callLLM(messages);
    const templateIds = result.trim().replace(/^推荐的模板[：:]\s*/i, '');
    
    if (templateIds === '无' || !templateIds || templateIds.toLowerCase() === 'none') {
      return [];
    }

    // 解析模板ID列表
    const ids = templateIds.split(',').map(id => id.trim()).filter(id => id);
    // 验证模板ID是否有效
    const validIds = ids.filter(id => 
      availableTemplates.some(t => t.id === id)
    );
    
    return validIds;
  } catch (error) {
    console.error('推荐模板失败:', error);
    return [];
  }
}

