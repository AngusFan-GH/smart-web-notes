// 对话框管理器
export interface DialogPosition {
  left: string;
  top: string;
  isCustomPosition: boolean;
}

export interface DialogSize {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

export interface DialogState {
  position: DialogPosition;
  size: DialogSize;
  isVisible: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}

export interface DialogPreferences {
  rememberPosition: boolean;
  rememberSize: boolean;
  autoHide: boolean;
  autoHideDelay: number;
  defaultPosition:
    | "bottom-right"
    | "bottom-left"
    | "top-right"
    | "top-left"
    | "center";
  defaultSize: "small" | "medium" | "large" | "custom";
  customSize?: DialogSize;
}

export class DialogManager {
  private static instance: DialogManager;
  private state: DialogState;
  private preferences: DialogPreferences;
  private resizeObserver: ResizeObserver | null = null;
  private positionTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.state = {
      position: {
        left: "auto",
        top: "auto",
        isCustomPosition: false,
      },
      size: {
        width: 400,
        height: 500,
        minWidth: 300,
        minHeight: 400,
      },
      isVisible: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 10001,
    };

    this.preferences = {
      rememberPosition: true,
      rememberSize: true,
      autoHide: true,
      autoHideDelay: 3000,
      defaultPosition: "bottom-right",
      defaultSize: "medium",
    };
  }

  public static getInstance(): DialogManager {
    if (!DialogManager.instance) {
      DialogManager.instance = new DialogManager();
    }
    return DialogManager.instance;
  }

  /**
   * 初始化对话框管理器
   */
  public async initialize(): Promise<void> {
    await this.loadPreferences();
    await this.loadDialogState();
    this.setupResizeObserver();
  }

  /**
   * 显示对话框
   */
  public showDialog(): void {
    this.state.isVisible = true;
    this.state.isMinimized = false;
    this.state.isMaximized = false;
    this.updateZIndex();
  }

  /**
   * 隐藏对话框
   */
  public hideDialog(): void {
    this.state.isVisible = false;
    this.state.isMinimized = false;
    this.state.isMaximized = false;
  }

  /**
   * 切换对话框显示状态
   */
  public toggleDialog(): void {
    if (this.state.isVisible) {
      this.hideDialog();
    } else {
      this.showDialog();
    }
  }

  /**
   * 最小化对话框
   */
  public minimizeDialog(): void {
    this.state.isMinimized = true;
    this.state.isMaximized = false;
  }

  /**
   * 最大化对话框
   */
  public maximizeDialog(): void {
    this.state.isMaximized = true;
    this.state.isMinimized = false;
    this.calculateMaximizedSize();
  }

  /**
   * 恢复对话框
   */
  public restoreDialog(): void {
    this.state.isMinimized = false;
    this.state.isMaximized = false;
  }

  /**
   * 设置对话框位置
   */
  public setPosition(left: string, top: string): void {
    this.state.position.left = left;
    this.state.position.top = top;
    this.state.position.isCustomPosition = true;
    this.updateZIndex();

    if (this.preferences.rememberPosition) {
      this.saveDialogState();
    }
  }

  /**
   * 设置对话框大小
   */
  public setSize(width: number, height: number): void {
    this.state.size.width = Math.max(width, this.state.size.minWidth);
    this.state.size.height = Math.max(height, this.state.size.minHeight);

    if (this.preferences.rememberSize) {
      this.saveDialogState();
    }
  }

  /**
   * 计算可用区域
   */
  public calculateAvailableArea(): {
    leftMargin: number;
    topMargin: number;
    rightMargin: number;
    bottomMargin: number;
    availableWidth: number;
    availableHeight: number;
  } {
    const isMobile = window.innerWidth <= 768;
    const scrollbarWidth = this.getScrollbarWidth();
    const baseMargin = isMobile ? 10 : 20;
    const scrollbarMargin = isMobile ? 3 : 16;

    return {
      leftMargin: baseMargin,
      topMargin: baseMargin,
      rightMargin: baseMargin + scrollbarWidth + scrollbarMargin,
      bottomMargin: baseMargin + scrollbarMargin,
      availableWidth:
        window.innerWidth - baseMargin - scrollbarWidth - scrollbarMargin,
      availableHeight: window.innerHeight - baseMargin - scrollbarMargin,
    };
  }

