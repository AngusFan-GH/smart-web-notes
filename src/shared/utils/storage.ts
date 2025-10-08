import type { Settings, DialogPosition } from "../types";

// Chrome Storage 工具函数
export async function getStorageData<T = any>(
  keys?: string | string[] | { [key: string]: any }
): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => {
      resolve(result as T);
    });
  });
}

export async function setStorageData(items: {
  [key: string]: any;
}): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(items, () => {
      resolve();
    });
  });
}

// 设置相关存储函数
export async function getSettings(): Promise<Settings> {
  const defaultSettings: Settings = {
    autoHideDialog: true,
    enableContext: true,
    maxContextRounds: 3,
    systemPrompt: "你是一个帮助理解网页内容的AI助手。请使用Markdown格式回复。",
    apiType: "custom",
    custom_apiKey: "",
    custom_apiBase: "https://api.deepseek.com/chat/completions",
    custom_model: "deepseek-chat",
    maxTokens: 2048,
    temperature: 0.7,
  };

  const settings = await getStorageData<Settings>(defaultSettings);
  return { ...defaultSettings, ...settings };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setStorageData(settings);
}

// 对话框位置存储
export async function getDialogPosition(): Promise<DialogPosition> {
  const defaultPosition: DialogPosition = {
    left: "auto",
    top: "auto",
    isCustomPosition: false,
  };

  const position = await getStorageData<DialogPosition>({
    dialogPosition: defaultPosition,
  });
  return position.dialogPosition || defaultPosition;
}

export async function saveDialogPosition(
  position: DialogPosition
): Promise<void> {
  await setStorageData({ dialogPosition: position });
}

// 悬浮球显示状态
export async function getFloatingBallVisibility(): Promise<boolean> {
  const result = await getStorageData<{ showFloatingBall: boolean }>(
    "showFloatingBall"
  );
  return result.showFloatingBall ?? true;
}

export async function setFloatingBallVisibility(
  visible: boolean
): Promise<void> {
  await setStorageData({ showFloatingBall: visible });
}
