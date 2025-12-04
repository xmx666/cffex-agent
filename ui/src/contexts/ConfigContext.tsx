/**
 * 配置上下文
 * 管理全局配置状态和应用
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SimpleConfigManager, AppConfig, defaultConfig } from '@/utils/configManager';

interface ConfigContextType {
  config: AppConfig;
  updateConfig: (newConfig: Partial<AppConfig>) => void;
  resetConfig: () => void;
  configManager: SimpleConfigManager;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [configManager] = useState(() => new SimpleConfigManager());

  // 初始化配置
  useEffect(() => {
    try {
      const savedConfig = configManager.getFullConfig();
      // 确保配置对象完整
      const completeConfig = {
        ...defaultConfig,
        ...savedConfig,
        prompts: {
          ...defaultConfig.prompts,
          ...(savedConfig.prompts || {})
        },
        mcp: {
          ...defaultConfig.mcp,
          ...(savedConfig.mcp || {})
        },
        templates: {
          ...defaultConfig.templates,
          ...(savedConfig.templates || {})
        }
      };
      setConfig(completeConfig);
      applyConfig(completeConfig);
    } catch (error) {
      console.error('配置加载失败，使用默认配置:', error);
      setConfig(defaultConfig);
      applyConfig(defaultConfig);
    }
  }, [configManager]);

  // 应用配置到DOM
  const applyConfig = (config: AppConfig) => {
    const root = document.documentElement;
    
    // 应用主题
    if (config.ui.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // 应用字号
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px'
    };
    root.style.fontSize = fontSizeMap[config.ui.fontSize] || '16px';
    
    // 应用侧边栏折叠状态
    if (config.ui.sidebarCollapsed) {
      root.classList.add('sidebar-collapsed');
    } else {
      root.classList.remove('sidebar-collapsed');
    }
  };

  // 更新配置
  const updateConfig = (newConfig: Partial<AppConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    configManager.saveFullConfig(updatedConfig);
    applyConfig(updatedConfig);
  };

  // 重置配置
  const resetConfig = () => {
    setConfig(defaultConfig);
    configManager.resetToDefault();
    applyConfig(defaultConfig);
  };

  const value: ConfigContextType = {
    config,
    updateConfig,
    resetConfig,
    configManager
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

// Hook to use config
export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
