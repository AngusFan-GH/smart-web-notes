// Content Script 就绪检查工具
// 用于在发送消息前确保 Content Script 已加载并准备好

declare const chrome: any;

/**
 * 检查 Content Script 是否已准备好接收消息
 * 通过发送一个简单的 ping 消息来验证
 */
export async function isContentScriptReady(tabId: number, maxRetries: number = 5, retryDelay: number = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 发送一个简单的 ping 消息
      const response = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(
          tabId,
          { action: "ping" }, // 简单的 ping 消息
          (response: any) => {
            if (chrome.runtime.lastError) {
              // 记录错误信息（用于调试）
              const error = chrome.runtime.lastError.message;
              if (error && !error.includes("port closed") && !error.includes("Could not establish connection")) {
                // 只记录非端口关闭的错误
              }
              resolve(null);
            } else {
              resolve(response);
            }
          }
        );
      });

      if (response && response.ready !== false) {
        return true;
      }
    } catch (error) {
      // 忽略错误，继续重试
    }

    // 等待后重试
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  return false;
}

/**
 * 等待 Content Script 准备好，并等待页面加载完成
 */
export async function waitForContentScriptReady(tabId: number, timeout: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  const maxWaitTime = timeout;

  // 首先检查 tab 状态
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      console.warn(`Tab ${tabId} 不存在`);
      return false;
    }
    
    // 如果页面还在加载，等待加载完成
    if (tab.status === 'loading') {
      console.log(`⏳ Tab ${tabId} 页面正在加载，等待加载完成...`);
      await new Promise<void>((resolve) => {
        const listener = (updatedTabId: number, changeInfo: any) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            console.log(`✅ Tab ${tabId} 页面加载完成`);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);

        // 超时保护
        const waitTime = Math.min(maxWaitTime, 10000); // 最多等待10秒页面加载
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          console.warn(`⚠️ Tab ${tabId} 页面加载超时，继续检查 Content Script`);
          resolve();
        }, waitTime);
      });
    }
  } catch (error) {
    console.warn("检查 tab 状态失败:", error);
    return false;
  }

  // 等待 Content Script 准备好（增加重试次数和延迟）
  console.log(`⏳ 等待 Tab ${tabId} Content Script 就绪...`);
  let isReady = false;
  const maxRetries = Math.floor(maxWaitTime / 1000); // 根据超时时间计算重试次数
  const retryDelay = 1000; // 1秒重试一次

  for (let i = 0; i < maxRetries && (Date.now() - startTime) < maxWaitTime; i++) {
    isReady = await isContentScriptReady(tabId, 3, 300); // 每次尝试3次ping，间隔300ms
    
    if (isReady) {
      console.log(`✅ Tab ${tabId} Content Script 已就绪 (尝试 ${i + 1}/${maxRetries})`);
      return true;
    }
    
    // 如果还没准备好，等待后重试
    if (i < maxRetries - 1 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  console.warn(`⚠️ Tab ${tabId} Content Script 等待超时 (${maxWaitTime}ms)`);
  return false;
}

