/**
 * 历史记录模态框组件
 * 提供历史记录查看、搜索、管理等功能
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, Select, DatePicker, Button, Card, Tag, message, Space } from 'antd';
import { SimpleHistoryManager, ChatSession } from '@/utils/historyManager';
import { BrowserFingerprint } from '@/utils/browserFingerprint';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ visible, onClose }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    productType: '',
    dateRange: null as [Date, Date] | null
  });

  const historyManager = useMemo(() => new SimpleHistoryManager(), []);

  useEffect(() => {
    if (visible) {
      loadSessions();
    }
  }, [visible, historyManager]);

  const loadSessions = () => {
    const data = historyManager.getSessions(100);
    setSessions(data);
  };

  const handleSearch = () => {
    const data = historyManager.searchSessions(searchQuery, filters);
    setSessions(data);
  };

  const handleDeleteSession = (sessionId: string) => {
    historyManager.deleteSession(sessionId);
    loadSessions();
    message.success('删除成功');
  };

  const handleRenameSession = (sessionId: string) => {
    const newTitle = prompt('请输入新的标题:');
    if (newTitle && newTitle.trim()) {
      historyManager.renameSession(sessionId, newTitle.trim());
      loadSessions();
      message.success('重命名成功');
    }
  };

  const handleContinueSession = (session: ChatSession) => {
    // 这里可以触发继续对话的逻辑
    message.info('继续对话功能待实现');
    onClose();
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  return (
    <Modal
      title="历史记录"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
      className="history-modal"
    >
      <div className="history-container">
        {/* 搜索和筛选 */}
        <div className="history-header mb-16">
          <div className="flex space-x-16 mb-16">
            <Input.Search
              placeholder="搜索历史记录..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
              enterButton
              style={{ width: 300 }}
            />
            <Select
              placeholder="产品类型"
              value={filters.productType}
              onChange={(value) => setFilters({...filters, productType: value})}
              allowClear
              style={{ width: 150 }}
            >
              <Option value="html">网页模式</Option>
              <Option value="docs">文档模式</Option>
              <Option value="ppt">PPT模式</Option>
              <Option value="table">表格模式</Option>
            </Select>
            <RangePicker
              value={filters.dateRange}
              onChange={(dates) => setFilters({...filters, dateRange: dates})}
              placeholder={['开始日期', '结束日期']}
            />
          </div>
        </div>
        
        {/* 会话列表 */}
        <div className="history-list max-h-400 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="text-center py-40 text-gray-500">
              暂无历史记录
            </div>
          ) : (
            sessions.map(session => (
              <Card key={session.id} size="small" className="mb-12">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-[16px] mb-8">{session.title}</div>
                    <div className="text-[12px] text-gray-500 mb-8 line-clamp-2">
                      {session.preview}
                    </div>
                    <div className="flex items-center space-x-16 text-[12px] text-gray-400">
                      <span>{formatDate(session.createdAt)}</span>
                      <span>{session.messageCount} 条消息</span>
                      <Tag color={getProductTypeColor(session.productType)} size="small">
                        {getProductTypeLabel(session.productType)}
                      </Tag>
                      {session.deepThink && (
                        <Tag color="orange" size="small">深度思考</Tag>
                      )}
                      {session.tags && session.tags.length > 0 && (
                        <div className="flex space-x-4">
                          {session.tags.map(tag => (
                            <Tag key={tag} size="small" color="purple">{tag}</Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-8">
                    <Button 
                      size="small" 
                      type="primary"
                      onClick={() => handleContinueSession(session)}
                    >
                      继续对话
                    </Button>
                    <Button 
                      size="small" 
                      onClick={() => handleRenameSession(session.id)}
                    >
                      重命名
                    </Button>
                    <Button 
                      size="small" 
                      danger 
                      onClick={() => handleDeleteSession(session.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
        
        {/* 底部信息 */}
        <div className="history-footer mt-16 pt-16 border-t border-gray-200 text-[12px] text-gray-500">
          <div className="flex justify-between items-center">
            <span>共 {sessions.length} 条记录</span>
            <span>用户ID: {BrowserFingerprint.getInstance().getUserId().substring(0, 8)}...</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default HistoryModal;
