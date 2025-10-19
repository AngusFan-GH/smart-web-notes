// AI意图识别服务 - 调用大模型进行意图识别
import { apiService } from "./apiService";

export interface AIIntentRequest {
  question: string;
  context?: string;
  url?: string;
}

export interface AIIntentResponse {
  intent: string;
  confidence: number;
  reasoning: string;
  needsFullHTML: boolean;
}

export class AIIntentService {
  private static instance: AIIntentService;

  private constructor() {}

  public static getInstance(): AIIntentService {
    if (!AIIntentService.instance) {
      AIIntentService.instance = new AIIntentService();
    }
    return AIIntentService.instance;
  }

  /**
   * 使用大模型进行意图识别
   */
  public async recognizeIntent(
    request: AIIntentRequest
  ): Promise<AIIntentResponse> {
    try {
      const prompt = this.buildIntentPrompt(request);

      // 直接调用API，避免使用generateAnswer（会触发意图识别循环）
      let response = "";

      const settings = apiService.getSettings();
      if (!settings) {
        throw new Error("API配置未设置");
      }

      const { custom_apiBase, custom_apiKey, custom_model } = settings;

      const apiRequest = {
        model: custom_model,
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的意图识别助手，能够准确分析用户问题的意图。请严格按照JSON格式返回结果。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
        stream: false, // 使用非流式请求避免复杂性
      };

      const fetchResponse = await fetch(custom_apiBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${custom_apiKey}`,
        },
        body: JSON.stringify(apiRequest),
      });

      if (!fetchResponse.ok) {
        throw new Error(
          `API请求失败: ${fetchResponse.status} ${fetchResponse.statusText}`
        );
      }

      const data = await fetchResponse.json();
      response = data.choices?.[0]?.message?.content || "";
      const result = this.parseIntentResponse(response);
      return result;
    } catch (error) {
      console.error("🤖 AI意图识别失败:", error);
      throw error;
    }
  }

  /**
   * 构建意图识别提示词
   */
  private buildIntentPrompt(request: AIIntentRequest): string {
    return `分析用户问题意图，返回JSON：

问题: "${request.question}"

意图选项：
- "browser_control": 页面操作（隐藏、修改、删除元素等）
- "summary": 总结内容
- "analysis": 分析内容  
- "question": 一般问题

返回JSON：
{
  "intent": "browser_control",
  "confidence": 0.9,
  "reasoning": "涉及页面元素操作",
  "needsFullHTML": true
}`;
  }

  /**
   * 解析意图识别响应
   */
  private parseIntentResponse(response: string): AIIntentResponse {
    try {
      // 尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("未找到有效的JSON响应");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 验证必需字段
      if (
        !parsed.intent ||
        typeof parsed.confidence !== "number" ||
        typeof parsed.needsFullHTML !== "boolean"
      ) {
        throw new Error("响应格式不完整");
      }

      return {
        intent: parsed.intent,
        confidence: Math.max(0, Math.min(1, parsed.confidence)), // 确保在0-1范围内
        reasoning: parsed.reasoning || "AI分析结果",
        needsFullHTML: parsed.needsFullHTML,
      };
    } catch (error) {
      console.error("解析AI意图识别响应失败:", error);

      // 返回默认响应
      return {
        intent: "question",
        confidence: 0.5,
        reasoning: "解析失败，使用默认意图",
        needsFullHTML: false,
      };
    }
  }

  /**
   * 批量识别意图（用于测试）
   */
  public async batchRecognizeIntent(
    requests: AIIntentRequest[]
  ): Promise<AIIntentResponse[]> {
    const results: AIIntentResponse[] = [];

    for (const request of requests) {
      try {
        const result = await this.recognizeIntent(request);
        results.push(result);
      } catch (error) {
        console.error(`批量识别失败 (${request.question}):`, error);
        results.push({
          intent: "question",
          confidence: 0.5,
          reasoning: "识别失败",
          needsFullHTML: false,
        });
      }
    }

    return results;
  }
}

// 导出单例实例
export const aiIntentService = AIIntentService.getInstance();
