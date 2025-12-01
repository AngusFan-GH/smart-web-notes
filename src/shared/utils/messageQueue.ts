// 消息队列管理器
// 当 Content Script 未就绪时，将消息加入队列，等待就绪后处理

declare const chrome: any;

interface QueuedMessage {
  tabId: number;
  message: any;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
  retries: number;
}

class MessageQueue {
  private static instance: MessageQueue;
  private queue: QueuedMessage[] = [];
  private readyTabs: Set<number> = new Set();
  private processing = false;
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly MESSAGE_TIMEOUT = 60000; // 60秒超时（给 Content Script 更多加载时间）
  private readonly MAX_RETRIES = 3;

  private constructor() {
    // 监听 Content Script 就绪通知
    chrome.runtime.onMessage.addListener((message: any, sender: any) => {
      if (message.action === "contentScriptReady") {
        const tabId = sender.tab?.id;
        if (tabId) {
          this.markTabReady(tabId);
        }
      }
    });

    // 定期清理过期消息
    setInterval(() => this.cleanupExpiredMessages(), 5000);
  }

  static getInstance(): MessageQueue {
    if (!MessageQueue.instance) {
      MessageQueue.instance = new MessageQueue();
    }
    return MessageQueue.instance;
  }

  /**
   * 标记 tab 为就绪状态
   */
  markTabReady(tabId: number) {
    this.readyTabs.add(tabId);
    console.log(`✅ Tab ${tabId} Content Script 已就绪`);
    
    // 处理该 tab 的队列消息
    this.processQueueForTab(tabId);
  }

  /**
   * 标记 tab 为未就绪状态（页面跳转时）
   */
  markTabNotReady(tabId: number) {
    this.readyTabs.delete(tabId);
    console.log(`⚠️ Tab ${tabId} Content Script 未就绪`);
  }

  /**
   * 检查 tab 是否就绪
   */
  isTabReady(tabId: number): boolean {
    return this.readyTabs.has(tabId);
  }

  /**
   * 发送消息（带队列机制）
   */
  async sendMessage(
    tabId: number,
    message: any,
    timeout: number = this.MESSAGE_TIMEOUT
  ): Promise<any> {
    // 如果 tab 就绪，直接发送
    if (this.isTabReady(tabId)) {
      return await this.sendMessageDirectly(tabId, message);
    }

    // 检查 tab 是否存在且 Content Script 是否已注入
    const tabExists = await this.checkTabExists(tabId);
    if (!tabExists) {
      throw new Error(`Tab ${tabId} 不存在或已关闭`);
    }

    // 尝试主动检查 Content Script 是否就绪（通过 ping）
    const isReady = await this.checkContentScriptReady(tabId);
    if (isReady) {
      this.markTabReady(tabId);
      return await this.sendMessageDirectly(tabId, message);
    }

    // 否则加入队列，并增加超时时间（给 Content Script 更多时间加载）
    return await this.queueMessage(tabId, message, Math.max(timeout, 60000)); // 至少 60 秒
  }

