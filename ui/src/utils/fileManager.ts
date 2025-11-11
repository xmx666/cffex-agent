/**
 * 文件管理器
 * 处理genie-tool文件存储和访问
 */

export interface FileInfo {
  name: string;
  path: string;
  type: string;
  size: number;
  url: string;
  sessionId: string;
}

export class FileManager {
  private static instance: FileManager;
  private baseUrl: string;

  static getInstance(): FileManager {
    if (!FileManager.instance) {
      FileManager.instance = new FileManager();
    }
    return FileManager.instance;
  }

  constructor() {
    // 假设genie-tool服务运行在1601端口
    this.baseUrl = 'http://172.31.73.223:1601';
  }

  /**
   * 获取会话的文件列表
   */
  async getSessionFiles(sessionId: string): Promise<FileInfo[]> {
    try {
      // 直接读取genie-tool的文件目录
      const sessionPath = this.generateSessionPath(sessionId);
      const response = await fetch(`${this.baseUrl}/api/files/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: sessionPath }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.files || [];
      }
    } catch (error) {
      console.error('获取会话文件失败:', error);
    }
    return [];
  }

  /**
   * 获取文件内容
   */
  async getFileContent(filePath: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/files/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_name: filePath }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.content;
      }
    } catch (error) {
      console.error('获取文件内容失败:', error);
    }
    return null;
  }

  /**
   * 下载文件
   */
  async downloadFile(filePath: string, fileName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/files/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_name: filePath }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.content;

        // 创建下载链接
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('下载文件失败:', error);
    }
  }

  /**
   * 获取文件预览URL
   */
  getFilePreviewUrl(filePath: string): string {
    return `${this.baseUrl}/api/files/get`;
  }

  /**
   * 根据会话ID生成文件路径
   */
  generateSessionPath(sessionId: string): string {
    return `geniesession-${sessionId}`;
  }

  /**
   * 解析文件路径获取会话ID
   */
  parseSessionIdFromPath(filePath: string): string | null {
    const match = filePath.match(/geniesession-([^-]+)/);
    return match ? match[1] : null;
  }

  /**
   * 获取文件类型
   */
  getFileType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      'html': 'html',
      'htm': 'html',
      'md': 'markdown',
      'txt': 'text',
      'pdf': 'pdf',
      'doc': 'word',
      'docx': 'word',
      'xls': 'excel',
      'xlsx': 'excel',
      'csv': 'csv',
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'gif': 'image',
      'wav': 'audio',
      'mp3': 'audio',
      'mp4': 'video',
      'avi': 'video',
    };
    return typeMap[ext || ''] || 'unknown';
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
