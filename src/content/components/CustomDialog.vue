<template>
  <div
    v-if="visible"
    class="custom-dialog-overlay"
    @mousedown="handleOverlayClick"
  >
    <div
      class="custom-dialog"
      :style="dialogStyle"
      @mousedown="handleDialogMouseDown"
    >
      <!-- 对话框头部 -->
      <div class="dialog-header" @mousedown="handleHeaderMouseDown">
        <div class="dialog-title">
          <el-icon><ChatDotRound /></el-icon>
          <span>Smart Web Notes</span>
        </div>
        <div class="dialog-controls">
          <el-button
            @click="minimize"
            type="text"
            size="small"
            :icon="Minus"
            circle
            class="control-btn"
          />
          <el-button
            @click="close"
            type="text"
            size="small"
            :icon="Close"
            circle
            class="control-btn"
          />
        </div>
      </div>

      <!-- 对话框内容 -->
      <div class="dialog-content">
        <div class="chat-container">
          <div class="messages" ref="messagesContainer">
            <el-empty
              v-if="messages.length === 0"
              description="👋 你好！我是AI助手，可以帮你理解和分析当前网页的内容。"
              :image-size="80"
            />

            <div
              v-for="(message, index) in messages"
              :key="index"
              :class="[
                'message',
                message.isUser ? 'user-message' : 'assistant-message',
              ]"
              v-html="
                message.isUser
                  ? message.content
                  : renderMarkdownContent(message.content)
              "
            ></div>

            <div v-if="isGenerating || isStreaming" class="loading-message">
              <el-icon class="is-loading">
                <Loading />
              </el-icon>
              <span>{{
                isStreaming ? "AI正在回复中..." : "AI正在思考中..."
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 对话框底部 -->
      <div class="dialog-footer">
        <div class="input-container">
          <el-input
            v-model="userInput"
            type="textarea"
            :rows="2"
            placeholder="请输入您的问题..."
            :disabled="isGenerating"
            @keydown="handleKeydown"
            resize="none"
            class="message-input"
          />
          <el-button
            type="primary"
            :icon="ArrowRight"
            :loading="isGenerating"
            :disabled="!userInput.trim()"
            @click="sendMessage"
            class="send-button"
          />
        </div>
      </div>

      <!-- 调整大小手柄 -->
      <div class="resize-handle" @mousedown="handleResizeStart"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  reactive,
  onMounted,
  onUnmounted,
  nextTick,
  computed,
  watch,
} from "vue";
import { ElIcon, ElButton, ElEmpty, ElInput } from "element-plus";
import {
  ChatDotRound,
  Minus,
  Close,
  Loading,
  ArrowRight,
} from "@element-plus/icons-vue";
import { useChromeAPI, useWebContent } from "../../shared/composables";
import { parseWebContent } from "../../shared/utils";
import { renderMarkdown } from "../../shared/utils/markdown";
import type { Message, DialogPosition, DialogSize } from "../../shared/types";

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
  minimize: [];
  "update:visible": [value: boolean];
}>();

// 响应式数据
const userInput = ref("");
const messages = ref<Message[]>([]);
const isGenerating = ref(false);
const messagesContainer = ref<HTMLElement>();
const streamingMessage = ref("");
const isStreaming = ref(false);

// 对话框位置和大小 - 参考WebChat-main的处理方式
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

