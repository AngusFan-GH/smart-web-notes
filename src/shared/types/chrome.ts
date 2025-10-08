// Chrome Extension API 类型定义
export interface ChromeTab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
  windowId?: number;
}

export interface ChromeMessage {
  action: string;
  tabId?: number | string;
  [key: string]: any;
}

export interface ChromeStorage {
  [key: string]: any;
}

// Chrome API 声明
declare global {
  interface Window {
    chrome: {
      runtime: {
        id: string;
        onInstalled: {
          addListener: (callback: () => void) => void;
        };
        onMessage: {
          addListener: (
            callback: (
              message: ChromeMessage,
              sender: any,
              sendResponse: (response?: any) => void
            ) => boolean
          ) => void;
          removeListener: (
            callback: (
              message: ChromeMessage,
              sender: any,
              sendResponse: (response?: any) => void
            ) => boolean
          ) => void;
        };
        onConnect: {
          addListener: (callback: (port: any) => void) => void;
        };
        sendMessage: (message: ChromeMessage) => Promise<any>;
        openOptionsPage: () => void;
      };
      tabs: {
        query: (queryInfo: {
          active?: boolean;
          currentWindow?: boolean;
        }) => Promise<ChromeTab[]>;
        sendMessage: (tabId: number, message: ChromeMessage) => Promise<any>;
      };
      action: {
        openPopup: () => void;
      };
      storage: {
        sync: {
          get: (
            keys?: string | string[] | { [key: string]: any }
          ) => Promise<ChromeStorage>;
          set: (items: ChromeStorage) => Promise<void>;
        };
      };
    };
  }
}

export {};
