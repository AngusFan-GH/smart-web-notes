import { ref, onMounted, onUnmounted } from "vue";
import type { ChromeMessage, ChromeTab } from "../types";

// Chrome API 组合式函数
export function useChromeAPI() {
  const isConnected = ref(false);

  // 获取当前标签页
  const getCurrentTab = async (): Promise<ChromeTab | null> => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tab;
    } catch (error) {
      console.error("获取当前标签页失败:", error);
      return null;
    }
  };

  // 发送消息到 background script
  const sendMessage = async (message: ChromeMessage): Promise<any> => {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error("发送消息失败:", error);
      throw error;
    }
  };

  // 发送消息到 content script
  const sendMessageToTab = async (
    tabId: number,
    message: ChromeMessage
  ): Promise<any> => {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error("发送消息到标签页失败:", error);
      throw error;
    }
  };

  // 监听消息
  const addMessageListener = (
    callback: (
      message: ChromeMessage,
      sender: any,
      sendResponse: (response?: any) => void
    ) => boolean
  ) => {
    chrome.runtime.onMessage.addListener(callback);
  };

  // 移除消息监听器
  const removeMessageListener = (
    callback: (
      message: ChromeMessage,
      sender: any,
      sendResponse: (response?: any) => void
    ) => boolean
  ) => {
    chrome.runtime.onMessage.removeListener(callback);
  };

  // 打开选项页面
  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  // 打开 popup
  const openPopup = () => {
    chrome.action.openPopup();
  };

  // 检查连接状态
  const checkConnection = () => {
    isConnected.value = !!chrome.runtime;
  };

  onMounted(() => {
    checkConnection();
  });

  return {
    isConnected,
    getCurrentTab,
    sendMessage,
    sendMessageToTab,
    addMessageListener,
    removeMessageListener,
    openOptionsPage,
    openPopup,
    checkConnection,
  };
}
