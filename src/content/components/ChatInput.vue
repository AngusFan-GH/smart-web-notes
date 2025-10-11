<template>
  <div class="chat-input-container">
    <div class="input-wrapper">
      <div
        ref="inputRef"
        class="input-editor"
        contenteditable="true"
        :placeholder="placeholder"
        :contenteditable="!disabled"
        @input="handleInput"
        @keydown="handleKeydown"
        @paste="handlePaste"
        @focus="handleFocus"
        @blur="handleBlur"
      ></div>
    </div>
    <button
      type="button"
      class="submit-btn"
      :disabled="!isLoading && (!hasContent || disabled)"
      @click="handleSubmit"
    >
      <div v-if="!isLoading" class="send-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div v-else class="stop-icon"></div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from "vue";

interface Props {
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder: "请输入您的问题...",
  disabled: false,
  isLoading: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  submit: [value: string];
  keydown: [event: KeyboardEvent];
  stop: [];
}>();

const inputRef = ref<HTMLElement>();
const hasContent = computed(() => props.modelValue.trim().length > 0);

// 同步外部值到内部
const syncValue = () => {
  if (inputRef.value && inputRef.value.textContent !== props.modelValue) {
    inputRef.value.textContent = props.modelValue;
  }
};

// 处理输入
const handleInput = (event: Event) => {
  const target = event.target as HTMLElement;
  const value = target.textContent || "";
  emit("update:modelValue", value);

  // 自动调整高度
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = "auto";
      inputRef.value.style.height = `${Math.min(
        inputRef.value.scrollHeight,
        120
      )}px`;
    }
  });
};

// 处理键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  emit("keydown", event);

  // 处理Enter键
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (hasContent.value && !props.disabled) {
      handleSubmit();
    }
  }
};

// 处理粘贴
const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain") || "";
  document.execCommand("insertText", false, text);
};

// 处理聚焦
const handleFocus = () => {
  if (inputRef.value) {
    inputRef.value.style.height = "auto";
    inputRef.value.style.height = `${Math.min(
      inputRef.value.scrollHeight,
      120
    )}px`;
  }
};

// 处理失焦
const handleBlur = () => {
  if (inputRef.value) {
    inputRef.value.style.height = "44px";
  }
};

// 处理提交
const handleSubmit = () => {
  if (props.isLoading) {
    // 如果正在加载，则停止
    emit("stop");
  } else if (hasContent.value && !props.disabled) {
    // 否则提交消息
    emit("submit", props.modelValue);
  }
};

// 清空输入
const clear = () => {
  if (inputRef.value) {
    inputRef.value.textContent = "";
    inputRef.value.style.height = "44px";
  }
  emit("update:modelValue", "");
};

// 聚焦输入框
const focus = () => {
  inputRef.value?.focus();
};

// 暴露方法
defineExpose({
  clear,
  focus,
});

onMounted(() => {
  syncValue();
});
</script>

<style scoped>
.chat-input-container {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(240, 248, 255, 0.95) 100%
  );
  border-radius: 20px;
  padding: 6px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15),
    0 0 0 1px rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  backdrop-filter: blur(20px);
}

.chat-input-container::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.2) 0%,
    rgba(118, 75, 162, 0.2) 50%,
    transparent 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.chat-input-container:focus-within {
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4),
    0 0 0 2px rgba(102, 126, 234, 0.3);
  border-color: #667eea;
  transform: translateY(-1px);
}

.chat-input-container:focus-within::before {
  opacity: 1;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  min-height: 44px;
}

.input-editor {
  width: 100%;
  min-height: 44px;
  max-height: 120px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  outline: none;
  font-size: 16px;
  line-height: 1.5;
  color: #1f2937;
  font-weight: 400;
  resize: none;
  overflow-y: auto;
  transition: all 0.3s ease;
  word-wrap: break-word;
  white-space: pre-wrap;
}

/* 隐藏滚动条但保持滚动功能 */
.input-editor::-webkit-scrollbar {
  display: none;
}

.input-editor {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.input-editor:empty::before {
  content: attr(placeholder);
  color: #9ca3af;
  font-weight: 400;
  pointer-events: none;
}

.input-editor:focus {
  outline: none;
}

.input-editor:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 20px;
  padding: 0;
  min-width: 44px;
  height: 44px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4),
    0 2px 4px rgba(118, 75, 162, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transform-origin: center center;
}

.submit-btn::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.2) 0%,
    transparent 50%,
    rgba(255, 255, 255, 0.1) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.submit-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5),
    0 4px 8px rgba(118, 75, 162, 0.4);
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
}

.submit-btn:hover:not(:disabled)::before {
  opacity: 1;
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* 停止状态样式 */
.submit-btn:not(:disabled) .stop-icon {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
  animation: pulse 1.5s ease-in-out infinite;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.4);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

.send-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: white;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn:hover:not(:disabled) .send-btn {
  transform: scale(1.02);
}

.stop-icon {
  width: 18px;
  height: 18px;
  background: currentColor;
  border-radius: 3px;
  animation: pulse 1.5s ease-in-out infinite;
  position: relative;
  z-index: 1;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chat-input-container {
    padding: 6px;
    border-radius: 20px;
    min-height: 52px;
  }

  .input-editor {
    font-size: 15px;
    padding: 10px 14px;
  }

  .submit-btn {
    min-width: 40px;
    height: 40px;
    border-radius: 18px;
  }
}

@media (max-width: 480px) {
  .chat-input-container {
    padding: 6px;
    border-radius: 18px;
    min-height: 48px;
  }

  .input-editor {
    font-size: 14px;
    padding: 8px 12px;
  }

  .submit-btn {
    min-width: 36px;
    height: 36px;
    border-radius: 16px;
  }

  .stop-icon {
    width: 14px;
    height: 14px;
  }
}
</style>
