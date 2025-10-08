// 完全复刻Smart Web Notes的background.js功能
import { callLLMAPI, callLLMAPIStream } from "../shared/utils/api";

export default defineBackground(() => {
  console.log("Smart Web Notes Background Script Started");

  // 存储会话历史的对象，键是标签ID
  let sessionHistories: Record<string, any[]> = {};
  // 存储生成状态的对象，键是标签ID
  let generatingStates: Record<string, any> = {};
  // 用于跟踪当前正在生成的答案
  let currentAnswers: Record<string, string> = {};
  // 存储活动端口的对象，键是标签ID
  let activePorts: Record<string, any> = {};
  // 存储已完成的答案，键是标签ID
  let completedAnswers: Record<string, string> = {};

  // 监听扩展安装事件
  chrome.runtime.onInstalled.addListener(() => {
    console.log("Smart Web Notes扩展已安装");
  });

  // 处理来自popup的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveHistory") {
      // 保存会话历史
      sessionHistories[request.tabId] = request.history;
      sendResponse({ status: "ok" });
    } else if (request.action === "getHistory") {
      const history = sessionHistories[request.tabId] || [];
      const state = generatingStates[request.tabId] || { isGenerating: false };

      // 如果正在生成答案，确保返回的历史记录中包含用户问题
      if (state.isGenerating && state.pendingQuestion) {
        const lastMessage = history[history.length - 1];
        if (
          !lastMessage ||
          !lastMessage.isUser ||
          lastMessage.content !== state.pendingQuestion
        ) {
          // 创建一个新的历史记录数组，包含用户问题
          const updatedHistory = [
            ...history,
            { content: state.pendingQuestion, isUser: true },
          ];
          sendResponse({
            history: updatedHistory,
            isGenerating: state.isGenerating,
            pendingQuestion: state.pendingQuestion,
            currentAnswer: currentAnswers[request.tabId] || "",
          });
          return true;
        }
      }

      sendResponse({
        history: history,
        isGenerating: state.isGenerating,
        pendingQuestion: state.pendingQuestion,
        currentAnswer: currentAnswers[request.tabId] || "",
      });
    } else if (request.action === "clearHistory") {
      // 清除会话历史
      delete sessionHistories[request.tabId];
      delete generatingStates[request.tabId];
      delete currentAnswers[request.tabId];
      sendResponse({ status: "ok" });
    } else if (request.action === "generateAnswer") {
      // 开始生成答案
      const tabId = sender.tab?.id?.toString() || "unknown";
      const state = generatingStates[tabId] || {};

      if (!state.isGenerating) {
        console.log("开始生成答案:", { tabId, question: request.question });

        // 获取页面内容
        chrome.tabs
          .sendMessage(parseInt(tabId), { action: "getPageContent" })
          .then(async (response) => {
            try {
              await handleAnswerGeneration(
                tabId,
                response.content || "",
                request.question
              );
            } catch (error) {
              console.error("生成答案失败:", error);
            }
          })
          .catch(async (error) => {
            console.error("获取页面内容失败:", error);
            try {
              await handleAnswerGeneration(tabId, "", request.question);
            } catch (genError) {
              console.error("生成答案失败:", genError);
            }
          });
      }
      sendResponse({ success: true });
    } else if (request.action === "getGeneratingState") {
      // 获取生成状态
      sendResponse(generatingStates[request.tabId] || { isGenerating: false });
    } else if (request.action === "openPopup") {
      // 打开扩展的popup
      chrome.action.openPopup();
      sendResponse({ status: "ok" });
    } else if (request.action === "getCurrentTab") {
      // 返回发送消息的标签页ID
      sendResponse({ tabId: sender.tab.id });
    } else if (request.action === "openOptions") {
      // 打开选项页面
      chrome.runtime.openOptionsPage();
      sendResponse({ status: "ok" });
    }
    return true;
  });

  // 处理答案生成
  async function handleAnswerGeneration(
    tabId: string,
    pageContent: string,
    question: string
  ) {
    try {
      console.log("开始生成答案:", { tabId, question });

      // 立即将用户问题添加到历史记录
      let chatHistory = sessionHistories[tabId] || [];
      chatHistory.push({ content: question, isUser: true });
      sessionHistories[tabId] = chatHistory;

      // 设置生成状态
      generatingStates[tabId] = {
        isGenerating: true,
        pendingQuestion: question,
      };

      // 获取设置
      const settings = await chrome.storage.sync.get({
        apiType: "custom",
        maxTokens: 2048,
        temperature: 0.7,
        enableContext: true,
        maxContextRounds: 3,
        systemPrompt:
          "你是一个帮助理解网页内容的AI助手。请使用Markdown格式回复。",
        custom_apiKey: "",
        custom_apiBase: "https://api.deepseek.com/chat/completions",
        custom_model: "deepseek-chat",
      });

      // 获取自定义API配置
      const apiKey = settings.custom_apiKey;
      const apiBase = settings.custom_apiBase;
      const model = settings.custom_model;

      console.log("API配置:", {
        apiType: settings.apiType,
        apiBase,
        model,
        hasApiKey: !!apiKey,
        apiKey: apiKey ? apiKey.substring(0, 10) + "..." : "无",
      });

      if (!apiBase || !model) {
        throw new Error("API配置不完整，请检查设置");
      }

      if (!apiKey) {
        throw new Error("API密钥未配置，请在设置页面配置API密钥");
      }

      // 构建用于API调用的历史（不包含刚添加的用户问题）
      let contextHistory = chatHistory.slice(0, -1); // 移除最后添加的用户问题

      // 如果启用了上下文，保留最近的对话
      if (settings.enableContext && contextHistory.length > 0) {
        // 保留最近的几轮对话
        const maxRounds = settings.maxContextRounds || 3;
        const maxMessages = maxRounds * 2; // 每轮包含一问一答
        if (contextHistory.length > maxMessages) {
          contextHistory = contextHistory.slice(-maxMessages);
        }
      } else {
        contextHistory = [];
      }

      // 构建完整的消息数组
      const messages: any[] = [
        {
          role: "system",
          content:
            settings.systemPrompt ||
            "你是一个帮助理解网页内容的AI助手。请使用Markdown格式回复。",
        },
      ];

      // 添加历史对话
      if (contextHistory.length > 0) {
        messages.push(
          ...contextHistory.map((msg) => ({
            role: msg.isUser ? "user" : "assistant",
            content: msg.content,
          }))
        );
      }

      // 添加当前问题和页面内容
      messages.push({
        role: "user",
        content: `网页内容：\n${pageContent}\n\n问题：${question}`,
      });

      console.log("发送到LLM的消息数:", messages.length);

      // 使用流式API调用
      let streamingResponse = "";

      await callLLMAPIStream(
        apiBase,
        apiKey,
        model,
        messages,
        settings,
        (chunk: string) => {
          // 处理每个流式数据块
          console.log("收到流式数据块:", chunk);
          streamingResponse += chunk;
          currentAnswers[tabId] = streamingResponse;

          // 通知content script有新的数据块
          chrome.tabs
            .sendMessage(parseInt(tabId), {
              action: "streamChunk",
              chunk: chunk,
              fullResponse: streamingResponse,
            })
            .catch((error) => {
              console.error("发送流式数据块失败:", error);
            });
        },
        (fullResponse: string) => {
          // 流式响应完成
          console.log(
            "收到完整LLM响应:",
            fullResponse.substring(0, 100) + "..."
          );

          // 保存完整答案
          currentAnswers[tabId] = fullResponse;
          completedAnswers[tabId] = fullResponse;

          // 更新生成状态
          generatingStates[tabId] = {
            isGenerating: false,
            pendingQuestion: null,
          };

          // 更新会话历史（添加AI回答）
          chatHistory.push({ content: fullResponse, isUser: false });
          sessionHistories[tabId] = chatHistory;

          // 通知content script流式响应完成
          chrome.tabs
            .sendMessage(parseInt(tabId), {
              action: "streamComplete",
              fullResponse: fullResponse,
            })
            .catch((error) => {
              console.error("发送流式完成消息失败:", error);
            });
        },
        (error: Error) => {
          // 处理错误
          console.error("流式API调用失败:", error);

          // 更新生成状态
          generatingStates[tabId] = {
            isGenerating: false,
            pendingQuestion: null,
          };

          // 添加错误消息到历史
          chatHistory.push({
            content: `抱歉，生成答案时出现错误：${error.message || "未知错误"}`,
            isUser: false,
          });
          sessionHistories[tabId] = chatHistory;

          // 通知content script发生错误
          chrome.tabs
            .sendMessage(parseInt(tabId), {
              action: "streamError",
              error: error.message,
            })
            .catch((sendError) => {
              console.error("发送错误消息失败:", sendError);
            });
        }
      );

      console.log("答案生成完成，历史记录数量:", chatHistory.length);
    } catch (error) {
      console.error("生成答案失败:", error);

      // 更新生成状态
      generatingStates[tabId] = {
        isGenerating: false,
        pendingQuestion: null,
      };

      // 添加错误消息到历史
      const history = sessionHistories[tabId] || [];
      history.push({
        content: `抱歉，生成答案时出现错误：${
          error instanceof Error ? error.message : "未知错误"
        }`,
        isUser: false,
      });
      sessionHistories[tabId] = history;

      // 通知content script发生错误
      chrome.tabs
        .sendMessage(parseInt(tabId), {
          action: "streamError",
          error: error instanceof Error ? error.message : "未知错误",
        })
        .catch((sendError) => {
          console.error("发送错误消息失败:", sendError);
        });
    }
  }

  // 调用LLM API的函数
  async function callLLMAPI(
    apiBase: string,
    apiKey: string,
    model: string,
    messages: any[],
    settings: any
  ) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    let requestBody: any;

    if (settings.apiType === "ollama") {
      // Ollama API 格式
      requestBody = {
        model: model,
        messages: messages,
        stream: false,
        options: {
          temperature: settings.temperature || 0.7,
          num_predict: settings.maxTokens || 2048,
        },
      };
    } else {
      // OpenAI API 格式
      requestBody = {
        model: model,
        messages: messages,
        max_tokens: settings.maxTokens || 2048,
        temperature: settings.temperature || 0.7,
        stream: false,
      };
    }

    const response = await fetch(apiBase, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API请求失败: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();

    if (settings.apiType === "ollama") {
      if (data.message && data.message.content) {
        return data.message.content;
      } else {
        throw new Error("Ollama响应格式不正确");
      }
    } else {
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      } else {
        throw new Error("API响应格式不正确");
      }
    }
  }

  // 处理端口连接
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "answerStream") {
      // 存储端口连接
      port.onMessage.addListener(async (request) => {
        const tabId = request.tabId;

        if (request.action === "generateAnswer") {
          activePorts[tabId] = port;
          try {
            await handleAnswerGeneration(
              tabId,
              request.pageContent,
              request.question
            );
          } catch (error) {
            if (port === activePorts[tabId]) {
              port.postMessage({ type: "error", error: error.message });
            }
          }
        }
      });

      port.onDisconnect.addListener(() => {
        // 清理端口连接
        Object.keys(activePorts).forEach((key) => {
          if (activePorts[key] === port) {
            delete activePorts[key];
          }
        });
      });
    }
  });

  console.log("Smart Web Notes Background Script Completed");
});
