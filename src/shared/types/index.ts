// 统一类型定义
export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: number;
  isGenerating?: boolean;
  thinkingContent?: string; // 思考过程内容
  isThinkingCollapsed?: boolean; // 思考内容是否折叠
}

export interface Settings {
  apiType: "custom";
  custom_apiKey: string;
  custom_apiBase: string;
  custom_model: string;
  systemPrompt: string;
  enableContext: boolean;
  maxContextRounds: number;
  autoHideDialog: boolean;
  maxTokens: number;
  temperature: number;
  showProcessingSteps: boolean;
  enableBrowserControl: boolean;
}

export interface ApiRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface StreamChunk {
  type: "chunk" | "complete" | "error";
  content?: string;
  reasoningContent?: string; // 思考过程内容
  fullResponse?: string;
  error?: string;
}

export interface ChromeMessage {
  action:
    | "generateAnswer"
    | "testCommunication"
    | "getSettings"
    | "updateSettings"
    | "streamChunk"
    | "streamError"
    | "openDialog"
    | "closeDialog"
    | "executeJavaScript"
    | "getDialogStatus"
    | "toggleFloatingBall"
    | "getDOMInfo"
    | "executeAgentAction"
    | "getPageState"
    | "takeSnapshot"
    | "getConsoleMessages"
    | "getNetworkRequests"
    | "resizePage"
    | "emulate"
    | "performanceStartTrace"
    | "performanceStopTrace"
    | "performanceAnalyzeInsight"
    | "getNetworkRequest"
    | "listNetworkRequests"
    | "listConsoleMessages"
    | "getConsoleMessage"
    | "agentUpdate"
    | "processAgentGoal"
    | "stopAgent"
    | "getTaskState"
    | "stopStreaming"
    | "injectCSS"
    | "removeCSS"
    | "contentScriptReady"
    | "ping"
    | "getCurrentTabId";
  data?: any;
  tabId?: number | string;
  goal?: string;
  taskId?: string;
  context?: { url: string; title: string };
  showFloatingBall?: boolean;
}

export interface ChromeResponse {
  success: boolean;
  data?: any;
  error?: string;
  isOpen?: boolean; // 用于 getDialogStatus
  ready?: boolean; // 用于 ping 响应
}

// Chrome API 声明
declare global {
  interface Window {
    chrome: {
      runtime: {
        sendMessage: (message: ChromeMessage) => Promise<ChromeResponse>;
        onMessage: {
          addListener: (
            callback: (
              message: ChromeMessage,
              sender: any,
              sendResponse: (response: ChromeResponse) => void
            ) => void
          ) => void;
        };
      };
      storage: {
        sync: {
          get: (
            keys?: string | string[] | { [key: string]: any }
          ) => Promise<{ [key: string]: any }>;
          set: (items: { [key: string]: any }) => Promise<void>;
        };
      };
    };
  }
}

export {};
