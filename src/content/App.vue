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
import { onMounted, onUnmounted } from "vue";
import FloatingBall from "./components/FloatingBall.vue";
import CustomDialog from "./components/CustomDialog.vue";
import { appState, appActions } from "../shared/stores/appStore";
import type { ChromeMessage, ChromeResponse } from "../shared/types";

// 声明chrome类型
declare const chrome: any;

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

// 初始化
onMounted(async () => {
  console.log("App.vue mounted - 初始化开始");

  // 加载悬浮球状态
  await loadFloatingBallState();

  // 加载设置
  await loadSettings();

  // 设置消息监听
  setupMessageListener();

  // 加载 KaTeX CSS
  loadKaTeXCSS();

  // 监听停止流式事件
  window.addEventListener("stopStreaming", handleStopStreaming);

  console.log("App.vue 初始化完成");
});

// 加载 KaTeX CSS
function loadKaTeXCSS() {
  if (!document.querySelector('link[href*="katex"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
}

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

// 设置消息监听
function setupMessageListener() {
  chrome.runtime.onMessage.addListener(handleMessage);
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

// 流式超时处理
let streamTimeout: NodeJS.Timeout | null = null;

// 处理停止流式事件
function handleStopStreaming() {
  console.log("App.vue: 收到停止流式事件");

  // 清除流式超时
  if (streamTimeout) {
    clearTimeout(streamTimeout);
    streamTimeout = null;
    console.log("App.vue: 已清除流式超时");
  }

  // 确保停止所有状态
  appActions.setStreaming(false);
  appActions.setGenerating(false);

  console.log("App.vue: 流式处理已停止");
}

// 处理流式数据块
function handleStreamChunk(data: any) {
  console.log("收到流式数据块:", data);
  console.log("数据类型:", data.type);
  console.log("是否有fullResponse:", !!data.fullResponse);

  if (data.type === "chunk" && data.fullResponse) {
    console.log("开始处理流式数据块");
    appActions.setStreaming(true);

    // 清除之前的超时
    if (streamTimeout) {
      clearTimeout(streamTimeout);
    }

    // 设置新的超时，防止流式响应卡住
    streamTimeout = setTimeout(() => {
      console.warn("流式响应超时，强制停止");
      appActions.setStreaming(false);
      appActions.setGenerating(false);
    }, 30000); // 30秒超时

    // 如果还没有AI消息，先添加一个
    if (
      appState.messages.value.length === 0 ||
      appState.messages.value[appState.messages.value.length - 1].isUser
    ) {
      console.log("添加新的AI消息");
      appActions.addMessage("", false);
    }

    console.log("调用updateLastMessage");
    appActions.updateLastMessage(data.fullResponse);
  } else if (data.type === "done") {
    // 检测到流式完成信号
    console.log("Content Script: 检测到流式完成信号");
    handleStreamComplete({ fullResponse: data.fullResponse });
  } else {
    console.log("流式数据块条件不满足");
  }
}

// 处理流式完成
function handleStreamComplete(data: any) {
  console.log("Content Script: 收到流式响应完成信号:", data);

  // 清除超时
  if (streamTimeout) {
    clearTimeout(streamTimeout);
    streamTimeout = null;
    console.log("Content Script: 已清除流式超时");
  }

  // 确保停止所有状态
  appActions.setStreaming(false);
  appActions.setGenerating(false);
  console.log("Content Script: 已设置流式状态为false");

  // 如果提供了完整响应，确保最后一条消息是最新的
  if (data.fullResponse) {
    appActions.updateLastMessage(data.fullResponse);
    console.log("Content Script: 已更新最后一条消息");
  }

  console.log("Content Script: 流式响应处理完成");
}

// 处理流式错误
function handleStreamError(data: any) {
  console.error("流式响应错误:", data);

  appActions.setGenerating(false);
  appActions.setStreaming(false);

  if (data.error) {
    appActions.addMessage(`错误: ${data.error}`, false);
  }
}

// 解析网页内容
function parseWebContent(): string {
  // 克隆当前文档以供解析，不影响原始页面
  const docClone = document.cloneNode(true) as Document;

  // 在克隆的文档中移除不需要的元素
  const scripts = docClone.querySelectorAll("script");
  const styles = docClone.querySelectorAll('style, link[rel="stylesheet"]');
  const headers = docClone.querySelectorAll("header, nav");
  const footers = docClone.querySelectorAll("footer");

  // 从克隆的文档中移除元素
  [...scripts, ...styles, ...headers, ...footers].forEach((element) => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });

  // 获取主要内容（从body中提取）
  const mainContent = docClone.querySelector("body");

  // 如果找到了body元素，获取其文本内容
  const textContent = mainContent ? mainContent.innerText : "";

  // 清理文本
  return textContent
    .replace(/\s+/g, " ") // 将多个空白字符替换为单个空格
    .trim(); // 移除首尾空白
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
</style>
