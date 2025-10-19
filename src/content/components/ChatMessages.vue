<template>
  <div class="chat-container">
    <el-scrollbar
      ref="scrollbarRef"
      class="messages-scrollbar"
      @scroll="(args) => handleScroll(args.scrollTop)"
    >
      <div class="messages">
        <!-- AI开场白 -->
        <div class="message-item assistant-message welcome-message">
          <div class="message-content">
            <div class="welcome-header">
              <div class="welcome-icon">🤖</div>
              <div class="welcome-title">智能网页助手</div>
            </div>
            <div class="welcome-description">
              你好！我是你的智能网页助手，可以通过对话帮你：
            </div>
            <div class="welcome-features">
              <div class="feature-item">
                <span class="feature-icon">📊</span>
                <span class="feature-text">分析网页内容和数据</span>
              </div>
              <div class="feature-item">
                <span class="feature-icon">🎛️</span>
                <span class="feature-text"
                  >控制页面元素（隐藏广告、修改样式等）</span
                >
              </div>
              <div class="feature-item">
                <span class="feature-icon">💬</span>
                <span class="feature-text">回答各种问题</span>
              </div>
              <div class="feature-item">
                <span class="feature-icon">⚡</span>
                <span class="feature-text">执行快捷命令</span>
              </div>
            </div>
            <div class="welcome-action">
              <div class="action-text">
                试试说<code>"帮助"</code>查看所有可用命令，或直接问我任何问题！
              </div>
            </div>
          </div>
        </div>

        <div
          v-for="(message, index) in messages"
          :key="`${message.id}-${index}`"
          :class="[
            'message-item',
            message.isUser ? 'user-message' : 'assistant-message',
          ]"
        >
          <div class="message-content">
            <!-- 思考内容 -->
            <div
              v-if="!message.isUser && message.thinkingContent"
              class="thinking-section"
            >
              <div class="thinking-header" @click="toggleThinking(message.id)">
                <span class="thinking-title">
                  <i
                    :class="
                      message.isThinkingCollapsed
                        ? 'el-icon-arrow-right'
                        : 'el-icon-arrow-down'
                    "
                  ></i>
                  思考过程
                </span>
                <span class="thinking-toggle">
                  {{ message.isThinkingCollapsed ? "展开" : "折叠" }}
                </span>
              </div>
              <div
                v-show="!message.isThinkingCollapsed"
                class="thinking-content"
                v-html="getRenderedThinkingContent(message.id)"
              ></div>
            </div>

            <!-- 回答内容 -->
            <div v-html="getRenderedContent(message.id)"></div>
          </div>

          <!-- 复制按钮 -->
          <div class="message-actions">
            <el-tooltip
              content="复制消息内容"
              placement="top"
              :show-after="500"
            >
              <el-button
                class="action-button copy-button"
                :class="{ 'copy-success': copyStates[message.id] }"
                @click="copyMessage(message)"
                :disabled="props.isProcessing"
                circle
                size="small"
              >
                <el-icon>
                  <Check v-if="copyStates[message.id]" />
                  <DocumentCopy v-else />
                </el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>

        <!-- 加载中提示 -->
        <div v-if="isProcessing" class="loading-indicator">
          <div class="loading-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
          <span class="loading-text">{{
            isStreaming ? "AI正在回复中" : "AI正在思考中"
          }}</span>
        </div>
      </div>
    </el-scrollbar>

    <!-- 滚动到底部按钮 -->
    <el-button
      v-if="!isAtBottom && messages.length > 0"
      class="scroll-to-bottom-btn"
      type="primary"
      :icon="ArrowDown"
      circle
      size="small"
      @click="handleScrollToBottom"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";
import { ElButton, ElScrollbar, ElTooltip } from "element-plus";
import { ArrowDown, DocumentCopy, Check } from "@element-plus/icons-vue";
import { renderMarkdown } from "../../shared/utils/markdown";
import { appActions } from "../../shared/stores/appStore";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: number;
}

interface Props {
  messages: Message[];
  isProcessing: boolean;
  isStreaming: boolean;
}

const props = defineProps<Props>();

const scrollbarRef = ref();
const isAtBottom = ref(true);

// 渲染内容缓存 - 简化为只存储已渲染的内容
const renderedContentCache = ref<Map<string, string>>(new Map());

