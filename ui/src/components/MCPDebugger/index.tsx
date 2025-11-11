/**
 * MCP配置展示组件
 * 只显示从application.yml读取的MCP配置信息
 */

import React from 'react';
import { Card, Tag, Space, Badge } from 'antd';
import { useConfig } from '@/contexts/ConfigContext';

const MCPDebugger: React.FC = () => {
  const { config } = useConfig();

  // 从application.yml读取的MCP配置
  const defaultServerUrls = config.mcp.defaultServerUrls || [];
  const defaultClientUrls = config.mcp.defaultClientUrls || [];
  const timeout = config.mcp.timeout || 30000;
  const retryCount = config.mcp.retryCount || 3;

  // 调试信息
  console.log('🔧 MCP配置解析结果:', {
    defaultServerUrls,
    defaultClientUrls,
    serverCount: defaultServerUrls.length,
    clientCount: defaultClientUrls.length
  });

  return (
    <Card title="Application.yml MCP配置" size="small" className="mb-16">
      <div className="mb-8 p-8 bg-blue-50 rounded">
        <div className="text-[12px] text-gray-500">
          💡 显示从application.yml文件读取的MCP配置信息
        </div>
      </div>

      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <div className="flex items-center justify-between">
          <span className="font-semibold">配置状态:</span>
          <Badge
            status="success"
            text="已启用(yml配置)"
          />
        </div>

        <div className="mb-4">
          <span className="font-semibold">MCP服务器地址 ({(defaultServerUrls || []).length}个):</span>
          <div className="mt-2 space-y-2">
            {(defaultServerUrls || []).map((url, index) => (
              <div key={index} className="flex items-center justify-between">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1 mr-2">{url}</code>
                <Tag color="blue">服务器{index + 1}</Tag>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <span className="font-semibold">MCP客户端地址 ({(defaultClientUrls || []).length}个):</span>
          <div className="mt-2 space-y-2">
            {(defaultClientUrls || []).map((url, index) => (
              <div key={index} className="flex items-center justify-between">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1 mr-2">{url}</code>
                <Tag color="green">客户端{index + 1}</Tag>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold">超时时间:</span>
          <Tag color="blue">{timeout}ms</Tag>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold">重试次数:</span>
          <Tag color="green">{retryCount}次</Tag>
        </div>
      </Space>

      {/* 显示完整的MCP配置信息 */}
      <div className="mt-8">
        <div className="font-semibold mb-4">完整MCP配置信息:</div>
        <div className="p-4 bg-gray-50 rounded">
          <div className="text-[12px] space-y-2">
            <div><strong>服务器地址:</strong> {(defaultServerUrls || []).join(', ') || '未配置'}</div>
            <div><strong>客户端地址:</strong> {(defaultClientUrls || []).join(', ') || '未配置'}</div>
            <div><strong>超时时间:</strong> {timeout}ms</div>
            <div><strong>重试次数:</strong> {retryCount}次</div>
            <div><strong>自定义MCP:</strong> {config.mcp.enableCustomMCP ? '启用' : '禁用'}</div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MCPDebugger;