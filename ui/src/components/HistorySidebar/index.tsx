/**
 * 历史记录侧边栏组件
 * 提供历史记录的侧边栏展示和管理功能
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Drawer, 
  Input, 
  Select, 
  DatePicker, 
  Button, 
  Card, 
  Tag, 
  message, 
  Space,
  Tooltip,
  Empty,
  Spin
} from 'antd';
import { SimpleHistoryManager, ChatSession } from '@/utils/historyManager';
import { BrowserFingerprint } from '@/utils/browserFingerprint';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Search } = Input;

interface HistorySidebarProps {
  visible: boolean;
  onClose: () => void;
  onSelectSession: (session: ChatSession) => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  visible, 
  onClose, 
  onSelectSession 
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    try {
      const data = historyManager.getSessions(100);
      setSessions(data);
    } catch (error) {
      message.error('加载历史记录失败');
    } finally {
      setLoading(false);
    }
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
    onSelectSession(session);
    onClose();
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
  };

  const getProductTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'html': '网页',
      'docs': '文档',
      'ppt': 'PPT',
      'table': '表格'
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

  const handleClearSearch = () => {
    setSearchQuery('');
    setFilters({ productType: '', dateRange: null });
    loadSessions();
  };

  return (
    <Drawer
      title="历史记录"
      placement="left"
      width={360}
      open={visible}
      onClose={onClose}
      className="history-sidebar"
      extra={
        <Button type="text" size="small" onClick={handleClearSearch}>
          清空筛选
        </Button>
      }
    >
      <div className="history-sidebar-content">
        {/* 搜索和筛选 */}
        <div className="search-section mb-16">
          <Search
            placeholder="搜索历史记录..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            enterButton
            size="small"
          />
          
          <div className="filter-row mt-12">
            <Select
              placeholder="类型"
              value={filters.productType}
              onChange={(value) => setFilters({...filters, productType: value})}
              allowClear
              size="small"
              style={{ width: '100%' }}
            >
              <Option value="html">网页模式</Option>
              <Option value="docs">文档模式</Option>
              <Option value="ppt">PPT模式</Option>
              <Option value="table">表格模式</Option>
            </Select>
          </div>
          
          <div className="filter-row mt-8">
            <RangePicker
              value={filters.dateRange}
              onChange={(dates) => setFilters({...filters, dateRange: dates})}
              placeholder={['开始', '结束']}
              size="small"
              style={{ width: '100%' }}
            />
          </div>
        </div>
        
        {/* 会话列表 */}
        <div className="sessions-list">
          {loading ? (
            <div className="text-center py-40">
              <Spin />
            </div>
          ) : sessions.length === 0 ? (
            <Empty 
              description="暂无历史记录" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            sessions.map(session => (
              <Card 
                key={session.id} 
                size="small" 
                className="session-card mb-12 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleContinueSession(session)}
              >
                <div className="session-header">
                  <div className="session-title text-[14px] font-medium mb-8 line-clamp-2">
                    {session.title}
                  </div>
                  <div className="session-meta flex items-center justify-between text-[12px] text-gray-500 mb-8">
                    <span>{formatDate(session.createdAt)}</span>
                    <span>{session.messageCount}条</span>
                  </div>
                </div>
                
                <div className="session-preview text-[12px] text-gray-600 mb-12 line-clamp-2">
                  {session.preview}
                </div>
                
                <div className="session-tags flex items-center justify-between">
                  <div className="flex space-x-4">
                    <Tag color={getProductTypeColor(session.productType)} size="small">
                      {getProductTypeLabel(session.productType)}
                    </Tag>
                    {session.deepThink && (
                      <Tag color="orange" size="small">深度思考</Tag>
                    )}
                  </div>
                  
                  <div className="session-actions" onClick={(e) => e.stopPropagation()}>
                    <Space size="small">
                      <Tooltip title="重命名">
                        <Button 
                          type="text" 
                          size="small" 
                          icon={<i className="font_family icon-bianji"></i>}
                          onClick={() => handleRenameSession(session.id)}
                        />
                      </Tooltip>
                      <Tooltip title="删除">
                        <Button 
                          type="text" 
                          size="small" 
                          danger
                          icon={<i className="font_family icon-shanchu"></i>}
                          onClick={() => handleDeleteSession(session.id)}
                        />
                      </Tooltip>
                    </Space>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
        
        {/* 底部信息 */}
        <div className="sidebar-footer mt-16 pt-16 border-t border-gray-200 text-[12px] text-gray-500">
          <div className="flex justify-between items-center">
            <span>共 {sessions.length} 条记录</span>
            <span>用户: {BrowserFingerprint.getInstance().getUserId().substring(0, 8)}...</span>
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default HistorySidebar;
