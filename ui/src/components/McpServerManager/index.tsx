/**
 * MCP服务器管理组件
 * 提供MCP服务器的增删改查和状态管理功能
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Switch, 
  message, 
  Space, 
  Tag, 
  Popconfirm,
  Tooltip,
  Badge,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  PlayCircleOutlined, 
  StopOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { useConfig } from '@/contexts/ConfigContext';

const { TextArea } = Input;

interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  status: 'connected' | 'error' | 'unknown';
  toolCount: number;
}

interface McpServerManagerProps {
  onConfigChange?: () => void;
}

const McpServerManager: React.FC<McpServerManagerProps> = ({ onConfigChange }) => {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServerConfig | null>(null);
  const [form] = Form.useForm();
  const { config } = useConfig();

  // 获取API基础URL（优先使用打包注入的常量，其次使用window，再退回为空走代理）
  const getApiBaseUrl = () => {
    // @ts-ignore 打包注入的全局常量
    const injected = typeof SERVICE_BASE_URL !== 'undefined' ? SERVICE_BASE_URL : '';
    const winVal = (window as any).SERVICE_BASE_URL || '';
    return injected || winVal || '';
  };

  // 统一的API请求方法
  const apiRequest = async (path: string, options: RequestInit = {}) => {
    const baseUrl = getApiBaseUrl();
    // 当未配置后端BaseUrl时，使用Vite代理：直接使用路径（/admin会被代理）
    const url = baseUrl ? `${baseUrl}${path}` : path;

    try {
      const response = await fetch(url, options);

      // 检查响应是否是HTML（404错误）
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || contentType.indexOf('application/json') === -1) {
        console.error('Response is not JSON, status:', response.status);
        throw new Error('后端服务未启动或API路径不存在');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`API请求失败 (${path}):`, error);
      throw error;
    }
  };

  // 获取MCP服务器列表
  const fetchServers = async () => {
    setLoading(true);
    try {
      const result = await apiRequest('/admin/mcp/servers');
      if (result.status === 'success') {
        const apiServers: McpServerConfig[] = result.data || [];
        // 将application.yml中的默认服务器合并进来（避免重复）
        const defaultUrls: string[] = config?.mcp?.defaultServerUrls || [];
        const existingUrls = new Set(apiServers.map(s => s.url));
        const merged: McpServerConfig[] = [
          ...apiServers,
          ...defaultUrls
            .filter(u => !!u && !existingUrls.has(u))
            .map((u, idx) => ({
              id: `default_ui_${idx}`,
              name: `默认MCP服务器${idx + 1}`,
              url: u,
              description: '来自application.yml（只读）',
              enabled: true,
              createdAt: '',
              updatedAt: '',
              status: 'unknown',
              toolCount: 0
            }))
        ];
        setServers(merged);
      } else {
        message.error('获取MCP服务器列表失败: ' + result.message);
      }
    } catch (error) {
      // 后端不可用时，至少展示application.yml中的默认服务器
      const defaultUrls: string[] = config?.mcp?.defaultServerUrls || [];
      if (defaultUrls.length > 0) {
        const merged: McpServerConfig[] = defaultUrls.map((u, idx) => ({
          id: `default_ui_${idx}`,
          name: `默认MCP服务器${idx + 1}`,
          url: u,
          description: '来自application.yml（只读）',
          enabled: true,
          createdAt: '',
          updatedAt: '',
          status: 'unknown',
          toolCount: 0
        }));
        setServers(merged);
      } else {
        message.error('后端服务未启动或API路径不存在，请确保后端服务正在运行');
        console.error('Error fetching servers:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  // 测试服务器连接
  const testServer = async (id: string) => {
    try {
      const result = await apiRequest(`/admin/mcp/servers/${id}/test`, {
        method: 'POST'
      });
      if (result.status === 'success') {
        message.success('连接测试完成');
        fetchServers(); // 刷新列表
      } else {
        message.error('连接测试失败: ' + result.message);
      }
    } catch (error) {
      message.error('连接测试失败');
      console.error('Error testing server:', error);
    }
  };

  // 批量测试所有服务器
  const testAllServers = async () => {
    try {
      const result = await apiRequest('/admin/mcp/servers/test-all', {
        method: 'POST'
      });
      if (result.status === 'success') {
        message.success('所有服务器连接测试完成');
        fetchServers(); // 刷新列表
      } else {
        message.error('批量测试失败: ' + result.message);
      }
    } catch (error) {
      message.error('批量测试失败');
      console.error('Error testing all servers:', error);
    }
  };

  // 添加/更新服务器
  const handleSubmit = async (values: any) => {
    try {
      const url = editingServer ? `/admin/mcp/servers/${editingServer.id}` : '/admin/mcp/servers';
      const method = editingServer ? 'PUT' : 'POST';

      const result = await apiRequest(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (result.status === 'success') {
        message.success(editingServer ? '服务器更新成功' : '服务器添加成功');
        setModalVisible(false);
        form.resetFields();
        setEditingServer(null);
        fetchServers();
        onConfigChange?.();
      } else {
        message.error((editingServer ? '更新' : '添加') + '服务器失败: ' + result.message);
      }
    } catch (error) {
      message.error((editingServer ? '更新' : '添加') + '服务器失败');
      console.error('Error submitting server:', error);
    }
  };

  // 删除服务器
  const deleteServer = async (id: string) => {
    try {
      const result = await apiRequest(`/admin/mcp/servers/${id}`, {
        method: 'DELETE'
      });
      if (result.status === 'success') {
        message.success('服务器删除成功');
        fetchServers();
        onConfigChange?.();
      } else {
        message.error('删除服务器失败: ' + result.message);
      }
    } catch (error) {
      message.error('删除服务器失败');
      console.error('Error deleting server:', error);
    }
  };

  // 切换服务器状态
  const toggleServer = async (id: string, enabled: boolean) => {
    try {
      const result = await apiRequest(`/admin/mcp/servers/${id}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });
      if (result.status === 'success') {
        message.success(enabled ? '服务器已启用' : '服务器已禁用');
        fetchServers();
        onConfigChange?.();
      } else {
        message.error('切换服务器状态失败: ' + result.message);
      }
    } catch (error) {
      message.error('切换服务器状态失败');
      console.error('Error toggling server:', error);
    }
  };

  // 打开编辑模态框
  const openEditModal = (server: McpServerConfig) => {
    setEditingServer(server);
    form.setFieldsValue({
      name: server.name,
      url: server.url,
      description: server.description,
      enabled: server.enabled,
    });
    setModalVisible(true);
  };

  // 打开添加模态框
  const openAddModal = () => {
    setEditingServer(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setEditingServer(null);
    form.resetFields();
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'connected':
        return <Tag color="green" icon={<CheckCircleOutlined />}>已连接</Tag>;
      case 'error':
        return <Tag color="red" icon={<ExclamationCircleOutlined />}>连接失败</Tag>;
      default:
        return <Tag color="gray" icon={<QuestionCircleOutlined />}>未知</Tag>;
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '服务器名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: McpServerConfig) => {
        const isDefaultUi = record.id.startsWith('default_ui_');
        return (
          <div>
            <div className="font-medium flex items-center gap-2">
              {text}
              {isDefaultUi && (
                <Tag color="blue" size="small">application.yml</Tag>
              )}
              {record.id.startsWith('default_') && !isDefaultUi && (
                <Tag color="green" size="small">后端默认</Tag>
              )}
            </div>
            <div className="text-xs text-gray-500">{record.id}</div>
          </div>
        );
      },
    },
    {
      title: '地址',
      dataIndex: 'url',
      key: 'url',
      render: (text: string) => (
        <code className="bg-gray-100 px-2 py-1 rounded text-sm">{text}</code>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: McpServerConfig) => (
        <div className="space-y-1">
          {getStatusTag(status)}
          <div className="text-xs text-gray-500">
            工具数量: {record.toolCount}
          </div>
        </div>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: McpServerConfig) => (
        <Switch
          checked={enabled}
          onChange={(checked) => toggleServer(record.id, checked)}
          disabled={record.id.startsWith('default_') || record.id.startsWith('default_ui_')} // 默认服务器不能禁用
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: McpServerConfig) => {
        const isDefaultUi = record.id.startsWith('default_ui_');
        const isDefault = record.id.startsWith('default_');

        return (
          <Space size="small">
            {!isDefaultUi ? (
              <Tooltip title="测试连接">
                <Button
                  type="text"
                  icon={<PlayCircleOutlined />}
                  onClick={() => testServer(record.id)}
                  size="small"
                />
              </Tooltip>
            ) : (
              <Tooltip title="此服务器来自application.yml配置，不能通过API测试">
                <Button
                  type="text"
                  icon={<PlayCircleOutlined />}
                  disabled
                  size="small"
                />
              </Tooltip>
            )}

            {!isDefaultUi && !isDefault && (
              <Tooltip title="编辑">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openEditModal(record)}
                  size="small"
                />
              </Tooltip>
            )}

            {!isDefault && !isDefaultUi && (
              <Popconfirm
                title="确定要删除这个MCP服务器吗？"
                onConfirm={() => deleteServer(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="删除">
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  useEffect(() => {
    fetchServers();
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold">MCP服务器管理</h3>
            <p className="text-sm text-gray-500">
              管理MCP服务器配置，支持动态添加、删除和启用/禁用服务器
            </p>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={testAllServers}
              loading={loading}
            >
              测试所有连接
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openAddModal}
            >
              添加服务器
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={servers}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>

      <Modal
        title={editingServer ? '编辑MCP服务器' : '添加MCP服务器'}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="服务器名称"
            name="name"
            rules={[{ required: true, message: '请输入服务器名称' }]}
          >
            <Input placeholder="请输入服务器名称" />
          </Form.Item>

          <Form.Item
            label="服务器地址"
            name="url"
            rules={[
              { required: true, message: '请输入服务器地址' },
              { type: 'url', message: '请输入有效的URL地址' }
            ]}
          >
            <Input placeholder="http://example.com:3000/sse" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea
              rows={3}
              placeholder="请输入服务器描述（可选）"
            />
          </Form.Item>

          <Form.Item
            label="启用状态"
            name="enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={closeModal}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingServer ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default McpServerManager;