// 复制状态管理
const copyStates = ref<Record<string, boolean>>({});

// 获取渲染内容（同步）
const getRenderedContent = (messageId: string): string => {
  const message = props.messages.find((m) => m.id === messageId);
  if (!message) return "";

  // 如果没有缓存，同步渲染（对于用户消息或简单文本）
  if (!renderedContentCache.value.has(messageId)) {
    // 对于流式更新的消息，立即渲染
    renderMarkdown(message.content)
      .then((result) => {
        nextTick(() => {
          renderedContentCache.value.set(messageId, result);
        });
      })
      .catch(() => {
        nextTick(() => {
          const fallback = message.content.replace(/\n/g, "<br>");
          renderedContentCache.value.set(messageId, fallback);
        });
      });

    // 返回临时内容
    return message.content.replace(/\n/g, "<br>");
  }

  return renderedContentCache.value.get(messageId) || message.content;
};

// 获取思考内容渲染（同步）
const getRenderedThinkingContent = (messageId: string): string => {
  const message = props.messages.find((m) => m.id === messageId);
  if (!message || !message.thinkingContent) return "";

  const cacheKey = `${messageId}-thinking`;

  // 如果没有缓存，同步渲染
  if (!renderedContentCache.value.has(cacheKey)) {
    // 对于流式更新的思考内容，立即渲染
    renderMarkdown(message.thinkingContent)
      .then((result) => {
        nextTick(() => {
          renderedContentCache.value.set(cacheKey, result);
        });
      })
      .catch(() => {
        nextTick(() => {
          const fallback = message.thinkingContent.replace(/\n/g, "<br>");
          renderedContentCache.value.set(cacheKey, fallback);
        });
      });

    // 返回临时内容
    return message.thinkingContent.replace(/\n/g, "<br>");
  }

  return renderedContentCache.value.get(cacheKey) || message.thinkingContent;
};

// 切换思考内容折叠状态
const toggleThinking = (messageId: string) => {
  appActions.toggleThinkingCollapse(messageId);
};

// 复制消息内容
const copyMessage = async (message: Message) => {
  try {
    // 获取纯文本内容（去除HTML标签）
    const textContent = message.content.replace(/<[^>]*>/g, "").trim();

    // 使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textContent);
    } else {
      // 降级方案：使用传统的 document.execCommand
      const textArea = document.createElement("textarea");
      textArea.value = textContent;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }

    // 显示成功状态
    copyStates.value[message.id] = true;

    // 2秒后恢复原始状态
    setTimeout(() => {
      copyStates.value[message.id] = false;
    }, 2000);
  } catch (error) {
    console.error("复制失败:", error);
    // 可以在这里添加错误提示
  }
};

// 滚动到底部（参考 newme-ds 的 handleDown 实现）
const handleDown = () => {
  setTimeout(() => {
    if (scrollbarRef.value?.wrapRef) {
      scrollbarRef.value.wrapRef.scrollTop =
        scrollbarRef.value.wrapRef.scrollHeight;
    }
  }, 100);
};

// 处理滚动事件（检测是否在底部）
const handleScroll = (scrollTop: number) => {
  if (!scrollbarRef.value?.wrapRef) return;

  const el = scrollbarRef.value.wrapRef;
  const scrollHeight = el.scrollHeight;
  const clientHeight = el.clientHeight;

  // 浏览器差异，小数点导致 1px 误差（参考 newme-ds）
  isAtBottom.value = scrollTop + clientHeight + 1 >= scrollHeight;
};

// 手动滚动到底部（按钮点击）
const handleScrollToBottom = () => {
  if (scrollbarRef.value?.wrapRef) {
    scrollbarRef.value.wrapRef.scrollTop =
      scrollbarRef.value.wrapRef.scrollHeight;
    isAtBottom.value = true;
  }
};

