<template>
  <div v-if="visible" class="suggested-questions">
    <div
      v-for="(question, index) in questions"
      :key="index"
      class="suggested-question-bubble"
      :style="{ animationDelay: `${index * 0.2}s` }"
      @click="handleQuestionClick(question)"
    >
      <div class="bubble-content">
        <el-icon class="bubble-icon"><QuestionFilled /></el-icon>
        <span class="bubble-text">{{ question }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { QuestionFilled } from "@element-plus/icons-vue";

interface Props {
  visible: boolean;
  questions: string[];
}

interface Emits {
  (e: "question-click", question: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function handleQuestionClick(question: string) {
  emit("question-click", question);
}
</script>

<style scoped>
/* 智能问题推荐样式 - 消息气泡风格 */
.suggested-questions {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 10;
  pointer-events: none;
}

.suggested-question-bubble {
  background: linear-gradient(
    135deg,
    rgba(212, 175, 55, 0.9) 0%,
    rgba(255, 193, 7, 0.8) 100%
  );
  border-radius: 20px 20px 20px 8px;
  padding: 0;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(212, 175, 55, 0.3);
  pointer-events: auto;
  opacity: 0;
  transform: translateY(20px) scale(0.9);
  animation: bubbleSlideUp 0.6s ease-out forwards;
  max-width: 80%;
  align-self: flex-start;
}

.suggested-question-bubble:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
}

.suggested-question-bubble:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 2px 8px rgba(212, 175, 55, 0.5);
}

.bubble-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  color: rgba(26, 26, 46, 0.9);
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
}

.bubble-icon {
  color: rgba(26, 26, 46, 0.7);
  font-size: 14px;
  flex-shrink: 0;
}

.bubble-text {
  flex: 1;
  word-break: break-word;
}

/* 气泡出现动画 */
@keyframes bubbleSlideUp {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
  }
  50% {
    opacity: 0.8;
    transform: translateY(-5px) scale(1.05);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 响应式调整 */
@media (max-width: 520px) {
  .suggested-questions {
    bottom: 15px;
    left: 15px;
    right: 15px;
    gap: 10px;
  }

  .suggested-question-bubble {
    max-width: 85%;
  }

  .bubble-content {
    padding: 10px 12px;
    font-size: 12px;
  }

  .bubble-icon {
    font-size: 12px;
  }
}
</style>
