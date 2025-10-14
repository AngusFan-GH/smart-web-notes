import { DEFAULT_SETTINGS } from "../src/shared/constants/defaults";
import type {
  ChromeMessage,
  ChromeResponse,
  StreamChunk,
} from "../src/shared/types";

export default defineBackground(() => {
  console.log("Web Assistant Background Script Started");

  // 存储当前流式请求的AbortController
  let currentStreamController: AbortController | null = null;
  let isStreaming = false; // 跟踪流式状态

  // 监听来自Content Script的消息
  chrome.runtime.onMessage.addListener(
    (
      message: ChromeMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: ChromeResponse) => void
    ) => {
      console.log("Background收到消息:", message.action);

      // 处理不同类型的消息
      switch (message.action) {
        case "testCommunication":
          sendResponse({
            success: true,
            data: { message: "Background Script通信正常" },
          });
          break;

        case "getSettings":
          handleGetSettings(sendResponse);
          break;

        case "updateSettings":
          handleUpdateSettings(message.data, sendResponse);
          break;

        case "generateAnswer":
          handleGenerateAnswer(message.data, sendResponse);
          break;

        case "stopStreaming":
          handleStopStreaming(sendResponse);
          break;

        case "generateSuggestedQuestions":
          handleGenerateSuggestedQuestions(message.data, sendResponse);
          break;

        default:
          sendResponse({
            success: false,
            error: "未知的消息类型",
          });
      }

      return true; // 保持消息通道打开
    }
  );

  // 获取设置
  async function handleGetSettings(
    sendResponse: (response: ChromeResponse) => void
  ) {
    try {
      const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      // 动态加载apiService
      const { apiService } = await import("../src/shared/services/apiService");
      apiService.setSettings(settings);
      sendResponse({
        success: true,
        data: settings,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 更新设置
  async function handleUpdateSettings(
    data: any,
    sendResponse: (response: ChromeResponse) => void
  ) {
    try {
      await chrome.storage.sync.set(data);
      // 动态加载apiService
      const { apiService } = await import("../src/shared/services/apiService");
      apiService.setSettings(data);
      sendResponse({
        success: true,
        data: { message: "设置已保存" },
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 生成答案
  async function handleGenerateAnswer(
    data: any,
    sendResponse: (response: ChromeResponse) => void
  ) {
    try {
      const {
        question,
        pageContent,
        conversationHistory,
        url,
        networkAnalysis,
      } = data;

      if (!question) {
        sendResponse({
          success: false,
          error: "问题不能为空",
        });
        return;
      }

      // 获取当前标签页ID
      let tabId: number;
      if (data.tabId === "current") {
        // 获取当前活动标签页
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = tabs[0]?.id;
        if (!tabId) {
          throw new Error("无法获取当前标签页ID");
        }
      } else {
        tabId = parseInt(data.tabId as string);
        if (isNaN(tabId)) {
          throw new Error("无效的标签页ID");
        }
      }

      // 检查是否已有流式请求在进行
      if (isStreaming) {
        sendResponse({
          success: false,
          error: "已有流式请求在进行中",
        });
        return;
      }

      // 创建AbortController用于控制流式请求
      currentStreamController = new AbortController();
      isStreaming = true;

      // 生成答案
      let fullResponse = "";
      try {
        // 动态加载apiService
        const { apiService } = await import(
          "../src/shared/services/apiService"
        );
        await apiService.generateAnswer(
          question,
          pageContent || "",
          (chunk: StreamChunk) => {
            // 累积完整响应
            fullResponse = chunk.fullResponse;

            // 使用 setTimeout 确保异步发送，避免阻塞
            setTimeout(() => {
              chrome.tabs
                .sendMessage(tabId, {
                  action: "streamChunk",
                  data: chunk,
                })
                .catch(() => {
                  // 忽略发送失败的错误
                });
            }, 0);
          },
          (fullResponse: string) => {
            // 发送完成信号到Content Script
            console.log("Background Script: 流式响应完成，发送done消息");
            isStreaming = false;
            currentStreamController = null;

            chrome.tabs
              .sendMessage(tabId, {
                action: "streamChunk",
                data: {
                  type: "done",
                  fullResponse: fullResponse,
                },
              })
              .then(() => {
                console.log("Background Script: done消息发送成功");
              })
              .catch((error) => {
                console.error("Background Script: done消息发送失败:", error);
              });
          },
          (error: string) => {
            // 发送错误信号到Content Script
            isStreaming = false;
            currentStreamController = null;

            chrome.tabs
              .sendMessage(tabId, {
                action: "streamError",
                data: { error },
              })
              .catch(() => {
                // 忽略发送失败的错误
              });
          },
          currentStreamController,
          conversationHistory,
          url,
          networkAnalysis
        );
      } catch (error) {
        // 重置流式状态
        isStreaming = false;
        currentStreamController = null;

        // 检查是否是AbortError（用户主动停止）
        if (error instanceof Error && error.name === "AbortError") {
          console.log("Background Script: 流式请求被用户停止");
          // 如果有已接收的内容，发送完成信号
          if (fullResponse) {
            chrome.tabs
              .sendMessage(tabId, {
                action: "streamChunk",
                data: {
                  type: "done",
                  fullResponse: fullResponse,
                },
              })
              .catch(() => {
                // 忽略发送失败的错误
              });
          }
          return; // 不发送错误消息
        }

        // 其他错误正常处理
        chrome.tabs
          .sendMessage(tabId, {
            action: "streamError",
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
          })
          .catch(() => {
            // 忽略发送失败的错误
          });
      }

      sendResponse({
        success: true,
        data: { message: "开始生成答案" },
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 处理停止流式请求
  function handleStopStreaming(
    sendResponse: (response: ChromeResponse) => void
  ) {
    console.log("Background Script: 收到停止流式请求");

    if (currentStreamController) {
      currentStreamController.abort();
      currentStreamController = null;
      isStreaming = false;
      console.log("Background Script: 已停止流式请求");
    }

    sendResponse({
      success: true,
      data: { message: "流式请求已停止" },
    });
  }

  // 生成建议问题
  async function handleGenerateSuggestedQuestions(
    data: any,
    sendResponse: (response: ChromeResponse) => void
  ) {
    try {
      const { prompt, max_tokens = 200, temperature = 0.7 } = data;

      if (!prompt) {
        sendResponse({
          success: false,
          error: "提示词不能为空",
        });
        return;
      }

      // 动态加载apiService
      const { apiService } = await import("../src/shared/services/apiService");

      // 调用API生成建议问题
      const response = await apiService.generateSuggestedQuestions(
        prompt,
        max_tokens,
        temperature
      );

      sendResponse({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error("生成建议问题失败:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
});
