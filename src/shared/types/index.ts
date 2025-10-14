// 统一类型定义
export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: number;
  isGenerating?: boolean;
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
  enableSuggestedQuestions: boolean;
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
  fullResponse?: string;
  error?: string;
}

export interface ChromeMessage {
  action:
    | "generateAnswer"
    | "testCommunication"
    | "getSettings"
    | "updateSettings";
  data?: any;
  tabId?: number | string;
}

export interface ChromeResponse {
  success: boolean;
  data?: any;
  error?: string;
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
