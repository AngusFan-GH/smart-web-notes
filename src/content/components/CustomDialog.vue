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
      <ProcessingSteps />
      <ChatMessages
        :messages="appState.messages.value"
        :is-processing="appState.isProcessing.value"
        :is-streaming="appState.isStreaming.value"
      />

      <!-- 推荐问题加载状态 -->
      <div
        v-if="
          isGeneratingSuggestedQuestions && appState.messages.value.length === 0
        "
        class="suggested-questions-loading"
      >
        <div class="loading-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span class="loading-text">生成推荐问题中</span>
      </div>

      <!-- 智能问题推荐 -->
      <SuggestedQuestions
        :visible="showSuggestedQuestions"
        :questions="suggestedQuestions.slice(0, 3)"
        @question-click="useSuggestedQuestion"
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
        @input="handleInputChange"
      />

      <!-- 命令建议 -->
      <div v-if="commandSuggestions.length > 0" class="command-suggestions">
        <div
          v-for="suggestion in commandSuggestions"
          :key="suggestion"
          class="suggestion-item"
          @click="selectSuggestion(suggestion)"
        >
          {{ suggestion }}
        </div>
      </div>
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
import {
  ref,
  reactive,
  onMounted,
  onUnmounted,
  computed,
  watch,
  nextTick,
} from "vue";
import { appState, appActions } from "../../shared/stores/appStore";
import { UnifiedCommandExecutor } from "../../shared/services/unifiedCommandExecutor";
import { useContextStore } from "../../shared/stores/contextStore";
import {
  handleError,
  getUserFriendlyMessage,
  isRetryable,
  getSuggestedAction,
} from "../../shared/utils/errorHandler";
import {
  userFeedback,
  showProcessingSteps,
  startStep,
  completeStep,
  errorStep,
} from "../../shared/utils/userFeedback";
import { stateManager } from "../../shared/utils/stateManager";
import { SuggestedQuestionsService } from "../../shared/services/suggestedQuestionsService";
import DialogHeader from "./DialogHeader.vue";
import ChatMessages from "./ChatMessages.vue";
import ChatInput from "./ChatInput.vue";
import ProcessingSteps from "./ProcessingSteps.vue";
import SuggestedQuestions from "./SuggestedQuestions.vue";

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
const commandSuggestions = ref<string[]>([]);

// 智能问题推荐相关
const suggestedQuestions = ref<string[]>([]);
const isGeneratingSuggestedQuestions = ref(false);
const showSuggestedQuestions = computed(() => {
  return (
    appState.messages.value.length === 0 &&
    suggestedQuestions.value.length > 0 &&
    appState.settings.value?.enableSuggestedQuestions !== false
  );
});

// 服务实例
const commandExecutor = UnifiedCommandExecutor.getInstance();
const contextStore = useContextStore();

// 从全局状态获取推荐问题
function loadSuggestedQuestions() {
  const globalQuestions = (window as any).suggestedQuestions;
  if (globalQuestions && Array.isArray(globalQuestions)) {
    suggestedQuestions.value = globalQuestions;
    console.log("从全局状态加载推荐问题:", globalQuestions);
  }
}

// 处理推荐问题更新事件
function handleSuggestedQuestionsUpdated(event: any) {
  const { questions } = event.detail;
  if (questions && Array.isArray(questions)) {
    suggestedQuestions.value = questions;
    console.log("收到推荐问题更新事件:", questions);
  }
}

