import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { ContextManager } from "../services/contextManager";
import { SmartContext, ConversationMessage } from "../types/commandTypes";

export const useContextStore = defineStore("context", () => {
  const contextManager = ContextManager.getInstance();
  const currentContext = ref<SmartContext | null>(null);
  const contextHistory = ref<Array<SmartContext>>([]);
  const isContextLoading = ref(false);
  const maxHistorySize = 10;

  // 获取智能上下文
  async function getSmartContext(question: string): Promise<SmartContext> {
    isContextLoading.value = true;
    try {
      const context = await contextManager.buildSmartContext(question);
      currentContext.value = context;

      // 添加到历史记录
      contextHistory.value.push(context);
      if (contextHistory.value.length > maxHistorySize) {
        contextHistory.value.shift();
      }

      return context;
    } finally {
      isContextLoading.value = false;
    }
  }

  // 回滚到特定上下文
  function rollbackToContext(version: string): boolean {
    const targetContext = contextHistory.value.find(
      (ctx) => ctx.contextVersion === version
    );
    if (targetContext) {
      currentContext.value = targetContext;
      return true;
    }
    return false;
  }

  // 清理上下文历史
  function clearContextHistory(): void {
    contextHistory.value = [];
    currentContext.value = null;
  }

  // 更新对话缓存
  function updateConversationCache(messages: ConversationMessage[]): void {
    contextManager.updateConversationCache(messages);
  }

  // 清理所有缓存
  function clearAllCache(): void {
    contextManager.clearAllCache();
    clearContextHistory();
  }

  // 获取缓存统计
  function getCacheStats() {
    return contextManager.getCacheStats();
  }

  // 计算属性
  const hasContext = computed(() => currentContext.value !== null);
  const contextCount = computed(() => contextHistory.value.length);
  const isLoading = computed(() => isContextLoading.value);

  return {
    // 状态
    currentContext,
    contextHistory,
    isContextLoading,

    // 计算属性
    hasContext,
    contextCount,
    isLoading,

    // 方法
    getSmartContext,
    rollbackToContext,
    clearContextHistory,
    updateConversationCache,
    clearAllCache,
    getCacheStats,
  };
});
