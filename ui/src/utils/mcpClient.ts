/**
 * MCP客户端工具
 * 用于与本地MCP服务器通信和工具注册
 */

import { AppConfig } from './configManager';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  category?: string;
  enabled?: boolean;
}

export interface MCPCapabilities {
  tools: MCPTool[];
  resources: any[];
  prompts: any[];
}

export interface MCPConnection {
  serverUrl: string;
  clientUrl: string;
  timeout: number;
  retryCount: number;
  enabled: boolean;
  isDefault?: boolean; // 标识是否为默认配置
  name?: string; // 服务器名称
}

/**
 * MCP客户端类 - 连接现有的MCP客户端
 */
export class MCPClient {
  private connection: MCPConnection;
  private capabilities: MCPCapabilities | null = null;
  private isConnected: boolean = false;

  constructor(connection: MCPConnection) {
    this.connection = connection;
  }

  /**
   * 连接到现有的MCP客户端并获取能力信息
   */
  async connect(): Promise<boolean> {
    if (!this.connection.enabled || !this.connection.clientUrl) {
      return false;
    }

    try {
      console.log(`🔧 尝试连接到MCP客户端: ${this.connection.clientUrl}`);
      console.log(`🔧 MCP服务器地址: ${this.connection.serverUrl}`);

      // 1. 首先检查MCP客户端健康状态
      const healthResponse = await fetch(`${this.connection.clientUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!healthResponse.ok) {
        throw new Error(`MCP客户端健康检查失败: ${healthResponse.status}`);
      }

      const healthResult = await healthResponse.json();
      console.log('🔧 MCP客户端健康状态:', healthResult);

      // 2. 测试MCP服务器连通性（通过MCP客户端）
      console.log(`🔧 测试MCP服务器连通性: ${this.connection.serverUrl}`);
      const pingResponse = await fetch(`${this.connection.clientUrl}/v1/serv/pong`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server_url: this.connection.serverUrl
        })
      });

      if (!pingResponse.ok) {
        throw new Error(`MCP服务器连通性测试失败: ${pingResponse.status}`);
      }

      const pingResult = await pingResponse.json();
      console.log('🔧 MCP服务器连通性测试结果:', pingResult);

      if (pingResult.code !== 200) {
        throw new Error(`MCP服务器不可达: ${pingResult.message}`);
      }

      // 3. 通过MCP客户端获取工具列表（MCP客户端会连接到MCP服务器获取工具）
      console.log(`🔧 通过MCP客户端获取工具列表...`);
      const toolsResponse = await fetch(`${this.connection.clientUrl}/v1/tool/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server_url: this.connection.serverUrl
        })
      });

      if (!toolsResponse.ok) {
        throw new Error(`获取工具列表失败: ${toolsResponse.status}`);
      }

      const toolsResult = await toolsResponse.json();
      console.log('🔧 工具列表API响应:', toolsResult);

      if (toolsResult.code === 200 && toolsResult.data) {
        // 转换MCP客户端返回的工具格式
        const tools = Array.isArray(toolsResult.data) ? toolsResult.data.map((tool: any) => ({
          name: tool.name || tool.tool_name || 'unknown_tool',
          description: tool.description || tool.tool_description || 'No description',
          inputSchema: tool.inputSchema || tool.input_schema || {}
        })) : [];

        this.capabilities = {
          tools: tools,
          resources: [],
          prompts: []
        };
        this.isConnected = true;
        console.log(`🔧 MCP客户端连接成功，可用工具: ${tools.length}个`);
        console.log('🔧 工具列表:', tools.map((t: any) => t.name));
        return true;
      } else {
        throw new Error(toolsResult.message || '获取工具列表失败');
      }
    } catch (error) {
      console.error('🔧 MCP客户端连接失败:', error);
      this.isConnected = false;
      this.capabilities = { tools: [], resources: [], prompts: [] };
      return false;
    }
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): MCPTool[] {
    return this.capabilities?.tools || [];
  }

  /**
   * 获取可用资源
   */
  getAvailableResources(): any[] {
    return this.capabilities?.resources || [];
  }

  /**
   * 获取可用提示
   */
  getAvailablePrompts(): any[] {
    return this.capabilities?.prompts || [];
  }

  /**
   * 执行工具调用 - 通过现有MCP客户端
   */
  async executeTool(toolName: string, parameters: any): Promise<any> {
    if (!this.isConnected) {
      throw new Error('MCP客户端未连接');
    }

    try {
      console.log(`🔧 执行工具: ${toolName}，参数:`, parameters);

      // 通过MCP客户端的工具调用API执行工具
      const response = await fetch(`${this.connection.clientUrl}/v1/tool/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server_url: this.connection.serverUrl,
          name: toolName,
          arguments: parameters
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.code === 200) {
        console.log(`🔧 工具 ${toolName} 执行成功`);
        return result.data;
      } else {
        throw new Error(result.message || `工具 ${toolName} 执行失败`);
      }
    } catch (error) {
      console.error(`🔧 工具 ${toolName} 执行失败:`, error);
      throw error;
    }
  }

  /**
   * 检查连接状态
   */
  isServerConnected(): boolean {
    return this.isConnected;
  }

  /**
   * 获取连接信息
   */
  getConnectionInfo() {
    return {
      ...this.connection,
      isConnected: this.isConnected,
      capabilities: this.capabilities
    };
  }
}

/**
 * 从配置创建MCP连接 - 支持多个服务器
 */
export function createMCPConnection(config: AppConfig): MCPConnection[] {
  const connections: MCPConnection[] = [];

  // 添加默认MCP配置（从yml文件读取，支持多个地址）
  const serverUrls = config.mcp.defaultServerUrls || [];
  const clientUrls = config.mcp.defaultClientUrls || [];

  serverUrls.forEach((serverUrl, index) => {
    const clientUrl = clientUrls[index] || clientUrls[0]; // 如果客户端地址不够，使用第一个
    connections.push({
      serverUrl,
      clientUrl,
      timeout: config.mcp.timeout,
      retryCount: config.mcp.retryCount,
      enabled: true, // 默认配置始终启用
      isDefault: true,
      name: `默认MCP服务器${index + 1}`
    });
  });

  // 添加自定义MCP服务器
  config.mcp.customServers.forEach(server => {
    if (server.enabled) {
      connections.push({
        serverUrl: server.serverUrl,
        clientUrl: server.clientUrl,
        timeout: config.mcp.timeout,
        retryCount: config.mcp.retryCount,
        enabled: server.enabled,
        isDefault: false,
        name: server.name
      });
    }
  });

  return connections;
}

/**
 * 获取当前活跃的MCP连接
 */
export function getActiveMCPConnections(config: AppConfig): MCPConnection[] {
  const connections: MCPConnection[] = [];

  if (!config.mcp.enableCustomMCP) {
    // 如果未启用自定义MCP，使用默认配置（支持多个地址）
    const serverUrls = config.mcp.defaultServerUrls || [];
    const clientUrls = config.mcp.defaultClientUrls || [];

    // 创建所有默认连接
    serverUrls.forEach((serverUrl, index) => {
      const clientUrl = clientUrls[index] || clientUrls[0]; // 如果客户端地址不够，使用第一个
      connections.push({
        serverUrl,
        clientUrl,
        timeout: config.mcp.timeout,
        retryCount: config.mcp.retryCount,
        enabled: true,
        isDefault: true,
        name: `默认MCP服务器${index + 1}`
      });
    });

    return connections;
  }

  // 添加启用的自定义服务器
  config.mcp.customServers.forEach(server => {
    if (server.enabled) {
      connections.push({
        serverUrl: server.serverUrl,
        clientUrl: server.clientUrl,
        timeout: config.mcp.timeout,
        retryCount: config.mcp.retryCount,
        enabled: true,
        isDefault: false,
        name: server.name
      });
    }
  });

  return connections;
}

/**
 * 构建MCP请求头
 */
export function buildMCPHeaders(config: AppConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-MCP-Client': 'joyagent-jdgenie',
    'X-MCP-Version': '1.0.0'
  };

  if (config.mcp.enableCustomMCP) {
    // 使用第一个服务器地址作为默认
    const serverUrl = config.mcp.defaultServerUrls[0] || '';
    const clientUrl = config.mcp.defaultClientUrls[0] || '';
    headers['X-MCP-Server'] = serverUrl;
    headers['X-MCP-Client-URL'] = clientUrl;
  }

  return headers;
}

/**
 * 构建MCP请求体
 */
export function buildMCPRequestBody(
  baseRequest: any,
  config: AppConfig,
  mcpTools?: MCPTool[]
): any {
  const mcpRequest = {
    ...baseRequest,
    mcp: {
      enabled: config.mcp.enableCustomMCP,
      serverUrls: config.mcp.defaultServerUrls,
      clientUrls: config.mcp.defaultClientUrls,
      timeout: config.mcp.timeout,
      retryCount: config.mcp.retryCount,
      tools: mcpTools || []
    }
  };

  return mcpRequest;
}