// 生成推荐问题（如果需要）
async function generateSuggestedQuestionsIfNeeded() {
  console.log("🔍 CustomDialog generateSuggestedQuestionsIfNeeded 被调用", {
    enableSuggestedQuestions: appState.settings.value?.enableSuggestedQuestions,
    showFloatingBall: appState.showFloatingBall.value,
    messagesLength: appState.messages.value.length,
  });

  // 检查设置是否启用推荐问题
  if (appState.settings.value?.enableSuggestedQuestions === false) {
    console.log("推荐问题功能已禁用，跳过生成");
    return;
  }

  // 检查悬浮球是否显示
  if (!appState.showFloatingBall.value) {
    console.log("悬浮球已隐藏，跳过推荐问题生成");
    return;
  }

  // 检查是否有消息
  if (appState.messages.value.length > 0) {
    console.log("已有消息，跳过推荐问题生成");
    return;
  }

  try {
    // 设置加载状态
    isGeneratingSuggestedQuestions.value = true;

    // 获取页面内容解析函数
    const parseWebContent = (window as any).parseWebContent;
    if (!parseWebContent) {
      console.warn("页面内容解析函数不可用");
      return;
    }

    // 获取页面上下文
    const pageContext = {
      url: typeof window !== "undefined" ? window.location.href : "",
      title: typeof document !== "undefined" ? document.title : "",
    };

    // 生成推荐问题
    const questions =
      await SuggestedQuestionsService.generateSuggestedQuestions(
        parseWebContent,
        pageContext
      );

    // 将问题存储到全局状态中
    (window as any).suggestedQuestions = questions;

    // 更新本地状态
    suggestedQuestions.value = questions;

    console.log("推荐问题生成完成:", questions);
  } catch (error) {
    console.warn("生成推荐问题失败:", error);
    // 生成失败时保持推荐问题为空
    suggestedQuestions.value = [];
  } finally {
    // 清除加载状态
    isGeneratingSuggestedQuestions.value = false;
  }
}

// 页面上下文
const pageContext = computed(() => {
  try {
    return {
      url: typeof window !== "undefined" ? window.location.href : "",
      title: typeof document !== "undefined" ? document.title : "",
    };
  } catch (error) {
    console.warn("无法获取页面上下文:", error);
    return {
      url: "",
      title: "",
    };
  }
});

// 对话框位置和大小
const dialogPosition = reactive({
  left: "auto",
  top: "auto",
  isCustomPosition: false,
});

const dialogSize = reactive({
  width: 360,
  height: 600,
  minWidth: 300,
  minHeight: 500,
});

// 计算样式
const dialogStyle = computed(() => {
  const area = calculateAvailableArea();
  const isMobile =
    typeof window !== "undefined" ? window.innerWidth <= 768 : false;

  // 如果对话框位置是自定义的，需要检查是否超出屏幕范围
  if (dialogPosition.isCustomPosition) {
    const left = parseInt(dialogPosition.left) || 0;
    const top = parseInt(dialogPosition.top) || 0;
    const width = dialogSize.width;
    const height = dialogSize.height;

    // 检查是否超出屏幕边界
    const rightOverflow = left + width > area.availableWidth;
    const bottomOverflow = top + height > area.availableHeight;
    const leftOverflow = left < area.leftMargin;
    const topOverflow = top < area.topMargin;

    // 如果超出范围，调整位置
    let adjustedLeft = left;
    let adjustedTop = top;

    if (rightOverflow) {
      adjustedLeft = Math.max(area.leftMargin, area.availableWidth - width);
    }
    if (bottomOverflow) {
      adjustedTop = Math.max(area.topMargin, area.availableHeight - height);
    }
    if (leftOverflow) {
      adjustedLeft = area.leftMargin;
    }
    if (topOverflow) {
      adjustedTop = area.topMargin;
    }

    // 如果位置有调整，更新存储的位置
    if (adjustedLeft !== left || adjustedTop !== top) {
      dialogPosition.left = `${adjustedLeft}px`;
      dialogPosition.top = `${adjustedTop}px`;
      saveDialogPosition();
    }

    return {
      position: "fixed" as const,
      left: dialogPosition.left,
      top: dialogPosition.top,
      right: "auto",
      bottom: "auto",
      width: `${Math.min(dialogSize.width, area.availableWidth)}px`,
      height: `${Math.min(dialogSize.height, area.availableHeight)}px`,
      minWidth: `${dialogSize.minWidth}px`,
      minHeight: `${dialogSize.minHeight}px`,
      maxWidth: `${area.availableWidth}px`,
      maxHeight: `${area.availableHeight}px`,
    };
  }

  // 默认位置（非自定义）
  return {
    position: "fixed" as const,
    right: `${area.rightMargin}px`,
    bottom: `${area.bottomMargin}px`,
    left: "auto",
    top: "auto",
    width: `${Math.min(dialogSize.width, area.availableWidth)}px`,
    height: `${Math.min(dialogSize.height, area.availableHeight)}px`,
    minWidth: `${dialogSize.minWidth}px`,
    minHeight: `${dialogSize.minHeight}px`,
    maxWidth: `${area.availableWidth}px`,
    maxHeight: `${area.availableHeight}px`,
  };
});

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

