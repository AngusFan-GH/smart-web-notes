<template>
  <div
    v-if="steps.length > 0 && showProcessingSteps && isVisible"
    class="processing-steps"
    :class="{ 'is-collapsed': isCollapsed }"
  >
    <div class="steps-header" @click="toggleCollapse">
      <div class="header-left">
        <div class="header-title-row">
          <h4>处理进度</h4>
          <!-- 折叠状态下的摘要信息 -->
          <div v-if="isCollapsed" class="collapsed-info">
            <span class="summary-text">
              {{ completedStepsCount }}/{{ steps.length }} 步骤完成
            </span>
            <div class="mini-progress-bar">
              <div
                class="mini-progress-fill"
                :style="{ width: `${progressPercentage}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
      <div class="header-controls">
        <div v-if="!isCollapsed" class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${progressPercentage}%` }"
          ></div>
        </div>
        <button class="collapse-btn" :class="{ 'is-collapsed': isCollapsed }">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="!isCollapsed" class="steps-list">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="step-item"
        :class="{
          'step-pending': step.status === 'pending',
          'step-processing': step.status === 'processing',
          'step-completed': step.status === 'completed',
          'step-error': step.status === 'error',
        }"
      >
        <div class="step-icon">
          <div v-if="step.status === 'pending'" class="icon-pending">⏳</div>
          <div v-else-if="step.status === 'processing'" class="icon-processing">
            <div class="spinner"></div>
          </div>
          <div v-else-if="step.status === 'completed'" class="icon-completed">
            ✅
          </div>
          <div v-else-if="step.status === 'error'" class="icon-error">❌</div>
        </div>

        <div class="step-content">
          <div class="step-name">{{ step.name }}</div>
          <div v-if="step.message" class="step-message">{{ step.message }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { userFeedback } from "../../shared/utils/userFeedback";
import { appState } from "../../shared/stores/appStore";

const steps = ref(userFeedback.getAllSteps());
const isCollapsed = ref(true); // 默认折叠
const userManuallyCollapsed = ref(false); // 用户手动折叠状态
const isVisible = ref(false); // 控制整个组件的显示/隐藏，默认不显示

// 是否显示处理进度（从设置中获取）
const showProcessingSteps = computed(() => {
  return appState.settings.value?.showProcessingSteps ?? true;
});

// 计算进度百分比
const progressPercentage = computed(() => {
  if (steps.value.length === 0) return 0;

  const completedSteps = steps.value.filter(
    (step) => step.status === "completed"
  ).length;
  return (completedSteps / steps.value.length) * 100;
});

// 计算完成的步骤数量
const completedStepsCount = computed(() => {
  return steps.value.filter((step) => step.status === "completed").length;
});

// 切换折叠状态
function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
  userManuallyCollapsed.value = isCollapsed.value; // 记录用户手动操作
}

// 监听步骤变化
let intervalId: NodeJS.Timeout | null = null;

onMounted(() => {
  // 定期更新步骤状态
  intervalId = setInterval(() => {
    steps.value = userFeedback.getAllSteps();
  }, 100);

  // 检查是否有正在处理的步骤，如果有则不折叠
  const hasProcessingStep = steps.value.some(
    (step) => step.status === "processing"
  );
  if (hasProcessingStep) {
    isCollapsed.value = false;
  }
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});

// 监听步骤状态变化，只在AI对话处理时自动展开
watch(
  steps,
  (newSteps) => {
    // 检查是否有任何步骤正在处理
    const hasProcessingStep = newSteps.some(
      (step) => step.status === "processing"
    );

    // 如果有步骤正在处理，显示组件
    if (hasProcessingStep) {
      isVisible.value = true;
    }

    const aiConversationStep = newSteps.find(
      (step) => step.id === "ai_conversation"
    );
    const isAiProcessing =
      aiConversationStep && aiConversationStep.status === "processing";

    // 只有在AI对话处理且用户没有手动折叠时才自动展开
    if (isAiProcessing && !userManuallyCollapsed.value) {
      isCollapsed.value = false;
    }

    // 检查是否所有步骤都完成了
    const allCompleted = newSteps.every((step) => step.status === "completed");
    if (allCompleted && newSteps.length > 0) {
      // 所有步骤完成后1秒隐藏
      setTimeout(() => {
        isVisible.value = false;
      }, 1000);
    }
  },
  { deep: true }
);

// 监听对话状态，对话时自动折叠
watch(
  () => appState.messages.value.length,
  (newLength, oldLength) => {
    // 当有新消息时（用户发送消息），立即折叠处理进度
    if (newLength > oldLength) {
      const lastMessage =
        appState.messages.value[appState.messages.value.length - 1];
      if (lastMessage && lastMessage.isUser) {
        // 用户发送消息时，显示处理进度并重置状态
        isVisible.value = true;
        isCollapsed.value = true;
        userManuallyCollapsed.value = false;
      }
    }
  }
);
</script>

<style scoped>
.processing-steps {
  background: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.95) 0%,
    rgba(22, 33, 62, 0.9) 100%
  );
  border-radius: 12px;
  padding: 16px;
  margin: 12px 0;
  border: 1px solid rgba(212, 175, 55, 0.3);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.processing-steps.is-collapsed {
  padding: 12px 16px;
}

.steps-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  padding: 4px 0;
}

.steps-header:hover {
  opacity: 0.8;
}

.processing-steps.is-collapsed .steps-header {
  margin-bottom: 0;
}

.header-left {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.steps-header h4 {
  margin: 0;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  flex-shrink: 0;
}

.collapsed-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.summary-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.mini-progress-bar {
  width: 60px;
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}

.mini-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d4af37 0%, #ffd700 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.progress-bar {
  width: 120px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d4af37 0%, #ffd700 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.collapse-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.collapse-btn.is-collapsed {
  transform: rotate(180deg);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.step-pending {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.step-processing {
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.3);
  animation: pulse 2s infinite;
}

.step-completed {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.step-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.step-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-pending {
  font-size: 12px;
  opacity: 0.6;
}

.icon-processing {
  position: relative;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(212, 175, 55, 0.3);
  border-top: 2px solid #d4af37;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.icon-completed {
  font-size: 14px;
  color: #22c55e;
}

.icon-error {
  font-size: 14px;
  color: #ef4444;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-name {
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
}

.step-message {
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  line-height: 1.4;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .processing-steps {
    padding: 12px;
    margin: 8px 0;
  }

  .processing-steps.is-collapsed {
    padding: 8px 12px;
  }

  .steps-header h4 {
    font-size: 13px;
  }

  .progress-bar {
    width: 80px;
  }

  .header-controls {
    gap: 6px;
  }

  .step-item {
    padding: 6px;
    gap: 10px;
  }

  .step-name {
    font-size: 12px;
  }

  .step-message {
    font-size: 10px;
  }

  .summary-text {
    font-size: 10px;
  }

  .mini-progress-bar {
    width: 50px;
  }
}

/* 小尺寸对话框优化 */
@media (max-height: 400px) {
  .processing-steps {
    margin: 6px 0;
  }

  .processing-steps.is-collapsed {
    padding: 8px 12px;
  }

  .steps-header {
    margin-bottom: 8px;
  }

  .processing-steps.is-collapsed .steps-header {
    margin-bottom: 0;
  }

  .steps-list {
    gap: 6px;
  }

  .step-item {
    padding: 6px;
    gap: 8px;
  }

  .step-name {
    font-size: 12px;
  }

  .step-message {
    font-size: 10px;
  }
}

/* 超小尺寸对话框 */
@media (max-height: 300px) {
  .processing-steps {
    margin: 4px 0;
  }

  .processing-steps.is-collapsed {
    padding: 6px 12px;
  }

  .steps-header h4 {
    font-size: 12px;
  }

  .progress-bar {
    width: 60px;
    height: 3px;
  }

  .summary-text {
    font-size: 10px;
  }
}
</style>
