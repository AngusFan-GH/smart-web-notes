// API 相关类型定义
export interface ApiRequest {
  model: string;
  messages: ApiMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ApiResponse {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  message?: {
    content: string;
  };
  error?: {
    message: string;
  };
}

// API 配置类型
export interface ApiConfigs {
  custom: ApiConfig;
  ollama: ApiConfig;
}

export interface ApiConfig {
  apiBase: string;
  modelPlaceholder: string;
  requiresKey: boolean;
  apiBasePlaceholder: string;
  apiKeyPlaceholder: string;
  modelHelp: string;
}

// 默认 API 配置
export const DEFAULT_API_CONFIGS: ApiConfigs = {
  custom: {
    apiBase: "https://api.deepseek.com/chat/completions",
    modelPlaceholder: "deepseek-chat",
    requiresKey: true,
    apiBasePlaceholder: "https://api.deepseek.com/chat/completions",
    apiKeyPlaceholder: "请输入API密钥",
    modelHelp: "例如：deepseek-chat、gpt-4等",
  },
  ollama: {
    apiBase: "http://127.0.0.1:11434/api/chat",
    modelPlaceholder: "qwen2.5",
    requiresKey: false,
    apiBasePlaceholder: "http://127.0.0.1:11434/api/chat",
    apiKeyPlaceholder: "本地模型无需API密钥",
    modelHelp:
      "常用模型：qwen2.5, llama2, mistral, gemma, codellama等。使用前请确保已安装模型：ollama pull qwen2.5",
  },
};