// 计算样式 - 参考WebChat-main的样式计算
const dialogStyle = computed(() => ({
  position: "fixed",
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

// 拖动相关 - 参考WebChat-main
let isDragging = false;
let dragCurrentX = 0;
let dragCurrentY = 0;
let dragInitialX = 0;
let dragInitialY = 0;
let dragAnimationFrame: number | null = null;

// 调整大小相关 - 参考WebChat-main
let isResizing = false;
let resizeInitialX = 0;
let resizeInitialY = 0;
let resizeInitialWidth = 0;
let resizeInitialHeight = 0;
let resizeAnimationFrame: number | null = null;

// 初始化
onMounted(async () => {
  await loadHistory();
  await loadDialogPosition();
  await loadDialogSize();

  // 监听流式响应事件
  window.addEventListener("streamChunk", handleStreamChunk);
  window.addEventListener("streamComplete", handleStreamComplete);
  window.addEventListener("streamError", handleStreamError);

  // 监听对话框显示状态变化
  watch(
    () => props.visible,
    (newVisible) => {
      if (newVisible) {
        nextTick(() => {
          updateResizeHandlePosition();
        });
      }
    }
  );

  // 监听对话框位置和尺寸变化
  watch(
    [
      () => dialogPosition.left,
      () => dialogPosition.top,
      () => dialogSize.width,
      () => dialogSize.height,
    ],
    () => {
      if (props.visible) {
        nextTick(() => {
          updateResizeHandlePosition();
        });
      }
    }
  );
});

// 加载对话框位置 - 参考WebChat-main
async function loadDialogPosition() {
  try {
    const result = await chrome.storage.sync.get({
      dialogPosition: {
        left: "auto",
        top: "auto",
        isCustomPosition: false,
      },
    });

    if (result.dialogPosition.isCustomPosition) {
      dialogPosition.left = result.dialogPosition.left;
      dialogPosition.top = result.dialogPosition.top;
      dialogPosition.isCustomPosition = true;
    }
  } catch (error) {
    console.error("加载对话框位置失败:", error);
  }
}

// 加载对话框尺寸 - 参考WebChat-main
async function loadDialogSize() {
  try {
    const result = await chrome.storage.sync.get({
      dialogSize: {
        width: 400,
        height: 500,
      },
    });

    dialogSize.width = result.dialogSize.width;
    dialogSize.height = result.dialogSize.height;
  } catch (error) {
    console.error("加载对话框尺寸失败:", error);
  }
}

// 保存对话框位置 - 参考WebChat-main
function saveDialogPosition() {
  chrome.storage.sync.set({
    dialogPosition: {
      left: dialogPosition.left,
      top: dialogPosition.top,
      isCustomPosition: dialogPosition.isCustomPosition,
    },
  });
}

// 保存对话框尺寸 - 参考WebChat-main
function saveDialogSize() {
  chrome.storage.sync.set({
    dialogSize: {
      width: dialogSize.width,
      height: dialogSize.height,
    },
  });
}

// 更新调整大小手柄位置
function updateResizeHandlePosition() {
  const dialogElement = document.querySelector(".custom-dialog") as HTMLElement;
  const resizeHandle = document.querySelector(".resize-handle") as HTMLElement;

  if (dialogElement && resizeHandle) {
    // 手柄使用绝对定位，相对于对话框的右下角
    resizeHandle.style.position = "absolute";
    resizeHandle.style.right = "0";
    resizeHandle.style.bottom = "0";
    resizeHandle.style.left = "auto";
    resizeHandle.style.top = "auto";
  }
}

// 处理对话框鼠标按下
function handleDialogMouseDown(e: MouseEvent) {
  // 阻止事件冒泡到overlay
  e.stopPropagation();
}

// 处理头部鼠标按下 - 开始拖动 - 参考WebChat-main
function handleHeaderMouseDown(e: MouseEvent) {
  if (e.target && (e.target as HTMLElement).closest(".dialog-controls")) return;

  isDragging = true;
  const dialogElement = document.querySelector(".custom-dialog") as HTMLElement;
  if (dialogElement) {
    // 禁用过渡动画，确保拖动流畅
    dialogElement.style.transition = "none";
    const rect = dialogElement.getBoundingClientRect();
    dragInitialX = e.clientX - rect.left;
    dragInitialY = e.clientY - rect.top;
  }

  document.addEventListener("mousemove", handleDrag);
  document.addEventListener("mouseup", stopDrag);
  e.preventDefault();
}

// 处理拖动 - 完全参考WebChat-main的实现
function handleDrag(e: MouseEvent) {
  if (!isDragging) return;

  e.preventDefault();

  // 取消之前的动画帧
  if (dragAnimationFrame) {
    cancelAnimationFrame(dragAnimationFrame);
  }

  // 请求新的动画帧
  dragAnimationFrame = requestAnimationFrame(() => {
    dragCurrentX = e.clientX - dragInitialX;
    dragCurrentY = e.clientY - dragInitialY;

    // 确保不会超出屏幕边界
    const maxX = window.innerWidth - dialogSize.width;
    const maxY = window.innerHeight - dialogSize.height;

    dragCurrentX = Math.max(0, Math.min(dragCurrentX, maxX));
    dragCurrentY = Math.max(0, Math.min(dragCurrentY, maxY));

    // 直接操作自定义对话框的DOM元素
    const dialogElement = document.querySelector(
      ".custom-dialog"
    ) as HTMLElement;
    if (dialogElement) {
      dialogElement.style.left = `${dragCurrentX}px`;
      dialogElement.style.top = `${dragCurrentY}px`;
      dialogElement.style.right = "auto";
      dialogElement.style.bottom = "auto";
    }

    // 同时更新响应式数据
    dialogPosition.left = `${dragCurrentX}px`;
    dialogPosition.top = `${dragCurrentY}px`;
    dialogPosition.isCustomPosition = true;

    // 更新调整大小手柄位置
    nextTick(() => {
      updateResizeHandlePosition();
    });
  });
}

// 停止拖动 - 完全参考WebChat-main
function stopDrag() {
  if (isDragging) {
    isDragging = false;
    saveDialogPosition();
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);

    if (dragAnimationFrame) {
      cancelAnimationFrame(dragAnimationFrame);
    }

    // 恢复过渡动画
    const dialogElement = document.querySelector(
      ".custom-dialog"
    ) as HTMLElement;
    if (dialogElement) {
      dialogElement.style.transition = "";
    }
  }
}

// 开始调整大小 - 完全参考WebChat-main
function handleResizeStart(e: MouseEvent) {
  isResizing = true;
  resizeInitialX = e.clientX;
  resizeInitialY = e.clientY;

  // 获取当前对话框的实际尺寸
  const dialogElement = document.querySelector(".custom-dialog") as HTMLElement;
  if (dialogElement) {
    // 禁用过渡动画，确保调整大小流畅
    dialogElement.style.transition = "none";
    resizeInitialWidth = dialogElement.offsetWidth;
    resizeInitialHeight = dialogElement.offsetHeight;
  } else {
    resizeInitialWidth = dialogSize.width;
    resizeInitialHeight = dialogSize.height;
  }

  document.addEventListener("mousemove", handleResize);
  document.addEventListener("mouseup", stopResize);
  e.preventDefault();
  e.stopPropagation();
}

// 处理调整大小 - 完全参考WebChat-main
function handleResize(e: MouseEvent) {
  if (!isResizing) return;

  e.preventDefault();

  // 取消之前的动画帧
  if (resizeAnimationFrame) {
    cancelAnimationFrame(resizeAnimationFrame);
  }

  // 请求新的动画帧
  resizeAnimationFrame = requestAnimationFrame(() => {
    const deltaX = e.clientX - resizeInitialX;
    const deltaY = e.clientY - resizeInitialY;

    const newWidth = Math.max(dialogSize.minWidth, resizeInitialWidth + deltaX);
    const newHeight = Math.max(
      dialogSize.minHeight,
      resizeInitialHeight + deltaY
    );

    // 直接操作自定义对话框的DOM元素
    const dialogElement = document.querySelector(
      ".custom-dialog"
    ) as HTMLElement;
    if (dialogElement) {
      const rect = dialogElement.getBoundingClientRect();
      const maxWidth = window.innerWidth - rect.left - 20;
      const maxHeight = window.innerHeight - rect.top - 20;

      const finalWidth = Math.min(newWidth, maxWidth);
      const finalHeight = Math.min(newHeight, maxHeight);

      // 直接设置DOM样式
      dialogElement.style.width = `${finalWidth}px`;
      dialogElement.style.height = `${finalHeight}px`;

      // 同时更新响应式数据
      dialogSize.width = finalWidth;
      dialogSize.height = finalHeight;

      // 更新调整大小手柄位置
      updateResizeHandlePosition();
    }
  });
}

// 停止调整大小 - 完全参考WebChat-main
function stopResize() {
  if (isResizing) {
    isResizing = false;
    saveDialogSize();
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);

    if (resizeAnimationFrame) {
      cancelAnimationFrame(resizeAnimationFrame);
    }

    // 恢复过渡动画
    const dialogElement = document.querySelector(
      ".custom-dialog"
    ) as HTMLElement;
    if (dialogElement) {
      dialogElement.style.transition = "";
    }

    // 更新调整大小手柄位置
    updateResizeHandlePosition();
  }
}

// 处理遮罩层点击
function handleOverlayClick(e: MouseEvent) {
  // 如果点击的是遮罩层本身，关闭对话框
  if (e.target === e.currentTarget) {
    close();
  }
}

// 关闭对话框
function close() {
  emit("close");
  emit("update:visible", false);
}

// 最小化对话框
function minimize() {
  emit("minimize");
  emit("update:visible", false);
}

// 加载历史会话
async function loadHistory() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getChatHistory",
    });

    if (response && response.messages) {
      messages.value = response.messages;
    }

    if (response && response.isGenerating) {
      isGenerating.value = true;
    }
  } catch (error) {
    console.error("加载历史失败:", error);
  }
}

