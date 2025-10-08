import type { ApiRequest, ApiResponse, Settings } from "../types";
import { fetchEventSource } from "@microsoft/fetch-event-source";

// API 调用工具函数 - 支持流式响应（使用微软SSE库）
export async function callLLMAPIStream(
  apiBase: string,
  apiKey: string,
  model: string,
  messages: any[],
  settings: Settings,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  let requestBody: ApiRequest;

  // 调试：显示API类型
  console.log("🔍 API类型检查:", {
    apiType: settings.apiType,
    isCustom: settings.apiType === "custom",
  });

  // OpenAI兼容API格式
  requestBody = {
    model: model,
    messages: messages,
    max_tokens: settings.maxTokens || 2048,
    temperature: settings.temperature || 0.7,
    stream: true,
  };

  let fullResponse = "";

  // 打印请求信息用于调试
  console.log("💬 [聊天对话] 使用SSE发送API请求:", {
    url: apiBase,
    model: model,
    stream: requestBody.stream, // 显示stream参数
  });
  console.log("📦 请求体:", JSON.stringify(requestBody, null, 2));
  console.log("🔑 请求头:", headers);

  try {
    await fetchEventSource(apiBase, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
      onopen: async (response) => {
        console.log("🔗 SSE连接已建立:", response.status, response.statusText);
        console.log(
          "📄 响应Content-Type:",
          response.headers.get("content-type")
        );

        if (
          response.ok &&
          response.headers.get("content-type")?.includes("text/event-stream")
        ) {
          console.log("✅ SSE连接成功，开始接收流式数据");
          return; // 一切正常
        } else if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          // 客户端错误，不要重试
          throw new Error(
            `API请求失败: ${response.status} ${response.statusText}`
          );
        } else {
          throw new Error(
            `API请求失败: ${response.status} ${response.statusText}`
          );
        }
      },
      onmessage: (event) => {
        console.log("📨 收到SSE消息:", event.data);
        try {
          if (event.data === "[DONE]") {
            console.log("🏁 收到[DONE]信号，流式响应完成");
            onComplete(fullResponse);
            return;
          }

          // 处理SSE数据格式：去掉 "data: " 前缀
          let jsonData = event.data;
          if (jsonData.startsWith("data: ")) {
            jsonData = jsonData.substring(6); // 去掉 "data: " 前缀
          }

          // 跳过空数据
          if (!jsonData.trim()) {
            return;
          }

          const data = JSON.parse(jsonData);
          let content = "";

          // OpenAI兼容格式解析
          content = data.choices?.[0]?.delta?.content || "";

          if (content) {
            console.log("💬 提取到内容:", content);
            fullResponse += content;
            onChunk(content);
          }
        } catch (e) {
          console.warn("⚠️ 解析SSE数据失败:", e, "原始数据:", event.data);
        }
      },
      onerror: (error) => {
        console.error("❌ SSE连接错误:", error);
        console.error("错误详情:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
        onError(new Error(`SSE连接错误: ${error}`));
        throw error; // 停止重试
      },
      onclose: () => {
        console.log("🔌 SSE连接已关闭，最终响应:", fullResponse);
        onComplete(fullResponse);
      },
    });
  } catch (error) {
    console.error("💥 SSE API调用失败:", error);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

// 兼容性：保留原有的非流式API调用
export async function callLLMAPI(
  apiBase: string,
  apiKey: string,
  model: string,
  messages: any[],
  settings: Settings
): Promise<string> {
  return new Promise((resolve, reject) => {
    let fullResponse = "";

    callLLMAPIStream(
      apiBase,
      apiKey,
      model,
      messages,
      settings,
      (chunk) => {
        fullResponse += chunk;
      },
      (completeResponse) => {
        resolve(completeResponse);
      },
      (error) => {
        reject(error);
      }
    );
  });
}

// 测试 API 配置
export async function testApiConfig(settings: Settings): Promise<string> {
  const apiKey = settings[`${settings.apiType}_apiKey`];
  const apiBase = settings[`${settings.apiType}_apiBase`];
  const model = settings[`${settings.apiType}_model`];

  // 设置基础headers
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // 添加Authorization头
  if (!apiKey) {
    throw new Error("API密钥是必填项");
  }
  headers["Authorization"] = `Bearer ${apiKey}`;

  // OpenAI兼容API格式
  const requestBody = {
    model: model,
    messages: [
      {
        role: "system",
        content: "你是一个帮助理解网页内容的AI助手。",
      },
      {
        role: "user",
        content: "这是一条测试消息，请回复：API配置测试成功",
      },
    ],
    max_tokens: 50,
    temperature: 0.7,
    stream: false,
  };

  const response = await fetch(apiBase, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error?.message || "请求失败");
    } catch (e) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }
  }

  const data: ApiResponse = await response.json();

  // OpenAI兼容格式解析
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  } else {
    throw new Error("API响应格式不正确");
  }
}
