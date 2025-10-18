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

// 声明chrome类型
declare const chrome: any;

// 数学渲染器已集成，无需声明KaTeX类型

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
  console.log("App.vue mounted - 初始化开始");

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

    case "removeDOMElement":
      // 移除DOM元素
      handleRemoveDOMElement(message.data, sendResponse);
      break;

    case "addDOMElement":
      // 添加DOM元素
      handleAddDOMElement(message.data, sendResponse);
      break;

    case "modifyDOMElement":
      // 修改DOM元素
      handleModifyDOMElement(message.data, sendResponse);
      break;

    case "moveDOMElement":
      // 移动DOM元素
      handleMoveDOMElement(message.data, sendResponse);
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
  streamManager.abort();
  stateManager.reset();
}

// 暴露重置函数到全局，供其他组件调用
(window as any).resetStreamState = resetStreamState;

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

// 处理流式数据块
function handleStreamChunk(data: any) {
  if (data.type === "chunk") {
    // 开始流式处理
    stateManager.startStreaming();

    // 使用流式管理器处理chunk
    streamManager.handleChunk(data);

    // 如果还没有AI消息，先添加一个
    if (
      appState.messages.value.length === 0 ||
      appState.messages.value[appState.messages.value.length - 1].isUser
    ) {
      appActions.addMessage("", false);
    }

    // 处理思考内容
    if (data.reasoningContent) {
      appActions.updateLastMessageThinking(data.reasoningContent);
    }

    // 处理回答内容
    if (data.content) {
      appActions.updateLastMessage(data.content);
    }
  } else if (data.type === "done") {
    // 检测到流式完成信号

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
          appActions.toggleThinkingCollapse(lastMessage.id);
        }, 2000); // 2秒后自动折叠
      }
    }

    // 处理浏览器控制指令
    if (data.fullResponse) {
      handleBrowserControlInstructions(data.fullResponse);
    }

    // 直接设置状态确保立即生效
    appActions.setStreaming(false);
    appActions.setGenerating(false);

    // 使用nextTick确保状态更新后DOM也更新
    nextTick(() => {
      // 强制重置状态，确保UI正确更新
      appActions.setStreaming(false);
      appActions.setGenerating(false);

      // 延迟检查，如果状态仍然不正确则强制重置
      setTimeout(() => {
        if (appState.isStreaming.value || appState.isGenerating.value) {
          appActions.setStreaming(false);
          appActions.setGenerating(false);
        }
      }, 100);
    });
  }
}

// 处理流式错误
function handleStreamError(data: any) {
  console.error("流式处理错误:", data.error);

  // 停止流式处理
  stateManager.stopStreaming();

  // 标记当前步骤为错误
  errorStep("ai_conversation", `处理失败: ${data.error}`);

  // 添加错误消息
  appActions.addMessage(`❌ 处理失败: ${data.error}`, false);

  // 重置状态
  appActions.setStreaming(false);
  appActions.setGenerating(false);
}

