/**
 * 浏览器控制服务
 * 用于通过AI对话控制浏览器行为，统一使用JavaScript执行
 */

export interface BrowserAction {
  type: "execute_js"; // 只支持JavaScript执行
  javascript: string; // 要执行的JavaScript代码
  reason?: string; // 操作原因说明
}

export interface BrowserControlResult {
  success: boolean;
  action: BrowserAction;
  message: string;
  appliedAt: string;
}

export class BrowserControlService {
  private static instance: BrowserControlService;

  private constructor() {}

  static getInstance(): BrowserControlService {
    if (!BrowserControlService.instance) {
      BrowserControlService.instance = new BrowserControlService();
    }
    return BrowserControlService.instance;
  }

  /**
   * 执行浏览器控制操作
   */
  async executeAction(action: BrowserAction): Promise<BrowserControlResult> {
    try {
      console.log("执行浏览器控制操作:", action);

      // 只支持JavaScript执行
      if (action.type !== "execute_js") {
        return {
          success: false,
          action,
          message: `不支持的操作类型: ${action.type}，只支持 execute_js`,
          appliedAt: new Date().toISOString(),
        };
      }

      return await this.executeJavaScript(action);
    } catch (error) {
      console.error("浏览器控制操作失败:", error);
      return {
        success: false,
        action,
        message: error instanceof Error ? error.message : String(error),
        appliedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 执行JavaScript代码
   */
  private async executeJavaScript(
    action: BrowserAction
  ): Promise<BrowserControlResult> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "executeJavaScript",
          data: {
            javascript: action.javascript,
            reason: action.reason || "执行JavaScript代码",
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              action,
              message: `JavaScript执行失败: ${chrome.runtime.lastError.message}`,
              appliedAt: new Date().toISOString(),
            });
            return;
          }

          if (response.success) {
            // 优化成功消息，避免重复
            const resultMessage = response.data?.message || "操作完成";
            const message = resultMessage.includes("JavaScript执行成功")
              ? resultMessage
              : `JavaScript执行成功: ${resultMessage}`;

            resolve({
              success: true,
              action,
              message,
              appliedAt: new Date().toISOString(),
            });
          } else {
            resolve({
              success: false,
              action,
              message: `JavaScript执行失败: ${response.error || "未知错误"}`,
              appliedAt: new Date().toISOString(),
            });
          }
        }
      );
    });
  }

  /**
   * 撤销所有浏览器控制操作
   * 通过执行撤销JavaScript代码来恢复页面状态
   */
  async undoAllActions(): Promise<BrowserControlResult> {
    const undoJavaScript = `
      (function() {
        // 撤销所有可能的浏览器控制操作
        try {
          // 1. 恢复所有被隐藏的元素
          const hiddenElements = document.querySelectorAll('[style*="display: none"]');
          hiddenElements.forEach(el => {
            if (el.style.display === 'none') {
              el.style.display = '';
            }
          });

          // 2. 移除所有添加的样式
          const styledElements = document.querySelectorAll('[style]');
          styledElements.forEach(el => {
            // 只移除可能由AI添加的样式，保留原有的重要样式
            const style = el.getAttribute('style') || '';
            if (style.includes('border') || style.includes('background') || style.includes('color')) {
              el.removeAttribute('style');
            }
          });

          // 3. 恢复被修改的文本内容（如果可能的话）
          // 注意：文本修改通常无法完全撤销，因为原始内容可能已经丢失
          
          // 4. 移除可能添加的元素
          const aiAddedElements = document.querySelectorAll('[data-ai-added="true"]');
          aiAddedElements.forEach(el => el.remove());

          console.log('浏览器控制操作已撤销');
          return '撤销成功';
        } catch (error) {
          console.error('撤销操作失败:', error);
          throw error;
        }
      })();
    `;

    return await this.executeJavaScript({
      type: "execute_js",
      javascript: undoJavaScript,
      reason: "撤销所有浏览器控制操作",
    });
  }

  /**
   * 检查浏览器控制功能是否支持
   */
  static isSupported(): boolean {
    return true; // 现在统一使用JavaScript执行，总是支持
  }
}
