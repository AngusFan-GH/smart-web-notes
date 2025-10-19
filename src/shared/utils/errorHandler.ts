// 错误处理工具类
export interface ErrorInfo {
  type:
    | "network"
    | "api"
    | "content"
    | "rateLimit"
    | "directCommand"
    | "unknown";
  message: string;
  userMessage: string;
  action?: string;
  retryable: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 分析错误并返回用户友好的错误信息
   */
  public analyzeError(error: any): ErrorInfo {
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || error?.status;

    // 直接命令错误 - 优先处理，直接显示具体错误信息
    if (this.isDirectCommandError(error)) {
      return {
        type: "directCommand",
        message: errorMessage,
        userMessage: errorMessage, // 直接显示原始错误信息
        action: this.getDirectCommandAction(errorMessage),
        retryable: this.isDirectCommandRetryable(errorMessage),
      };
    }

    // 网络错误
    if (this.isNetworkError(error)) {
      return {
        type: "network",
        message: errorMessage,
        userMessage: "网络连接失败，请检查网络设置后重试",
        action: "检查网络连接",
        retryable: true,
      };
    }

    // API错误
    if (this.isApiError(error)) {
      return this.handleApiError(error, errorCode);
    }

    // 内容提取错误
    if (this.isContentError(error)) {
      return {
        type: "content",
        message: errorMessage,
        userMessage: "无法提取网页内容，请尝试刷新页面或选择其他内容区域",
        action: "刷新页面",
        retryable: true,
      };
    }

    // 频率限制错误
    if (this.isRateLimitError(error)) {
      return {
        type: "rateLimit",
        message: errorMessage,
        userMessage: "请求过于频繁，请稍后再试（建议等待30秒）",
        action: "等待后重试",
        retryable: true,
      };
    }

    // 未知错误
    return {
      type: "unknown",
      message: errorMessage,
      userMessage: "发生了未知错误，请稍后重试或联系技术支持",
      action: "重试",
      retryable: true,
    };
  }

  /**
   * 检查是否为直接命令错误
   */
  private isDirectCommandError(error: any): boolean {
    const errorMessage = error?.message || String(error);
    const directCommandPatterns = [
      "当前页面没有检测到",
      "没有可重新拉取的GET端点",
      "清空消息",
      "撤销操作",
      "获取页面内容",
      "显示帮助",
      "命令执行失败",
    ];

    return directCommandPatterns.some((pattern) =>
      errorMessage.includes(pattern)
    );
  }

  /**
   * 获取直接命令的建议操作
   */
  private getDirectCommandAction(errorMessage: string): string | undefined {
    if (errorMessage.includes("当前页面没有检测到")) {
      return "等待页面加载完成或刷新页面";
    }
    if (errorMessage.includes("没有可重新拉取的GET端点")) {
      return "等待页面加载更多内容或尝试其他操作";
    }
    if (errorMessage.includes("清空消息")) {
      return "检查消息状态";
    }
    if (errorMessage.includes("撤销操作")) {
      return "检查是否有可撤销的操作";
    }
    if (errorMessage.includes("获取页面内容")) {
      return "刷新页面或选择其他内容区域";
    }
    if (errorMessage.includes("显示帮助")) {
      return "检查命令格式";
    }
    return "重试";
  }

  /**
   * 检查直接命令错误是否可重试
   */
  private isDirectCommandRetryable(errorMessage: string): boolean {
    // 大部分直接命令错误都可以重试
    return !errorMessage.includes("命令执行失败");
  }

  /**
   * 检查是否为网络错误
   */
  private isNetworkError(error: any): boolean {
    const networkErrors = [
      "NetworkError",
      "Failed to fetch",
      "net::ERR_",
      "Connection refused",
      "timeout",
    ];

    const errorMessage = error?.message || String(error);
    return networkErrors.some((networkError) =>
      errorMessage.includes(networkError)
    );
  }

  /**
   * 检查是否为API错误
   */
  private isApiError(error: any): boolean {
    const apiErrors = [
      "API request failed",
      "Invalid API key",
      "Unauthorized",
      "Forbidden",
      "Not Found",
      "Internal Server Error",
    ];

    const errorMessage = error?.message || String(error);
    return apiErrors.some((apiError) => errorMessage.includes(apiError));
  }

  /**
   * 检查是否为内容错误
   */
  private isContentError(error: any): boolean {
    const contentErrors = [
      "无法获取页面内容",
      "parseWebContent",
      "DOM",
      "content extraction",
    ];

    const errorMessage = error?.message || String(error);
    return contentErrors.some((contentError) =>
      errorMessage.includes(contentError)
    );
  }

  /**
   * 检查是否为频率限制错误
   */
  private isRateLimitError(error: any): boolean {
    const rateLimitErrors = [
      "rate limit",
      "too many requests",
      "quota exceeded",
      "429",
    ];

    const errorMessage = error?.message || String(error);
    return rateLimitErrors.some((rateLimitError) =>
      errorMessage.includes(rateLimitError)
    );
  }

  /**
   * 处理API错误
   */
  private handleApiError(error: any, errorCode?: number): ErrorInfo {
    const errorMessage = error?.message || String(error);

    switch (errorCode) {
      case 401:
        return {
          type: "api",
          message: errorMessage,
          userMessage: "API密钥无效，请检查设置中的API配置",
          action: "检查API设置",
          retryable: false,
        };

      case 403:
        return {
          type: "api",
          message: errorMessage,
          userMessage: "API访问被拒绝，请检查API权限设置",
          action: "检查API权限",
          retryable: false,
        };

      case 400:
        return {
          type: "api",
          message: errorMessage,
          userMessage: "请求参数错误，可能是内容过长或格式不正确",
          action: "检查请求内容",
          retryable: true,
        };

      case 404:
        return {
          type: "api",
          message: errorMessage,
          userMessage: "API服务不可用，请检查API地址配置",
          action: "检查API地址",
          retryable: false,
        };

      case 429:
        return {
          type: "rateLimit",
          message: errorMessage,
          userMessage: "API请求频率超限，请稍后再试",
          action: "等待后重试",
          retryable: true,
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: "api",
          message: errorMessage,
          userMessage: "API服务暂时不可用，请稍后重试",
          action: "稍后重试",
          retryable: true,
        };

      default:
        return {
          type: "api",
          message: errorMessage,
          userMessage: "API请求失败，请检查网络连接和API配置",
          action: "检查配置",
          retryable: true,
        };
    }
  }

  /**
   * 生成用户友好的错误消息
   */
  public getUserFriendlyMessage(error: any): string {
    const errorInfo = this.analyzeError(error);
    return errorInfo.userMessage;
  }

  /**
   * 检查错误是否可重试
   */
  public isRetryable(error: any): boolean {
    const errorInfo = this.analyzeError(error);
    return errorInfo.retryable;
  }

  /**
   * 获取建议的操作
   */
  public getSuggestedAction(error: any): string | undefined {
    const errorInfo = this.analyzeError(error);
    return errorInfo.action;
  }
}

// 导出单例实例
export const errorHandler = ErrorHandler.getInstance();

// 便捷函数
export function handleError(error: any): ErrorInfo {
  return errorHandler.analyzeError(error);
}

export function getUserFriendlyMessage(error: any): string {
  return errorHandler.getUserFriendlyMessage(error);
}

export function isRetryable(error: any): boolean {
  return errorHandler.isRetryable(error);
}

export function getSuggestedAction(error: any): string | undefined {
  return errorHandler.getSuggestedAction(error);
}
