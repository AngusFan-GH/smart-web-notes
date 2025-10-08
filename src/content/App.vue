<template>
  <div id="ai-assistant-content">
    <FloatingBall
      :visible="showFloatingBall && !showDialog"
      @click="openDialog"
    />
    <CustomDialog
      :visible="showDialog"
      @close="closeDialog"
      @minimize="minimizeDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import FloatingBall from "./components/FloatingBall.vue";
import CustomDialog from "./components/CustomDialog.vue";
import { useChromeAPI, useWebContent } from "../shared/composables";
import { parseWebContent } from "../shared/utils";

// 声明chrome类型
declare const chrome: any;

// 响应式数据
const showFloatingBall = ref(true);
const showDialog = ref(false);

// 初始化
onMounted(async () => {
  // 检查悬浮球显示状态
  const { showFloatingBall: storedValue = true } =
    await chrome.storage.sync.get("showFloatingBall");
  showFloatingBall.value = storedValue;

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener(handleMessage);
});

// 清理
onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleMessage);
});

// 处理消息
function handleMessage(message: any, sender: any, sendResponse: any) {
  if (message.action === "toggleFloatingBall") {
    showFloatingBall.value = !showFloatingBall.value;
    sendResponse({ status: "ok" });
  } else if (message.action === "openDialog") {
    openDialog();
    sendResponse({ status: "ok" });
  } else if (message.action === "getPageContent") {
    const content = parseWebContent();
    sendResponse({ content: content });
  } else if (message.action === "streamChunk") {
    // 处理流式数据块 - 转发给ChatDialog组件
    if (showDialog.value) {
      // 通过事件总线或直接调用ChatDialog的方法
      window.dispatchEvent(
        new CustomEvent("streamChunk", {
          detail: { chunk: message.chunk, fullResponse: message.fullResponse },
        })
      );
    }
    sendResponse({ status: "ok" });
  } else if (message.action === "streamComplete") {
    // 流式响应完成
    if (showDialog.value) {
      window.dispatchEvent(
        new CustomEvent("streamComplete", {
          detail: { fullResponse: message.fullResponse },
        })
      );
    }
    sendResponse({ status: "ok" });
  } else if (message.action === "streamError") {
    // 流式响应错误
    if (showDialog.value) {
      window.dispatchEvent(
        new CustomEvent("streamError", {
          detail: { error: message.error },
        })
      );
    }
    sendResponse({ status: "ok" });
  }
  return true; // 保持消息通道打开
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

// 打开对话框
function openDialog() {
  showDialog.value = true;
  // 对话框打开时，悬浮球会自动隐藏（通过模板中的条件判断）
}

// 关闭对话框
function closeDialog() {
  showDialog.value = false;
  // 对话框关闭时，悬浮球会自动显示（通过模板中的条件判断）
}

// 最小化对话框
function minimizeDialog() {
  showDialog.value = false;
  // 对话框最小化时，悬浮球会自动显示（通过模板中的条件判断）
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
</style>