  /**
   * 计算对话框样式
   */
  public calculateDialogStyle(): React.CSSProperties {
    const area = this.calculateAvailableArea();
    const isMobile = window.innerWidth <= 768;

    // 如果对话框位置是自定义的，需要检查是否超出屏幕范围
    if (this.state.position.isCustomPosition) {
      const left = parseInt(this.state.position.left) || 0;
      const top = parseInt(this.state.position.top) || 0;
      const width = this.state.size.width;
      const height = this.state.size.height;

      // 检查是否超出屏幕边界
      const rightOverflow = left + width > area.availableWidth;
      const bottomOverflow = top + height > area.availableHeight;
      const leftOverflow = left < area.leftMargin;
      const topOverflow = top < area.topMargin;

      // 如果超出范围，调整位置
      let adjustedLeft = left;
      let adjustedTop = top;

      if (rightOverflow) {
        adjustedLeft = Math.max(area.leftMargin, area.availableWidth - width);
      }
      if (bottomOverflow) {
        adjustedTop = Math.max(area.topMargin, area.availableHeight - height);
      }
      if (leftOverflow) {
        adjustedLeft = area.leftMargin;
      }
      if (topOverflow) {
        adjustedTop = area.topMargin;
      }

      // 如果位置有调整，更新存储的位置
      if (adjustedLeft !== left || adjustedTop !== top) {
        this.state.position.left = `${adjustedLeft}px`;
        this.state.position.top = `${adjustedTop}px`;
        this.saveDialogState();
      }

      return {
        position: "fixed",
        left: this.state.position.left,
        top: this.state.position.top,
        right: "auto",
        bottom: "auto",
        width: `${Math.min(this.state.size.width, area.availableWidth)}px`,
        height: `${Math.min(this.state.size.height, area.availableHeight)}px`,
        minWidth: `${this.state.size.minWidth}px`,
        minHeight: `${this.state.size.minHeight}px`,
        maxWidth: `${area.availableWidth}px`,
        maxHeight: `${area.availableHeight}px`,
        zIndex: this.state.zIndex,
      };
    }

    // 默认位置（非自定义）
    return {
      position: "fixed",
      right: `${area.rightMargin}px`,
      bottom: `${area.bottomMargin}px`,
      left: "auto",
      top: "auto",
      width: `${Math.min(this.state.size.width, area.availableWidth)}px`,
      height: `${Math.min(this.state.size.height, area.availableHeight)}px`,
      minWidth: `${this.state.size.minWidth}px`,
      minHeight: `${this.state.size.minHeight}px`,
      maxWidth: `${area.availableWidth}px`,
      maxHeight: `${area.availableHeight}px`,
      zIndex: this.state.zIndex,
    };
  }

  /**
   * 处理窗口大小变化
   */
  public handleWindowResize(): void {
    if (this.positionTimer) {
      clearTimeout(this.positionTimer);
    }

    this.positionTimer = setTimeout(() => {
      const area = this.calculateAvailableArea();

      // 如果对话框是自定义位置，检查是否需要调整
      if (this.state.position.isCustomPosition) {
        const left = parseInt(this.state.position.left) || 0;
        const top = parseInt(this.state.position.top) || 0;
        const width = this.state.size.width;
        const height = this.state.size.height;

        let needsAdjustment = false;
        let newLeft = left;
        let newTop = top;

        // 检查右边界
        if (left + width > area.availableWidth) {
          newLeft = Math.max(area.leftMargin, area.availableWidth - width);
          needsAdjustment = true;
        }

        // 检查下边界
        if (top + height > area.availableHeight) {
          newTop = Math.max(area.topMargin, area.availableHeight - height);
          needsAdjustment = true;
        }

        // 检查左边界
        if (newLeft < area.leftMargin) {
          newLeft = area.leftMargin;
          needsAdjustment = true;
        }

        // 检查上边界
        if (newTop < area.topMargin) {
          newTop = area.topMargin;
          needsAdjustment = true;
        }

        // 如果需要调整，更新位置
        if (needsAdjustment) {
          this.state.position.left = `${newLeft}px`;
          this.state.position.top = `${newTop}px`;
          this.saveDialogState();
        }
      }

      // 如果对话框尺寸超出屏幕，调整尺寸
      if (this.state.size.width > area.availableWidth) {
        this.state.size.width = Math.max(
          this.state.size.minWidth,
          area.availableWidth
        );
        this.saveDialogState();
      }

      if (this.state.size.height > area.availableHeight) {
        this.state.size.height = Math.max(
          this.state.size.minHeight,
          area.availableHeight
        );
        this.saveDialogState();
      }
    }, 100);
  }

