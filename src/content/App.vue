<template>
  <div id="ai-assistant-content">
    <FloatingBall
      :visible="appState.showFloatingBall.value && !appState.showDialog.value"
      @click="appActions.openDialog"
    />
    <CustomDialog
      :visible="appState.showDialog.value"
      @close="appActions.closeDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, nextTick, watch } from "vue";
import FloatingBall from "./components/FloatingBall.vue";
import CustomDialog from "./components/CustomDialog.vue";
import { appState, appActions } from "../shared/stores/appStore";
import type { ChromeMessage, ChromeResponse } from "../shared/types";
import { streamManager } from "../shared/utils/streamManager";
import { completeStep, errorStep } from "../shared/utils/userFeedback";
import { stateManager } from "../shared/utils/stateManager";
import { getEvalInstance, transformCode } from "chrome-inject-eval";

// 声明chrome类型
declare const chrome: any;

// 数学渲染器已集成，无需声明KaTeX类型

// 使用chrome-inject-eval库创建eval实例
const evil = getEvalInstance(window);

// 执行JavaScript代码的函数
function executeJavaScriptCode(code: string): {
  success: boolean;
  result?: any;
  error?: string;
} {
  try {
    console.log("原始JavaScript代码:", code);
    console.log("代码长度:", code.length);

    // 使用chrome-inject-eval库执行代码
    const result = evil(code);
    console.log("JavaScript执行结果:", result);

    return {
      success: true,
      result: result || "JavaScript执行成功",
    };
  } catch (error) {
    console.error("JavaScript执行错误:", error);
    console.error("错误详情:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error:
        "JavaScript执行失败: " +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

// 加载悬浮球状态
async function loadFloatingBallState() {
  try {
    const { showFloatingBall = true } = await chrome.storage.sync.get(
      "showFloatingBall"
    );
    if (showFloatingBall) {
      appActions.showFloatingBall();
    } else {
      appActions.hideFloatingBall();
    }
    console.log("悬浮球状态已加载:", showFloatingBall);
  } catch (error) {
    console.error("加载悬浮球状态失败:", error);
    appActions.showFloatingBall(); // 默认显示
  }
}

// 注意：推荐问题生成标志已移动到CustomDialog组件中

// 初始化
onMounted(async () => {
  // 加载悬浮球状态
  await loadFloatingBallState();

  // 加载设置
  await loadSettings();

  // 设置消息监听
  setupMessageListener();

  // 初始化流式管理器回调
  setupStreamManagerCallbacks();

  // 数学渲染器已集成
  console.log("数学渲染器已集成");

  // 监听停止流式事件
  window.addEventListener("stopStreaming", handleStopStreaming);

  // 监听消息清除事件，重置流式完成标志
  window.addEventListener("messagesCleared", () => {
    console.log("收到消息清除事件，重置流式完成标志");
    isStreamingCompleted = false;
  });

  // 注意：推荐问题现在在对话弹框打开时请求，而不是页面加载时

  console.log("App.vue 初始化完成");

  // 调试：检查数学公式渲染状态
  setTimeout(() => {
    console.log("数学公式渲染状态检查:", {
      windowExists: typeof window !== "undefined",
      markdownItKatex: "已启用",
    });
  }, 1000);
});

// 清理
onUnmounted(() => {
  // 清理消息监听器
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.removeListener(handleMessage);
  }

  // 清理停止流式事件监听器
  window.removeEventListener("stopStreaming", handleStopStreaming);
});

// 加载设置
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getSettings",
    });

    if (response.success) {
      appActions.setSettings(response.data);
      // 同步设置到apiService
      apiService.setSettings(response.data);
      console.log("设置加载完成:", response.data);
    } else {
      console.error("加载设置失败:", response.error);
    }
  } catch (error) {
    console.error("加载设置异常:", error);
  }
}

// 注意：推荐问题生成逻辑已移动到CustomDialog组件中

// 注意：推荐问题生成和更新现在由CustomDialog组件处理

// 设置消息监听
function setupMessageListener() {
  chrome.runtime.onMessage.addListener(handleMessage);
}

// 设置流式管理器回调
function setupStreamManagerCallbacks() {
  streamManager.setCallbacks({
    onChunk: (chunk: any) => {
      console.log("StreamManager onChunk:", chunk);
      // 状态由stateManager统一管理
    },
    onComplete: (fullResponse: string) => {
      console.log("StreamManager onComplete:", fullResponse);
      // 状态由stateManager统一管理
    },
    onError: (error: string) => {
      console.error("StreamManager onError:", error);
      // 使用stateManager重置状态
      stateManager.reset();
    },
    onStateChange: (state: any) => {
      console.log("StreamManager state changed:", state);
      // 状态由stateManager统一管理
    },
  });
}

