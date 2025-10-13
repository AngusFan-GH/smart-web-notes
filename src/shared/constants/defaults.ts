import type { Settings } from "../types";

export const DEFAULT_SETTINGS: Settings = {
  apiType: "custom",
  custom_apiKey: "sk-d0297f69db424456942275de346f5375",
  custom_apiBase: "https://api.deepseek.com/chat/completions",
  custom_model: "deepseek-chat",
  systemPrompt: "你是一个帮助理解网页内容的AI助手。请使用Markdown格式回复。",
  enableContext: true,
  maxContextRounds: 5,
  autoHideDialog: true,
  maxTokens: 2048,
  temperature: 0.7,
  showProcessingSteps: false,
} as const;

export const API_CONFIG_INFO = {
  custom: {
    apiBase: "https://api.deepseek.com/chat/completions",
    modelPlaceholder: "deepseek-chat",
    requiresKey: true,
    apiBasePlaceholder: "https://api.deepseek.com/chat/completions",
    apiKeyPlaceholder: "请输入API密钥",
    modelHelp: "例如：deepseek-chat、gpt-4等",
  },
} as const;