// 发送消息
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message || isGenerating.value) return;

  // 清空输入框
  userInput.value = "";
  isGenerating.value = true;

  try {
    // 添加用户消息
    messages.value.push({ content: message, isUser: true });

    // 滚动到底部
    nextTick(() => {
      scrollToBottom();
    });

    // 发送消息到background script
    const response = await chrome.runtime.sendMessage({
      action: "generateAnswer",
      question: message,
    });

    if (response && response.success) {
      console.log("消息发送成功");
    }

    // 设置超时保护，防止一直显示"AI正在思考中..."
    setTimeout(() => {
      if (isGenerating.value && !isStreaming.value) {
        console.warn("AI响应超时，重置状态");
        isGenerating.value = false;
        messages.value.push({
          content: "抱歉，AI响应超时，请检查网络连接和API配置。",
          isUser: false,
        });
      }
    }, 30000); // 30秒超时
  } catch (error) {
    console.error("发送消息失败:", error);
    isGenerating.value = false;

    // 检查是否是API密钥未配置的错误
    if (error.message && error.message.includes("API密钥未配置")) {
      messages.value.push({
        content:
          "❌ **API密钥未配置**\n\n请先配置API密钥才能使用AI对话功能：\n\n1. 点击扩展图标\n2. 选择「设置」\n3. 在「API配置」标签中填入您的API密钥\n\n**推荐API服务：**\n- [DeepSeek](https://platform.deepseek.com/) - 免费额度大\n- [OpenAI](https://platform.openai.com/) - 功能强大\n- [Claude](https://console.anthropic.com/) - 安全性高",
        isUser: false,
      });
    } else {
      messages.value.push({
        content: `发送消息失败：${error.message || "未知错误"}`,
        isUser: false,
      });
    }
  }
}

