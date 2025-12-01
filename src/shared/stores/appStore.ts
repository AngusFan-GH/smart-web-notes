import { reactive, computed, watch } from "vue";
import type { Message } from "../types";
import { contextManager } from "../services/contextManager";
import { conversationStore } from "./conversationStore";

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

// 从持久化存储中初始化状态
// 确保在页面跳转后重新加载时，能立即从 storage 恢复所有状态
const initState = async () => {
  // 等待 ConversationStore 完全加载（确保从 storage 读取完成）
  // 这样可以确保页面跳转后，对话历史能完整恢复
  await conversationStore.loadFromStorage();
  
  // 加载对话消息（已确保加载完成）
  const messages = conversationStore.getMessagesSync();
  
  // 加载 UI 状态（已确保加载完成）
  const uiState = conversationStore.getUIStateSync();
  
  return {
    showFloatingBall: uiState.showFloatingBall,
    showDialog: uiState.showDialog,
    messages,
    isGenerating: false,
    isStreaming: false,
    settings: null,
  };
};

// 全局状态（先使用默认值，稍后从存储中加载）
const state = reactive<AppState>({
  showFloatingBall: true,
  showDialog: false,
  messages: [],
  isGenerating: false,
  isStreaming: false,
  settings: null,
});

// 初始化：从存储中加载状态
// 这是关键：确保在 Content Script 重新加载时（页面跳转后），
// 能立即从 chrome.storage 恢复所有对话状态，实现完全独立于页面的状态管理
initState().then((loadedState) => {
  // 始终从存储恢复状态（页面跳转后 Content Script 重新加载，需要恢复所有状态）
  // 这样可以确保对话历史在页面跳转后保持完整
  Object.assign(state, loadedState);
  console.log("✅ 从存储恢复状态（独立于页面）:", {
    messages: state.messages.length,
    showDialog: state.showDialog,
    showFloatingBall: state.showFloatingBall,
  });
}).catch(err => {
  console.error("❌ 从存储恢复状态失败:", err);
  // 即使加载失败，也保持基本功能
});

// 注意：不再使用 watch，因为 addMessage/updateLastMessage 等方法已经直接保存
// 这样可以避免重复保存和性能问题

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
    conversationStore.updateUIState({ showFloatingBall: state.showFloatingBall }).catch(err => {
      console.error("更新 UI 状态失败:", err);
    });
  },

  openDialog() {
    state.showDialog = true;
    conversationStore.updateUIState({ showDialog: true }).catch(err => {
      console.error("更新 UI 状态失败:", err);
    });
  },

  closeDialog() {
    state.showDialog = false;
    conversationStore.updateUIState({ showDialog: false }).catch(err => {
      console.error("更新 UI 状态失败:", err);
    });
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
    // 检查是否已存在相同的消息（避免重复）
    const existingMessage = state.messages.find(
      msg => msg.content === content && msg.isUser === isUser && 
      Math.abs(msg.timestamp - Date.now()) < 1000 // 1秒内的相同消息视为重复
    );
    
    if (existingMessage) {
      console.warn("⚠️ 检测到重复消息，跳过添加:", content);
      return;
    }
    
    const message: Message = {
      id: Date.now().toString(),
      content,
      isUser,
      timestamp: Date.now(),
    };
    state.messages.push(message);

    // 异步保存到存储（不阻塞 UI）
    conversationStore.addMessage(message).catch(err => {
      console.error("保存消息失败:", err);
    });

    // 更新对话缓存，用于多轮对话上下文
    this.updateConversationCache();
  },

  updateLastMessage(content: string) {
    if (state.messages.length > 0) {
      const lastMessage = state.messages[state.messages.length - 1];

      // 严格检查：只有最后一条消息是AI消息时，才更新
      if (!lastMessage.isUser) {
        // 直接修改对象属性，Vue 会自动追踪响应式变化
        // 类似 newme-ds: answerObj.value.content = answerObj.value.content + content
        lastMessage.content = lastMessage.content + content;
        
        // 触发 Vue 响应式更新（确保内容变化能被检测到）
        // 通过重新赋值触发响应式系统
        const index = state.messages.length - 1;
        state.messages[index] = { ...lastMessage };

        // 异步保存到存储（不阻塞 UI）
        conversationStore.updateLastMessage((msg) => {
          msg.content = lastMessage.content;
        }).catch(err => {
          console.error("更新消息失败:", err);
        });

        // 更新对话缓存，确保上下文传递
        this.updateConversationCache();
      } else {
        // 如果最后一条是用户消息，记录警告但不更新（避免错误地更新用户消息）
        console.warn("⚠️ updateLastMessage: 最后一条消息是用户消息，跳过更新。当前消息列表:", 
          state.messages.map(m => ({ id: m.id, isUser: m.isUser, content: m.content.substring(0, 50) }))
        );
      }
    } else {
      console.warn("⚠️ updateLastMessage: 消息列表为空，无法更新");
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

        // 异步保存到存储（不阻塞 UI）
        conversationStore.updateLastMessage((msg) => {
          msg.thinkingContent = lastMessage.thinkingContent;
          msg.isThinkingCollapsed = lastMessage.isThinkingCollapsed;
        }).catch(err => {
          console.error("更新思考内容失败:", err);
        });

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
    // 异步清除存储
    conversationStore.clearMessages().catch(err => {
      console.error("清除消息失败:", err);
    });
  },

  deleteMessage(messageId: string) {
    const index = state.messages.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      state.messages.splice(index, 1);
      // 异步删除存储
      conversationStore.deleteMessage(messageId).catch(err => {
        console.error("删除消息失败:", err);
      });
    }
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
