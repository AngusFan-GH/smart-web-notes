// 跨页面对话状态管理
// 使用 chrome.storage 持久化对话消息，确保跨页面保持状态

import type { Message } from "../types";
import { ChromeStorage } from "../storage";

const STORAGE_KEY = "conversation_messages";
const UI_STATE_KEY = "conversation_ui_state";

interface UIState {
  showFloatingBall: boolean;
  showDialog: boolean;
  activeTaskId: string | null;      // 当前活动的任务ID
  activeTabId: number | null;        // 当前活动的标签页ID
}

/**
 * 对话状态管理器
 * 负责跨页面的对话消息和 UI 状态持久化
 */
export class ConversationStore {
  private static instance: ConversationStore;
  private messages: Message[] = [];
  private uiState: UIState = {
    showFloatingBall: true,
    showDialog: false,
    activeTaskId: null,
    activeTabId: null,
  };

  private constructor() {
    // 初始化时从存储中加载（同步等待，确保状态完全加载）
    // 注意：在 Content Script 中，这会在模块加载时执行
    // 确保在页面跳转后重新加载时，状态能立即恢复
    this.loadFromStorage().catch(err => {
      console.error("初始化时加载存储失败:", err);
    });
  }

  static getInstance(): ConversationStore {
    if (!ConversationStore.instance) {
      ConversationStore.instance = new ConversationStore();
    }
    return ConversationStore.instance;
  }

  /**
   * 从存储中加载对话消息
   */
  async loadFromStorage(): Promise<void> {
    try {
      const data = await ChromeStorage.get([STORAGE_KEY, UI_STATE_KEY]);
      
      // 加载消息
      if (data[STORAGE_KEY]) {
        this.messages = data[STORAGE_KEY] as Message[];
        console.log(`📥 从存储加载了 ${this.messages.length} 条消息`);
      }

      // 加载 UI 状态
      if (data[UI_STATE_KEY]) {
        this.uiState = { ...this.uiState, ...data[UI_STATE_KEY] };
        console.log("📥 从存储加载了 UI 状态:", this.uiState);
      }
    } catch (error) {
      console.error("加载对话状态失败:", error);
    }
  }

  /**
   * 保存对话消息到存储
   */
  async saveMessages(): Promise<void> {
    try {
      await ChromeStorage.set({ [STORAGE_KEY]: this.messages });
      console.log(`💾 保存了 ${this.messages.length} 条消息到存储`);
    } catch (error) {
      console.error("保存对话消息失败:", error);
    }
  }

  /**
   * 保存 UI 状态到存储
   */
  async saveUIState(): Promise<void> {
    try {
      await ChromeStorage.set({ [UI_STATE_KEY]: this.uiState });
    } catch (error) {
      console.error("保存 UI 状态失败:", error);
    }
  }

  /**
   * 获取所有消息
   * 如果消息还未加载，会先等待加载完成
   */
  async getMessages(): Promise<Message[]> {
    // 确保消息已从存储中加载
    if (this.messages.length === 0) {
      await this.loadFromStorage();
    }
    return [...this.messages];
  }

  /**
   * 同步获取消息（不等待加载，用于快速访问）
   */
  getMessagesSync(): Message[] {
    return [...this.messages];
  }

  /**
   * 添加消息
   */
  async addMessage(message: Message): Promise<void> {
    this.messages.push(message);
    await this.saveMessages();
  }

  /**
   * 更新最后一条消息
   */
  async updateLastMessage(updater: (message: Message) => void): Promise<void> {
    if (this.messages.length > 0) {
      const lastMessage = this.messages[this.messages.length - 1];
      updater(lastMessage);
      await this.saveMessages();
    }
  }

  /**
   * 删除指定消息
   */
  async deleteMessage(messageId: string): Promise<void> {
    this.messages = this.messages.filter(msg => msg.id !== messageId);
    await this.saveMessages();
  }

  /**
   * 清空消息
   */
  async clearMessages(): Promise<void> {
    this.messages = [];
    await ChromeStorage.remove(STORAGE_KEY);
  }

  /**
   * 获取 UI 状态
   * 如果状态还未加载，会先等待加载完成
   */
  async getUIState(): Promise<UIState> {
    // 确保状态已从存储中加载
    await this.loadFromStorage();
    return { ...this.uiState };
  }

  /**
   * 同步获取 UI 状态（不等待加载，用于快速访问）
   */
  getUIStateSync(): UIState {
    return { ...this.uiState };
  }

  /**
   * 更新 UI 状态
   */
  async updateUIState(updates: Partial<UIState>): Promise<void> {
    this.uiState = { ...this.uiState, ...updates };
    await this.saveUIState();
  }

  /**
   * 设置活动任务
   */
  async setActiveTask(taskId: string, tabId: number): Promise<void> {
    this.uiState.activeTaskId = taskId;
    this.uiState.activeTabId = tabId;
    this.uiState.showDialog = true;  // 自动打开对话窗口
    await this.saveUIState();
  }

  /**
   * 清除活动任务
   */
  async clearActiveTask(): Promise<void> {
    this.uiState.activeTaskId = null;
    this.uiState.activeTabId = null;
    await this.saveUIState();
  }

  /**
   * 监听 UI 状态变化（跨标签页同步）
   */
  watchUIState(callback: (state: UIState) => void): () => void {
    const listener = (changes: any, areaName: string) => {
      if (areaName === 'sync' && changes[UI_STATE_KEY]) {
        this.uiState = { ...this.uiState, ...changes[UI_STATE_KEY].newValue };
        callback(this.uiState);
      }
    };
    
    chrome.storage.onChanged.addListener(listener);
    
    // 立即调用一次，传递当前状态
    callback(this.uiState);
    
    // 返回取消监听的函数
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }

  /**
   * 重置所有状态
   */
  async reset(): Promise<void> {
    this.messages = [];
    this.uiState = {
      showFloatingBall: true,
      showDialog: false,
      activeTaskId: null,
      activeTabId: null,
    };
    await ChromeStorage.remove([STORAGE_KEY, UI_STATE_KEY]);
  }
}

export const conversationStore = ConversationStore.getInstance();

