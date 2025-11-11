/**
 * 设置模态框组件
 * 提供自定义Prompt等功能
 */

import React, { useEffect, useState } from 'react';
import { Modal, Tabs, Form, Input, Switch, Button, message, Space, Select, Card, Table, Tag, Popconfirm, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useConfig } from '@/contexts';
import PromptDebugger from '@/components/PromptDebugger';
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
  const [customPromptModalVisible, setCustomPromptModalVisible] = useState(false);
  const [editingCustomPrompt, setEditingCustomPrompt] = useState<any>(null);
  const [customPromptForm] = Form.useForm();
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm] = Form.useForm();

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

  // 自定义Prompt管理
  const handleAddCustomPrompt = () => {
    setEditingCustomPrompt(null);
    customPromptForm.resetFields();
    customPromptForm.setFieldsValue({
      category: 'system',
      enabled: true
    });
    setCustomPromptModalVisible(true);
  };

  const handleEditCustomPrompt = (prompt: any) => {
    setEditingCustomPrompt(prompt);
    customPromptForm.setFieldsValue(prompt);
    setCustomPromptModalVisible(true);
  };

  const handleDeleteCustomPrompt = (id: string) => {
    const newConfig = {
      ...config,
      prompts: {
        ...config.prompts,
        customPrompts: config.prompts.customPrompts.filter((p: any) => p.id !== id)
      }
    };
    updateConfig(newConfig);
    message.success('自定义Prompt已删除');
  };

  const handleSaveCustomPrompt = () => {
    customPromptForm.validateFields().then((values: any) => {
      const newConfig = { ...config };
      const customPrompts = [...(config.prompts.customPrompts || [])];

      if (editingCustomPrompt) {
        const index = customPrompts.findIndex((p: any) => p.id === editingCustomPrompt.id);
        if (index >= 0) {
          customPrompts[index] = { ...editingCustomPrompt, ...values };
        }
      } else {
        const newPrompt = {
          id: `custom_${Date.now()}`,
          ...values
        };
        customPrompts.push(newPrompt);
      }

      newConfig.prompts = {
        ...newConfig.prompts,
        customPrompts
      };

      updateConfig(newConfig);
      setCustomPromptModalVisible(false);
      customPromptForm.resetFields();
      setEditingCustomPrompt(null);
      message.success(editingCustomPrompt ? '自定义Prompt已更新' : '自定义Prompt已添加');
    });
  };

  const handleToggleCustomPrompt = (id: string) => {
    const newConfig = {
      ...config,
      prompts: {
        ...config.prompts,
        customPrompts: config.prompts.customPrompts.map((p: any) =>
          p.id === id ? { ...p, enabled: !p.enabled } : p
        )
      }
    };
    updateConfig(newConfig);
  };

  // 解决方案模板管理
  const handleAddTemplate = () => {
    setEditingTemplate(null);
    templateForm.resetFields();
    setTemplateModalVisible(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    templateForm.setFieldsValue({
      ...template,
      tags: Array.isArray(template.tags) ? template.tags.join(', ') : template.tags
    });
    setTemplateModalVisible(true);
  };

  const handleDeleteTemplate = (id: string) => {
    const newConfig = {
      ...config,
      prompts: {
        ...config.prompts,
        solutionTemplates: config.prompts.solutionTemplates.filter((t: any) => t.id !== id)
      }
    };
    updateConfig(newConfig);
    message.success('解决方案模板已删除');
  };

  const handleSaveTemplate = () => {
    templateForm.validateFields().then((values: any) => {
      const newConfig = { ...config };
      const templates = [...(config.prompts.solutionTemplates || [])];

      // 处理tags：如果是字符串则转换为数组
      const tagsArray = typeof values.tags === 'string'
        ? values.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
        : (Array.isArray(values.tags) ? values.tags : []);

      if (editingTemplate) {
        const index = templates.findIndex((t: any) => t.id === editingTemplate.id);
        if (index >= 0) {
          templates[index] = { ...editingTemplate, ...values, tags: tagsArray };
        }
      } else {
        const newTemplate = {
          id: `template_${Date.now()}`,
          ...values,
          tags: tagsArray
        };
        templates.push(newTemplate);
      }

      newConfig.prompts = {
        ...newConfig.prompts,
        solutionTemplates: templates
      };

      updateConfig(newConfig);
      setTemplateModalVisible(false);
      templateForm.resetFields();
      setEditingTemplate(null);
      message.success(editingTemplate ? '解决方案模板已更新' : '解决方案模板已添加');
    });
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
          defaultActiveKey="prompts"
          className="settings-tabs"
          items={[
            {
              key: 'prompts',
              label: '自定义Prompt',
              children: (
                <div className="space-y-4">
                  <Form form={form} layout="vertical" initialValues={config}>
                    <PromptDebugger />

                    <Card title="系统级Prompt追加" size="small">
                      <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-gray-600">
                        💡 提示：这里输入的内容会追加到系统原始Prompt之后，不会替换原有的系统Prompt。可以输入额外的指令或规则来扩展系统行为。
                      </div>
                      <Form.Item label="系统级Prompt追加内容" name={['prompts', 'systemPrompt']}>
                        <TextArea
                          rows={6}
                          placeholder="请输入要追加到系统Prompt的内容..."
                        />
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
                    </Card>
                  </Form>

                  <Card
                    title="自定义Prompt列表（追加模式）"
                    size="small"
                    extra={
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddCustomPrompt}
                        size="small"
                      >
                        添加
                      </Button>
                    }
                  >
                    <div className="mb-4 p-2 bg-gray-50 rounded text-xs text-gray-500">
                      💡 这些Prompt会追加到对应级别的原始Prompt之后，不会替换原有内容
                    </div>
                    <Table
                      size="small"
                      dataSource={config.prompts?.customPrompts || []}
                      rowKey="id"
                      pagination={false}
                      columns={[
                        {
                          title: '名称',
                          dataIndex: 'name',
                          key: 'name',
                        },
                        {
                          title: '类型',
                          dataIndex: 'category',
                          key: 'category',
                          render: (category: string) => {
                            const colors: Record<string, string> = {
                              system: 'blue',
                              task: 'green',
                              summary: 'orange',
                              custom: 'purple'
                            };
                            const names: Record<string, string> = {
                              system: '系统级',
                              task: '任务级',
                              summary: '总结级',
                              custom: '用户级'
                            };
                            return <Tag color={colors[category]}>{names[category] || category}</Tag>;
                          }
                        },
                        {
                          title: '启用',
                          dataIndex: 'enabled',
                          key: 'enabled',
                          render: (enabled: boolean, record: any) => (
                            <Switch
                              checked={enabled}
                              onChange={() => handleToggleCustomPrompt(record.id)}
                              size="small"
                            />
                          )
                        },
                        {
                          title: '操作',
                          key: 'actions',
                          render: (_: any, record: any) => (
                            <Space size="small">
                              <Button
                                type="text"
                                icon={<EditOutlined />}
                                onClick={() => handleEditCustomPrompt(record)}
                                size="small"
                              />
                              <Popconfirm
                                title="确定要删除这个Prompt吗？"
                                onConfirm={() => handleDeleteCustomPrompt(record.id)}
                                okText="确定"
                                cancelText="取消"
                              >
                                <Button
                                  type="text"
                                  danger
                                  icon={<DeleteOutlined />}
                                  size="small"
                                />
                              </Popconfirm>
                            </Space>
                          )
                        }
                      ]}
                    />
                  </Card>

                  <Card
                    title="解决方案模板"
                    size="small"
                    extra={
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddTemplate}
                        size="small"
                      >
                        添加
                      </Button>
                    }
                  >
                    <Table
                      size="small"
                      dataSource={config.prompts?.solutionTemplates || []}
                      rowKey="id"
                      pagination={false}
                      columns={[
                        {
                          title: '名称',
                          dataIndex: 'name',
                          key: 'name',
                        },
                        {
                          title: '描述',
                          dataIndex: 'description',
                          key: 'description',
                        },
                        {
                          title: '标签',
                          dataIndex: 'tags',
                          key: 'tags',
                          render: (tags: string[]) => (
                            <Space size="small">
                              {tags?.map((tag, index) => (
                                <Tag key={index}>{tag}</Tag>
                              ))}
                            </Space>
                          )
                        },
                        {
                          title: '操作',
                          key: 'actions',
                          render: (_: any, record: any) => (
                            <Space size="small">
                              <Button
                                type="text"
                                icon={<EditOutlined />}
                                onClick={() => handleEditTemplate(record)}
                                size="small"
                              />
                              <Popconfirm
                                title="确定要删除这个模板吗？"
                                onConfirm={() => handleDeleteTemplate(record.id)}
                                okText="确定"
                                cancelText="取消"
                              >
                                <Button
                                  type="text"
                                  danger
                                  icon={<DeleteOutlined />}
                                  size="small"
                                />
                              </Popconfirm>
                            </Space>
                          )
                        }
                      ]}
                    />
                  </Card>
                </div>
              )
            },
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

      {/* 自定义Prompt编辑模态框 */}
      <Modal
        title={editingCustomPrompt ? '编辑自定义Prompt' : '添加自定义Prompt'}
        open={customPromptModalVisible}
        onCancel={() => {
          setCustomPromptModalVisible(false);
          customPromptForm.resetFields();
          setEditingCustomPrompt(null);
        }}
        onOk={handleSaveCustomPrompt}
        width={700}
      >
        <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-gray-600">
          💡 提示：这里输入的内容会追加到对应级别的原始Prompt之后，不会替换原有内容。
        </div>
        <Form
          form={customPromptForm}
          layout="vertical"
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入Prompt名称' }]}
          >
            <Input placeholder="请输入Prompt名称" />
          </Form.Item>

          <Form.Item
            label="类型"
            name="category"
            rules={[{ required: true, message: '请选择Prompt类型' }]}
          >
            <Select>
              <Option value="system">系统级（追加到系统Prompt）</Option>
              <Option value="task">任务级（追加到任务执行Prompt）</Option>
              <Option value="summary">总结级（追加到总结Prompt）</Option>
              <Option value="custom">用户级（追加到用户输入）</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="追加内容"
            name="content"
            rules={[{ required: true, message: '请输入Prompt内容' }]}
          >
            <TextArea
              rows={8}
              placeholder="请输入要追加的Prompt内容..."
            />
          </Form.Item>

          <Form.Item
            label="启用"
            name="enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 解决方案模板编辑模态框 */}
      <Modal
        title={editingTemplate ? '编辑解决方案模板' : '添加解决方案模板'}
        open={templateModalVisible}
        onCancel={() => {
          setTemplateModalVisible(false);
          templateForm.resetFields();
          setEditingTemplate(null);
        }}
        onOk={handleSaveTemplate}
        width={700}
      >
        <Form
          form={templateForm}
          layout="vertical"
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ required: true, message: '请输入模板描述' }]}
          >
            <Input placeholder="请输入模板描述" />
          </Form.Item>

          <Form.Item
            label="模板内容"
            name="template"
            rules={[{ required: true, message: '请输入模板内容' }]}
          >
            <TextArea
              rows={8}
              placeholder="请输入模板内容..."
            />
          </Form.Item>

          <Form.Item
            label="标签（用逗号分隔）"
            name="tags"
            getValueFromEvent={(e) => e.target.value}
            normalize={(value) => {
              if (Array.isArray(value)) {
                return value.join(', ');
              }
              return value;
            }}
          >
            <Input placeholder="例如: 数据分析, 报告生成" />
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
};

export default SettingsModal;