// 防抖定时器
let resizeTimeout: NodeJS.Timeout | null = null;

// 统一的边距配置
const MARGIN_CONFIG = {
  // 基础边距（上下左右统一使用）
  base: 20,
  // 滚动条额外边距（仅用于右侧和底部）
  scrollbar: 16,
  // 移动端边距调整
  mobile: {
    base: 10,
    scrollbar: 3,
  },
};

// 获取滚动条宽度
function getScrollbarWidth() {
  if (typeof document === "undefined") {
    return 0; // 如果document不可用，返回0
  }

  try {
    // 创建临时元素来测量滚动条宽度
    const outer = document.createElement("div");
    outer.style.visibility = "hidden";
    outer.style.overflow = "scroll";
    (outer.style as any).msOverflowStyle = "scrollbar";
    document.body.appendChild(outer);

    const inner = document.createElement("div");
    outer.appendChild(inner);

    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.parentNode?.removeChild(outer);

    return scrollbarWidth;
  } catch (error) {
    console.warn("无法获取滚动条宽度:", error);
    return 0;
  }
}

// 计算可用区域尺寸
function calculateAvailableArea() {
  const isMobile =
    typeof window !== "undefined" ? window.innerWidth <= 768 : false;
  const scrollbarWidth = getScrollbarWidth();
  const config = isMobile ? MARGIN_CONFIG.mobile : MARGIN_CONFIG;

  return {
    // 左侧和顶部边距（不考虑滚动条）
    leftMargin: config.base,
    topMargin: config.base,
    // 右侧边距（考虑滚动条）
    rightMargin: config.base + scrollbarWidth + config.scrollbar,
    // 底部边距（考虑滚动条，如果有水平滚动条的话）
    bottomMargin: config.base + config.scrollbar,
    // 计算可用区域
    availableWidth:
      typeof window !== "undefined"
        ? window.innerWidth - config.base - scrollbarWidth - config.scrollbar
        : 800,
    availableHeight:
      typeof window !== "undefined"
        ? window.innerHeight - config.base - config.scrollbar
        : 600,
    // 原始窗口尺寸
    windowWidth: typeof window !== "undefined" ? window.innerWidth : 800,
    windowHeight: typeof window !== "undefined" ? window.innerHeight : 600,
  };
}

// 初始化
onMounted(async () => {
  await loadDialogPosition();
  await loadDialogSize();

  // 初始化命令执行器
  commandExecutor.initialize();

  // 监听窗口大小变化（使用防抖）
  window.addEventListener("resize", handleWindowResizeDebounced);

  // 添加背景点击监听（用于自动隐藏对话框）
  document.addEventListener("mousedown", handleBackgroundClick);

  // 监听推荐问题更新事件
  window.addEventListener(
    "suggestedQuestionsUpdated",
    handleSuggestedQuestionsUpdated
  );

  // 加载推荐问题
  loadSuggestedQuestions();

  // 如果全局状态中没有推荐问题，则生成新的
  if (
    !(window as any).suggestedQuestions ||
    (window as any).suggestedQuestions.length === 0
  ) {
    generateSuggestedQuestionsIfNeeded();
  }
});

// 清理
onUnmounted(() => {
  // 清理命令执行器
  commandExecutor.cleanup();

  // 清理事件监听器
  window.removeEventListener("resize", handleWindowResizeDebounced);
  document.removeEventListener("mousedown", handleBackgroundClick);
  window.removeEventListener(
    "suggestedQuestionsUpdated",
    handleSuggestedQuestionsUpdated
  );
});

