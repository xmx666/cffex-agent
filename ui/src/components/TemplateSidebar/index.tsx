/**
 * 模板设置侧边栏组件
 * 提供模板管理和多选功能
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Drawer, 
  Input, 
  Button, 
  Card, 
  Tag, 
  message, 
  Space,
  Tooltip,
  Empty,
  Modal,
  Form,
  Select,
  Checkbox,
  Popconfirm,
  Divider,
  Spin
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { globalTemplateManager, TemplateConfig, Template, Domain } from '@/utils/templateManager';

const { Option } = Select;
const { TextArea } = Input;

interface TemplateSidebarProps {
  visible: boolean;
  onClose: () => void;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  content: string;
  domainId: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Domain {
  id: string;
  name: string;
  description?: string;
}

const TemplateSidebar: React.FC<TemplateSidebarProps> = ({
  visible,
  onClose
}) => {
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>({
    domains: [],
    templateList: []
  });
  const [loading, setLoading] = useState(false);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('default');
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [domainModalVisible, setDomainModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm] = Form.useForm();
  const [domainForm] = Form.useForm();

  // 当侧边栏打开时，从后端加载配置
  useEffect(() => {
    if (visible) {
      loadTemplateConfig();
      // 加载用户选择的模板
      setSelectedTemplateIds(globalTemplateManager.getUserSelectedTemplateIds());
    }
  }, [visible]);

  // 加载模板配置
  const loadTemplateConfig = async () => {
    setLoading(true);
    try {
      const config = await globalTemplateManager.getTemplateConfig();
      setTemplateConfig(config);
    } catch (error) {
      message.error('加载模板配置失败');
      console.error('加载模板配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const domains = useMemo(() => templateConfig.domains || [], [templateConfig]);
  const templates = useMemo(() => templateConfig.templateList || [], [templateConfig]);
  // 使用用户级别的模板选择
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(() =>
    globalTemplateManager.getUserSelectedTemplateIds()
  );

  // 当前领域下的模板
  const currentDomainTemplates = useMemo(() => {
    return templates.filter(t => t.domainId === selectedDomainId);
  }, [templates, selectedDomainId]);

  // 处理模板选择/取消选择（用户级别）
  const handleToggleTemplate = (templateId: string) => {
    const currentSelected = [...selectedTemplateIds];
    let newSelected: string[];

    if (currentSelected.includes(templateId)) {
      // 取消选择
      newSelected = currentSelected.filter(id => id !== templateId);
    } else {
      // 选择
      newSelected = [...currentSelected, templateId];
    }

    // 保存到用户级别的存储
    globalTemplateManager.setUserSelectedTemplateIds(newSelected);
    setSelectedTemplateIds(newSelected);
  };

  // 打开添加模板模态框
  const handleAddTemplate = () => {
    setEditingTemplate(null);
    templateForm.resetFields();
    templateForm.setFieldsValue({
      domainId: selectedDomainId,
      enabled: true
    });
    setTemplateModalVisible(true);
  };

  // 打开编辑模板模态框
  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    templateForm.setFieldsValue(template);
    setTemplateModalVisible(true);
  };

  // 保存模板
  const handleSaveTemplate = async () => {
    try {
      await templateForm.validateFields();
      const values = templateForm.getFieldsValue();

      const templateList = [...templates];
      const now = Date.now();

      if (editingTemplate) {
        // 更新模板
        const index = templateList.findIndex(t => t.id === editingTemplate.id);
        if (index >= 0) {
          templateList[index] = {
            ...editingTemplate,
            ...values,
            updatedAt: now
          };
        }
      } else {
        // 添加新模板
        const newTemplate: Template = {
          id: `template_${now}`,
          ...values,
          enabled: true,
          createdAt: now,
          updatedAt: now
        };
        templateList.push(newTemplate);
      }

      await globalTemplateManager.updateTemplateList(templateList);
      const newConfig = { ...templateConfig, templateList };
      setTemplateConfig(newConfig);
      setTemplateModalVisible(false);
      templateForm.resetFields();
      setEditingTemplate(null);
      message.success(editingTemplate ? '模板已更新' : '模板已添加');
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error('保存模板失败');
      console.error('保存模板失败:', error);
    }
  };

  // 删除模板
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const templateList = templates.filter(t => t.id !== templateId);
      const newSelectedTemplateIds = selectedTemplateIds.filter(id => id !== templateId);

      await globalTemplateManager.updateTemplateList(templateList);
      // 更新用户级别的选择
      globalTemplateManager.setUserSelectedTemplateIds(newSelectedTemplateIds);
      setSelectedTemplateIds(newSelectedTemplateIds);

      const newConfig = {
        ...templateConfig,
        templateList
      };

      setTemplateConfig(newConfig);
      message.success('模板已删除');
    } catch (error) {
      message.error('删除模板失败');
      console.error('删除模板失败:', error);
    }
  };

  // 打开添加领域模态框
  const handleAddDomain = () => {
    domainForm.resetFields();
    setDomainModalVisible(true);
  };

  // 保存领域
  const handleSaveDomain = async () => {
    try {
      await domainForm.validateFields();
      const values = domainForm.getFieldsValue();

      const newDomains = [...domains];

      const newDomain: Domain = {
        id: `domain_${Date.now()}`,
        ...values
      };
      newDomains.push(newDomain);

      await globalTemplateManager.updateDomains(newDomains);
      const newConfig = { ...templateConfig, domains: newDomains };
      setTemplateConfig(newConfig);
      setDomainModalVisible(false);
      domainForm.resetFields();
      message.success('领域已添加');
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error('保存领域失败');
      console.error('保存领域失败:', error);
    }
  };

  // 删除领域
  const handleDeleteDomain = async (domainId: string) => {
    // 检查是否有模板使用该领域
    const hasTemplates = templates.some(t => t.domainId === domainId);
    if (hasTemplates) {
      message.warning('该领域下还有模板，请先删除所有模板');
      return;
    }

    // 不能删除默认领域
    if (domainId === 'default') {
      message.warning('不能删除默认领域');
      return;
    }

    try {
      const newDomains = domains.filter(d => d.id !== domainId);
      await globalTemplateManager.updateDomains(newDomains);

      const newConfig = { ...templateConfig, domains: newDomains };
      setTemplateConfig(newConfig);

      // 如果删除的是当前选中的领域，切换到默认领域
      if (selectedDomainId === domainId) {
        setSelectedDomainId('default');
      }

      message.success('领域已删除');
    } catch (error) {
      message.error('删除领域失败');
      console.error('删除领域失败:', error);
    }
  };

  return (
    <>
      <Drawer
        title="模板设置"
        placement="right"
        width={600}
        open={visible}
        onClose={onClose}
        className="template-sidebar"
      >
        {loading && (
          <div className="mb-16 text-center">
            <Spin />
            <div className="text-[12px] text-gray-500 mt-4">加载模板配置中...</div>
          </div>
        )}
        <div className="template-sidebar-content">
          {/* 领域选择 */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div className="text-[14px] font-medium text-gray-700">选择领域</div>
              <Button 
                type="primary" 
                size="small" 
                icon={<PlusOutlined />}
                onClick={handleAddDomain}
              >
                添加领域
              </Button>
            </div>
            <div className="flex flex-wrap gap-8">
              {domains.map(domain => (
                <div key={domain.id} className="relative group">
                  <Tag
                    color={selectedDomainId === domain.id ? 'blue' : 'default'}
                    className="cursor-pointer px-12 py-4 text-[13px]"
                    onClick={() => setSelectedDomainId(domain.id)}
                  >
                    {domain.name}
                  </Tag>
                  {domain.id !== 'default' && (
                    <Popconfirm
                      title="确定要删除这个领域吗？"
                      onConfirm={() => handleDeleteDomain(domain.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 h-16 w-16 p-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Divider />

          {/* 模板列表 */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div className="text-[14px] font-medium text-gray-700">
                {domains.find(d => d.id === selectedDomainId)?.name || '通用'} 模板
              </div>
              <Button 
                type="primary" 
                size="small" 
                icon={<PlusOutlined />}
                onClick={handleAddTemplate}
              >
                添加模板
              </Button>
            </div>
            
            {currentDomainTemplates.length === 0 ? (
              <Empty 
                description="该领域下暂无模板" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                className="py-40"
              />
            ) : (
              <div className="space-y-8">
                {currentDomainTemplates.map(template => {
                  const isSelected = selectedTemplateIds.includes(template.id);
                  return (
                    <Card 
                      key={template.id} 
                      size="small"
                      className={`template-card cursor-pointer transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => handleToggleTemplate(template.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-8 mb-4">
                            <Checkbox 
                              checked={isSelected}
                              onChange={() => handleToggleTemplate(template.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="font-medium text-[14px] text-gray-800">
                              {template.name}
                            </div>
                            {isSelected && (
                              <Tag color="blue" size="small">已选择</Tag>
                            )}
                          </div>
                          {template.description && (
                            <div className="text-[12px] text-gray-500 mb-8">
                              {template.description}
                            </div>
                          )}
                          <div className="text-[12px] text-gray-400 line-clamp-2">
                            {template.content}
                          </div>
                        </div>
                        <div className="flex gap-4 ml-8" onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="编辑">
                            <Button 
                              type="text" 
                              size="small" 
                              icon={<EditOutlined />}
                              onClick={() => handleEditTemplate(template)}
                            />
                          </Tooltip>
                          <Popconfirm
                            title="确定要删除这个模板吗？"
                            onConfirm={() => handleDeleteTemplate(template.id)}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Tooltip title="删除">
                              <Button 
                                type="text" 
                                size="small" 
                                danger
                                icon={<DeleteOutlined />}
                              />
                            </Tooltip>
                          </Popconfirm>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 已选择的模板提示 */}
          {selectedTemplateIds.length > 0 && (
            <div className="mt-16 pt-16 border-t border-gray-200">
              <div className="text-[12px] text-gray-500 mb-8">
                已选择 {selectedTemplateIds.length} 个模板
              </div>
              <div className="flex flex-wrap gap-4">
                {selectedTemplateIds.map(id => {
                  const template = templates.find(t => t.id === id);
                  if (!template) return null;
                  return (
                    <Tag 
                      key={id} 
                      color="blue" 
                      closable
                      onClose={() => handleToggleTemplate(id)}
                    >
                      {template.name}
                    </Tag>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Drawer>

      {/* 模板编辑模态框 */}
      <Modal
        title={editingTemplate ? '编辑模板' : '添加模板'}
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
            label="模板名称"
            name="name"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>

          <Form.Item
            label="模板描述（可选）"
            name="description"
          >
            <Input placeholder="简要描述模板用途" />
          </Form.Item>

          <Form.Item
            label="所属领域"
            name="domainId"
            rules={[{ required: true, message: '请选择所属领域' }]}
          >
            <Select placeholder="请选择所属领域">
              {domains.map(domain => (
                <Option key={domain.id} value={domain.id}>
                  {domain.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="模板内容"
            name="content"
            rules={[{ required: true, message: '请输入模板内容' }]}
          >
            <TextArea
              rows={8}
              placeholder="请输入模板内容，这些内容会追加到用户输入中..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 领域编辑模态框 */}
      <Modal
        title="添加领域"
        open={domainModalVisible}
        onCancel={() => {
          setDomainModalVisible(false);
          domainForm.resetFields();
        }}
        onOk={handleSaveDomain}
        width={500}
      >
        <Form
          form={domainForm}
          layout="vertical"
        >
          <Form.Item
            label="领域名称"
            name="name"
            rules={[{ required: true, message: '请输入领域名称' }]}
          >
            <Input placeholder="例如：数据分析、内容创作等" />
          </Form.Item>

          <Form.Item
            label="领域描述（可选）"
            name="description"
          >
            <TextArea
              rows={3}
              placeholder="简要描述该领域的用途"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TemplateSidebar;

