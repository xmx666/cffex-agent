/**
 * 设置模态框组件
 * 提供自定义Prompt等功能
 */

import React, { useEffect, useState } from 'react';
import { Modal, Tabs, Form, Input, Switch, Button, message, Space, Select, Card, Table, Tag, Popconfirm, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useConfig } from '@/contexts';
import MCPDebugger from '@/components/MCPDebugger';
import McpServerManager from '@/components/McpServerManager';

const { Option } = Select;
const { TextArea } = Input;

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { config, updateConfig, resetConfig } = useConfig();
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue(config);
  }, [config, form]);

  const handleSave = () => {
    form.validateFields().then((values: any) => {
      updateConfig(values);
      message.success('设置已保存');
    }).catch(() => {
      message.error('请检查输入内容');
    });
  };

  const handleReset = () => {
    resetConfig();
    form.setFieldsValue(config);
    message.success('已恢复默认设置');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const newConfig = JSON.parse(e.target?.result as string);
            updateConfig(newConfig);
            form.setFieldsValue(newConfig);
            message.success('配置已导入');
          } catch (error) {
            message.error('配置文件格式错误');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'genie-config.json';
    link.click();
    URL.revokeObjectURL(url);
    message.success('配置已导出');
  };


  return (
    <Modal
      title="设置"
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={null}
      className="settings-modal"
    >
      <div className="settings-container">
        <Tabs
          defaultActiveKey="mcp"
          className="settings-tabs"
          items={[
            {
              key: 'mcp',
              label: 'MCP配置',
              children: (
                <div className="space-y-4">
                  <MCPDebugger />
                  <McpServerManager onConfigChange={() => {
                    // 当MCP配置发生变化时，可以在这里处理
                    console.log('MCP配置已更新');
                  }} />
                </div>
              )
            },
            {
              key: 'ui',
              label: '界面设置',
              children: (
                <Form form={form} layout="vertical" initialValues={config}>
                  <Form.Item label="主题" name={['ui', 'theme']}>
                    <Select>
                      <Option value="light">浅色</Option>
                      <Option value="dark">深色</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="字体大小" name={['ui', 'fontSize']}>
                    <Select>
                      <Option value="small">小</Option>
                      <Option value="medium">中</Option>
                      <Option value="large">大</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="侧边栏折叠" name={['ui', 'sidebarCollapsed']} valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button type="primary" onClick={handleSave}>
                        保存
                      </Button>
                      <Button onClick={handleReset}>
                        恢复默认
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'import-export',
              label: '导入/导出',
              children: (
                <div className="space-y-4">
                  <Card title="配置管理" size="small">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button onClick={handleImport} block>
                        导入配置
                      </Button>
                      <Button onClick={handleExport} block>
                        导出配置
                      </Button>
                    </Space>
                  </Card>
                </div>
              )
            }
          ]}
        />
      </div>

    </Modal>
  );
};

export default SettingsModal;