// 防抖处理窗口大小变化
function handleWindowResizeDebounced() {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  resizeTimeout = setTimeout(() => {
    handleWindowResize();
  }, 100); // 100ms防抖
}

// 处理窗口大小变化
function handleWindowResize() {
  const area = calculateAvailableArea();

  // 如果对话框是自定义位置，检查是否需要调整
  if (dialogPosition.isCustomPosition) {
    const left = parseInt(dialogPosition.left) || 0;
    const top = parseInt(dialogPosition.top) || 0;
    const width = dialogSize.width;
    const height = dialogSize.height;

    let needsAdjustment = false;
    let newLeft = left;
    let newTop = top;

    // 检查右边界（考虑滚动条）
    if (left + width > area.availableWidth) {
      newLeft = Math.max(area.leftMargin, area.availableWidth - width);
      needsAdjustment = true;
    }

    // 检查下边界
    if (top + height > area.availableHeight) {
      newTop = Math.max(area.topMargin, area.availableHeight - height);
      needsAdjustment = true;
    }

    // 检查左边界
    if (newLeft < area.leftMargin) {
      newLeft = area.leftMargin;
      needsAdjustment = true;
    }

    // 检查上边界
    if (newTop < area.topMargin) {
      newTop = area.topMargin;
      needsAdjustment = true;
    }

    // 如果需要调整，更新位置
    if (needsAdjustment) {
      dialogPosition.left = `${newLeft}px`;
      dialogPosition.top = `${newTop}px`;
      saveDialogPosition();
    }
  }

  // 如果对话框尺寸超出屏幕，调整尺寸（考虑滚动条）
  if (dialogSize.width > area.availableWidth) {
    dialogSize.width = Math.max(dialogSize.minWidth, area.availableWidth);
    saveDialogSize();
  }

  if (dialogSize.height > area.availableHeight) {
    dialogSize.height = Math.max(dialogSize.minHeight, area.availableHeight);
    saveDialogSize();
  }
}

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

  // 清空输入框
  userInput.value = "";
  commandSuggestions.value = [];

  // 同时清空contenteditable div的内容
  if (chatInputRef.value) {
    chatInputRef.value.clear();
  }

  // 显示处理步骤
  const steps = userFeedback.generateContentAnalysisSteps();
  showProcessingSteps(steps);

  // 重置流式完成标志，准备接收新的流式消息
  if ((window as any).resetStreamingCompletedFlag) {
    (window as any).resetStreamingCompletedFlag();
  }

  // 设置新的生成状态
  appActions.setGenerating(true);

  try {
    // 添加用户消息
    appActions.addMessage(message, true);

    // 使用命令执行器处理消息
    const result = await commandExecutor.executeCommand(message);

    if (result.success) {
      // 只有当消息不为空时才添加AI响应
      if (result.message && result.message.trim()) {
        appActions.addMessage(result.message, false);
      }

      // 只有直接命令才立即重置状态，AI命令让流式处理自己管理状态
      if (result.type === "direct") {
        console.log("直接命令执行完成，重置状态");
        stateManager.reset();
      } else {
        console.log("AI命令已发送，等待流式处理管理状态");
      }
    } else {
      throw new Error(result.message || "命令执行失败");
    }
  } catch (error) {
    console.error("发送消息失败:", error);

    // 标记当前步骤为错误
    const currentStep = userFeedback.getCurrentStep();
    if (currentStep) {
      errorStep(currentStep.id, "处理失败");
    }

    // 使用优化后的错误处理机制
    const errorInfo = handleError(error);
    const userMessage = getUserFriendlyMessage(error);
    const suggestedAction = getSuggestedAction(error);

    // 构建用户友好的错误消息
    let errorMessage = `❌ ${userMessage}`;
    if (suggestedAction) {
      errorMessage += `\n\n💡 建议操作：${suggestedAction}`;
    }

    // 如果是可重试的错误，添加重试按钮提示
    if (isRetryable(error)) {
      errorMessage += `\n\n🔄 您可以稍后重试此操作`;
    }

    appActions.addMessage(errorMessage, false);

    // 错误情况下总是重置状态
    stateManager.reset();
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

// 处理输入变化
function handleInputChange() {
  if (userInput.value.length > 0) {
    commandSuggestions.value = commandExecutor.getCommandSuggestions(
      userInput.value
    );
  } else {
    commandSuggestions.value = [];
  }
}

// 选择建议
function selectSuggestion(suggestion: string) {
  userInput.value = suggestion;
  commandSuggestions.value = [];
  if (chatInputRef.value) {
    chatInputRef.value.focus();
  }
}

// 停止生成
async function stopGeneration() {
  console.log("用户点击停止生成");
  console.log("停止前状态:", stateManager.getState());

  // 使用stateManager停止处理
  stateManager.stopStreaming();

  console.log("停止后状态:", stateManager.getState());

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

// 注意：推荐问题生成现在由App.vue统一管理

// 使用建议的问题
function useSuggestedQuestion(question: string) {
  userInput.value = question;
  sendMessage();
}

// 处理对话框鼠标按下
function handleDialogMouseDown(event: MouseEvent) {
  event.stopPropagation();
}

// 处理背景点击（自动隐藏对话框）
function handleBackgroundClick(event: MouseEvent) {
  // 检查是否启用了自动隐藏功能
  if (appState.settings.value?.autoHideDialog) {
    // 检查点击的是否是对话框外部
    const dialog = document.querySelector(".custom-dialog");
    if (dialog && !dialog.contains(event.target as Node)) {
      close();
    }
  }
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
  (document.body.style as any).mozUserSelect = "none";
  (document.body.style as any).msUserSelect = "none";

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
  (document.body.style as any).webkitUserSelect = "";
  (document.body.style as any).mozUserSelect = "";
  (document.body.style as any).msUserSelect = "";

  document.removeEventListener("mousemove", handleDrag);
  document.removeEventListener("mouseup", stopDrag);
}

// 处理调整大小开始
function handleResizeStart(direction: string, event: MouseEvent) {
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
  (document.body.style as any).mozUserSelect = "none";
  (document.body.style as any).msUserSelect = "none";

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
  (document.body.style as any).webkitUserSelect = "";
  (document.body.style as any).mozUserSelect = "";
  (document.body.style as any).msUserSelect = "";

  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);
}

// 清理事件监听器
onUnmounted(() => {
  document.removeEventListener("mousemove", handleDrag);
  document.removeEventListener("mouseup", stopDrag);
  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);
  window.removeEventListener("resize", handleWindowResizeDebounced);
  document.removeEventListener("mousedown", handleBackgroundClick);

  // 清理防抖定时器
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
});
</script>

