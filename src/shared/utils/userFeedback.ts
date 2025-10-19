// 用户反馈管理器

// 反馈消息类型常量
export const FEEDBACK_TYPES = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
  LOADING: "loading",
} as const;

// 处理步骤状态常量
export const STEP_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

// 动作类型常量
export const ACTION_TYPES = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
} as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[keyof typeof FEEDBACK_TYPES];
export type StepStatus = (typeof STEP_STATUS)[keyof typeof STEP_STATUS];
export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

export interface FeedbackMessage {
  id: string;
  type: FeedbackType;
  title: string;
  message: string;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
    type?: ActionType;
  }>;
}

export interface ProcessingStep {
  id: string;
  name: string;
  status: StepStatus;
  message?: string;
}

export class UserFeedbackManager {
  private static instance: UserFeedbackManager;
  private feedbackMessages: FeedbackMessage[] = [];
  private processingSteps: ProcessingStep[] = [];
  private currentStepIndex = -1;

  public static getInstance(): UserFeedbackManager {
    if (!UserFeedbackManager.instance) {
      UserFeedbackManager.instance = new UserFeedbackManager();
    }
    return UserFeedbackManager.instance;
  }

  /**
   * 显示处理步骤
   */
  public showProcessingSteps(steps: Omit<ProcessingStep, "status">[]): void {
    this.processingSteps = steps.map((step) => ({
      ...step,
      status: "pending" as const,
    }));
    this.currentStepIndex = -1;
  }

  /**
   * 开始处理步骤
   */
  public startStep(stepId: string): void {
    const step = this.processingSteps.find((s) => s.id === stepId);
    if (step) {
      step.status = "processing";
      this.currentStepIndex = this.processingSteps.indexOf(step);
    }
  }

  /**
   * 完成处理步骤
   */
  public completeStep(stepId: string, message?: string): void {
    const step = this.processingSteps.find((s) => s.id === stepId);
    if (step) {
      step.status = "completed";
      if (message) {
        step.message = message;
      }
    }
  }

  /**
   * 标记步骤错误
   */
  public errorStep(stepId: string, message?: string): void {
    const step = this.processingSteps.find((s) => s.id === stepId);
    if (step) {
      step.status = STEP_STATUS.ERROR;
      if (message) {
        step.message = message;
      }
    }
  }

  /**
   * 获取当前处理步骤
   */
  public getCurrentStep(): ProcessingStep | null {
    if (
      this.currentStepIndex >= 0 &&
      this.currentStepIndex < this.processingSteps.length
    ) {
      return this.processingSteps[this.currentStepIndex];
    }
    return null;
  }

  /**
   * 获取所有处理步骤
   */
  public getAllSteps(): ProcessingStep[] {
    return [...this.processingSteps];
  }

  /**
   * 清除处理步骤
   */
  public clearSteps(): void {
    this.processingSteps = [];
    this.currentStepIndex = -1;
  }

