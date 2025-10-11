<template>
  <div
    v-if="visible"
    class="custom-dialog"
    :style="dialogStyle"
    @mousedown="handleDialogMouseDown"
  >
    <!-- 对话框头部 -->
    <DialogHeader @close="close" @header-mousedown="handleHeaderMouseDown" />

    <!-- 对话框内容 -->
    <div class="dialog-content">
      <ChatMessages
        :messages="appState.messages.value"
        :is-processing="appState.isProcessing.value"
        :is-streaming="appState.isStreaming.value"
      />
    </div>

    <!-- 对话框底部 -->
    <div class="dialog-footer">
      <ChatInput
        ref="chatInputRef"
        v-model="userInput"
        :disabled="appState.isProcessing.value"
        :is-loading="appState.isProcessing.value"
        @submit="sendMessage"
        @keydown="handleKeydown"
        @stop="stopGeneration"
      />
    </div>

    <!-- 调整大小手柄 -->
    <!-- 右下角 -->
    <div
      class="resize-handle resize-handle-se"
      @mousedown="(event) => handleResizeStart('se', event)"
    ></div>
    <!-- 左下角 -->
    <div
      class="resize-handle resize-handle-sw"
      @mousedown="(event) => handleResizeStart('sw', event)"
    ></div>
    <!-- 右上角 -->
    <div
      class="resize-handle resize-handle-ne"
      @mousedown="(event) => handleResizeStart('ne', event)"
    ></div>
    <!-- 左上角 -->
    <div
      class="resize-handle resize-handle-nw"
      @mousedown="(event) => handleResizeStart('nw', event)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from "vue";
import { appState, appActions } from "../../shared/stores/appStore";
import type { ChromeMessage, ChromeResponse } from "../../shared/types";
import DialogHeader from "./DialogHeader.vue";
import ChatMessages from "./ChatMessages.vue";
import ChatInput from "./ChatInput.vue";

// 声明chrome类型
declare const chrome: any;

interface Props {
  visible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
});

const emit = defineEmits<{
  close: [];
  "update:visible": [value: boolean];
}>();

// 响应式数据
const userInput = ref("");
const chatInputRef = ref();

// 对话框位置和大小
const dialogPosition = reactive({
  left: "auto",
  top: "auto",
  isCustomPosition: false,
});

const dialogSize = reactive({
  width: 400,
  height: 500,
  minWidth: 300,
  minHeight: 400,
});

// 计算样式
const dialogStyle = computed(() => ({
  position: "fixed" as const,
  right: dialogPosition.isCustomPosition ? "auto" : "20px",
  bottom: dialogPosition.isCustomPosition ? "auto" : "80px",
  left: dialogPosition.isCustomPosition ? dialogPosition.left : "auto",
  top: dialogPosition.isCustomPosition ? dialogPosition.top : "auto",
  width: `${dialogSize.width}px`,
  height: `${dialogSize.height}px`,
  minWidth: `${dialogSize.minWidth}px`,
  minHeight: `${dialogSize.minHeight}px`,
  maxWidth: "90vw",
  maxHeight: "80vh",
}));

// 拖动相关
let isDragging = false;
let dragCurrentX = 0;
let dragCurrentY = 0;
let dragInitialX = 0;
let dragInitialY = 0;

// 调整大小相关
let isResizing = false;
let resizeDirection = "";
let resizeInitialX = 0;
let resizeInitialY = 0;
let resizeInitialWidth = 0;
let resizeInitialHeight = 0;
let resizeInitialLeft = 0;
let resizeInitialTop = 0;

// 初始化
onMounted(async () => {
  await loadDialogPosition();
  await loadDialogSize();
});

// 加载对话框位置
async function loadDialogPosition() {
  try {
    const result = await chrome.storage.local.get(["dialogPosition"]);
    if (result.dialogPosition) {
      Object.assign(dialogPosition, result.dialogPosition);
    }
  } catch (error) {
    console.warn("加载对话框位置失败:", error);
  }
}

// 保存对话框位置
async function saveDialogPosition() {
  try {
    await chrome.storage.local.set({ dialogPosition });
  } catch (error) {
    console.warn("保存对话框位置失败:", error);
  }
}

// 加载对话框大小
async function loadDialogSize() {
  try {
    const result = await chrome.storage.local.get(["dialogSize"]);
    if (result.dialogSize) {
      Object.assign(dialogSize, result.dialogSize);
    }
  } catch (error) {
    console.warn("加载对话框大小失败:", error);
  }
}

// 保存对话框大小
async function saveDialogSize() {
  try {
    await chrome.storage.local.set({ dialogSize });
  } catch (error) {
    console.warn("保存对话框大小失败:", error);
  }
}

// 关闭对话框
function close() {
  emit("close");
  emit("update:visible", false);
}