// 处理键盘事件
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// 滚动到底部
function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

// 处理流式数据块
function handleStreamChunk(event: CustomEvent) {
  console.log("收到流式数据块:", event.detail);
  const { chunk, fullResponse } = event.detail;
  streamingMessage.value = fullResponse;
  isStreaming.value = true;

  // 更新最后一条消息或创建新消息
  if (
    messages.value.length > 0 &&
    !messages.value[messages.value.length - 1].isUser
  ) {
    // 更新最后一条AI消息
    messages.value[messages.value.length - 1].content = fullResponse;
  } else {
    // 创建新的AI消息
    messages.value.push({ content: fullResponse, isUser: false });
  }

  nextTick(() => {
    scrollToBottom();
  });
}

// 处理流式响应完成
function handleStreamComplete(event: CustomEvent) {
  console.log("流式响应完成:", event.detail);
  const { fullResponse } = event.detail;
  streamingMessage.value = "";
  isStreaming.value = false;
  isGenerating.value = false;

  // 确保最后一条消息是完整的
  if (
    messages.value.length > 0 &&
    !messages.value[messages.value.length - 1].isUser
  ) {
    messages.value[messages.value.length - 1].content = fullResponse;
  }

  nextTick(() => {
    scrollToBottom();
  });
}

// 处理流式响应错误
function handleStreamError(event: CustomEvent) {
  console.log("流式响应错误:", event.detail);
  const { error } = event.detail;
  streamingMessage.value = "";
  isStreaming.value = false;
  isGenerating.value = false;

  // 检查是否是API密钥未配置的错误
  if (error && error.includes("API密钥未配置")) {
    messages.value.push({
      content:
        "❌ **API密钥未配置**\n\n请先配置API密钥才能使用AI对话功能：\n\n1. 点击扩展图标\n2. 选择「设置」\n3. 在「API配置」标签中填入您的API密钥\n\n**推荐API服务：**\n- [DeepSeek](https://platform.deepseek.com/) - 免费额度大\n- [OpenAI](https://platform.openai.com/) - 功能强大\n- [Claude](https://console.anthropic.com/) - 安全性高",
      isUser: false,
    });
  } else {
    // 添加错误消息
    messages.value.push({
      content: `抱歉，生成答案时出现错误：${error}`,
      isUser: false,
    });
  }

  nextTick(() => {
    scrollToBottom();
  });
}