// 统一的消息更新处理（合并所有监听逻辑）
watch(
  () => [props.messages, props.isStreaming, props.isProcessing] as const,
  async ([messages, isStreaming, isProcessing], [oldMessages]) => {
    // 1. 处理新消息或内容变化
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      // 流式更新：强制重新渲染最后一条消息
      if (isStreaming && lastMessage && !lastMessage.isUser) {
        renderedContentCache.value.delete(lastMessage.id);

        // 如果有思考内容，也清除其缓存
        if (lastMessage.thinkingContent) {
          renderedContentCache.value.delete(`${lastMessage.id}-thinking`);
        }

        await nextTick();

        // 渲染最新内容
        renderMarkdown(lastMessage.content)
          .then((result) => {
            renderedContentCache.value.set(lastMessage.id, result);
          })
          .catch(() => {
            const fallback = lastMessage.content.replace(/\n/g, "<br>");
            renderedContentCache.value.set(lastMessage.id, fallback);
          });

        // 渲染思考内容
        if (lastMessage.thinkingContent) {
          renderMarkdown(lastMessage.thinkingContent)
            .then((result) => {
              renderedContentCache.value.set(
                `${lastMessage.id}-thinking`,
                result
              );
            })
            .catch(() => {
              const fallback = lastMessage.thinkingContent.replace(
                /\n/g,
                "<br>"
              );
              renderedContentCache.value.set(
                `${lastMessage.id}-thinking`,
                fallback
              );
            });
        }

        // 流式更新时自动滚动（参考 newme-ds）
        handleDown();
      }
      // 新消息添加：滚动到底部
      else if (oldMessages && messages.length > oldMessages.length) {
        // 渲染新消息
        const newMessage = messages[messages.length - 1];
        if (newMessage && !renderedContentCache.value.has(newMessage.id)) {
          renderMarkdown(newMessage.content)
            .then((result) => {
              renderedContentCache.value.set(newMessage.id, result);
            })
            .catch(() => {
              const fallback = newMessage.content.replace(/\n/g, "<br>");
              renderedContentCache.value.set(newMessage.id, fallback);
            });
        }

        handleDown();
      }
    }

    // 2. 处理状态变化时的滚动
    if (isProcessing || isStreaming) {
      handleDown();
    }
  },
  { deep: true, flush: "post", immediate: false }
);

// 组件挂载时初始化
onMounted(async () => {
  // 渲染所有现有消息
  if (props.messages && props.messages.length > 0) {
    for (const message of props.messages) {
      if (!renderedContentCache.value.has(message.id)) {
        await renderMarkdown(message.content)
          .then((result) => {
            renderedContentCache.value.set(message.id, result);
          })
          .catch(() => {
            const fallback = message.content.replace(/\n/g, "<br>");
            renderedContentCache.value.set(message.id, fallback);
          });
      }
    }
  }

  // 初始化时滚动到底部
  await nextTick();
  handleDown();
});
</script>

<style scoped>
.chat-container {
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
  height: 100%;
  backdrop-filter: blur(20px);
}

/* Element Plus 滚动条容器 */
.messages-scrollbar {
  flex: 1;
  height: 100%;
}

.messages {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}

/* 滚动到底部按钮 */
.scroll-to-bottom-btn {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 10;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
  border: 1px solid rgba(245, 158, 11, 0.3) !important;
  color: #1f2937 !important;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.scroll-to-bottom-btn:hover {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important;
  border-color: rgba(245, 158, 11, 0.5) !important;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4), 0 4px 8px rgba(0, 0, 0, 0.15) !important;
}

.scroll-to-bottom-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3), 0 1px 2px rgba(0, 0, 0, 0.1) !important;
}

/* 消息项基础样式 */
.message-item {
  display: flex;
  animation: messageSlideIn 0.3s ease-out;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 消息操作按钮区域 */
.message-actions {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 8px 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-item:hover .message-actions {
  opacity: 1;
}

/* 通用按钮样式 */
.action-button {
  width: 32px !important;
  height: 32px !important;
  min-width: 32px !important;
  padding: 0 !important;
  background: rgba(255, 255, 255, 0.9) !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  transition: all 0.2s ease !important;
}

.action-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 1) !important;
  border-color: rgba(0, 0, 0, 0.2) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  transform: translateY(-1px) !important;
}

.action-button:active:not(:disabled) {
  transform: translateY(0) !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2) !important;
}

.action-button:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
  transform: none !important;
}

/* 复制按钮成功状态 */
.copy-button.copy-success {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%) !important;
  border-color: #67c23a !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3) !important;
}