// 发送消息
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message || appState.isProcessing.value) return;

  console.log("CustomDialog开始发送消息:", message);

  // 清空输入框
  userInput.value = "";
  // 同时清空contenteditable div的内容
  if (chatInputRef.value) {
    chatInputRef.value.clear();
  }
  appActions.setGenerating(true);

  try {
    // 添加用户消息
    appActions.addMessage(message, true);

    // 获取页面内容
    const pageContent = (window as any).parseWebContent
      ? (window as any).parseWebContent()
      : "";

    // 发送消息到Background Script
    const response = await chrome.runtime.sendMessage({
      action: "generateAnswer",
      data: {
        question: message,
        pageContent: pageContent,
        tabId: "current",
      },
    });

    console.log("收到Background Script响应:", response);

    if (!response.success) {
      throw new Error(response.error || "未知错误");
    }
  } catch (error) {
    console.error("发送消息失败:", error);
    appActions.addMessage(
      `抱歉，发送消息时出现错误：${
        error instanceof Error ? error.message : String(error)
      }`,
      false
    );
  } finally {
    appActions.setGenerating(false);
  }
}

// 处理键盘事件
function handleKeydown(e: Event) {
  const keyboardEvent = e as KeyboardEvent;
  if (keyboardEvent.key === "Enter" && !keyboardEvent.shiftKey) {
    keyboardEvent.preventDefault();
    sendMessage();
  }
}

// 停止生成
async function stopGeneration() {
  console.log("用户点击停止生成");

  // 停止所有处理状态
  appActions.setStreaming(false);
  appActions.setGenerating(false);

  // 清空输入框
  userInput.value = "";
  if (chatInputRef.value) {
    chatInputRef.value.clear();
  }

  // 通知Background Script停止流式请求
  try {
    const response = await chrome.runtime.sendMessage({
      action: "stopStreaming",
    });
    console.log("Background Script停止响应:", response);
  } catch (error) {
    console.error("通知Background Script停止失败:", error);
  }

  // 通知App.vue清除流式超时
  window.dispatchEvent(new CustomEvent("stopStreaming"));

  console.log("已停止生成");
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

// 处理对话框鼠标按下
function handleDialogMouseDown(event: MouseEvent) {
  event.stopPropagation();
}

// 处理头部鼠标按下
function handleHeaderMouseDown(event: MouseEvent) {
  isDragging = true;
  dragInitialX = event.clientX;
  dragInitialY = event.clientY;
  dragCurrentX = dialogPosition.isCustomPosition
    ? parseInt(dialogPosition.left) || 0
    : window.innerWidth - dialogSize.width - 20;
  dragCurrentY = dialogPosition.isCustomPosition
    ? parseInt(dialogPosition.top) || 0
    : window.innerHeight - dialogSize.height - 80;

  // 禁用文字选择
  document.body.style.userSelect = "none";
  document.body.style.webkitUserSelect = "none";
  document.body.style.mozUserSelect = "none";
  document.body.style.msUserSelect = "none";

  document.addEventListener("mousemove", handleDrag);
  document.addEventListener("mouseup", stopDrag);
}

// 处理拖动
function handleDrag(event: MouseEvent) {
  if (!isDragging) return;

  const deltaX = event.clientX - dragInitialX;
  const deltaY = event.clientY - dragInitialY;

  const newX = dragCurrentX + deltaX;
  const newY = dragCurrentY + deltaY;

  // 限制在视窗内
  const maxX = window.innerWidth - dialogSize.width;
  const maxY = window.innerHeight - dialogSize.height;

  dialogPosition.left = `${Math.max(0, Math.min(newX, maxX))}px`;
  dialogPosition.top = `${Math.max(0, Math.min(newY, maxY))}px`;
  dialogPosition.isCustomPosition = true;

  saveDialogPosition();
}

// 停止拖动
function stopDrag() {
  isDragging = false;

  // 恢复文字选择
  document.body.style.userSelect = "";
  document.body.style.webkitUserSelect = "";
  document.body.style.mozUserSelect = "";
  document.body.style.msUserSelect = "";

  document.removeEventListener("mousemove", handleDrag);
  document.removeEventListener("mouseup", stopDrag);
}

// 处理调整大小开始
function handleResizeStart(direction: string, event: MouseEvent) {
  console.log("开始调整大小，方向:", direction);
  event.stopPropagation();
  event.preventDefault(); // 防止默认行为
  isResizing = true;
  resizeDirection = direction;
  resizeInitialX = event.clientX;
  resizeInitialY = event.clientY;
  resizeInitialWidth = dialogSize.width;
  resizeInitialHeight = dialogSize.height;

  // 禁用文字选择
  document.body.style.userSelect = "none";
  document.body.style.webkitUserSelect = "none";
  document.body.style.mozUserSelect = "none";
  document.body.style.msUserSelect = "none";

  // 获取当前对话框位置
  const dialog = (event.currentTarget as HTMLElement).closest(
    ".custom-dialog"
  ) as HTMLElement;
  if (dialog) {
    const rect = dialog.getBoundingClientRect();
    resizeInitialLeft = rect.left;
    resizeInitialTop = rect.top;
  }

  document.addEventListener("mousemove", handleResize);
  document.addEventListener("mouseup", stopResize);
}

// 处理调整大小
function handleResize(event: MouseEvent) {
  if (!isResizing) return;

  const deltaX = event.clientX - resizeInitialX;
  const deltaY = event.clientY - resizeInitialY;

  let newWidth = resizeInitialWidth;
  let newHeight = resizeInitialHeight;
  let newLeft = resizeInitialLeft;
  let newTop = resizeInitialTop;

  // 根据方向计算新的尺寸和位置
  switch (resizeDirection) {
    case "se": // 右下角
      newWidth = resizeInitialWidth + deltaX;
      newHeight = resizeInitialHeight + deltaY;
      break;
    case "sw": // 左下角
      newWidth = resizeInitialWidth - deltaX;
      newHeight = resizeInitialHeight + deltaY;
      newLeft = resizeInitialLeft + deltaX;
      break;
    case "ne": // 右上角
      newWidth = resizeInitialWidth + deltaX;
      newHeight = resizeInitialHeight - deltaY;
      newTop = resizeInitialTop + deltaY;
      break;
    case "nw": // 左上角
      newWidth = resizeInitialWidth - deltaX;
      newHeight = resizeInitialHeight - deltaY;
      newLeft = resizeInitialLeft + deltaX;
      newTop = resizeInitialTop + deltaY;
      break;
  }

  // 应用最小尺寸限制
  dialogSize.width = Math.max(dialogSize.minWidth, newWidth);
  dialogSize.height = Math.max(dialogSize.minHeight, newHeight);

  // 更新位置（对于左上和左下角）
  if (resizeDirection === "nw" || resizeDirection === "sw") {
    dialogPosition.left = `${Math.max(0, newLeft)}px`;
    dialogPosition.isCustomPosition = true;
  }
  if (resizeDirection === "nw" || resizeDirection === "ne") {
    dialogPosition.top = `${Math.max(0, newTop)}px`;
    dialogPosition.isCustomPosition = true;
  }

  saveDialogSize();
  saveDialogPosition();
}

// 停止调整大小
function stopResize() {
  isResizing = false;

  // 恢复文字选择
  document.body.style.userSelect = "";
  document.body.style.webkitUserSelect = "";
  document.body.style.mozUserSelect = "";
  document.body.style.msUserSelect = "";

  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);
}

