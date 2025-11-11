/**
 * 简化的历史记录管理器
 * 基于localStorage实现用户隔离的历史记录存储
 */

import { BrowserFingerprint } from './browserFingerprint';

// 文件类型定义
export interface ChatFile {
  name: string;
  url: string;
  type: string;
  size: number;
  path?: string; // 文件在genie-tool中的路径
}

// 工具调用记录
export interface ToolCallRecord {
  id: string;
  toolName: string;
  toolParam: Record<string, any>;
  toolResult: string;
  timestamp: Date | string;
  status: 'success' | 'error' | 'running';
  files?: ChatFile[];
}

// 对话消息类型定义
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date | string;
  files?: ChatFile[];
  toolCalls?: ToolCallRecord[];
}

// 会话类型定义
export interface ChatSession {
  id: string;
  title: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  messageCount: number;
  productType: string;
  deepThink: boolean;
  preview: string;
  tags?: string[];
  sessionId: string;
  requestId: string;
  // 新增：对话详情
  messages: ChatMessage[];
  // 新增：生成的文件
  generatedFiles: ChatFile[];
  // 新增：任务执行结果
  tasks?: Array<{
    id: string;
    name: string;
    status: string;
    result?: string;
    files?: ChatFile[];
  }>;
  // 新增：完整的对话状态，用于恢复对话
  chatState?: {
    chatList: any[];
    taskList: any[];
    plan?: any;
    activeTask?: any;
  };
}

export class SimpleHistoryManager {
  private userId: string;
  private fingerprint: BrowserFingerprint;

  constructor() {
    this.fingerprint = BrowserFingerprint.getInstance();
    this.userId = this.fingerprint.getUserId();
  }

  /**
   * 获取用户专属的存储键
   */
  private getUserKey(key: string): string {
    return `${this.userId}_${key}`;
  }

  /**
   * 保存会话
   */
  saveSession(session: ChatSession): void {
    const sessions = this.getSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = { ...session, updatedAt: new Date() };
    } else {
      sessions.unshift({ ...session, createdAt: new Date(), updatedAt: new Date() });
    }
    
    // 限制历史记录数量（最多保存100个会话）
    if (sessions.length > 100) {
      sessions.splice(100);
    }
    
    localStorage.setItem(this.getUserKey('sessions'), JSON.stringify(sessions));
  }

  /**
   * 获取会话列表
   */
  getSessions(limit = 50): ChatSession[] {
    const sessions = this.getSessions();
    return sessions.slice(0, limit);
  }

  /**
   * 获取所有会话
   */
  private getSessions(): ChatSession[] {
    const data = localStorage.getItem(this.getUserKey('sessions'));
    return data ? JSON.parse(data) : [];
  }

  /**
   * 搜索会话
   */
  searchSessions(query: string, filters?: {
    productType?: string;
    dateRange?: [Date, Date];
    tags?: string[];
  }): ChatSession[] {
    let sessions = this.getSessions();
    
    // 文本搜索
    if (query) {
      const lowerQuery = query.toLowerCase();
      sessions = sessions.filter(session => 
        session.title.toLowerCase().includes(lowerQuery) ||
        session.preview.toLowerCase().includes(lowerQuery)
      );
    }
    
    // 产品类型过滤
    if (filters?.productType) {
      sessions = sessions.filter(session => 
        session.productType === filters.productType
      );
    }
    
    // 日期范围过滤
    if (filters?.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      sessions = sessions.filter(session => {
        const sessionDate = new Date(session.createdAt);
        return sessionDate >= startDate && sessionDate <= endDate;
      });
    }
    
    // 标签过滤
    if (filters?.tags?.length) {
      sessions = sessions.filter(session => 
        filters.tags!.some(tag => session.tags?.includes(tag))
      );
    }
    
    return sessions;
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): void {
    const sessions = this.getSessions();
    const filteredSessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(this.getUserKey('sessions'), JSON.stringify(filteredSessions));
  }

  /**
   * 重命名会话
   */
  renameSession(sessionId: string, newTitle: string): void {
    const sessions = this.getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.title = newTitle;
      session.updatedAt = new Date();
      localStorage.setItem(this.getUserKey('sessions'), JSON.stringify(sessions));
    }
  }

  /**
   * 添加标签
   */
  addTagToSession(sessionId: string, tag: string): void {
    const sessions = this.getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      if (!session.tags) {
        session.tags = [];
      }
      if (!session.tags.includes(tag)) {
        session.tags.push(tag);
        session.updatedAt = new Date();
        localStorage.setItem(this.getUserKey('sessions'), JSON.stringify(sessions));
      }
    }
  }

  /**
   * 导出用户数据
   */
  exportUserData(): string {
    const data = {
      userId: this.userId,
      sessions: this.getSessions(),
      exportTime: new Date().toISOString(),
      version: '1.0'
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入用户数据
   */
  importUserData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      if (data.sessions && Array.isArray(data.sessions)) {
        localStorage.setItem(this.getUserKey('sessions'), JSON.stringify(data.sessions));
        return true;
      }
    } catch (error) {
      console.error('导入数据失败:', error);
    }
    return false;
  }

  /**
   * 清空历史记录
   */
  clearAllHistory(): void {
    localStorage.removeItem(this.getUserKey('sessions'));
  }

  /**
   * 获取存储使用情况
   */
  getStorageInfo(): {
    sessionCount: number;
    totalSize: number;
    maxSize: number;
  } {
    const sessions = this.getSessions();
    const data = localStorage.getItem(this.getUserKey('sessions')) || '';
    const totalSize = new Blob([data]).size;
    const maxSize = 5 * 1024 * 1024; // 5MB限制
    
    return {
      sessionCount: sessions.length,
      totalSize,
      maxSize
    };
  }

  /**
   * 获取用户ID
   */
  getUserId(): string {
    return this.userId;
  }
}
