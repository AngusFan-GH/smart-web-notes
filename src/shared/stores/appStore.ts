import { reactive, computed } from "vue";
import type { Message } from "../types";
import { contextManager } from "../services/contextManager";

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

    // 更新对话缓存，用于多轮对话上下文
    this.updateConversationCache();
  },

  updateLastMessage(content: string) {
    if (state.messages.length > 0) {
      const lastMessage = state.messages[state.messages.length - 1];

      if (!lastMessage.isUser) {
        // 直接修改对象属性，Vue 会自动追踪响应式变化
        // 类似 newme-ds: answerObj.value.content = answerObj.value.content + content
        lastMessage.content = lastMessage.content + content;

        // 更新对话缓存，确保上下文传递
        this.updateConversationCache();
      }
    }
  },

  updateLastMessageThinking(reasoningContent: string) {
    if (state.messages.length > 0) {
      const lastMessage = state.messages[state.messages.length - 1];

      if (!lastMessage.isUser) {
        // 更新思考内容
        if (!lastMessage.thinkingContent) {
          lastMessage.thinkingContent = "";
        }
        lastMessage.thinkingContent =
          lastMessage.thinkingContent + reasoningContent;

        // 默认展开思考内容
        if (lastMessage.isThinkingCollapsed === undefined) {
          lastMessage.isThinkingCollapsed = false;
        }

        // 更新对话缓存，确保上下文传递
        this.updateConversationCache();
      }
    }
  },

  toggleThinkingCollapse(messageId: string) {
    const message = state.messages.find((m) => m.id === messageId);
    if (message && !message.isUser) {
      message.isThinkingCollapsed = !message.isThinkingCollapsed;
    }
  },

  // 更新对话缓存，用于多轮对话上下文
  updateConversationCache() {
    const conversationHistory = state.messages.map((msg) => ({
      role: msg.isUser ? "user" : "assistant",
      content: msg.content,
    }));
    contextManager.updateConversationCache(conversationHistory);
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