// 清理事件监听器
onUnmounted(() => {
  document.removeEventListener("mousemove", handleDrag);
  document.removeEventListener("mouseup", stopDrag);
  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);
});
</script>

<style scoped>
/* 对话框主体 */
.custom-dialog {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border-radius: 20px !important;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.2) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  min-width: 320px !important;
  min-height: 400px !important;
  max-width: 90vw !important;
  max-height: 80vh !important;
  position: fixed !important;
  z-index: 10001 !important;
  overflow: hidden !important;
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  display: flex !important;
  flex-direction: column !important;
  opacity: 1 !important;
  visibility: visible !important;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 对话框内容区域 */
.dialog-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.9) 100%
  );
  overflow: hidden;
  position: relative;
  min-height: 200px;
  max-height: calc(100% - 120px);
  backdrop-filter: blur(20px);
}

/* 对话框底部 */
.dialog-footer {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(240, 248, 255, 0.9) 100%
  );
  border-top: 1px solid rgba(255, 255, 255, 0.3);
  padding: 20px;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  min-height: 80px;
  backdrop-filter: blur(20px);
}

.dialog-footer::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(102, 126, 234, 0.6) 25%,
    rgba(118, 75, 162, 0.8) 50%,
    rgba(102, 126, 234, 0.6) 75%,
    transparent 100%
  );
  pointer-events: none;
}

/* 调整大小手柄基础样式 */
.resize-handle {
  position: absolute;
  width: 32px;
  height: 32px;
  transition: all 0.3s ease;
  z-index: 10;
  opacity: 0.7;
}

.resize-handle:hover {
  opacity: 1;
  transform: scale(1.15);
}

/* 右下角 - 同心圆弧样式 */
.resize-handle-se {
  bottom: -4px;
  right: -4px;
  cursor: nw-resize;
}