.copy-button.copy-success:hover {
  background: linear-gradient(135deg, #5daf34 0%, #7bc85a 100%) !important;
  box-shadow: 0 6px 16px rgba(103, 194, 58, 0.4) !important;
}

/* 用户消息样式 */
.user-message {
  justify-content: flex-end !important;
}

.user-message .message-actions {
  order: -1;
  margin-right: 8px;
}

.user-message .message-content {
  background: linear-gradient(
    135deg,
    #1a1a2e 0%,
    #16213e 50%,
    #0f3460 100%
  ) !important;
  color: white !important;
  border-radius: 18px 18px 4px 18px !important;
  padding: 12px 16px !important;
  max-width: 70% !important;
  box-shadow: 0 4px 12px rgba(15, 52, 96, 0.4),
    0 2px 4px rgba(212, 175, 55, 0.3) !important;
  word-wrap: break-word !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  line-height: 1.5 !important;
  font-size: 15px !important;
  overflow: hidden !important;
}

/* AI消息样式 */
.assistant-message {
  justify-content: flex-start !important;
}

.assistant-message .message-content {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(240, 248, 255, 0.95) 100%
  ) !important;
  color: #2d3748 !important;
  border-radius: 18px 18px 18px 4px !important;
  padding: 12px 16px !important;
  max-width: 80% !important;
  box-shadow: 0 4px 12px rgba(15, 52, 96, 0.15),
    0 2px 4px rgba(212, 175, 55, 0.1) !important;
  border: 1px solid rgba(212, 175, 55, 0.2) !important;
  word-wrap: break-word !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  line-height: 1.6 !important;
  font-size: 15px !important;
  overflow: hidden !important;
}

/* 加载指示器样式 */
.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 8px 0;
  margin: 8px 0;
}

.loading-dots {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 12px;
}

.dot {
  width: 6px;
  height: 6px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 50%;
  animation: loadingDots 1.4s infinite ease-in-out both;
  box-shadow: 0 2px 4px rgba(15, 52, 96, 0.3);
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

.dot:nth-child(3) {
  animation-delay: 0s;
}

@keyframes loadingDots {
  0%,
  80%,
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.loading-text {
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .messages {
    padding: 16px;
    gap: 12px;
  }

  .user-message .message-content,
  .assistant-message .message-content {
    max-width: 85% !important;
    padding: 10px 14px !important;
    font-size: 14px !important;
  }

  .user-message .message-content {
    border-radius: 16px 16px 4px 16px !important;
  }

  .assistant-message .message-content {
    border-radius: 16px 16px 16px 4px !important;
  }

  .loading-text {
    font-size: 13px;
  }

  .dot {
    width: 5px;
    height: 5px;
  }
}

@media (max-width: 480px) {
  .messages {
    padding: 12px;
    gap: 10px;
  }

  .user-message .message-content,
  .assistant-message .message-content {
    max-width: 90% !important;
    padding: 8px 12px !important;
    font-size: 14px !important;
  }

  .user-message .message-content {
    border-radius: 14px 14px 4px 14px !important;
  }

  .assistant-message .message-content {
    border-radius: 14px 14px 14px 4px !important;
  }

  .loading-text {
    font-size: 12px;
  }

  .dot {
    width: 4px;
    height: 4px;
  }

  .loading-dots {
    gap: 3px;
    margin-right: 8px;
  }
}

/* 数学公式样式 */
.math-block {
  display: block;
  text-align: center;
  margin: 16px 0;
  padding: 8px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  overflow-x: auto;
}

/* 思考内容样式 */
.thinking-section {
  margin-bottom: 8px;
}

.thinking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  margin-bottom: 4px;
}

.thinking-header:hover {
  opacity: 0.8;
}

.thinking-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #9ca3af;
  letter-spacing: 0.3px;
}

.thinking-title i {
  font-size: 11px;
  transition: transform 0.2s ease;
}

.thinking-toggle {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 400;
  transition: color 0.2s ease;
}

.thinking-header:hover .thinking-toggle {
  color: #6b7280;
}

