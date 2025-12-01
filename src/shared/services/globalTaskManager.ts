// 全局任务管理器
// 负责管理 Agent 任务的全局状态，防止重复触发，支持跨标签页状态同步

declare const chrome: any;

export interface GlobalTaskState {
  taskId: string;              // 任务唯一ID
  isRunning: boolean;          // 是否正在运行
  activeTabId: number;         // 当前活动的标签页ID
  goal: string;                // 任务目标
  startTime: number;           // 开始时间
  currentStep: number;         // 当前步骤
  maxSteps: number;            // 最大步骤数
  status: 'running' | 'completed' | 'error' | 'stopped';  // 任务状态
  error?: string;              // 错误信息（如果有）
}

const STORAGE_KEY = 'global_task_state';

/**
 * 全局任务管理器
 * 单例模式，在 Background Script 中运行
 */
export class GlobalTaskManager {
  private static instance: GlobalTaskManager;
  private currentTask: GlobalTaskState | null = null;
  private listeners: Set<(task: GlobalTaskState | null) => void> = new Set();

  private constructor() {
    // 从存储中恢复任务状态
    this.loadFromStorage();
    
    // 监听存储变化（跨标签页同步）
    chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        this.currentTask = changes[STORAGE_KEY].newValue || null;
        this.notifyListeners();
      }
    });
  }

  static getInstance(): GlobalTaskManager {
    if (!GlobalTaskManager.instance) {
      GlobalTaskManager.instance = new GlobalTaskManager();
    }
    return GlobalTaskManager.instance;
  }

  /**
   * 从存储中加载任务状态
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY]);
      if (data[STORAGE_KEY]) {
        this.currentTask = data[STORAGE_KEY];
        console.log('📥 从存储恢复任务状态:', this.currentTask);
      }
    } catch (error) {
      console.error('加载任务状态失败:', error);
    }
  }

  /**
   * 保存任务状态到存储
   */
  private async saveToStorage(): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: this.currentTask });
    } catch (error) {
      console.error('保存任务状态失败:', error);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentTask);
      } catch (error) {
        console.error('通知监听器失败:', error);
      }
    });
  }

  /**
   * 检查是否可以启动新任务
   */
  canStartNewTask(): boolean {
    if (!this.currentTask) {
      return true;
    }
    
    // 如果任务已完成、出错或已停止，可以启动新任务
    return !this.currentTask.isRunning || 
           this.currentTask.status === 'completed' ||
           this.currentTask.status === 'error' ||
           this.currentTask.status === 'stopped';
  }

  /**
   * 获取当前任务状态
   */
  getCurrentTask(): GlobalTaskState | null {
    return this.currentTask ? { ...this.currentTask } : null;
  }

  /**
   * 启动新任务
   */
  async startTask(
    taskId: string,
    tabId: number,
    goal: string,
    maxSteps: number = 15
  ): Promise<void> {
    if (!this.canStartNewTask()) {
      throw new Error('已有任务正在运行，请先停止当前任务');
    }

    this.currentTask = {
      taskId,
      isRunning: true,
      activeTabId: tabId,
      goal,
      startTime: Date.now(),
      currentStep: 0,
      maxSteps,
      status: 'running',
    };

    await this.saveToStorage();
    this.notifyListeners();
    
    console.log('🚀 任务已启动:', this.currentTask);
  }

  /**
   * 更新任务进度
   */
  async updateProgress(step: number, status?: GlobalTaskState['status']): Promise<void> {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.currentStep = step;
    if (status) {
      this.currentTask.status = status;
    }

    await this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * 更新活动标签页ID（导航时）
   */
  async updateActiveTabId(tabId: number): Promise<void> {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.activeTabId = tabId;
    await this.saveToStorage();
    this.notifyListeners();
    
    console.log(`📍 任务活动标签页已更新: ${tabId}`);
  }

  /**
   * 完成任务
   */
  async completeTask(): Promise<void> {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.isRunning = false;
    this.currentTask.status = 'completed';
    
    await this.saveToStorage();
    this.notifyListeners();
    
    console.log('✅ 任务已完成');
  }

  /**
   * 任务出错
   */
  async failTask(error: string): Promise<void> {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.isRunning = false;
    this.currentTask.status = 'error';
    this.currentTask.error = error;
    
    await this.saveToStorage();
    this.notifyListeners();
    
    console.error('❌ 任务失败:', error);
  }

  /**
   * 停止任务
   */
  async stopTask(): Promise<void> {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.isRunning = false;
    this.currentTask.status = 'stopped';
    
    await this.saveToStorage();
    this.notifyListeners();
    
    console.log('🛑 任务已停止');
  }

  /**
   * 清理任务状态
   */
  async clearTask(): Promise<void> {
    this.currentTask = null;
    await chrome.storage.local.remove(STORAGE_KEY);
    this.notifyListeners();
    
    console.log('🧹 任务状态已清理');
  }

  /**
   * 注册任务状态变化监听器
   */
  onTaskChange(listener: (task: GlobalTaskState | null) => void): () => void {
    this.listeners.add(listener);
    
    // 立即调用一次，传递当前状态
    listener(this.currentTask);
    
    // 返回取消监听的函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 检查任务是否属于指定标签页
   */
  isTaskForTab(tabId: number): boolean {
    return this.currentTask?.activeTabId === tabId;
  }

  /**
   * 检查任务是否正在运行
   */
  isTaskRunning(): boolean {
    return this.currentTask?.isRunning === true;
  }
}

export const globalTaskManager = GlobalTaskManager.getInstance();