.resize-handle-se::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: conic-gradient(
    from 0deg at 100% 100%,
    transparent 0deg,
    rgba(99, 102, 241, 0.8) 30deg,
    rgba(168, 85, 247, 0.9) 60deg,
    rgba(99, 102, 241, 0.8) 90deg,
    transparent 120deg
  );
  border-radius: 50% 0 50% 0;
  clip-path: polygon(100% 0%, 100% 100%, 0% 100%);
}

.resize-handle-se::after {
  content: "";
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  background: conic-gradient(
    from 0deg at 100% 100%,
    transparent 0deg,
    rgba(99, 102, 241, 0.4) 30deg,
    rgba(168, 85, 247, 0.5) 60deg,
    rgba(99, 102, 241, 0.4) 90deg,
    transparent 120deg
  );
  border-radius: 50% 0 50% 0;
  clip-path: polygon(100% 0%, 100% 100%, 0% 100%);
}

/* 左下角 - 同心圆弧样式 */
.resize-handle-sw {
  bottom: -4px;
  left: -4px;
  cursor: ne-resize;
}

.resize-handle-sw::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: conic-gradient(
    from 90deg at 0% 100%,
    transparent 0deg,
    rgba(99, 102, 241, 0.8) 30deg,
    rgba(168, 85, 247, 0.9) 60deg,
    rgba(99, 102, 241, 0.8) 90deg,
    transparent 120deg
  );
  border-radius: 0 50% 0 50%;
  clip-path: polygon(0% 0%, 100% 100%, 0% 100%);
}

.resize-handle-sw::after {
  content: "";
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  background: conic-gradient(
    from 90deg at 0% 100%,
    transparent 0deg,
    rgba(99, 102, 241, 0.4) 30deg,
    rgba(168, 85, 247, 0.5) 60deg,
    rgba(99, 102, 241, 0.4) 90deg,
    transparent 120deg
  );
  border-radius: 0 50% 0 50%;
  clip-path: polygon(0% 0%, 100% 100%, 0% 100%);
}

/* 右上角 - 同心圆弧样式 */
.resize-handle-ne {
  top: -4px;
  right: -4px;
  cursor: sw-resize;
}

.resize-handle-ne::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: conic-gradient(
    from 270deg at 100% 0%,
    transparent 0deg,
    rgba(99, 102, 241, 0.8) 30deg,
    rgba(168, 85, 247, 0.9) 60deg,
    rgba(99, 102, 241, 0.8) 90deg,
    transparent 120deg
  );
  border-radius: 0 50% 0 50%;
  clip-path: polygon(100% 0%, 100% 100%, 0% 0%);
}

.resize-handle-ne::after {
  content: "";
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  background: conic-gradient(
    from 270deg at 100% 0%,
    transparent 0deg,
    rgba(99, 102, 241, 0.4) 30deg,
    rgba(168, 85, 247, 0.5) 60deg,
    rgba(99, 102, 241, 0.4) 90deg,
    transparent 120deg
  );
  border-radius: 0 50% 0 50%;
  clip-path: polygon(100% 0%, 100% 100%, 0% 0%);
}

/* 左上角 - 同心圆弧样式 */
.resize-handle-nw {
  top: -4px;
  left: -4px;
  cursor: se-resize;
}

.resize-handle-nw::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: conic-gradient(
    from 180deg at 0% 0%,
    transparent 0deg,
    rgba(99, 102, 241, 0.8) 30deg,
    rgba(168, 85, 247, 0.9) 60deg,
    rgba(99, 102, 241, 0.8) 90deg,
    transparent 120deg
  );
  border-radius: 50% 0 50% 0;
  clip-path: polygon(0% 0%, 100% 0%, 0% 100%);
}

.resize-handle-nw::after {
  content: "";
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  background: conic-gradient(
    from 180deg at 0% 0%,
    transparent 0deg,
    rgba(99, 102, 241, 0.4) 30deg,
    rgba(168, 85, 247, 0.5) 60deg,
    rgba(99, 102, 241, 0.4) 90deg,
    transparent 120deg
  );
  border-radius: 50% 0 50% 0;
  clip-path: polygon(0% 0%, 100% 0%, 0% 100%);
}

/* 响应式设计优化 */
@media (max-width: 768px) {
  .custom-dialog {
    min-width: 300px;
    margin: 16px;
    border-radius: 20px;
    min-height: 350px;
    max-height: 85vh;
  }

  .dialog-content {
    min-height: 150px;
    max-height: calc(100% - 100px);
  }

  .dialog-footer {
    padding: 16px;
    flex-shrink: 0;
  }
}

@media (max-width: 480px) {
  .custom-dialog {
    min-width: 280px;
    margin: 12px;
    border-radius: 16px;
    min-height: 300px;
    max-height: 90vh;
  }

  .dialog-content {
    min-height: 120px;
    max-height: calc(100% - 80px);
  }

  .dialog-footer {
    padding: 12px;
    flex-shrink: 0;
  }
}
</style>
