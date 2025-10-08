// 消息类型定义
export interface Message {
  content: string;
  isUser: boolean;
  timestamp?: number;
}

export interface ChatMessage extends Message {
  id?: string;
  isGenerating?: boolean;
}

// API 消息类型
export interface ApiMessage {
  action:
    | "generateAnswer"
    | "getHistory"
    | "clearHistory"
    | "getGeneratingState"
    | "toggleFloatingBall"
    | "openDialog"
    | "getPageContent"
    | "openOptions";
  tabId?: number | string;
  pageContent?: string;
  question?: string;
  history?: Message[];
  [key: string]: any;
}

// 设置相关类型
export interface Settings {
  autoHideDialog: boolean;
  enableContext: boolean;
  maxContextRounds: number;
  systemPrompt: string;
  apiType: "custom";
  custom_apiKey: string;
  custom_apiBase: string;
  custom_model: string;
  maxTokens: number;
  temperature: number;
}

// API 配置类型
export interface ApiConfig {
  apiBase: string;
  modelPlaceholder: string;
  requiresKey: boolean;
  apiBasePlaceholder: string;
  apiKeyPlaceholder: string;
  modelHelp: string;
}

// 对话框位置类型
export interface DialogPosition {
  left: string;
  top: string;
  isCustomPosition: boolean;
}

// 对话框大小类型
export interface DialogSize {
  width: string;
  height: string;
}
