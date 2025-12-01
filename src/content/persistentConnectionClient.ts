// Content Script 端的持久连接客户端
// 在 Content Script 中建立到 Background Script 的持久连接

declare const chrome: any;

class PersistentConnectionClient {
  private port: chrome.runtime.Port | null = null;
  private tabId: number | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 1000;
  private messageHandlers: Map<string, (data: any) => Promise<any>> = new Map();

  constructor() {
    this.connect();
    
    // 监听页面卸载，准备重连
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });

    // 监听页面可见性变化，检查连接状态
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.port) {
        this.connect();
      }
    });
  }

  /**
   * 建立连接
   */
  private connect() {
    try {
      // 获取当前 tab ID
      chrome.runtime.sendMessage(
        { action: 'getCurrentTabId' },
        (response: any) => {
          if (response?.tabId) {
            this.tabId = response.tabId;
            this.establishConnection();
          } else {
            // 如果无法获取 tabId，使用延迟重试
            setTimeout(() => this.connect(), 1000);
          }
        }
      );
    } catch (error) {
      console.error('建立连接失败:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 建立实际的连接
   */
  private establishConnection() {
    try {
      this.port = chrome.runtime.connect({ name: 'content-script' });

      // 发送连接消息，包含 tabId
      this.port.postMessage({
        type: 'connect',
        tabId: this.tabId,
      });

      // 监听来自 Background 的消息
      this.port.onMessage.addListener((message: any) => {
        this.handleMessage(message);
      });

      // 监听连接断开
      this.port.onDisconnect.addListener(() => {
        console.log('⚠️ 持久连接断开，准备重连...');
        this.port = null;
        this.scheduleReconnect();
      });

      console.log('✅ 持久连接已建立');
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('建立连接失败:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 处理来自 Background 的消息
   */
  private async handleMessage(message: any) {
    if (message.type === 'connected') {
      console.log('✅ Background 确认连接');
      return;
    }

    if (message.type === 'message') {
      const { messageId, data } = message;
      
      try {
        // 查找对应的消息处理器
        const handler = this.messageHandlers.get(data.action);
        let response: any;

        if (handler) {
          // 如果消息有 data 字段，传递给处理器的是 data.data（实际的 action 对象）
          // 例如：{ action: "executeAgentAction", data: { type: "click", elementId: 1 } }
          // 应该传递 { type: "click", elementId: 1 } 给 executeAgentAction
          const handlerData = data.data !== undefined ? data.data : data;
          console.log('📨 持久连接处理消息:', { action: data.action, handlerData });
          response = await handler(handlerData);
        } else {
          // 如果没有注册处理器，使用默认的消息处理
          response = await this.handleDefaultMessage(data);
        }

        // 发送响应
        if (this.port) {
          this.port.postMessage({
            type: 'response',
            messageId,
            response,
          });
        }
      } catch (error: any) {
        // 发送错误响应
        if (this.port) {
          this.port.postMessage({
            type: 'response',
            messageId,
            error: error.message || String(error),
          });
        }
      }
    }
  }

  /**
   * 处理默认消息（兼容现有的消息处理逻辑）
   * 这个方法会被 App.vue 中的实际消息处理函数替换
   */
  private async handleDefaultMessage(data: any): Promise<any> {
    // 这个方法会被 setDefaultMessageHandler 替换
    return { success: false, error: '未实现的消息处理器' };
  }

  /**
   * 设置默认消息处理器（由 App.vue 调用）
   */
  setDefaultMessageHandler(handler: (data: any) => Promise<any>) {
    this.handleDefaultMessage = handler;
  }

  /**
   * 注册消息处理器
   */
  registerHandler(action: string, handler: (data: any) => Promise<any>) {
    this.messageHandlers.set(action, handler);
  }

  /**
   * 计划重连
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ 重连次数已达上限，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.RECONNECT_DELAY * this.reconnectAttempts;
    console.log(`⏳ ${delay}ms 后尝试重连 (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 断开连接
   */
  private disconnect() {
    if (this.port) {
      try {
        this.port.disconnect();
      } catch (error) {
        // 忽略断开错误
      }
      this.port = null;
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.port !== null;
  }
}

// 导出单例
export const persistentConnectionClient = new PersistentConnectionClient();