// 渲染Markdown（使用新的markdown-it）
function renderMarkdownContent(text: string): string {
  return renderMarkdown(text);
}

// 清理事件监听器
onUnmounted(() => {
  document.removeEventListener("mousemove", handleDrag);
  document.removeEventListener("mouseup", stopDrag);
  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);

  // 清理流式响应事件监听器
  window.removeEventListener("streamChunk", handleStreamChunk);
  window.removeEventListener("streamComplete", handleStreamComplete);
  window.removeEventListener("streamError", handleStreamError);
});
</script>

<style scoped>
/* 自定义对话框遮罩层 */
.custom-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  z-index: 2147483645;
  pointer-events: auto;
}

/* 自定义对话框 - 参考WebChat-main */
.custom-dialog {
  position: fixed;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  max-height: 80vh;
  max-width: 90vw;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  min-width: 300px;
  min-height: 400px;
}

/* 对话框头部 */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  cursor: move;
  user-select: none;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.dialog-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tokens-counter {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  opacity: 0.8;
}

.control-btn {
  color: white !important;
  border: none !important;
  background: transparent !important;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

/* 对话框内容 */
.dialog-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-container {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #f8f9fa;
  max-height: calc(100vh - 200px);
  min-height: 200px;
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  padding: 12px 16px;
  border-radius: 8px;
  max-width: 80%;
  word-wrap: break-word;
  line-height: 1.5;
  overflow-wrap: break-word;
  word-break: break-word;
}

.user-message {
  background: #409eff;
  color: white;
  margin-left: auto;
  border-radius: 12px 12px 2px 12px;
}

.assistant-message {
  background: #f0f0f0;
  color: #000;
  border-radius: 12px 12px 12px 2px;
  font-size: 14px;
}

.loading-message {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: center;
  color: #909399;
  padding: 20px;
}

/* 对话框底部 */
.dialog-footer {
  padding: 12px 16px;
  border-top: 1px solid #eee;
  background: white;
}

.input-container {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.message-input {
  flex: 1;
}

.send-button {
  flex-shrink: 0;
}

/* 调整大小手柄样式 - 完全参考WebChat-main */
.resize-handle {
  position: absolute !important;
  width: 20px !important;
  height: 20px !important;
  right: 0 !important;
  bottom: 0 !important;
  cursor: se-resize !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 2147483647 !important;
  background: transparent !important;
  pointer-events: auto !important;
  user-select: none !important;
}

/* 调整手柄的图标 - 参考WebChat-main */
.resize-handle::before {
  content: "" !important;
  width: 8px !important;
  height: 8px !important;
  border-right: 2px solid #999 !important;
  border-bottom: 2px solid #999 !important;
  position: absolute !important;
  right: 4px !important;
  bottom: 4px !important;
}

/* 调整手柄悬停效果 */
.resize-handle:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

.resize-handle:hover::before {
  border-right: 2px solid #666 !important;
  border-bottom: 2px solid #666 !important;
}

/* 自定义滚动条样式 */
.chat-container::-webkit-scrollbar {
  width: 8px;
}

.chat-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.chat-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.chat-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 代码高亮样式 */
.assistant-message .hljs {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 13px;
  line-height: 1.45;
}

.assistant-message .hljs code {
  background: transparent;
  padding: 0;
  border: none;
  font-size: inherit;
}

.assistant-message pre {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 0.5em 0;
}

.assistant-message pre code {
  background: transparent;
  padding: 0;
  border: none;
  font-size: inherit;
}

.assistant-message code {
  background-color: #f3f4f6;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.9em;
}
</style>
