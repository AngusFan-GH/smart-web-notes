import { DEFAULT_SETTINGS } from "../src/shared/constants/defaults";
import type {
  ChromeMessage,
  ChromeResponse,
  StreamChunk,
} from "../src/shared/types";
import { Interpreter } from "eval5";

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

        case "injectCSS":
          handleInjectCSS(message.data, sendResponse);
          break;

        case "removeCSS":
          handleRemoveCSS(message.data, sendResponse);
          break;

        case "executeJavaScript":
          handleExecuteJavaScript(message.data, sendResponse);
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
      // 获取所有设置，而不是只获取DEFAULT_SETTINGS中的键
      const settings = await chrome.storage.sync.get(null);
      console.log("Background script handleGetSettings读取的设置:", settings);

      // 如果没有设置，使用默认设置
      if (Object.keys(settings).length === 0) {
        console.log("存储中没有设置，使用默认设置");
        const defaultSettings = { ...DEFAULT_SETTINGS };
        sendResponse({
          success: true,
          data: defaultSettings,
        });
        return;
      }

      // 合并默认设置和存储的设置
      const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
      console.log("合并后的设置:", mergedSettings);

      // 动态加载apiService
      const { apiService } = await import("../src/shared/services/apiService");
      apiService.setSettings(mergedSettings);
      sendResponse({
        success: true,
        data: mergedSettings,
      });
    } catch (error) {
      console.error("获取设置失败:", error);
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
        domStructure,
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

        // 确保API设置已加载
        const settings = await chrome.storage.sync.get(null);
        console.log("Background script读取的设置:", settings);
        console.log("API配置检查:", {
          custom_apiKey: !!settings.custom_apiKey,
          custom_apiBase: !!settings.custom_apiBase,
          custom_model: !!settings.custom_model,
          apiType: settings.apiType,
        });

        if (
          !settings.custom_apiKey ||
          !settings.custom_apiBase ||
          !settings.custom_model ||
          settings.custom_apiKey.trim() === "" ||
          settings.custom_apiBase.trim() === "" ||
          settings.custom_model.trim() === ""
        ) {
          console.error("API配置不完整:", {
            custom_apiKey: settings.custom_apiKey,
            custom_apiBase: settings.custom_apiBase,
            custom_model: settings.custom_model,
          });
          throw new Error("API配置未设置或配置不完整");
        }

        // 设置API配置
        apiService.setSettings(settings);

        // 从content script获取DOM信息
        let domInfo = null;
        try {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tabs[0]?.id) {
            const domResponse = await chrome.tabs.sendMessage(tabs[0].id, {
              action: "getDOMInfo",
            });
            if (domResponse?.success) {
              domInfo = domResponse.data;
              console.log("获取到DOM信息:", domInfo);
            }
          }
        } catch (domError) {
          console.log("获取DOM信息失败，继续使用现有数据:", domError);
        }

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
          networkAnalysis,
          domInfo
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

      // 确保API设置已加载
      const settings = await chrome.storage.sync.get(null);
      console.log("Background script读取的设置:", settings);
      console.log("API配置检查:", {
        custom_apiKey: !!settings.custom_apiKey,
        custom_apiBase: !!settings.custom_apiBase,
        custom_model: !!settings.custom_model,
        apiType: settings.apiType,
      });

      if (
        !settings.custom_apiKey ||
        !settings.custom_apiBase ||
        !settings.custom_model ||
        settings.custom_apiKey.trim() === "" ||
        settings.custom_apiBase.trim() === "" ||
        settings.custom_model.trim() === ""
      ) {
        console.error("API配置不完整:", {
          custom_apiKey: settings.custom_apiKey,
          custom_apiBase: settings.custom_apiBase,
          custom_model: settings.custom_model,
        });
        sendResponse({
          success: false,
          error: "API配置未设置或配置不完整",
        });
        return;
      }

      // 设置API配置
      apiService.setSettings(settings);

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

  // 注入CSS
  async function handleInjectCSS(
    data: any,
    sendResponse: (response: ChromeResponse) => void
  ) {
    try {
      const { css, styleId } = data;

      if (!css) {
        sendResponse({
          success: false,
          error: "CSS代码不能为空",
        });
        return;
      }

      // 获取当前活动标签页
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tabs[0]?.id) {
        sendResponse({
          success: false,
          error: "无法获取当前标签页",
        });
        return;
      }

      // 检查chrome.scripting API是否可用
      if (!chrome.scripting || !chrome.scripting.insertCSS) {
        throw new Error(
          "chrome.scripting.insertCSS API不可用，请检查manifest版本和权限"
        );
      }

      // 注入CSS (使用Manifest V3的chrome.scripting API)
      await chrome.scripting.insertCSS({
        target: { tabId: tabs[0].id },
        css: css,
      });

      console.log(`CSS注入成功: ${styleId}`);
      sendResponse({
        success: true,
        data: { message: "CSS注入成功" },
      });
    } catch (error) {
      console.error("CSS注入失败:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 移除CSS
  async function handleRemoveCSS(
    data: any,
    sendResponse: (response: ChromeResponse) => void
  ) {
    try {
      const { css, styleId } = data;

      if (!css) {
        sendResponse({
          success: false,
          error: "CSS代码不能为空",
        });
        return;
      }

      // 获取当前活动标签页
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tabs[0]?.id) {
        sendResponse({
          success: false,
          error: "无法获取当前标签页",
        });
        return;
      }

      // 检查chrome.scripting API是否可用
      if (!chrome.scripting || !chrome.scripting.removeCSS) {
        throw new Error(
          "chrome.scripting.removeCSS API不可用，请检查manifest版本和权限"
        );
      }

      // 移除CSS (使用Manifest V3的chrome.scripting API)
      await chrome.scripting.removeCSS({
        target: { tabId: tabs[0].id },
        css: css,
      });

      console.log(`CSS移除成功: ${styleId}`);
      sendResponse({
        success: true,
        data: { message: "CSS移除成功" },
      });
    } catch (error) {
      console.error("CSS移除失败:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 执行JavaScript代码
  async function handleExecuteJavaScript(
    data: any,
    sendResponse: (response: ChromeResponse) => void
  ) {
    try {
      const { code, javascript, reason } = data;
      const jsCode = code || javascript; // 支持两种参数名

      if (!jsCode) {
        sendResponse({
          success: false,
          error: "JavaScript代码不能为空",
        });
        return;
      }

      // 获取当前活动标签页
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tabs[0]?.id) {
        sendResponse({
          success: false,
          error: "无法获取当前标签页",
        });
        return;
      }

      // JavaScript执行现在由content script直接处理
      // 这里只需要转发消息到content script
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: "executeJavaScript",
          data: {
            javascript: jsCode,
            reason: data?.reason || "执行JavaScript代码",
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }

          sendResponse({
            success: response?.success || false,
            data: response?.data,
            error: response?.error,
          });
        }
      );
    } catch (error) {
      console.error("执行JavaScript失败:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
});