.thinking-content {
  padding: 0;
  margin-bottom: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: #9ca3af;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* 思考内容中的元素样式 - 使用灰色调 */
.thinking-content * {
  color: #9ca3af !important;
}

.thinking-content strong,
.thinking-content b {
  color: #6b7280 !important;
  font-weight: 600;
}

.thinking-content pre {
  background: rgba(156, 163, 175, 0.1) !important;
  border: 1px solid rgba(156, 163, 175, 0.2) !important;
  border-radius: 4px !important;
  padding: 8px !important;
  margin: 8px 0 !important;
  font-size: 12px !important;
  overflow-x: auto !important;
}

.thinking-content code {
  background: rgba(156, 163, 175, 0.1) !important;
  color: #6b7280 !important;
  padding: 2px 4px !important;
  border-radius: 3px !important;
  font-size: 12px !important;
}

.thinking-content ul,
.thinking-content ol {
  margin: 8px 0 !important;
  padding-left: 20px !important;
}

.thinking-content li {
  margin: 4px 0 !important;
  line-height: 1.5 !important;
}

.thinking-content blockquote {
  border-left: 2px solid rgba(156, 163, 175, 0.4) !important;
  padding-left: 12px !important;
  margin: 8px 0 !important;
  font-style: italic !important;
}

/* 响应式设计 - 思考内容 */
@media (max-width: 768px) {
  .thinking-header {
    padding: 3px 0;
  }

  .thinking-title {
    font-size: 11px;
  }

  .thinking-toggle {
    font-size: 10px;
  }

  .thinking-content {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .thinking-header {
    padding: 2px 0;
  }

  .thinking-title {
    font-size: 10px;
    gap: 4px;
  }

  .thinking-toggle {
    font-size: 9px;
  }

  .thinking-content {
    font-size: 12px;
  }
}

.math-inline {
  display: inline;
  margin: 0 2px;
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  font-size: 0.9em;
}

/* 确保数学公式在深色背景中可见 */
.user-message .math-block,
.user-message .math-inline {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.user-message .math-block .katex,
.user-message .math-inline .katex {
  color: white !important;
}

.user-message .math-block .katex .mord,
.user-message .math-inline .katex .mord {
  color: white !important;
}

/* 数学公式错误样式 */
.math-error {
  color: #cc0000;
  background: rgba(204, 0, 0, 0.1);
  border: 1px solid rgba(204, 0, 0, 0.3);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
}

/* 欢迎语样式 */
.welcome-message {
  margin-bottom: 24px;
}

.welcome-message .message-content {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.1) 0%,
    rgba(245, 158, 11, 0.05) 100%
  ) !important;
  border: 1px solid rgba(245, 158, 11, 0.2) !important;
  border-radius: 16px !important;
  padding: 24px !important;
  box-shadow: 0 4px 20px rgba(245, 158, 11, 0.1) !important;
}

.welcome-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.welcome-icon {
  font-size: 24px;
  line-height: 1;
}

.welcome-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-description {
  font-size: 15px;
  color: #374151;
  margin-bottom: 16px;
  line-height: 1.5;
}

.welcome-features {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.1);
  transition: all 0.2s ease;
}

.feature-item:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(245, 158, 11, 0.2);
  transform: translateX(4px);
}

.feature-icon {
  font-size: 16px;
  line-height: 1;
  min-width: 20px;
}

.feature-text {
  font-size: 14px;
  color: #4b5563;
  font-weight: 500;
}

.welcome-action {
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.action-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
  text-align: center;
}

.action-text code {
  background: rgba(245, 158, 11, 0.2);
  color: #d97706;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 13px;
  font-weight: 600;
}

/* 响应式设计 - 欢迎语 */
@media (max-width: 768px) {
  .welcome-message .message-content {
    padding: 20px !important;
  }

  .welcome-title {
    font-size: 16px;
  }

  .welcome-description {
    font-size: 14px;
  }

  .feature-item {
    padding: 6px 10px;
  }

  .feature-text {
    font-size: 13px;
  }

  .action-text {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .welcome-message .message-content {
    padding: 16px !important;
  }

  .welcome-header {
    gap: 8px;
  }

  .welcome-icon {
    font-size: 20px;
  }

  .welcome-title {
    font-size: 15px;
  }

  .welcome-features {
    gap: 8px;
  }

  .feature-item {
    padding: 6px 8px;
    gap: 8px;
  }

  .feature-icon {
    font-size: 14px;
    min-width: 16px;
  }

  .feature-text {
    font-size: 12px;
  }

  .welcome-action {
    padding: 10px 12px;
  }

  .action-text {
    font-size: 12px;
  }
}
</style>
