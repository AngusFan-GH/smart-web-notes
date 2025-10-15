import type { Settings } from "../types";

export const DEFAULT_SETTINGS: Settings = {
  apiType: "custom",
  custom_apiKey: "sk-luulfdrjkupdjynjwjrakhugpeizmlhfhomywdiiauspncpc",
  custom_apiBase: "https://api.siliconflow.cn/v1/chat/completions",
  custom_model: "deepseek-ai/DeepSeek-R1",
  systemPrompt: "",
  enableContext: true,
  maxContextRounds: 5,
  autoHideDialog: true,
  maxTokens: 2048,
  temperature: 0.7,
  showProcessingSteps: false,
  enableSuggestedQuestions: true,
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