<style scoped>
/* 对话框主体 */
.custom-dialog {
  background: linear-gradient(
    135deg,
    #1a1a2e 0%,
    #16213e 50%,
    #0f3460 100%
  ) !important;
  border-radius: 20px !important;
  box-shadow: 0 8px 32px rgba(15, 52, 96, 0.4),
    0 0 0 1px rgba(212, 175, 55, 0.3) !important;
  border: 1px solid rgba(212, 175, 55, 0.4) !important;
  min-width: 300px !important;
  min-height: 500px !important;
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
    rgba(26, 26, 46, 0.95) 0%,
    rgba(22, 33, 62, 0.9) 50%,
    rgba(15, 52, 96, 0.9) 100%
  );
  overflow: hidden;
  position: relative;
  min-height: 200px;
  max-height: calc(100% - 120px);
  backdrop-filter: blur(20px);
}

/* 确保聊天消息区域有足够空间 */
.dialog-content > :last-child {
  flex: 1;
  min-height: 0; /* 允许flex子项收缩 */
}

/* 对话框底部 */
.dialog-footer {
  background: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.8) 0%,
    rgba(22, 33, 62, 0.9) 50%,
    rgba(15, 52, 96, 0.9) 100%
  );
  border-top: 1px solid rgba(212, 175, 55, 0.3);
  padding: 20px;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  min-height: 80px;
  backdrop-filter: blur(20px);
}

.dialog-toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px dashed rgba(212, 175, 55, 0.25);
}

