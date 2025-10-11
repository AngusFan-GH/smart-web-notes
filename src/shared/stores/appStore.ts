import { reactive, computed } from "vue";
import type { Message } from "../types";

// 应用状态
interface AppState {
  // UI状态
  showFloatingBall: boolean;
  showDialog: boolean;

  // 对话状态
  messages: Message[];
  isGenerating: boolean;
  isStreaming: boolean;

  // 设置
  settings: any;
}

// 全局状态
const state = reactive<AppState>({
  showFloatingBall: true,
  showDialog: false,
  messages: [],
  isGenerating: false,
  isStreaming: false,
  settings: null,
});

// 计算属性
export const appState = {
  showFloatingBall: computed(() => state.showFloatingBall),
  showDialog: computed(() => state.showDialog),
  messages: computed(() => state.messages),
  isGenerating: computed(() => state.isGenerating),
  isStreaming: computed(() => state.isStreaming),
  isProcessing: computed(() => state.isGenerating || state.isStreaming),
  settings: computed(() => state.settings),
};

// 状态操作
export const appActions = {
  // UI控制
  toggleFloatingBall() {
    state.showFloatingBall = !state.showFloatingBall;
  },

  openDialog() {
    state.showDialog = true;
  },

  closeDialog() {
    state.showDialog = false;
  },

  showFloatingBall() {
    state.showFloatingBall = true;
  },

  hideFloatingBall() {
    state.showFloatingBall = false;
  },

  // 对话控制
  setGenerating(generating: boolean) {
    state.isGenerating = generating;
  },

  setStreaming(streaming: boolean) {
    state.isStreaming = streaming;
  },

  addMessage(content: string, isUser: boolean) {
    const message: Message = {
      id: Date.now().toString(),
      content,
      isUser,
      timestamp: Date.now(),
    };
    state.messages.push(message);
  },

  updateLastMessage(content: string) {
    console.log("updateLastMessage被调用:", content);
    console.log("当前消息数量:", state.messages.length);

    if (state.messages.length > 0) {
      const lastMessage = state.messages[state.messages.length - 1];
      console.log("最后一条消息:", lastMessage);

      if (!lastMessage.isUser) {
        console.log("更新AI消息内容");
        // 创建新的消息对象来触发响应式更新
        const updatedMessage = {
          ...lastMessage,
          content: content,
        };

        // 替换整个数组来触发响应式更新
        state.messages = [...state.messages.slice(0, -1), updatedMessage];
        console.log("更新后的消息:", updatedMessage);
      } else {
        console.log("最后一条消息是用户消息，无法更新");
      }
    } else {
      console.log("没有消息可以更新");
    }
  },

  clearMessages() {
    state.messages = [];
  },

  // 设置管理
  setSettings(settings: any) {
    state.settings = settings;
  },

  // 重置状态
  reset() {
    state.showFloatingBall = true;
    state.showDialog = false;
    state.messages = [];
    state.isGenerating = false;
    state.isStreaming = false;
  },
};
