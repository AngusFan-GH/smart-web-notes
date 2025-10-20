import type { Settings } from "../types";

export const DEFAULT_SETTINGS: Settings = {
  apiType: "custom",
  custom_apiKey: "sk-7NAitPWQhdhwT2AR66Cc27E060664741A143E38eFbB33bE6",
  // custom_apiKey: "sk-luulfdrjkupdjynjwjrakhugpeizmlhfhomywdiiauspncpc",
  custom_apiBase: "http://192.168.103.11:31091/spiritx-api/v1/chat/completions",
  // custom_apiBase: "https://api.siliconflow.cn/v1/chat/completions",
  custom_model: "deepseek-r1-distill-qwen-32b-awq",
  // custom_model: "deepseek-ai/DeepSeek-V3",
  // custom_model: "deepseek-ai/DeepSeek-R1",
  systemPrompt: "",
  enableContext: true,
  maxContextRounds: 5,
  autoHideDialog: true,
  maxTokens: 2048,
  temperature: 0.7,
  showProcessingSteps: false,
  enableSuggestedQuestions: true,
  enableBrowserControl: true,
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