/* 窄屏仅显示图标，隐藏文字 */
@media (max-width: 520px) {
  .dialog-toolbar-actions .btn-text {
    display: none;
  }

  .dialog-toolbar-actions .el-button {
    padding: 8px;
    min-width: auto;
  }
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
    rgba(212, 175, 55, 0.6) 25%,
    rgba(255, 193, 7, 0.8) 50%,
    rgba(212, 175, 55, 0.6) 75%,
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
    rgba(212, 175, 55, 0.8) 30deg,
    rgba(255, 193, 7, 0.9) 60deg,
    rgba(212, 175, 55, 0.8) 90deg,
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
    rgba(212, 175, 55, 0.4) 30deg,
    rgba(255, 193, 7, 0.5) 60deg,
    rgba(212, 175, 55, 0.4) 90deg,
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
    rgba(212, 175, 55, 0.8) 30deg,
    rgba(255, 193, 7, 0.9) 60deg,
    rgba(212, 175, 55, 0.8) 90deg,
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
    rgba(212, 175, 55, 0.4) 30deg,
    rgba(255, 193, 7, 0.5) 60deg,
    rgba(212, 175, 55, 0.4) 90deg,
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
    rgba(212, 175, 55, 0.8) 30deg,
    rgba(255, 193, 7, 0.9) 60deg,
    rgba(212, 175, 55, 0.8) 90deg,
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
    rgba(212, 175, 55, 0.4) 30deg,
    rgba(255, 193, 7, 0.5) 60deg,
    rgba(212, 175, 55, 0.4) 90deg,
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
    rgba(212, 175, 55, 0.8) 30deg,
    rgba(255, 193, 7, 0.9) 60deg,
    rgba(212, 175, 55, 0.8) 90deg,
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
    rgba(212, 175, 55, 0.4) 30deg,
    rgba(255, 193, 7, 0.5) 60deg,
    rgba(212, 175, 55, 0.4) 90deg,
    transparent 120deg
  );
  border-radius: 50% 0 50% 0;
  clip-path: polygon(0% 0%, 100% 0%, 0% 100%);
}

/* 小尺寸对话框优化 */
@media (max-height: 400px) {
  .dialog-content {
    min-height: 120px;
    max-height: calc(100% - 100px);
  }

  .dialog-footer {
    padding: 12px 20px;
    min-height: 60px;
  }
}

@media (max-height: 300px) {
  .dialog-content {
    min-height: 80px;
    max-height: calc(100% - 80px);
  }

  .dialog-footer {
    padding: 8px 20px;
    min-height: 50px;
  }
}

/* 推荐问题加载状态样式 */
.suggested-questions-loading {
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  z-index: 10;
  animation: fadeInUp 0.3s ease-out;
}

.loading-dots {
  display: flex;
  gap: 6px;
  align-items: center;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff, #67c23a);
  animation: dotPulse 1.4s ease-in-out infinite both;
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

.loading-text {
  color: #909399;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.5px;
  opacity: 0.8;
  animation: textFade 2s ease-in-out infinite;
}

/* 动画效果 */
@keyframes dotPulse {
  0%,
  80%,
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1.2);
    opacity: 1;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateX(-10px) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(0) translateY(0);
  }
}

@keyframes textFade {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

/* 命令建议样式 */
.command-suggestions {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.95) 0%,
    rgba(22, 33, 62, 0.9) 50%,
    rgba(15, 52, 96, 0.9) 100%
  );
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 12px;
  padding: 8px;
  margin-bottom: 8px;
  max-height: 200px;
  overflow-y: auto;
  backdrop-filter: blur(20px);
  z-index: 1000;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.suggestion-item {
  padding: 8px 12px;
  margin: 2px 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #e0e0e0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.suggestion-item:hover {
  background: rgba(212, 175, 55, 0.2);
  border-color: rgba(212, 175, 55, 0.4);
  color: #fff;
  transform: translateX(4px);
}

.suggestion-item:active {
  transform: translateX(2px) scale(0.98);
}

/* 响应式设计已通过JavaScript边距配置系统处理，无需额外CSS */
</style>