  /**
   * 检查 tab 是否存在
   */
  private async checkTabExists(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.get(tabId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 主动检查 Content Script 是否就绪（通过 ping）
   */
  private async checkContentScriptReady(tabId: number): Promise<boolean> {
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(
          tabId,
          { action: "ping" },
          (response: any) => {
            if (chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(response);
            }
          }
        );
      });
      return !!response;
    } catch (error) {
      return false;
    }
  }

  /**
   * 直接发送消息（不经过队列）
   */
  private async sendMessageDirectly(
    tabId: number,
    message: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response: any) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          
          // 如果是端口关闭错误，标记 tab 为未就绪并重试
          if (
            errorMsg.includes("port closed") ||
            errorMsg.includes("Could not establish connection")
          ) {
            this.markTabNotReady(tabId);
            reject(new Error("PORT_CLOSED"));
          } else {
            reject(new Error(errorMsg));
          }
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 将消息加入队列
   */
  private async queueMessage(
    tabId: number,
    message: any,
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // 检查队列大小
      if (this.queue.length >= this.MAX_QUEUE_SIZE) {
        reject(new Error("消息队列已满"));
        return;
      }

      const queuedMessage: QueuedMessage = {
        tabId,
        message,
        resolve,
        reject,
        timestamp: Date.now(),
        retries: 0,
      };

      this.queue.push(queuedMessage);
      console.log(`📥 消息已加入队列 (Tab ${tabId}):`, message.action);

      // 设置超时（增加超时时间，给 Content Script 更多加载时间）
      const timeoutId = setTimeout(() => {
        const index = this.queue.indexOf(queuedMessage);
        if (index !== -1) {
          this.queue.splice(index, 1);
          console.error(`❌ 消息超时 (Tab ${tabId}, ${message.action}): 等待 ${timeout}ms 后仍未收到 Content Script 就绪通知`);
          reject(new Error("消息超时"));
        }
      }, timeout);

      // 定期检查 Content Script 是否就绪（每 2 秒检查一次）
      const checkInterval = setInterval(async () => {
        if (this.isTabReady(tabId)) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          // Tab 已就绪，立即处理
          this.processQueueForTab(tabId);
        } else {
          // 主动检查 Content Script 是否就绪
          const isReady = await this.checkContentScriptReady(tabId);
          if (isReady) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            this.markTabReady(tabId);
            // Tab 已就绪，立即处理
            this.processQueueForTab(tabId);
          }
        }
      }, 2000);

      // 尝试立即处理（可能 tab 在加入队列时已就绪）
      this.processQueueForTab(tabId);
    });
  }

  /**
   * 处理指定 tab 的队列消息
   */
  private async processQueueForTab(tabId: number) {
    if (!this.isTabReady(tabId)) {
      return;
    }

    const tabMessages = this.queue.filter((msg) => msg.tabId === tabId);
    if (tabMessages.length === 0) {
      return;
    }

    console.log(`🔄 处理 Tab ${tabId} 的 ${tabMessages.length} 条队列消息`);

    for (const queuedMessage of tabMessages) {
      const index = this.queue.indexOf(queuedMessage);
      if (index === -1) continue; // 消息已被移除

      try {
        const response = await this.sendMessageDirectly(
          queuedMessage.tabId,
          queuedMessage.message
        );
        
        // 移除队列中的消息
        this.queue.splice(index, 1);
        queuedMessage.resolve(response);
      } catch (error: any) {
        queuedMessage.retries++;
        
        if (queuedMessage.retries >= this.MAX_RETRIES) {
          // 超过重试次数，移除并拒绝
          this.queue.splice(index, 1);
          console.error(`❌ 消息重试次数已达上限 (${this.MAX_RETRIES})，放弃:`, queuedMessage.message.action);
          queuedMessage.reject(error);
        } else {
          // 标记 tab 为未就绪，等待下次就绪通知
          this.markTabNotReady(tabId);
          console.log(`⏳ 消息重试 (${queuedMessage.retries}/${this.MAX_RETRIES}):`, queuedMessage.message.action);
          // 不立即移除，等待 Content Script 就绪后再次处理
        }
      }
    }
  }

  /**
   * 清理过期消息
   */
  private cleanupExpiredMessages() {
    const now = Date.now();
    const expired = this.queue.filter(
      (msg) => now - msg.timestamp > this.MESSAGE_TIMEOUT
    );

    expired.forEach((msg) => {
      const index = this.queue.indexOf(msg);
      if (index !== -1) {
        this.queue.splice(index, 1);
        msg.reject(new Error("消息超时"));
      }
    });

    if (expired.length > 0) {
      console.log(`🧹 清理了 ${expired.length} 条过期消息`);
    }
  }

  /**
   * 获取队列状态（用于调试）
   */
  getQueueStatus() {
    return {
      queueSize: this.queue.length,
      readyTabs: Array.from(this.readyTabs),
      queuedTabs: Array.from(new Set(this.queue.map((msg) => msg.tabId))),
    };
  }
}

export const messageQueue = MessageQueue.getInstance();

