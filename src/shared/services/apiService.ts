import type { Settings, ApiRequest, StreamChunk } from "../types";

export class ApiService {
  private static instance: ApiService;
  private settings: Settings | null = null;

  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  public setSettings(settings: Settings) {
    this.settings = settings;
  }

  public getSettings(): Settings | null {
    return this.settings;
  }

  public validateSettings(): { valid: boolean; error?: string } {
    if (!this.settings) {
      return { valid: false, error: "API配置未设置" };
    }

    if (!this.settings.custom_apiKey) {
      return { valid: false, error: "API密钥未设置" };
    }

    if (!this.settings.custom_apiBase) {
      return { valid: false, error: "API地址未设置" };
    }

    if (!this.settings.custom_model) {
      return { valid: false, error: "模型名称未设置" };
    }

    return { valid: true };
  }

  public async generateAnswer(
    question: string,
    pageContent: string,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: string) => void,
    abortController?: AbortController,
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<void> {
    try {
      // 验证配置
      const validation = this.validateSettings();
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 构建消息
      const messages = this.buildMessages(
        question,
        pageContent,
        conversationHistory
      );

      // 获取API配置
      const { custom_apiBase, custom_apiKey, custom_model } = this.settings!;

      // 构建请求
      const request: ApiRequest = {
        model: custom_model,
        messages,
        max_tokens: this.settings!.maxTokens,
        temperature: this.settings!.temperature,
        stream: true,
      };

      // 发送流式请求
      await this.sendStreamRequest(
        custom_apiBase,
        custom_apiKey,
        request,
        onChunk,
        onComplete,
        onError,
        abortController
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }

  private buildMessages(
    question: string,
    pageContent: string,
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
  ): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [];

    // 系统提示
    if (this.settings?.systemPrompt) {
      messages.push({
        role: "system",
        content: this.settings.systemPrompt,
      });
    }

    // 添加对话历史（如果启用上下文聊天）
    if (
      this.settings?.enableContext &&
      conversationHistory &&
      conversationHistory.length > 0
    ) {
      // 限制对话轮数
      const maxRounds = this.settings.maxContextRounds || 5;
      const limitedHistory = conversationHistory.slice(-maxRounds * 2); // 每轮包含一问一答

      // 添加历史对话
      limitedHistory.forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // 当前问题
    if (pageContent && this.settings?.enableContext) {
      messages.push({
        role: "user",
        content: `基于以下网页内容回答问题：\n\n${pageContent}\n\n问题：${question}`,
      });
    } else {
      messages.push({
        role: "user",
        content: question,
      });
    }

    return messages;
  }

  private async sendStreamRequest(
    apiBase: string,
    apiKey: string,
    request: ApiRequest,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: string) => void,
    abortController?: AbortController
  ): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const decoder = new TextDecoder();
    let fullResponse = "";
    let isCompleted = false; // 防止重复调用onComplete

    try {
      const fetchOptions: RequestInit = {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      };

      if (abortController) {
        fetchOptions.signal = abortController.signal;
      }

      const response = await fetch(apiBase, fetchOptions);

      if (!response.ok) {
        throw new Error(
          `API请求失败: ${response.status} ${response.statusText}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法获取响应流");
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;

          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();

            if (data === "[DONE]") {
              if (!isCompleted) {
                isCompleted = true;
                onComplete(fullResponse);
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";

              if (content) {
                fullResponse += content;
                onChunk({
                  type: "chunk",
                  content,
                  fullResponse,
                });
              }
            } catch (parseError) {
              console.warn("解析SSE数据失败:", parseError, "原始数据:", data);
              continue;
            }
          }
        }
      }

      // 如果没有收到[DONE]信号，手动完成
      if (!isCompleted) {
        isCompleted = true;
        onComplete(fullResponse);
      }
    } catch (error) {
      // 检查是否是AbortError（用户主动停止）
      if (error instanceof Error && error.name === "AbortError") {
        console.log("流式请求被用户停止，完成已接收的内容");
        // 如果有已接收的内容，完成它
        if (fullResponse && !isCompleted) {
          isCompleted = true;
          onComplete(fullResponse);
        }
        return; // 不调用onError
      }

      // 其他错误正常处理
      onError(error instanceof Error ? error.message : String(error));
    }
  }
}

export const apiService = ApiService.getInstance();
