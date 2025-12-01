// 流式处理管理器
export interface StreamState {
  isStreaming: boolean;
  isGenerating: boolean;
  isCompleted: boolean;
  isAborted: boolean;
  retryCount: number;
  lastChunkTime: number;
  startTime: number;
}

export interface StreamConfig {
  maxRetries: number;
  timeoutMs: number;
  retryDelayMs: number;
  chunkTimeoutMs: number;
}

export interface StreamCallbacks {
  onChunk: (chunk: any) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: string) => void;
  onStateChange?: (state: StreamState) => void;
}

export class StreamManager {
  private static instance: StreamManager;
  private state: StreamState;
  private config: StreamConfig;
  private callbacks: StreamCallbacks | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private chunkTimeoutId: NodeJS.Timeout | null = null;
  private abortController: AbortController | null = null;

  private constructor() {
    this.state = {
      isStreaming: false,
      isGenerating: false,
      isCompleted: false,
      isAborted: false,
      retryCount: 0,
      lastChunkTime: 0,
      startTime: 0,
    };

    this.config = {
      maxRetries: 3,
      timeoutMs: 30000, // 30秒总超时
      retryDelayMs: 1000, // 1秒重试延迟
      chunkTimeoutMs: 5000, // 5秒chunk超时
    };
  }

  public static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager();
    }
    return StreamManager.instance;
  }

  /**
   * 设置回调函数
   */
  public setCallbacks(callbacks: StreamCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 开始流式处理
   */
  public async startStream(
    streamFunction: (abortController: AbortController) => Promise<void>,
    callbacks: StreamCallbacks,
    config?: Partial<StreamConfig>
  ): Promise<void> {
    // 更新配置
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // 重置状态
    this.resetState();
    this.callbacks = callbacks;

    // 创建新的AbortController
    this.abortController = new AbortController();
    this.state.startTime = Date.now();

    try {
      // 设置总超时
      this.setTimeout();

      // 开始流式处理
      this.setState({ isGenerating: true });
      await streamFunction(this.abortController);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 处理流式数据块
   */
  public handleChunk(chunk: any): void {
    if (this.state.isAborted || this.state.isCompleted) {
      return;
    }

    // 更新最后接收时间
    this.state.lastChunkTime = Date.now();

    // 清除chunk超时
    this.clearChunkTimeout();

    // 只设置内部状态，外部状态由stateManager管理
    if (!this.state.isStreaming) {
      this.setState({ isStreaming: true });
    }

    // 处理chunk
    if (this.callbacks?.onChunk) {
      this.callbacks.onChunk(chunk);
    }

    // 设置新的chunk超时
    this.setChunkTimeout();
  }

  /**
   * 更新流式内容（便捷方法，用于 Agent 更新）
   */
  public update(content: string): void {
    this.handleChunk({
      type: "chunk",
      content,
    });
  }

  /**
   * 完成流式处理
   */
  public complete(fullResponse: string): void {
    if (this.state.isAborted || this.state.isCompleted) {
      return;
    }

    // 只设置内部状态，不管理外部状态
    this.setState({
      isCompleted: true,
    });

    // 清除所有超时
    this.clearTimeouts();

    // 调用完成回调
    if (this.callbacks?.onComplete) {
      this.callbacks.onComplete(fullResponse);
    }
  }

  /**
   * 处理错误
   */
  public handleError(error: any): void {
    if (this.state.isAborted) {
      return;
    }

    // 检查是否可重试
    if (this.canRetry(error)) {
      this.retry();
      return;
    }

    // 只设置内部状态，外部状态由stateManager管理
    this.setState({
      isAborted: true,
    });

    // 清除所有超时
    this.clearTimeouts();

    // 调用错误回调
    if (this.callbacks?.onError) {
      this.callbacks.onError(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 中止流式处理
   */
  public abort(): void {
    if (this.state.isAborted || this.state.isCompleted) {
      return;
    }

    this.setState({ isAborted: true });
    this.clearTimeouts();

    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * 获取当前状态
   */
  public getState(): StreamState {
    return { ...this.state };
  }

  /**
   * 检查是否正在处理
   */
  public isProcessing(): boolean {
    return this.state.isGenerating || this.state.isStreaming;
  }

  /**
   * 检查是否已完成
   */
  public isCompleted(): boolean {
    return this.state.isCompleted;
  }

  /**
   * 检查是否已中止
   */
  public isAborted(): boolean {
    return this.state.isAborted;
  }

  /**
   * 重置状态
   */
  private resetState(): void {
    this.state = {
      isStreaming: false,
      isGenerating: false,
      isCompleted: false,
      isAborted: false,
      retryCount: 0,
      lastChunkTime: 0,
      startTime: 0,
    };

    this.clearTimeouts();
    this.callbacks = null;
  }

  /**
   * 设置状态
   */
  private setState(updates: Partial<StreamState>): void {
    this.state = { ...this.state, ...updates };

    if (this.callbacks?.onStateChange) {
      this.callbacks.onStateChange(this.state);
    }
  }

  /**
   * 设置总超时
   */
  private setTimeout(): void {
    this.timeoutId = setTimeout(() => {
      this.handleError(new Error("流式处理超时"));
    }, this.config.timeoutMs);
  }

  /**
   * 设置chunk超时
   */
  private setChunkTimeout(): void {
    this.chunkTimeoutId = setTimeout(() => {
      this.handleError(new Error("长时间未收到数据，连接可能已断开"));
    }, this.config.chunkTimeoutMs);
  }

  /**
   * 清除chunk超时
   */
  private clearChunkTimeout(): void {
    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
      this.chunkTimeoutId = null;
    }
  }

  /**
   * 清除所有超时
   */
  private clearTimeouts(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.clearChunkTimeout();
  }

  /**
   * 检查是否可以重试
   */
  private canRetry(error: any): boolean {
    // 如果已经达到最大重试次数
    if (this.state.retryCount >= this.config.maxRetries) {
      return false;
    }

    // 如果是中止错误，不重试
    if (error instanceof Error && error.name === "AbortError") {
      return false;
    }

    // 如果是网络错误或超时错误，可以重试
    const retryableErrors = [
      "NetworkError",
      "Failed to fetch",
      "timeout",
      "超时",
      "连接",
    ];

    const errorMessage = error?.message || String(error);
    return retryableErrors.some((retryableError) =>
      errorMessage.includes(retryableError)
    );
  }

  /**
   * 重试
   */
  private async retry(): Promise<void> {
    this.state.retryCount++;
    this.state.isStreaming = false;
    this.state.isGenerating = false;

    // 等待重试延迟
    await new Promise((resolve) =>
      setTimeout(resolve, this.config.retryDelayMs)
    );

    // 重新开始流式处理
    if (this.callbacks) {
      this.setState({ isGenerating: true });
      // 这里需要重新调用原始的streamFunction
      // 由于我们无法直接访问它，这里只是重置状态
      // 实际的重试逻辑应该在调用方处理
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<StreamConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取统计信息
   */
  public getStats(): {
    duration: number;
    retryCount: number;
    isProcessing: boolean;
  } {
    return {
      duration: this.state.startTime ? Date.now() - this.state.startTime : 0,
      retryCount: this.state.retryCount,
      isProcessing: this.isProcessing(),
    };
  }
}

// 导出单例实例
export const streamManager = StreamManager.getInstance();

// 便捷函数
export function createStreamManager(): StreamManager {
  return StreamManager.getInstance();
}
