import {
  SmartContext,
  AIProcessingOptions,
  AIResponse,
} from "../types/commandTypes";
import { ApiService } from "./apiService";
import { generateSmartPromptAsync } from "../utils/promptManager";

export class EnhancedAISystem {
  private static instance: EnhancedAISystem;
  private apiService: ApiService;

  private constructor() {
    this.apiService = ApiService.getInstance();
  }

  static getInstance(): EnhancedAISystem {
    if (!EnhancedAISystem.instance) {
      EnhancedAISystem.instance = new EnhancedAISystem();
    }
    return EnhancedAISystem.instance;
  }

  // 确保API设置已加载
  private async ensureApiSettings(): Promise<void> {
    if (this.apiService.getSettings()) {
      return; // 设置已存在
    }

    // 通过background script获取设置，确保与background script使用相同的设置
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "getSettings" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "从background script获取设置失败:",
            chrome.runtime.lastError
          );
          reject(
            new Error(`设置加载失败: ${chrome.runtime.lastError.message}`)
          );
          return;
        }

        if (!response.success) {
          console.error("Background script返回错误:", response.error);
          reject(new Error(response.error || "设置加载失败"));
          return;
        }

        const settings = response.data;
        console.log("从background script获取的设置:", settings);
        console.log("API配置检查:", {
          custom_apiKey: !!settings.custom_apiKey,
          custom_apiBase: !!settings.custom_apiBase,
          custom_model: !!settings.custom_model,
          apiType: settings.apiType,
        });

        if (
          settings.custom_apiKey &&
          settings.custom_apiBase &&
          settings.custom_model &&
          settings.custom_apiKey.trim() !== "" &&
          settings.custom_apiBase.trim() !== "" &&
          settings.custom_model.trim() !== ""
        ) {
          console.log("从background script找到API设置，正在设置ApiService");
          this.apiService.setSettings(settings);
          resolve();
        } else {
          console.error("未找到有效的API设置:", {
            custom_apiKey: settings.custom_apiKey,
            custom_apiBase: settings.custom_apiBase,
            custom_model: settings.custom_model,
          });
          reject(new Error("未找到API设置，请先在选项中配置API"));
        }
      });
    });
  }

  // 处理AI请求
  async processRequest(
    context: SmartContext,
    options?: AIProcessingOptions
  ): Promise<AIResponse> {
    // 确保API服务有正确的设置
    await this.ensureApiSettings();

    const enhancedPrompt = await this.buildEnhancedPrompt(context, options);

    return new Promise((resolve, reject) => {
      let fullResponse = "";
      let isComplete = false;

      this.apiService.generateAnswer(
        context.question,
        context.pageContent.text,
        (chunk) => {
          // 处理流式响应
          if (chunk.type === "content" && chunk.content) {
            fullResponse += chunk.content;
          }
        },
        (completeResponse) => {
          // 完成响应
          isComplete = true;
          resolve({
            content: completeResponse,
            metadata: {
              contextVersion: context.contextVersion,
              timestamp: Date.now(),
              processingOptions: options,
            },
          });
        },
        (error) => {
          // 错误处理
          if (!isComplete) {
            reject(new Error(error));
          }
        },
        undefined, // abortController
        context.conversationHistory,
        context.metadata.url,
        context.pageContent.networkAnalysis,
        context.pageContent.domStructure
      );
    });
  }

  // 构建增强提示词
  private async buildEnhancedPrompt(
    context: SmartContext,
    options?: AIProcessingOptions
  ): Promise<string> {
    const promptTemplate = await generateSmartPromptAsync(
      context.question,
      context.pageContent.text,
      context.metadata.url,
      context.pageContent.networkAnalysis,
      context.pageContent.domStructure,
      context.conversationHistory
    );

    let basePrompt = promptTemplate.system + "\n\n" + promptTemplate.user;

    if (options?.fallbackReason) {
      basePrompt += `\n\n注意：直接命令执行失败，原因：${options.fallbackReason}`;
    }

    // 添加上下文信息
    basePrompt += `\n\n当前上下文信息：`;
    basePrompt += `\n- 页面标题: ${context.metadata.title}`;
    basePrompt += `\n- 页面URL: ${context.metadata.url}`;
    basePrompt += `\n- 对话历史长度: ${context.conversationHistory.length}`;
    basePrompt += `\n- 上下文版本: ${context.contextVersion}`;

    return basePrompt;
  }

  // 处理流式响应块
  private handleStreamChunk(chunk: any): void {
    // 这里可以添加流式响应的处理逻辑
    console.log("收到流式响应块:", chunk);
  }

  // 处理完整响应
  private handleCompleteResponse(
    response: string,
    resolve: (value: AIResponse) => void
  ): void {
    resolve({
      content: response,
      metadata: {
        timestamp: Date.now(),
      },
    });
  }

  // 处理错误
  private handleError(error: string, reject: (reason?: any) => void): void {
    reject(new Error(error));
  }

  // 检查AI系统是否可用
  isAvailable(): boolean {
    return this.apiService !== null;
  }

  // 获取系统状态
  getSystemStatus(): { available: boolean; lastError?: string } {
    return {
      available: this.isAvailable(),
      lastError: undefined, // 可以添加错误跟踪
    };
  }
}
