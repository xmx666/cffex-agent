/**
 * 用户标识显示组件
 * 显示用户ID、会话数量等信息，提供数据管理功能
 */

import React, { useState, useEffect } from 'react';
import { Avatar, Tooltip, Dropdown, Button, message, Modal } from 'antd';
import { BrowserFingerprint } from '@/utils/browserFingerprint';
import { SimpleHistoryManager } from '@/utils/historyManager';
import { SimpleConfigManager } from '@/utils/configManager';

interface UserInfo {
  userId: string;
  sessionCount: number;
  lastActive: Date;
}

const UserIdentity: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    const fingerprint = BrowserFingerprint.getInstance();
    const historyManager = new SimpleHistoryManager();
    
    const userId = fingerprint.getUserId();
    const sessions = historyManager.getSessions();
    const lastActive = sessions.length > 0 ? new Date(sessions[0].updatedAt) : new Date();
    
    setUserInfo({
      userId: userId.substring(0, 8) + '...', // 只显示前8位
      sessionCount: sessions.length,
      lastActive
    });
  }, []);

  const handleClearData = () => {
    Modal.confirm({
      title: '确认清空数据',
      content: '确定要清空所有历史记录和配置吗？此操作不可恢复。',
      onOk: () => {
        const historyManager = new SimpleHistoryManager();
        const configManager = new SimpleConfigManager();
        
        historyManager.clearAllHistory();
        // 清空配置（保留基本配置）
        configManager.removeConfig('mcp');
        configManager.removeConfig('prompts');
        
        message.success('数据已清空');
        window.location.reload();
      }
    });
  };

  const handleExportData = () => {
    const historyManager = new SimpleHistoryManager();
    const configManager = new SimpleConfigManager();
    
    const data = {
      history: historyManager.exportUserData(),
      config: configManager.exportConfigs(),
      exportTime: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genie-data-${userInfo?.userId}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            const historyManager = new SimpleHistoryManager();
            const configManager = new SimpleConfigManager();
            
            if (data.history) {
              historyManager.importUserData(data.history);
            }
            if (data.config) {
              configManager.importConfigs(data.config);
            }
            
            message.success('导入成功');
            window.location.reload();
          } catch (error) {
            message.error('导入失败，文件格式不正确');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  if (!userInfo) return null;

  const menuItems = [
    {
      key: 'export',
      label: '导出数据',
      icon: <i className="font_family icon-daochu"></i>,
      onClick: handleExportData
    },
    {
      key: 'import',
      label: '导入数据',
      icon: <i className="font_family icon-daoru"></i>,
      onClick: handleImportData
    },
    {
      type: 'divider' as const
    },
    {
      key: 'clear',
      label: '清空数据',
      icon: <i className="font_family icon-qingkong"></i>,
      onClick: handleClearData,
      danger: true
    }
  ];

  return (
    <div className="user-identity flex items-center space-x-8">
      <Tooltip 
        title={`用户ID: ${userInfo.userId}\n会话数: ${userInfo.sessionCount}\n最后活跃: ${userInfo.lastActive.toLocaleString()}`}
      >
        <div className="user-info flex items-center space-x-8">
          <Avatar size="small" style={{ backgroundColor: '#4040ff' }}>
            {userInfo.userId[0].toUpperCase()}
          </Avatar>
          <span className="user-id text-[12px] text-gray-600">{userInfo.userId}</span>
          <span className="session-count text-[12px] text-gray-400">({userInfo.sessionCount})</span>
        </div>
      </Tooltip>
      
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        placement="bottomRight"
      >
        <Button type="text" size="small" className="text-gray-500">
          <i className="font_family icon-more"></i>
        </Button>
      </Dropdown>
    </div>
  );
};

export default UserIdentity;
