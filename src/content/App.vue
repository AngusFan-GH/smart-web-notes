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

// 解析网页内容 - 使用优化后的提取器
function parseWebContent(): string {
  return extractContent();
}

// 将函数暴露给全局，供其他组件使用
(window as any).parseWebContent = parseWebContent;
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