import { parseWebContent as extractContent } from "../shared/utils/contentExtractor";
import { promptManager } from "../shared/utils/promptManager";
import { BrowserControlService } from "../shared/services/browserControlService";

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

    console.log("检测到浏览器控制指令，开始处理...");

    // 解析指令
    const instructions = promptManager.parseBrowserControlInstructions(content);
    if (instructions.length === 0) {
      console.log("未找到有效的浏览器控制指令");
      return;
    }

    // 检查浏览器控制是否支持
    if (!BrowserControlService.isSupported()) {
      console.warn("浏览器控制功能不支持");
      appActions.addMessage("⚠️ 浏览器控制功能在当前环境中不可用", false);
      return;
    }

    // 检查用户是否启用了浏览器控制功能
    const settings = await chrome.storage.sync.get(["enableBrowserControl"]);
    if (settings.enableBrowserControl === false) {
      console.log("用户已禁用浏览器控制功能");
      appActions.addMessage("ℹ️ 浏览器控制功能已禁用，请在设置中启用", false);
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
      appActions.addMessage(
        `🎛️ **浏览器控制操作结果**\n\n${results.join("\n")}`,
        false
      );

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
        }, 500); // 延迟500ms，确保DOM变化生效
      } catch (error) {
        console.error("重新获取页面内容失败:", error);
      }
    }
  } catch (error) {
    console.error("处理浏览器控制指令失败:", error);
    appActions.addMessage(
      `❌ 处理浏览器控制指令时出错: ${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
  }
}

// DOM操作处理函数
function handleRemoveDOMElement(
  data: any,
  sendResponse: (response: any) => void
) {
  try {
    const { selector, reason } = data;
    console.log("移除DOM元素:", { selector, reason });

    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      sendResponse({
        success: false,
        error: `未找到匹配的元素: ${selector}`,
      });
      return;
    }

    let removedCount = 0;
    elements.forEach((element) => {
      element.remove();
      removedCount++;
    });

    sendResponse({
      success: true,
      data: {
        message: `已移除 ${removedCount} 个元素`,
        removedCount,
        selector,
      },
    });
  } catch (error) {
    console.error("移除DOM元素失败:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function handleAddDOMElement(data: any, sendResponse: (response: any) => void) {
  try {
    const { selector, tag, content, attributes, position, reason } = data;
    console.log("添加DOM元素:", { selector, tag, content, position, reason });

    const targetElements = document.querySelectorAll(selector);
    if (targetElements.length === 0) {
      sendResponse({
        success: false,
        error: `未找到目标元素: ${selector}`,
      });
      return;
    }

    let addedCount = 0;
    targetElements.forEach((targetElement) => {
      const newElement = document.createElement(tag || "div");

      if (content) {
        newElement.textContent = content;
      }

      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          newElement.setAttribute(key, value as string);
        });
      }

      switch (position) {
        case "before":
          targetElement.parentNode?.insertBefore(newElement, targetElement);
          break;
        case "after":
          targetElement.parentNode?.insertBefore(
            newElement,
            targetElement.nextSibling
          );
          break;
        case "inside":
        default:
          targetElement.appendChild(newElement);
          break;
      }

      addedCount++;
    });

    sendResponse({
      success: true,
      data: {
        message: `已添加 ${addedCount} 个元素`,
        addedCount,
        selector,
        tag,
      },
    });
  } catch (error) {
    console.error("添加DOM元素失败:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function handleModifyDOMElement(
  data: any,
  sendResponse: (response: any) => void
) {
  try {
    const { selector, content, attributes, reason } = data;
    console.log("修改DOM元素:", { selector, content, attributes, reason });

    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      sendResponse({
        success: false,
        error: `未找到匹配的元素: ${selector}`,
      });
      return;
    }

    let modifiedCount = 0;
    elements.forEach((element) => {
      if (content !== undefined) {
        element.textContent = content;
      }

      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          element.setAttribute(key, value as string);
        });
      }

      modifiedCount++;
    });

    sendResponse({
      success: true,
      data: {
        message: `已修改 ${modifiedCount} 个元素`,
        modifiedCount,
        selector,
      },
    });
  } catch (error) {
    console.error("修改DOM元素失败:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function handleMoveDOMElement(
  data: any,
  sendResponse: (response: any) => void
) {
  try {
    const { selector, targetSelector, position, reason } = data;
    console.log("移动DOM元素:", { selector, targetSelector, position, reason });

    const sourceElements = document.querySelectorAll(selector);
    const targetElements = document.querySelectorAll(targetSelector);

    if (sourceElements.length === 0) {
      sendResponse({
        success: false,
        error: `未找到源元素: ${selector}`,
      });
      return;
    }

    if (targetElements.length === 0) {
      sendResponse({
        success: false,
        error: `未找到目标元素: ${targetSelector}`,
      });
      return;
    }

    let movedCount = 0;
    sourceElements.forEach((sourceElement) => {
      targetElements.forEach((targetElement) => {
        switch (position) {
          case "before":
            targetElement.parentNode?.insertBefore(
              sourceElement,
              targetElement
            );
            break;
          case "after":
            targetElement.parentNode?.insertBefore(
              sourceElement,
              targetElement.nextSibling
            );
            break;
          case "inside":
          default:
            targetElement.appendChild(sourceElement);
            break;
        }
        movedCount++;
      });
    });

    sendResponse({
      success: true,
      data: {
        message: `已移动 ${movedCount} 个元素`,
        movedCount,
        selector,
        targetSelector,
      },
    });
  } catch (error) {
    console.error("移动DOM元素失败:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
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

    // 通过chrome.scripting.executeScript在页面上下文中执行JavaScript
    try {
      // 发送消息到background script执行JavaScript
      chrome.runtime.sendMessage(
        {
          action: "executeJavaScript",
          data: {
            code: javascript,
            reason: reason,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("JavaScript执行错误:", chrome.runtime.lastError);
            sendResponse({
              success: false,
              error: `JavaScript执行错误: ${chrome.runtime.lastError.message}`,
            });
          } else if (response && response.success) {
            sendResponse({
              success: true,
              data: {
                message: "JavaScript执行成功",
                result: response.result,
              },
            });
          } else {
            sendResponse({
              success: false,
              error: response?.error || "JavaScript执行失败",
            });
          }
        }
      );
    } catch (jsError) {
      console.error("JavaScript执行错误:", jsError);
      sendResponse({
        success: false,
        error: `JavaScript执行错误: ${jsError.message}`,
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
