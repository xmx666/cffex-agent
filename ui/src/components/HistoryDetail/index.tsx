/**
 * 历史记录详情页面组件
 * 展示历史会话的详细内容和生成的文件
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Tag,
  Space,
  Typography,
  Divider,
  message,
  Modal,
  Tooltip,
  List,
  Avatar,
  Collapse,
  Empty,
  Image
} from 'antd';
import { ChatSession, ChatMessage, ChatFile } from '@/utils/historyManager';
import { SimpleHistoryManager } from '@/utils/historyManager';
import { iconType } from '@/utils/constants';
import ReactJsonPretty from 'react-json-pretty';

const { Title, Paragraph } = Typography;
const { Panel } = Collapse;

interface HistoryDetailProps {
  session: ChatSession | null;
  visible: boolean;
  onClose: () => void;
  onContinueChat: (session: ChatSession) => void;
}

const HistoryDetail: React.FC<HistoryDetailProps> = ({
  session,
  visible,
  onClose,
  onContinueChat
}) => {
  const [sessionData, setSessionData] = useState<ChatSession | null>(null);
  const historyManager = new SimpleHistoryManager();

  console.log('HistoryDetail渲染 - session:', session);
  console.log('HistoryDetail渲染 - visible:', visible);

  useEffect(() => {
    if (session && visible) {
      console.log('设置sessionData:', session);
      setSessionData(session);
    }
  }, [session, visible]);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    return iconType[fileType.toLowerCase()] || iconType['txt'];
  };

  const handleFileDownload = (file: ChatFile) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.click();
  };

  const handleFilePreview = (file: ChatFile) => {
    if (file.type === 'image' || file.type.includes('image')) {
      // 图片预览
      Modal.info({
        title: file.name,
        content: <Image src={file.url} style={{ maxWidth: '100%' }} />,
        width: 600
      });
    } else {
      // 其他文件类型，直接下载
      handleFileDownload(file);
    }
  };

  const getProductTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'html': '网页模式',
      'docs': '文档模式',
      'ppt': 'PPT模式',
      'table': '表格模式'
    };
    return labels[type] || type;
  };

  const getProductTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'html': 'green',
      'docs': 'blue',
      'ppt': 'orange',
      'table': 'red'
    };
    return colors[type] || 'default';
  };

  const handleContinueChat = () => {
    if (sessionData) {
      onContinueChat(sessionData);
      onClose();
    }
  };

  const handleRename = () => {
    if (!sessionData) return;

    const newTitle = prompt('请输入新的标题:', sessionData.title);
    if (newTitle && newTitle.trim() && newTitle !== sessionData.title) {
      historyManager.renameSession(sessionData.id, newTitle.trim());
      setSessionData({ ...sessionData, title: newTitle.trim() });
      message.success('重命名成功');
    }
  };

  const handleDelete = () => {
    if (!sessionData) return;

    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个会话吗？此操作不可恢复。',
      onOk: () => {
        historyManager.deleteSession(sessionData.id);
        message.success('删除成功');
        onClose();
      }
    });
  };

  const handleExport = () => {
    if (!sessionData) return;

    const data = {
      session: sessionData,
      exportTime: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${sessionData.id}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  if (!sessionData) {
    console.log('sessionData为空，不渲染');
    return null;
  }

  console.log('渲染历史详情 - sessionData:', sessionData);

  return (
    <Modal
      title="会话详情"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
      className="history-detail-modal"
    >
      <div className="history-detail-content">
        {/* 会话头部信息 */}
        <div className="session-header mb-24">
          <div className="flex justify-between items-start mb-16">
            <Title level={4} className="mb-8">
              {sessionData.title}
            </Title>
            <Space>
              <Tooltip title="重命名">
                <Button
                  type="text"
                  icon={<i className="font_family icon-bianji"></i>}
                  onClick={handleRename}
                />
              </Tooltip>
              <Tooltip title="导出">
                <Button
                  type="text"
                  icon={<i className="font_family icon-daochu"></i>}
                  onClick={handleExport}
                />
              </Tooltip>
              <Tooltip title="删除">
                <Button
                  type="text"
                  danger
                  icon={<i className="font_family icon-shanchu"></i>}
                  onClick={handleDelete}
                />
              </Tooltip>
            </Space>
          </div>

          <div className="session-meta flex items-center space-x-16 text-[14px] text-gray-600">
            <span>创建时间: {formatDate(sessionData.createdAt)}</span>
            <span>更新时间: {formatDate(sessionData.updatedAt)}</span>
            <span>消息数量: {sessionData.messageCount}</span>
          </div>

          <div className="session-tags flex items-center space-x-8 mt-12">
            <Tag color={getProductTypeColor(sessionData.productType)}>
              {getProductTypeLabel(sessionData.productType)}
            </Tag>
            {sessionData.deepThink && (
              <Tag color="orange">深度思考</Tag>
            )}
            {sessionData.tags && sessionData.tags.map(tag => (
              <Tag key={tag} color="purple">{tag}</Tag>
            ))}
          </div>
        </div>

        <Divider />

        {/* 会话内容 */}
        <div className="session-content">
          <Collapse defaultActiveKey={['messages', 'files']} className="mb-16">
            {/* 对话详情 */}
            <Panel header={`对话详情 (${sessionData.messages?.length || 0} 条消息)`} key="messages">
              {sessionData.messages && sessionData.messages.length > 0 ? (
                <List
                  dataSource={sessionData.messages}
                  renderItem={(message: ChatMessage) => (
                    <List.Item className="message-item">
                      <div className="message-content w-full">
                        <div className="flex items-start space-x-12 mb-8">
                          <Avatar
                            size="small"
                            style={{
                              backgroundColor: message.type === 'user' ? '#4040ff' : '#52c41a'
                            }}
                          >
                            {message.type === 'user' ? 'U' : 'A'}
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center space-x-8 mb-4">
                              <span className="font-semibold">
                                {message.type === 'user' ? '用户' : '助手'}
                              </span>
                              <span className="text-[12px] text-gray-500">
                                {formatDate(message.timestamp)}
                              </span>
                            </div>
                            <Paragraph className="mb-8">
                              {message.content}
                            </Paragraph>

                            {/* 显示工具调用记录 */}
                            {message.toolCalls && message.toolCalls.length > 0 && (
                              <div className="message-tool-calls mb-8">
                                <div className="text-[12px] text-gray-500 mb-8 block">
                                  工具调用 ({message.toolCalls.length} 个):
                                </div>
                                <div className="space-y-8">
                                  {message.toolCalls.map((toolCall, index) => (
                                    <Card key={index} size="small" className="bg-white border border-gray-200">
                                      <div className="flex items-center space-x-8 mb-4">
                                        <Tag color="blue" className="text-[11px] font-medium">
                                          {toolCall.toolName}
                                        </Tag>
                                        <span className="text-[10px] text-gray-500">
                                          {formatDate(toolCall.timestamp)}
                                        </span>
                                      </div>
                                      {Object.keys(toolCall.toolParam).length > 0 && (
                                        <div className="mb-4">
                                          <div className="text-[11px] font-medium text-blue-600 mb-2">参数:</div>
                                          <div className="bg-gray-50 p-3 rounded border border-gray-100">
                                            <pre className="text-[11px] text-gray-800 whitespace-pre-wrap break-words overflow-x-auto font-mono">
                                              {JSON.stringify(toolCall.toolParam, null, 2)}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                      <div>
                                        <div className="text-[11px] font-medium text-green-600 mb-2">结果:</div>
                                        <div className="bg-gray-50 p-3 rounded border border-gray-100 max-h-100 overflow-y-auto">
                                          {(() => {
                                            // 检查是否是 JSON 格式
                                            let isJSON = false;
                                            let jsonData: any = {};
                                            try {
                                              jsonData = JSON.parse(toolCall.toolResult);
                                              isJSON = true;
                                            } catch (e) {
                                              // 不是 JSON，使用普通文本显示
                                            }

                                            // 递归函数：查找并解析所有可能的 JSON 字符串字段
                                            const parseNestedJsonStrings = (obj: any): any => {
                                              if (typeof obj === 'string') {
                                                // 尝试解析字符串是否为 JSON
                                                try {
                                                  const parsed = JSON.parse(obj);
                                                  // 如果解析成功且是对象或数组，返回解析后的结果
                                                  if (typeof parsed === 'object' && parsed !== null) {
                                                    return parseNestedJsonStrings(parsed); // 递归处理解析后的对象
                                                  }
                                                } catch (e) {
                                                  // 不是 JSON 字符串，返回原字符串
                                                }
                                                return obj;
                                              }

                                              if (Array.isArray(obj)) {
                                                return obj.map(item => parseNestedJsonStrings(item));
                                              }

                                              if (typeof obj === 'object' && obj !== null) {
                                                const result: any = {};
                                                for (const key in obj) {
                                                  if (obj.hasOwnProperty(key)) {
                                                    result[key] = parseNestedJsonStrings(obj[key]);
                                                  }
                                                }
                                                return result;
                                              }

                                              return obj;
                                            };

                                            // 如果是 JSON，处理所有嵌套的 JSON 字符串
                                            if (isJSON) {
                                              jsonData = parseNestedJsonStrings(jsonData);
                                            }

                                            if (isJSON) {
                                              return (
                                                <div className="json-result-container">
                                                  <style>{`
                                                    .json-result-container .react-json-pretty {
                                                      background-color: transparent !important;
                                                      color: #1f2937 !important;
                                                      font-size: 11px;
                                                      line-height: 1.5;
                                                      word-break: break-word;
                                                      white-space: pre-wrap;
                                                      overflow-wrap: break-word;
                                                    }
                                                    .json-result-container .react-json-pretty .react-json-pretty-key {
                                                      color: #2563eb !important;
                                                    }
                                                    .json-result-container .react-json-pretty .react-json-pretty-string {
                                                      color: #059669 !important;
                                                      white-space: pre-wrap !important;
                                                      word-break: break-word !important;
                                                    }
                                                    .json-result-container .react-json-pretty .react-json-pretty-boolean {
                                                      color: #dc2626 !important;
                                                    }
                                                    .json-result-container .react-json-pretty .react-json-pretty-number {
                                                      color: #7c3aed !important;
                                                    }
                                                  `}</style>
                                                  <ReactJsonPretty
                                                    data={jsonData}
                                                    theme={{
                                                      main: 'transparent',
                                                      error: '#ef4444',
                                                      key: '#2563eb',
                                                      string: '#059669',
                                                      value: '#1f2937',
                                                      boolean: '#dc2626',
                                                      number: '#7c3aed',
                                                    }}
                                                  />
                                                </div>
                                              );
                                            }

                                            // 普通文本显示
                                            return (
                                              <pre className="text-[11px] text-gray-800 whitespace-pre-wrap break-words overflow-x-auto font-mono">
                                                {toolCall.toolResult.length > 500
                                                  ? toolCall.toolResult.substring(0, 500) + '...'
                                                  : toolCall.toolResult
                                                }
                                              </pre>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            )}

                            {message.files && message.files.length > 0 && (
                              <div className="message-files">
                                <div className="text-[12px] text-gray-500 mb-4 block">
                                  附件 ({message.files.length} 个):
                                </div>
                                <div className="flex flex-wrap gap-8">
                                  {message.files.map((file, index) => (
                                    <Card
                                      key={index}
                                      size="small"
                                      className="file-card cursor-pointer hover:shadow-md"
                                      onClick={() => handleFilePreview(file)}
                                    >
                                      <div className="flex items-center space-x-8">
                                        <img
                                          src={getFileIcon(file.type)}
                                          alt={file.type}
                                          className="w-16 h-16"
                                        />
                                        <div>
                                          <div className="text-[12px] font-medium truncate max-w-120">
                                            {file.name}
                                          </div>
                                          <div className="text-[10px] text-gray-500">
                                            {formatFileSize(file.size)}
                                          </div>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无对话记录" />
              )}
            </Panel>

            {/* 生成的文件 */}
            <Panel header={`生成的文件 (${sessionData.generatedFiles?.length || 0} 个)`} key="files">
              {sessionData.generatedFiles && sessionData.generatedFiles.length > 0 ? (
                <div className="generated-files">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
                    {sessionData.generatedFiles.map((file, index) => (
                      <Card
                        key={index}
                        size="small"
                        className="file-card cursor-pointer hover:shadow-md"
                        onClick={() => handleFilePreview(file)}
                      >
                        <div className="flex items-center space-x-12">
                          <img
                            src={getFileIcon(file.type)}
                            alt={file.type}
                            className="w-24 h-24 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-medium truncate mb-4">
                              {file.name}
                            </div>
                            <div className="text-[12px] text-gray-500">
                              {formatFileSize(file.size)}
                            </div>
                            <div className="text-[12px] text-gray-400">
                              {file.type.toUpperCase()}
                            </div>
                            {file.path && (
                              <div className="text-[10px] text-gray-400 truncate">
                                路径: {file.path}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Empty description="暂无生成的文件" />
              )}
            </Panel>

            {/* 任务执行结果 */}
            {sessionData.tasks && sessionData.tasks.length > 0 && (
              <Panel header={`任务执行结果 (${sessionData.tasks.length} 个)`} key="tasks">
                <div className="tasks-list">
                  {sessionData.tasks.map((task, index) => (
                    <Card key={index} size="small" className="mb-12">
                      <div className="flex items-center justify-between mb-8">
                        <span className="font-semibold">{task.name}</span>
                        <Tag color={task.status === 'completed' ? 'green' : 'orange'}>
                          {task.status}
                        </Tag>
                      </div>
                      {task.result && (
                        <Paragraph className="text-gray-600 mb-8">
                          {task.result}
                        </Paragraph>
                      )}
                      {task.files && task.files.length > 0 && (
                        <div className="task-files">
                          <div className="text-[12px] text-gray-500 mb-4 block">
                            生成文件:
                          </div>
                          <div className="flex flex-wrap gap-8">
                            {task.files.map((file, fileIndex) => (
                              <Card
                                key={fileIndex}
                                size="small"
                                className="file-card cursor-pointer hover:shadow-md"
                                onClick={() => handleFilePreview(file)}
                              >
                                <div className="flex items-center space-x-8">
                                  <img
                                    src={getFileIcon(file.type)}
                                    alt={file.type}
                                    className="w-16 h-16"
                                  />
                                  <div>
                                    <div className="text-[12px] font-medium truncate max-w-120">
                                      {file.name}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                      {formatFileSize(file.size)}
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </Panel>
            )}
          </Collapse>
        </div>
        
        <Divider />
        
        {/* 操作按钮 */}
        <div className="session-actions text-center">
          <Space>
            <Button type="primary" onClick={handleContinueChat}>
              继续对话
            </Button>
            <Button onClick={onClose}>
              关闭
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
};

export default HistoryDetail;