  /**
   * 添加反馈消息
   */
  public addFeedback(feedback: Omit<FeedbackMessage, "id">): string {
    const id = `feedback_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const message: FeedbackMessage = {
      id,
      ...feedback,
    };

    this.feedbackMessages.push(message);

    // 自动移除消息
    if (message.duration && message.duration > 0) {
      setTimeout(() => {
        this.removeFeedback(id);
      }, message.duration);
    }

    return id;
  }

  /**
   * 移除反馈消息
   */
  public removeFeedback(id: string): void {
    this.feedbackMessages = this.feedbackMessages.filter(
      (msg) => msg.id !== id
    );
  }

  /**
   * 获取所有反馈消息
   */
  public getAllFeedback(): FeedbackMessage[] {
    return [...this.feedbackMessages];
  }

  /**
   * 清除所有反馈
   */
  public clearAllFeedback(): void {
    this.feedbackMessages = [];
  }

  /**
   * 显示成功消息
   */
  public showSuccess(title: string, message: string, duration = 3000): string {
    return this.addFeedback({
      type: FEEDBACK_TYPES.SUCCESS,
      title,
      message,
      duration,
    });
  }

  /**
   * 显示错误消息
   */
  public showError(
    title: string,
    message: string,
    actions?: FeedbackMessage["actions"]
  ): string {
    return this.addFeedback({
      type: FEEDBACK_TYPES.ERROR,
      title,
      message,
      actions,
    });
  }

  /**
   * 显示警告消息
   */
  public showWarning(title: string, message: string, duration = 5000): string {
    return this.addFeedback({
      type: "warning",
      title,
      message,
      duration,
    });
  }

  /**
   * 显示信息消息
   */
  public showInfo(title: string, message: string, duration = 4000): string {
    return this.addFeedback({
      type: "info",
      title,
      message,
      duration,
    });
  }

  /**
   * 显示加载消息
   */
  public showLoading(title: string, message: string): string {
    return this.addFeedback({
      type: "loading",
      title,
      message,
    });
  }

  /**
   * 生成内容分析步骤
   */
  public generateContentAnalysisSteps(): Omit<ProcessingStep, "status">[] {
    return [
      {
        id: "prepare_content",
        name: "准备内容",
        message: "正在分析网页内容并准备AI对话...",
      },
      {
        id: "ai_conversation",
        name: "AI对话处理",
        message: "正在与AI模型进行对话...",
      },
    ];
  }

  /**
   * 生成错误恢复建议
   */
  public generateErrorRecoverySuggestions(
    error: any
  ): FeedbackMessage["actions"] {
    const suggestions: FeedbackMessage["actions"] = [];

    if (error?.message?.includes("网络")) {
      suggestions.push({
        label: "检查网络连接",
        action: () => {
          window.open("chrome://settings/", "_blank");
        },
        type: "primary",
      });
    }

    if (error?.message?.includes("API")) {
      suggestions.push({
        label: "检查API设置",
        action: () => {
          // 这里可以打开设置页面
          console.log("打开API设置");
        },
        type: "primary",
      });
    }

    suggestions.push({
      label: "重试",
      action: () => {
        // 重试逻辑
        console.log("重试操作");
      },
      type: "secondary",
    });

    return suggestions;
  }

  /**
   * 生成使用提示
   */
  public generateUsageTips(): FeedbackMessage[] {
    return [
      {
        id: "tip_1",
        type: "info",
        title: "💡 使用提示",
        message:
          "您可以问我关于这个网页的任何问题，比如总结内容、解释概念、分析观点等。",
        duration: 8000,
      },
      {
        id: "tip_2",
        type: "info",
        title: "🎯 建议问题",
        message:
          '试试这些问题：\n• "总结这篇文章的主要内容"\n• "解释其中的关键概念"\n• "分析作者的观点"',
        duration: 10000,
      },
    ];
  }
}

// 导出单例实例
export const userFeedback = UserFeedbackManager.getInstance();

// 便捷函数
export function showProcessingSteps(
  steps: Omit<ProcessingStep, "status">[]
): void {
  userFeedback.showProcessingSteps(steps);
}

export function startStep(stepId: string): void {
  userFeedback.startStep(stepId);
}

export function completeStep(stepId: string, message?: string): void {
  userFeedback.completeStep(stepId, message);
}

export function errorStep(stepId: string, message?: string): void {
  userFeedback.errorStep(stepId, message);
}

export function showSuccess(
  title: string,
  message: string,
  duration = 3000
): string {
  return userFeedback.showSuccess(title, message, duration);
}

export function showError(
  title: string,
  message: string,
  actions?: FeedbackMessage["actions"]
): string {
  return userFeedback.showError(title, message, actions);
}

export function showWarning(
  title: string,
  message: string,
  duration = 5000
): string {
  return userFeedback.showWarning(title, message, duration);
}

export function showInfo(
  title: string,
  message: string,
  duration = 4000
): string {
  return userFeedback.showInfo(title, message, duration);
}

export function showLoading(title: string, message: string): string {
  return userFeedback.showLoading(title, message);
}
