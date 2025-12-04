/**
 * 全局模板管理器
 * 模板设置是全局功能，所有用户共享
 * 数据存储在后端服务器，通过API访问
 */

export interface Template {
  id: string;
  name: string;
  description?: string;
  content: string;
  domainId: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Domain {
  id: string;
  name: string;
  description?: string;
}

export interface TemplateConfig {
  domains: Domain[];
  templateList: Template[];
  // selectedTemplateIds 已移除，改为用户级别存储
}

const defaultTemplateConfig: TemplateConfig = {
  domains: [
    { id: 'default', name: '通用' },
    { id: 'data-analysis', name: '数据分析' },
    { id: 'content-creation', name: '内容创作' },
    { id: 'code-optimization', name: '代码优化' },
    { id: 'problem-solving', name: '问题解决' }
  ],
  templateList: []
};

// 用户级别的模板选择存储键
const USER_SELECTED_TEMPLATES_KEY = 'user_selected_template_ids';

/**
 * 获取API基础URL
 */
function getApiBaseUrl(): string {
  // @ts-ignore 打包注入的全局常量
  const injected = typeof SERVICE_BASE_URL !== 'undefined' ? SERVICE_BASE_URL : '';
  const winVal = (window as any).SERVICE_BASE_URL || '';
  return injected || winVal || '';
}

/**
 * 统一的API请求方法
 */
async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  // 当未配置后端BaseUrl时，使用Vite代理：直接使用路径（/api会被代理）
  const url = baseUrl ? `${baseUrl}${path}` : path;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    // 检查响应是否是JSON
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.indexOf('application/json') === -1) {
      console.error('Response is not JSON, status:', response.status);
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result.status === 'error') {
      throw new Error(result.message || 'API请求失败');
    }

    return result;
  } catch (error) {
    console.error(`API请求失败 (${path}):`, error);
    throw error;
  }
}

export class GlobalTemplateManager {
  /**
   * 获取全局模板配置（从后端API）
   */
  async getTemplateConfig(): Promise<TemplateConfig> {
    try {
      const result = await apiRequest<{ status: string; data: TemplateConfig }>('/api/templates/config', {
        method: 'GET'
      });

      if (result.status === 'success' && result.data) {
        // 确保所有字段不为null
        return {
          ...defaultTemplateConfig,
          ...result.data,
          domains: result.data.domains || defaultTemplateConfig.domains,
          templateList: result.data.templateList || []
        };
      }
    } catch (error) {
      console.warn('从后端获取模板配置失败，使用默认配置:', error);
    }

    // 降级：返回默认配置
    return { ...defaultTemplateConfig };
  }

  /**
   * 保存全局模板配置（保存到后端）
   */
  async saveTemplateConfig(config: TemplateConfig): Promise<void> {
    try {
      const result = await apiRequest<{ status: string; message?: string }>('/api/templates/config', {
        method: 'POST',
        body: JSON.stringify(config)
      });

      if (result.status === 'success') {
        return;
      }
      throw new Error(result.message || '保存失败');
    } catch (error) {
      console.error('保存模板配置到后端失败:', error);
      throw error;
    }
  }

  /**
   * 更新模板列表
   */
  async updateTemplateList(templateList: Template[]): Promise<void> {
    try {
      await apiRequest<{ status: string }>('/api/templates/list', {
        method: 'PUT',
        body: JSON.stringify(templateList)
      });
    } catch (error) {
      console.error('更新模板列表失败:', error);
      throw error;
    }
  }

  /**
   * 更新领域列表
   */
  async updateDomains(domains: Domain[]): Promise<void> {
    try {
      await apiRequest<{ status: string }>('/api/templates/domains', {
        method: 'PUT',
        body: JSON.stringify(domains)
      });
    } catch (error) {
      console.error('更新领域列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户选择的模板ID列表（用户级别存储）
   */
  getUserSelectedTemplateIds(): string[] {
    try {
      const data = localStorage.getItem(USER_SELECTED_TEMPLATES_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('读取用户选择的模板失败:', error);
    }
    return [];
  }

  /**
   * 更新用户选择的模板ID列表（用户级别存储）
   */
  setUserSelectedTemplateIds(selectedTemplateIds: string[]): void {
    try {
      localStorage.setItem(USER_SELECTED_TEMPLATES_KEY, JSON.stringify(selectedTemplateIds));
    } catch (error) {
      console.error('保存用户选择的模板失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户选择的模板内容
   */
  async getUserSelectedTemplateContents(): Promise<string> {
    const selectedIds = this.getUserSelectedTemplateIds();
    if (selectedIds.length === 0) {
      return '';
    }

    const config = await this.getTemplateConfig();
    const selectedTemplates = selectedIds
      .map(id => config.templateList.find(t => t.id === id))
      .filter(t => t && t.enabled) as Template[];

    return selectedTemplates.map(t => t.content).join('\n\n');
  }
}

// 导出单例实例
export const globalTemplateManager = new GlobalTemplateManager();

