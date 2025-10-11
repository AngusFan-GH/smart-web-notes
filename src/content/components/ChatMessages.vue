<template>
  <div class="chat-container">
    <el-scrollbar
      ref="scrollbarRef"
      class="messages-scrollbar"
      @scroll="handleScroll"
    >
      <div class="messages" ref="messagesContainer">
        <!-- AI开场白 -->
        <div class="message-item assistant-message">
          <div class="message-content">
            你好！我可以帮你理解和分析当前网页的内容。
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
            <div v-html="renderMarkdownContent(message.content)"></div>
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
      v-if="!shouldAutoScroll && messages.length > 0"
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
import { ref, watch, nextTick } from "vue";
import { ElIcon, ElEmpty, ElButton, ElScrollbar } from "element-plus";
import { User, Loading, ArrowDown } from "@element-plus/icons-vue";
import { renderMarkdown } from "../../shared/utils/markdown";

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

const messagesContainer = ref<HTMLElement>();
const scrollbarRef = ref();
const isUserScrolling = ref(false);
const shouldAutoScroll = ref(true);

// 渲染Markdown内容
const renderMarkdownContent = (content: string) => {
  if (!content) return "";
  return renderMarkdown(content);
};

// 检查是否在底部附近
const isNearBottom = () => {
  if (!scrollbarRef.value) return true;
  const scrollbar = scrollbarRef.value;
  const threshold = 100; // 100px阈值
  return (
    scrollbar.wrapRef.scrollHeight -
      scrollbar.wrapRef.scrollTop -
      scrollbar.wrapRef.clientHeight <=
    threshold
  );
};

// 处理用户滚动
const handleScroll = (scrollTop: number) => {
  if (!scrollbarRef.value) return;

  const nearBottom = isNearBottom();

  // 如果用户手动向上滚动（远离底部），停止自动滚动
  if (!nearBottom) {
    shouldAutoScroll.value = false;
    isUserScrolling.value = true;
  } else {
    // 如果用户滚动到底部附近，重新启用自动滚动
    shouldAutoScroll.value = true;
    isUserScrolling.value = false;
  }
};

// 自动滚动到底部
const scrollToBottom = (smooth = true, force = false) => {
  // 如果是强制滚动（流式更新时），忽略用户滚动状态
  if (!force && !shouldAutoScroll.value) return;

  nextTick(() => {
    if (scrollbarRef.value) {
      const wrapRef = scrollbarRef.value.wrapRef;
      const scrollHeight = wrapRef.scrollHeight;

      // 使用原生DOM的scrollTo方法
      wrapRef.scrollTo({
        top: scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });

      console.log("自动滚动到底部，scrollHeight:", scrollHeight);
    }
  });
};

// 手动滚动到底部（按钮点击时调用）
const handleScrollToBottom = () => {
  if (scrollbarRef.value) {
    const wrapRef = scrollbarRef.value.wrapRef;
    const scrollHeight = wrapRef.scrollHeight;

    // 使用原生DOM的scrollTo方法，确保滚动到底部
    wrapRef.scrollTo({
      top: scrollHeight,
      behavior: "smooth",
    });

    // 重新启用自动滚动
    shouldAutoScroll.value = true;
    isUserScrolling.value = false;

    console.log("手动滚动到底部，scrollHeight:", scrollHeight);
  }
};

// 监听消息变化，自动滚动
watch(
  () => props.messages.length,
  (newLength, oldLength) => {
    // 只有在消息数量增加时才滚动
    if (newLength > oldLength) {
      scrollToBottom();
    }
  },
  { flush: "post" }
);

// 监听消息内容变化（用于流式更新）
watch(
  () => props.messages,
  () => {
    // 如果正在流式处理且用户没有手动滚动，则自动滚动到底部
    if (props.isStreaming && shouldAutoScroll.value) {
      scrollToBottom(true, false);
    }
  },
  { deep: true, flush: "post" }
);

// 监听流式处理状态变化
watch(
  () => props.isStreaming,
  (isStreaming) => {
    // 流式处理开始时强制滚动到底部
    if (isStreaming) {
      scrollToBottom(true, true);
    }
  },
  { flush: "post" }
);

// 监听处理状态变化
watch(
  () => props.isProcessing,
  (isProcessing) => {
    // 开始处理时滚动到底部
    if (isProcessing) {
      scrollToBottom(false);
    }
  },
  { flush: "post" }
);
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.scroll-to-bottom-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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

/* 用户消息样式 */
.user-message {
  justify-content: flex-end !important;
}

.user-message .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  border-radius: 18px 18px 4px 18px !important;
  padding: 12px 16px !important;
  max-width: 70% !important;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4),
    0 2px 4px rgba(118, 75, 162, 0.3) !important;
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
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15),
    0 2px 4px rgba(118, 75, 162, 0.1) !important;
  border: 1px solid rgba(102, 126, 234, 0.2) !important;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  animation: loadingDots 1.4s infinite ease-in-out both;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
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
</style>
