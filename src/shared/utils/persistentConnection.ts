// 持久连接管理器
// 使用 chrome.runtime.connect() 创建持久连接，替代 chrome.tabs.sendMessage()
// 这样可以避免 PORT_CLOSED 错误，因为连接在页面导航时也会保持

declare const chrome: any;

interface PortInfo {
  port: chrome.runtime.Port;
  tabId: number;
  connected: boolean;
  reconnectAttempts: number;
  lastMessageId: number;
  pendingMessages: Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
}

class PersistentConnectionManager {
  private static instance: PersistentConnectionManager;
  private ports: Map<number, PortInfo> = new Map(); // tabId -> PortInfo
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 1000;
  private readonly MESSAGE_TIMEOUT = 30000; // 30秒超时

  private constructor() {
    // 监听来自 Content Script 的连接
    chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
      // Content Script 会在连接时发送 tabId
      port.onMessage.addListener((message: any) => {
        if (message.type === 'connect' && message.tabId) {
          this.handleContentScriptConnect(port, message.tabId);
        } else if (message.type === 'response') {
          this.handleResponse(message);
        }
      });

      port.onDisconnect.addListener(() => {
        this.handlePortDisconnect(port);
      });
    });
  }

  static getInstance(): PersistentConnectionManager {
    if (!PersistentConnectionManager.instance) {
      PersistentConnectionManager.instance = new PersistentConnectionManager();
    }
    return PersistentConnectionManager.instance;
  }

  /**
   * 处理 Content Script 连接
   */
  private handleContentScriptConnect(port: chrome.runtime.Port, tabId: number) {
    console.log(`🔌 Content Script 建立持久连接 (Tab ${tabId})`);

    const portInfo: PortInfo = {
      port,
      tabId,
      connected: true,
      reconnectAttempts: 0,
      lastMessageId: 0,
      pendingMessages: new Map(),
    };

    this.ports.set(tabId, portInfo);

    // 发送连接确认
    port.postMessage({
      type: 'connected',
      tabId,
    });

    // 监听端口断开
    port.onDisconnect.addListener(() => {
      console.log(`⚠️ Content Script 连接断开 (Tab ${tabId})`);
      this.handlePortDisconnect(port);
    });
  }

  /**
   * 处理端口断开
   */
  private handlePortDisconnect(port: chrome.runtime.Port) {
    // 找到对应的 tabId
    for (const [tabId, portInfo] of this.ports.entries()) {
      if (portInfo.port === port) {
        portInfo.connected = false;
        
        // 拒绝所有待处理的消息
        for (const [messageId, pending] of portInfo.pendingMessages.entries()) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('PORT_CLOSED'));
        }
        portInfo.pendingMessages.clear();

        // 尝试重连（由 Content Script 主动重连）
        console.log(`⏳ 等待 Content Script 重连 (Tab ${tabId})`);
        break;
      }
    }
  }

  /**
   * 处理响应消息
   */
  private handleResponse(message: any) {
    const { messageId, response, error } = message;
    
    // 找到对应的 tabId
    for (const [tabId, portInfo] of this.ports.entries()) {
      const pending = portInfo.pendingMessages.get(messageId);
      if (pending) {
        clearTimeout(pending.timeout);
        portInfo.pendingMessages.delete(messageId);
        
        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(response);
        }
        return;
      }
    }
  }

  /**
   * 发送消息到 Content Script（通过持久连接）
   */
  async sendMessage(
    tabId: number,
    message: any,
    timeout: number = this.MESSAGE_TIMEOUT
  ): Promise<any> {
    const portInfo = this.ports.get(tabId);

    // 如果连接不存在或已断开，等待连接建立
    if (!portInfo || !portInfo.connected) {
      console.log(`⏳ 等待 Content Script 连接 (Tab ${tabId})...`);
      
      // 等待连接建立（最多等待 10 秒）
      const maxWait = 10000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentPortInfo = this.ports.get(tabId);
        if (currentPortInfo && currentPortInfo.connected) {
          return this.sendMessage(tabId, message, timeout);
        }
      }
      
      throw new Error(`Content Script 连接超时 (Tab ${tabId})`);
    }

    // 生成消息 ID
    const messageId = ++portInfo.lastMessageId;

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeoutId = setTimeout(() => {
        portInfo.pendingMessages.delete(messageId);
        reject(new Error('消息超时'));
      }, timeout);

      // 保存待处理消息
      portInfo.pendingMessages.set(messageId, {
        resolve,
        reject,
        timeout: timeoutId,
      });

      // 发送消息
      try {
        portInfo.port.postMessage({
          type: 'message',
          messageId,
          data: message,
        });
      } catch (error: any) {
        portInfo.pendingMessages.delete(messageId);
        clearTimeout(timeoutId);
        
        // 如果发送失败，标记为未连接
        if (error.message?.includes('port closed') || error.message?.includes('disconnected')) {
          portInfo.connected = false;
          reject(new Error('PORT_CLOSED'));
        } else {
          reject(error);
        }
      }
    });
  }

  /**
   * 检查连接是否就绪
   */
  isConnected(tabId: number): boolean {
    const portInfo = this.ports.get(tabId);
    return portInfo?.connected === true;
  }

  /**
   * 获取所有已连接的 tabId
   */
  getConnectedTabs(): number[] {
    return Array.from(this.ports.entries())
      .filter(([_, portInfo]) => portInfo.connected)
      .map(([tabId]) => tabId);
  }

  /**
   * 断开指定 tab 的连接
   */
  disconnect(tabId: number) {
    const portInfo = this.ports.get(tabId);
    if (portInfo) {
      try {
        portInfo.port.disconnect();
      } catch (error) {
        // 忽略断开错误
      }
      this.ports.delete(tabId);
    }
  }
}

export const persistentConnection = PersistentConnectionManager.getInstance();

