<template>
  <div class="chat-container">
    <el-scrollbar
      ref="scrollbarRef"
      class="messages-scrollbar"
      @scroll="(args) => handleScroll(args.scrollTop)"
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
            <div v-html="getRenderedContent(message.id)"></div>
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
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
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
const forceUpdate = ref(0); // 用于强制重新渲染

// 滚动优化相关
let scrollTimeout: number | null = null;
let isRendering = false; // 标记是否正在渲染
let lastScrollHeight = 0; // 记录上次的滚动高度
let scrollAnimationFrame: number | null = null; // 使用requestAnimationFrame优化滚动

// 渲染内容缓存
const renderedContentCache = ref<Map<string, string>>(new Map());
const renderingPromises = ref<Map<string, Promise<string>>>(new Map());

// 获取渲染内容（同步版本，从缓存获取）
const getRenderedContent = (messageId: string): string => {
  return renderedContentCache.value.get(messageId) || "渲染中...";
};

// 异步渲染Markdown内容
const renderMarkdownContent = async (
  content: string,
  messageId: string,
  forceRerender = false
) => {
  if (!content) {
    return "";
  }

  // 如果强制重新渲染，清除现有缓存
  if (forceRerender) {
    renderedContentCache.value.delete(messageId);
    renderingPromises.value.delete(messageId);
  }

  // 如果已经在渲染中且不是强制重新渲染，返回现有的Promise
  if (renderingPromises.value.has(messageId) && !forceRerender) {
    return renderingPromises.value.get(messageId)!;
  }

  // 创建渲染Promise
  const renderPromise = (async () => {
    try {
      // 标记开始渲染
      isRendering = true;

      const result = await renderMarkdown(content);

      // 缓存结果
      renderedContentCache.value.set(messageId, result);
      // 清理Promise缓存
      renderingPromises.value.delete(messageId);

      // 渲染完成
      isRendering = false;

      // 触发重新渲染
      forceUpdate.value++;
      return result;
    } catch (error) {
      const fallback = content.replace(/\n/g, "<br>");
      renderedContentCache.value.set(messageId, fallback);
      renderingPromises.value.delete(messageId);

      // 渲染完成
      isRendering = false;

      forceUpdate.value++;
      return fallback;
    }
  })();

  // 缓存Promise
  renderingPromises.value.set(messageId, renderPromise);
  return renderPromise;
};

// 检查是否在底部附近
const isNearBottom = () => {
  if (!scrollbarRef.value) return true;
  const scrollbar = scrollbarRef.value;
  const threshold = 50; // 减少阈值，提高检测精度
  const scrollTop = scrollbar.wrapRef.scrollTop;
  const scrollHeight = scrollbar.wrapRef.scrollHeight;
  const clientHeight = scrollbar.wrapRef.clientHeight;

  return scrollHeight - scrollTop - clientHeight <= threshold;
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

// 平滑滚动到底部
const scrollToBottom = (smooth = true, force = false) => {
  // 如果不是强制滚动且用户不在底部，则不滚动
  if (!force && !shouldAutoScroll.value) return;

  // 清除之前的滚动请求
  if (scrollAnimationFrame) {
    cancelAnimationFrame(scrollAnimationFrame);
  }
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }

  // 使用requestAnimationFrame确保在下一帧执行
  scrollAnimationFrame = requestAnimationFrame(() => {
    if (scrollbarRef.value) {
      const wrapRef = scrollbarRef.value.wrapRef;
      const scrollHeight = wrapRef.scrollHeight;
      const currentScrollTop = wrapRef.scrollTop;
      const clientHeight = wrapRef.clientHeight;

      // 计算距离底部的距离
      const distanceFromBottom = scrollHeight - currentScrollTop - clientHeight;

      // 如果距离底部超过30px，才进行滚动
      if (distanceFromBottom > 30) {
        // 记录新的滚动高度
        lastScrollHeight = scrollHeight;

        // 使用原生DOM的scrollTo方法
        wrapRef.scrollTo({
          top: scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      }
    }
    scrollAnimationFrame = null;
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
  (newMessages, oldMessages) => {
    // 处理流式更新：重新渲染所有消息
    if (newMessages && newMessages.length > 0) {
      let hasStreamingMessage = false;

      newMessages.forEach((message) => {
        // 对于流式消息，每次都重新渲染
        if (
          props.isStreaming &&
          message.id === newMessages[newMessages.length - 1].id
        ) {
          // 流式消息：强制重新渲染，确保数学公式被处理
          renderMarkdownContent(message.content, message.id, true);
          hasStreamingMessage = true;
        } else if (!renderedContentCache.value.has(message.id)) {
          // 非流式消息：只在没有缓存时渲染
          renderMarkdownContent(message.content, message.id, false);
        }
      });

      // 如果有流式消息且需要自动滚动，延迟滚动
      if (hasStreamingMessage && props.isStreaming && shouldAutoScroll.value) {
        // 使用较长的延迟确保DOM更新完成
        setTimeout(() => {
          scrollToBottom(true, false);
        }, 100);
      }
    }
  },
  { deep: true, flush: "post" }
);

// 监听流式处理状态变化
watch(
  () => props.isStreaming,
  (isStreaming, wasStreaming) => {
    // 流式处理开始时强制滚动到底部
    if (isStreaming) {
      shouldAutoScroll.value = true;
      isUserScrolling.value = false;
      nextTick(() => {
        scrollToBottom(true, true);
      });
    }

    // 流式处理结束时，重新渲染最后一条消息确保内容完整
    if (wasStreaming && !isStreaming && props.messages.length > 0) {
      const lastMessage = props.messages[props.messages.length - 1];
      if (lastMessage) {
        // 清除缓存并重新渲染，确保显示最终内容
        renderedContentCache.value.delete(lastMessage.id);
        renderingPromises.value.delete(lastMessage.id);
        renderMarkdownContent(lastMessage.content, lastMessage.id, true);

        // 确保最终内容显示后滚动到底部
        nextTick(() => {
          scrollToBottom(true, true);
        });
      }
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

// 组件挂载时渲染所有现有消息
onMounted(() => {
  // 渲染所有现有消息
  if (props.messages && props.messages.length > 0) {
    props.messages.forEach((message) => {
      if (!renderedContentCache.value.has(message.id)) {
        renderMarkdownContent(message.content, message.id);
      }
    });
  }

  // 初始化时滚动到底部
  nextTick(() => {
    scrollToBottom(false, true);
  });

  // 初始化完成
});

// 组件卸载时清理
onUnmounted(() => {
  // 清理定时器
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }

  // 清理动画帧
  if (scrollAnimationFrame) {
    cancelAnimationFrame(scrollAnimationFrame);
  }
});

// 数学渲染器已集成，无需监听外部事件
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

/* 用户消息样式 */
.user-message {
  justify-content: flex-end !important;
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
</style>
