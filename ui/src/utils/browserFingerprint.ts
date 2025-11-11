/**
 * 浏览器指纹识别器
 * 用于生成用户唯一标识，实现用户数据隔离
 */

export class BrowserFingerprint {
  private static instance: BrowserFingerprint;
  private fingerprint: string | null = null;

  static getInstance(): BrowserFingerprint {
    if (!BrowserFingerprint.instance) {
      BrowserFingerprint.instance = new BrowserFingerprint();
    }
    return BrowserFingerprint.instance;
  }

  /**
   * 生成浏览器指纹
   */
  generateFingerprint(): string {
    if (this.fingerprint) {
      return this.fingerprint;
    }

    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.platform,
      navigator.cookieEnabled ? '1' : '0',
      navigator.doNotTrack || '0'
    ];

    // 生成简单的哈希值
    const fingerprint = this.simpleHash(components.join('|'));
    this.fingerprint = fingerprint;
    
    // 存储到localStorage
    localStorage.setItem('browser_fingerprint', fingerprint);
    
    return fingerprint;
  }

  /**
   * 获取或生成用户ID
   */
  getUserId(): string {
    let userId = localStorage.getItem('user_id');
    
    if (!userId) {
      // 生成新的用户ID
      userId = this.generateUserId();
      localStorage.setItem('user_id', userId);
    }
    
    return userId;
  }

  /**
   * 生成用户ID
   */
  private generateUserId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `user_${timestamp}_${random}`;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 验证指纹一致性
   */
  validateFingerprint(): boolean {
    const stored = localStorage.getItem('browser_fingerprint');
    const current = this.generateFingerprint();
    return stored === current;
  }

  /**
   * 重置用户ID（用于测试或特殊情况）
   */
  resetUserId(): string {
    localStorage.removeItem('user_id');
    localStorage.removeItem('browser_fingerprint');
    this.fingerprint = null;
    return this.getUserId();
  }
}
