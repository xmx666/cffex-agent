/**
 * 简化的配置管理器
 * 基于localStorage实现用户隔离的配置存储
 */

import { BrowserFingerprint } from './browserFingerprint';

// 配置类型定义
export interface AppConfig {
  // 界面配置
  ui: {
    theme: 'light' | 'dark';
    language: 'zh-CN' | 'en-US';
    fontSize: 'small' | 'medium' | 'large';
    sidebarCollapsed: boolean;
  };
  
  // 功能配置
  features: {
    autoSave: boolean;
    deepThinkDefault: boolean;
    outputStyleDefault: string;
    maxHistoryCount: number;
    enableNotifications: boolean;
  };
  
  // 模型配置
  model: {
    temperature: number;
    maxTokens: number;
    timeout: number;
    retryCount: number;
  };
  
  // 产品配置
  product: {
    defaultProductType: string;
    customPlaceholders: Record<string, string>;
  };

  // MCP服务器配置
  mcp: {
    // 默认MCP配置（从yml文件读取，支持多个地址）
    defaultServerUrls: string[];
    defaultClientUrls: string[];
    timeout: number;
    retryCount: number;
    enableCustomMCP: boolean;
  };

  // 自定义Prompt配置
  prompts: {
    systemPrompt: string;
    customPrompts: Array<{
      id: string;
      name: string;
      content: string;
      category: 'system' | 'task' | 'summary' | 'custom';
      enabled: boolean;
    }>;
    solutionTemplates: Array<{
      id: string;
      name: string;
      description: string;
      template: string;
      tags: string[];
    }>;
  };

  // 模板设置配置
  templates: {
    // 模板领域列表
    domains: Array<{
      id: string;
      name: string;
      description?: string;
    }>;
    // 模板列表
    templateList: Array<{
      id: string;
      name: string;
      description?: string;
      content: string;
      domainId: string;
      enabled: boolean;
      createdAt: number;
      updatedAt: number;
    }>;
    // 当前已选择的模板ID列表
    selectedTemplateIds: string[];
  };
}

// 默认配置
/**
 * 从application.yml读取MCP配置
 * 这里应该从后端API获取，暂时使用硬编码值
 */
function getMCPConfigFromYml() {
  // 从application.yml读取的配置
  // 注意：实际应该从后端API获取，这里使用硬编码值模拟
  const mcpServerUrl = "http://172.31.73.223:8000/sse,http://172.31.73.16:3000/sse/139ab39e-91ae-4cdf-bdaf-850e5019a640";
  const mcpClientUrl = "http://172.31.73.223:8188";

  // 解析逗号分隔的多个地址
  const serverUrls = mcpServerUrl.split(',').map(url => url.trim()).filter(url => url);
  const clientUrls = mcpClientUrl.split(',').map(url => url.trim()).filter(url => url);

  return {
    defaultServerUrls: serverUrls,
    defaultClientUrls: clientUrls,
  };
}

export const defaultConfig: AppConfig = {
  ui: {
    theme: 'light',
    language: 'zh-CN',
    fontSize: 'medium',
    sidebarCollapsed: false
  },
  features: {
    autoSave: true,
    deepThinkDefault: false,
    outputStyleDefault: 'html',
    maxHistoryCount: 100,
    enableNotifications: true
  },
  model: {
    temperature: 0.7,
    maxTokens: 100000,
    timeout: 30000,
    retryCount: 3
  },
  product: {
    defaultProductType: 'html',
    customPlaceholders: {}
  },
  mcp: {
    // 默认MCP配置（从yml文件读取，不可修改）
    ...getMCPConfigFromYml(),
    timeout: 30000,
    retryCount: 3,
    enableCustomMCP: false
  },
  prompts: {
    systemPrompt: '',
    customPrompts: [],
    solutionTemplates: []
  },
  templates: {
    domains: [
      { id: 'default', name: '通用' },
      { id: 'data-analysis', name: '数据分析' },
      { id: 'content-creation', name: '内容创作' },
      { id: 'code-optimization', name: '代码优化' },
      { id: 'problem-solving', name: '问题解决' }
    ],
    templateList: [],
    selectedTemplateIds: []
  }
};

export class SimpleConfigManager {
  private userId: string;
  private fingerprint: BrowserFingerprint;

  constructor() {
    this.fingerprint = BrowserFingerprint.getInstance();
    this.userId = this.fingerprint.getUserId();
  }

  /**
   * 获取用户专属的配置键
   */
  private getUserKey(key: string): string {
    return `${this.userId}_config_${key}`;
  }

  /**
   * 保存配置
   */
  saveConfig<T>(key: string, value: T): void {
    localStorage.setItem(this.getUserKey(key), JSON.stringify(value));
  }

  /**
   * 获取配置
   */
  getConfig<T>(key: string, defaultValue: T): T {
    const data = localStorage.getItem(this.getUserKey(key));
    return data ? JSON.parse(data) : defaultValue;
  }

  /**
   * 删除配置
   */
  removeConfig(key: string): void {
    localStorage.removeItem(this.getUserKey(key));
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): Record<string, any> {
    const configs: Record<string, any> = {};
    const prefix = this.getUserKey('');
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const configKey = key.replace(prefix, '');
        const value = localStorage.getItem(key);
        if (value) {
          configs[configKey] = JSON.parse(value);
        }
      }
    }
    
    return configs;
  }

  /**
   * 获取完整配置
   */
  getFullConfig(): AppConfig {
    const configs = this.getAllConfigs();
    return {
      ...defaultConfig,
      ...configs
    };
  }

  /**
   * 保存完整配置
   */
  saveFullConfig(config: AppConfig): void {
    Object.entries(config).forEach(([key, value]) => {
      this.saveConfig(key, value);
    });
  }

  /**
   * 导出配置
   */
  exportConfigs(): string {
    const configs = this.getAllConfigs();
    return JSON.stringify(configs, null, 2);
  }

  /**
   * 导入配置
   */
  importConfigs(jsonData: string): boolean {
    try {
      const configs = JSON.parse(jsonData);
      Object.entries(configs).forEach(([key, value]) => {
        this.saveConfig(key, value);
      });
      return true;
    } catch (error) {
      console.error('导入配置失败:', error);
      return false;
    }
  }

  /**
   * 重置配置为默认值
   */
  resetToDefault(): void {
    // 删除所有用户配置
    const prefix = this.getUserKey('');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  }

  /**
   * 获取用户ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * 测试MCP服务器连接
   */
  async testMCPConnection(serverUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
