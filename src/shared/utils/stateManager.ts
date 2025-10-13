/**
 * 集中状态管理器
 * 统一管理所有流式处理相关的状态，确保状态一致性
 */

import { appActions } from "../stores/appStore";

export interface StreamState {
  isStreaming: boolean;
  isGenerating: boolean;
  isProcessing: boolean;
}

export interface StateChangeCallback {
  (state: StreamState): void;
}

class StateManager {
  private callbacks: StateChangeCallback[] = [];
  private currentState: StreamState = {
    isStreaming: false,
    isGenerating: false,
    isProcessing: false,
  };

  /**
   * 注册状态变化回调
   */
  public onStateChange(callback: StateChangeCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * 移除状态变化回调
   */
  public offStateChange(callback: StateChangeCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * 设置流式状态
   */
  public setStreaming(streaming: boolean): void {
    this.updateState({ isStreaming: streaming });
  }

  /**
   * 设置生成状态
   */
  public setGenerating(generating: boolean): void {
    this.updateState({ isGenerating: generating });
  }

  /**
   * 同时设置流式和生成状态
   */
  public setProcessing(streaming: boolean, generating: boolean): void {
    this.updateState({
      isStreaming: streaming,
      isGenerating: generating,
    });
  }

  /**
   * 开始流式处理
   */
  public startStreaming(): void {
    console.log("StateManager: 开始流式处理");
    this.setProcessing(true, true);
  }

  /**
   * 停止流式处理
   */
  public stopStreaming(): void {
    console.log("StateManager: 停止流式处理");
    this.setProcessing(false, false);
  }

  /**
   * 完成流式处理
   */
  public completeStreaming(): void {
    console.log("StateManager: 完成流式处理");
    this.setProcessing(false, false);
  }

  /**
   * 重置所有状态
   */
  public reset(): void {
    console.log("StateManager: 重置所有状态");
    this.setProcessing(false, false);
  }

  /**
   * 获取当前状态
   */
  public getState(): StreamState {
    return { ...this.currentState };
  }

  /**
   * 更新状态并同步到appStore
   */
  private updateState(updates: Partial<StreamState>): void {
    const oldState = { ...this.currentState };
    this.currentState = { ...this.currentState, ...updates };

    // 计算isProcessing
    this.currentState.isProcessing =
      this.currentState.isStreaming || this.currentState.isGenerating;

    // 同步到appStore
    appActions.setStreaming(this.currentState.isStreaming);
    appActions.setGenerating(this.currentState.isGenerating);

    // 触发回调
    this.notifyStateChange();

    // 调试日志
    console.log("StateManager状态变化:", {
      old: oldState,
      new: this.currentState,
    });
  }

  /**
   * 通知状态变化
   */
  private notifyStateChange(): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(this.currentState);
      } catch (error) {
        console.error("StateManager回调执行失败:", error);
      }
    });
  }
}

// 创建全局状态管理器实例
export const stateManager = new StateManager();

// 导出便捷方法
export const {
  setStreaming,
  setGenerating,
  setProcessing,
  startStreaming,
  stopStreaming,
  completeStreaming,
  reset,
  getState,
  onStateChange,
  offStateChange,
} = stateManager;