// 处理消息
function handleMessage(
  message: ChromeMessage,
  sender: any,
  sendResponse: (response: ChromeResponse) => void
) {
  console.log("Content Script收到消息:", message.action);

  switch (message.action) {
    case "streamChunk":
      // 处理流式数据块
      handleStreamChunk(message.data);
      break;

    case "streamError":
      // 处理流式错误
      handleStreamError(message.data);
      break;

    case "openDialog":
      // 打开对话窗口
      console.log("收到打开对话窗口消息");
      appActions.openDialog();
      break;

    case "closeDialog":
      // 关闭对话窗口
      console.log("收到关闭对话窗口消息");
      appActions.closeDialog();
      break;

    case "executeJavaScript":
      // 执行JavaScript代码
      handleExecuteJavaScript(message.data, sendResponse);
      break;

    case "getDialogStatus":
      // 获取对话窗口状态
      console.log("收到获取对话状态消息");
      sendResponse({
        success: true,
        isOpen: appState.showDialog.value,
      });
      break;

    case "toggleFloatingBall":
      // 切换悬浮球显示状态
      console.log("收到切换悬浮球消息", message.showFloatingBall);
      if (message.showFloatingBall !== undefined) {
        // 如果消息中包含具体状态，直接设置
        if (message.showFloatingBall) {
          appActions.showFloatingBall();
        } else {
          appActions.hideFloatingBall();
        }
      } else {
        // 否则切换状态
        appActions.toggleFloatingBall();
      }
      break;

    case "getDOMInfo":
      // 获取DOM信息
      console.log("收到获取DOM信息消息");
      try {
        const domInfo = getDOMInfo();
        sendResponse({
          success: true,
          data: domInfo,
        });
      } catch (error) {
        console.error("获取DOM信息失败:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      break;
  }

  sendResponse({ success: true });
}

// 重置流式状态
function resetStreamState() {
  console.log("重置流式状态");

  // 重置完成标志
  isStreamingCompleted = false;

  // 清除超时器
  if (streamingTimeout) {
    clearTimeout(streamingTimeout);
    streamingTimeout = null;
  }

  streamManager.abort();
  stateManager.reset();
}

// 仅重置流式完成标志（用于新对话开始）
function resetStreamingCompletedFlag() {
  console.log("重置流式完成标志");
  isStreamingCompleted = false;
}

// 暴露重置函数到全局，供其他组件调用
(window as any).resetStreamState = resetStreamState;
(window as any).resetStreamingCompletedFlag = resetStreamingCompletedFlag;

// 获取DOM信息
function getDOMInfo() {
  try {
    const body = document.body;
    if (!body) return { htmlStructure: "" };

    let html = `**页面完整HTML结构：**\n`;
    html += `\`\`\`html\n`;

    // 获取页面的主要部分
    const mainSections = [
      "header",
      "nav",
      "main",
      "article",
      "section",
      "aside",
      "footer",
    ];

    mainSections.forEach((tag) => {
      const elements = document.querySelectorAll(tag);
      if (elements.length > 0) {
        html += `<!-- ${tag.toUpperCase()} 部分 -->\n`;
        elements.forEach((el, index) => {
          const outerHTML = el.outerHTML;
          // 限制长度，避免过长
          const truncatedHTML =
            outerHTML.length > 500
              ? outerHTML.substring(0, 500) + "..."
              : outerHTML;
          html += `${truncatedHTML}\n`;
        });
        html += `\n`;
      }
    });

    // 获取包含特定文本的元素
    const textElements = document.querySelectorAll("*");
    const relevantElements: Element[] = [];

    textElements.forEach((el) => {
      if (el.textContent && el.textContent.includes("一见")) {
        relevantElements.push(el);
      }
    });

    if (relevantElements.length > 0) {
      html += `<!-- 包含"一见"文本的元素 -->\n`;
      relevantElements.forEach((el) => {
        const outerHTML = el.outerHTML;
        const truncatedHTML =
          outerHTML.length > 300
            ? outerHTML.substring(0, 300) + "..."
            : outerHTML;
        html += `${truncatedHTML}\n`;
      });
    }

    html += `\`\`\`\n`;

    return {
      htmlStructure: html,
      domStructure: {
        // 可以添加更多DOM结构信息
        mainSections: mainSections.map((tag) => ({
          tag,
          count: document.querySelectorAll(tag).length,
        })),
        totalElements: document.querySelectorAll("*").length,
        relevantElements: relevantElements.length,
      },
    };
  } catch (error) {
    console.error("获取DOM信息失败:", error);
    return { htmlStructure: "", domStructure: {} };
  }
}

// 处理停止流式事件
function handleStopStreaming() {
  resetStreamState();
}

// 流式处理超时器
let streamingTimeout: NodeJS.Timeout | null = null;

// 流式处理状态标志
let isStreamingCompleted = false;

// 处理流式数据块
function handleStreamChunk(data: any) {
  if (data.type === "chunk") {
    // 如果流式处理已经完成，忽略后续的chunk消息
    if (isStreamingCompleted) {
      console.log("流式处理已完成，忽略后续chunk消息");
      return;
    }

    // 开始流式处理（只在第一次chunk时设置）
    if (!appState.isStreaming.value) {
      // 重置流式完成标志，准备接收新的流式消息
      isStreamingCompleted = false;
      console.log("开始新的流式处理，重置完成标志");

      stateManager.startStreaming();

      // 设置超时保护，确保状态最终会被重置
      streamingTimeout = setTimeout(() => {
        if (appState.isStreaming.value || appState.isGenerating.value) {
          console.warn("流式处理超时，强制重置状态");
          stateManager.reset();
        }
        streamingTimeout = null;
      }, 30000); // 30秒超时
    }

    // 使用流式管理器处理chunk
    streamManager.handleChunk(data);

    // 如果还没有AI消息，先添加一个
    if (
      appState.messages.value.length === 0 ||
      appState.messages.value[appState.messages.value.length - 1].isUser
    ) {
      nextTick(() => {
        appActions.addMessage("", false);
      });
    }

    // 处理思考内容
    if (data.reasoningContent) {
      nextTick(() => {
        appActions.updateLastMessageThinking(data.reasoningContent);
      });
    }

    // 处理回答内容
    if (data.content) {
      nextTick(() => {
        appActions.updateLastMessage(data.content);
      });
    }
  } else if (data.type === "done") {
    // 检测到流式完成信号
    console.log("收到流式完成信号，设置完成标志");
    isStreamingCompleted = true;

    // 清除超时器
    if (streamingTimeout) {
      clearTimeout(streamingTimeout);
      streamingTimeout = null;
    }

    // 完成流式处理
    stateManager.completeStreaming();

    // 调用streamManager.complete
    streamManager.complete(data.fullResponse || "");

    // 完成AI对话处理步骤
    completeStep("ai_conversation", "AI对话处理完成");

    // 自动折叠思考内容（如果存在）
    if (appState.messages.value.length > 0) {
      const lastMessage =
        appState.messages.value[appState.messages.value.length - 1];
      if (!lastMessage.isUser && lastMessage.thinkingContent) {
        // 延迟一点时间再折叠，让用户看到思考过程
        setTimeout(() => {
          // 检查组件是否仍然存在
          if (document.querySelector("#ai-assistant-content")) {
            nextTick(() => {
              appActions.toggleThinkingCollapse(lastMessage.id);
            });
          }
        }, 2000); // 2秒后自动折叠
      }
    }

    // 处理浏览器控制指令
    if (data.fullResponse) {
      // 使用 nextTick 确保在下一个事件循环中执行
      nextTick(async () => {
        await handleBrowserControlInstructions(data.fullResponse);
        // 注意：不要在这里重置状态，因为状态已经由stateManager.completeStreaming()重置
      });
    }
    // 状态已经由stateManager.completeStreaming()重置，无需重复设置
  }
}

// 处理流式错误
function handleStreamError(data: any) {
  console.error("流式处理错误:", data.error);

  // 重置完成标志
  isStreamingCompleted = false;

  // 清除超时器
  if (streamingTimeout) {
    clearTimeout(streamingTimeout);
    streamingTimeout = null;
  }

  // 停止流式处理
  stateManager.stopStreaming();

  // 标记当前步骤为错误
  errorStep("ai_conversation", `处理失败: ${data.error}`);

  // 添加错误消息
  nextTick(() => {
    appActions.addMessage(`❌ 处理失败: ${data.error}`, false);
  });

  // 状态已经由stateManager.stopStreaming()重置，无需重复设置
}

import { parseWebContent as extractContent } from "../shared/utils/contentExtractor";
import { promptManager } from "../shared/utils/promptManager";
import { BrowserControlService } from "../shared/services/browserControlService";
import { apiService } from "../shared/services/apiService";

// 解析网页内容 - 使用优化后的提取器
function parseWebContent(): string {
  return extractContent();
}

// 将函数暴露给全局，供其他组件使用
(window as any).parseWebContent = parseWebContent;

// 处理浏览器控制指令
async function handleBrowserControlInstructions(content: string) {
  try {
    // 检查是否包含浏览器控制指令
    if (!promptManager.hasBrowserControlInstructions(content)) {
      return;
    }

    // 解析指令
    const instructions = promptManager.parseBrowserControlInstructions(content);
    if (instructions.length === 0) {
      console.log("未找到有效的浏览器控制指令");
      // 添加用户反馈
      nextTick(() => {
        appActions.addMessage(
          "❌ 解析浏览器控制指令失败，请检查指令格式",
          false
        );
      });
      return;
    }

    // 检查用户是否启用了浏览器控制功能
    const settings = await chrome.storage.sync.get(["enableBrowserControl"]);
    if (settings.enableBrowserControl === false) {
      console.log("用户已禁用浏览器控制功能");
      // 使用 nextTick 确保在下一个事件循环中执行
      nextTick(() => {
        appActions.addMessage("ℹ️ 浏览器控制功能已禁用，请在设置中启用", false);
      });
      return;
    }

    // 获取浏览器控制服务实例
    const browserControl = BrowserControlService.getInstance();

    // 执行所有指令
    const results: string[] = [];
    for (const instruction of instructions) {
      try {
        const result = await browserControl.executeAction(instruction);
        if (result.success) {
          results.push(`✅ ${result.message}`);
          console.log("浏览器控制操作成功:", result);
        } else {
          results.push(`❌ ${result.message}`);
          console.error("浏览器控制操作失败:", result);
        }
      } catch (error) {
        const errorMsg = `❌ 执行操作失败: ${
          error instanceof Error ? error.message : String(error)
        }`;
        results.push(errorMsg);
        console.error("执行浏览器控制操作时出错:", error);
      }
    }

    // 添加操作结果到对话中
    if (results.length > 0) {
      // 使用 nextTick 确保在下一个事件循环中执行
      nextTick(() => {
        appActions.addMessage(
          `🎛️ **浏览器控制操作结果**\n\n${results.join("\n")}`,
          false
        );
      });

      // 通知CustomDialog有活跃的浏览器控制操作
      window.dispatchEvent(
        new CustomEvent("browserControlsApplied", {
          detail: { hasActive: true },
        })
      );

      // 重新获取页面内容，以便下次操作时使用最新的DOM结构
      console.log("浏览器控制操作完成，重新获取页面内容...");
      try {
        // 延迟一点时间，确保DOM变化已经生效
        setTimeout(async () => {
          try {
            const { parseWebContent } = await import(
              "../shared/utils/contentExtractor"
            );
            const newContent = parseWebContent();
            console.log("页面内容已更新，新的DOM结构信息已准备就绪");

            // 可以在这里触发一个事件，通知其他组件页面内容已更新
            window.dispatchEvent(
              new CustomEvent("pageContentUpdated", {
                detail: { content: newContent },
              })
            );
          } catch (error) {
            console.error("重新获取页面内容失败:", error);
          }
        }, 500); // 延迟500ms，确保DOM变化生效
      } catch (error) {
        console.error("重新获取页面内容失败:", error);
      }
    }
  } catch (error) {
    console.error("处理浏览器控制指令失败:", error);

    // 使用 nextTick 确保在下一个事件循环中执行
    nextTick(() => {
      appActions.addMessage(
        `❌ 处理浏览器控制指令时出错: ${
          error instanceof Error ? error.message : String(error)
        }`,
        false
      );
    });
  }
}

function handleExecuteJavaScript(
  data: any,
  sendResponse: (response: any) => void
) {
  try {
    const { javascript, reason } = data;
    console.log("执行JavaScript代码:", { javascript, reason });

    if (!javascript) {
      sendResponse({
        success: false,
        error: "JavaScript代码不能为空",
      });
      return;
    }

    // 使用本地的eval5解释器执行JavaScript代码
    try {
      const result = executeJavaScriptCode(javascript);

      if (result.success) {
        console.log("JavaScript执行成功:", result.result);
        sendResponse({
          success: true,
          data: {
            message: "操作完成",
            result: result.result,
          },
        });
      } else {
        console.error("JavaScript执行失败:", result.error);
        sendResponse({
          success: false,
          error: result.error || "JavaScript执行失败",
        });
      }
    } catch (error) {
      console.error("JavaScript执行异常:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    console.error("处理JavaScript执行失败:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
</script>

<style>
#ai-assistant-content {
  /* 确保Vue组件不会影响页面样式 */
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* 重置Vue组件内的样式 */
#ai-assistant-content * {
  box-sizing: border-box;
}

/* 恢复列表样式，因为all: initial会重置它们 */
#ai-assistant-content ol,
#ai-assistant-content ul {
  margin: 0.5em 0;
  padding-left: 1.5em;
  line-height: 1.6;
}

#ai-assistant-content ol {
  list-style-type: decimal;
}

#ai-assistant-content ul {
  list-style-type: disc;
}

#ai-assistant-content li {
  margin: 0.25em 0;
  padding-left: 0.25em;
}

/* 嵌套列表 */
#ai-assistant-content ol ol,
#ai-assistant-content ul ul,
#ai-assistant-content ol ul,
#ai-assistant-content ul ol {
  margin: 0.25em 0;
  padding-left: 1em;
}

/* 列表项内容 */
#ai-assistant-content li p {
  margin: 0.25em 0;
  display: inline;
}
</style>