  /**
   * 获取当前状态
   */
  public getState(): DialogState {
    return { ...this.state };
  }

  /**
   * 获取当前样式
   */
  public getStyle(): React.CSSProperties {
    return this.calculateDialogStyle();
  }

  /**
   * 更新Z-index
   */
  private updateZIndex(): void {
    this.state.zIndex = 10001 + (Date.now() % 1000);
  }

  /**
   * 计算最大化尺寸
   */
  private calculateMaximizedSize(): void {
    const area = this.calculateAvailableArea();
    this.state.size.width = area.availableWidth;
    this.state.size.height = area.availableHeight;
  }

  /**
   * 获取滚动条宽度
   */
  private getScrollbarWidth(): number {
    const outer = document.createElement("div");
    outer.style.visibility = "hidden";
    outer.style.overflow = "scroll";
    (outer.style as any).msOverflowStyle = "scrollbar";
    document.body.appendChild(outer);

    const inner = document.createElement("div");
    outer.appendChild(inner);

    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.parentNode?.removeChild(outer);

    return scrollbarWidth;
  }

  /**
   * 设置调整大小观察器
   */
  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleWindowResize();
      });

      this.resizeObserver.observe(document.body);
    }
  }

  /**
   * 加载用户偏好
   */
  private async loadPreferences(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(["dialogPreferences"]);
      if (result.dialogPreferences) {
        this.preferences = { ...this.preferences, ...result.dialogPreferences };
      }
    } catch (error) {
      console.warn("加载对话框偏好失败:", error);
    }
  }

  /**
   * 保存用户偏好
   */
  public async savePreferences(): Promise<void> {
    try {
      await chrome.storage.sync.set({ dialogPreferences: this.preferences });
    } catch (error) {
      console.warn("保存对话框偏好失败:", error);
    }
  }

  /**
   * 加载对话框状态
   */
  private async loadDialogState(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([
        "dialogPosition",
        "dialogSize",
      ]);
      if (result.dialogPosition) {
        this.state.position = {
          ...this.state.position,
          ...result.dialogPosition,
        };
      }
      if (result.dialogSize) {
        this.state.size = { ...this.state.size, ...result.dialogSize };
      }
    } catch (error) {
      console.warn("加载对话框状态失败:", error);
    }
  }

  /**
   * 保存对话框状态
   */
  private async saveDialogState(): Promise<void> {
    try {
      await chrome.storage.local.set({
        dialogPosition: this.state.position,
        dialogSize: this.state.size,
      });
    } catch (error) {
      console.warn("保存对话框状态失败:", error);
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.positionTimer) {
      clearTimeout(this.positionTimer);
    }
  }
}

// 导出单例实例
export const dialogManager = DialogManager.getInstance();

// 便捷函数
export function getDialogStyle(): React.CSSProperties {
  return dialogManager.getStyle();
}

export function showDialog(): void {
  dialogManager.showDialog();
}

export function hideDialog(): void {
  dialogManager.hideDialog();
}

export function toggleDialog(): void {
  dialogManager.toggleDialog();
}
