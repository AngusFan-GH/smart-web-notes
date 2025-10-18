/**
 * 浏览器控制服务
 * 用于通过AI对话控制浏览器行为，如隐藏广告、修改样式等
 */

export interface BrowserAction {
  type:
    | "hide"
    | "show"
    | "style"
    | "remove"
    | "highlight"
    | "add"
    | "modify"
    | "move"
    | "execute_js"; // 新增JavaScript执行类型
  selector?: string; // 对于execute_js类型，selector是可选的
  css?: string;
  reason?: string;
  // 新增字段用于DOM操作
  content?: string; // 要添加的内容
  tag?: string; // 要添加的标签名
  attributes?: Record<string, string>; // 要添加的属性
  targetSelector?: string; // 目标位置（用于move操作）
  position?: "before" | "after" | "inside"; // 插入位置
  // 新增字段用于JavaScript执行
  javascript?: string; // 要执行的JavaScript代码
  method?: "css" | "dom" | "javascript"; // 推荐使用的方法
}

export interface BrowserControlResult {
  success: boolean;
  action: BrowserAction;
  message: string;
  appliedAt: string;
}

export class BrowserControlService {
  private static instance: BrowserControlService;
  private activeStyles: Map<string, string> = new Map(); // 存储已应用的样式ID和CSS
  private styleIdCounter = 0;

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

      switch (action.type) {
        case "hide":
          return await this.hideElement(action);
        case "show":
          return await this.showElement(action);
        case "style":
          return await this.applyStyle(action);
        case "remove":
          return await this.removeElement(action);
        case "highlight":
          return await this.highlightElement(action);
        case "add":
          return await this.addElement(action);
        case "modify":
          return await this.modifyElement(action);
        case "move":
          return await this.moveElement(action);
        case "execute_js":
          return await this.executeJavaScript(action);
        default:
          throw new Error(`不支持的操作类型: ${action.type}`);
      }
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
   * 隐藏元素
   */
  private async hideElement(
    action: BrowserAction
  ): Promise<BrowserControlResult> {
    const styleId = `hide-${++this.styleIdCounter}`;
    const css = `${action.selector} { display: none !important; }`;

    await this.injectCSS(styleId, css);
    this.activeStyles.set(styleId, css);

    return {
      success: true,
      action,
      message: `已隐藏元素: ${action.selector}`,
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * 显示元素
   */
  private async showElement(
    action: BrowserAction
  ): Promise<BrowserControlResult> {
    const styleId = `show-${++this.styleIdCounter}`;
    const css = `${action.selector} { display: block !important; }`;

    await this.injectCSS(styleId, css);
    this.activeStyles.set(styleId, css);

    return {
      success: true,
      action,
      message: `已显示元素: ${action.selector}`,
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * 应用自定义样式
   */
  private async applyStyle(
    action: BrowserAction
  ): Promise<BrowserControlResult> {
    if (!action.css) {
      throw new Error("样式操作需要提供CSS代码");
    }

    const styleId = `style-${++this.styleIdCounter}`;
    const css = `${action.selector} { ${action.css} }`;

    await this.injectCSS(styleId, css);
    this.activeStyles.set(styleId, css);

    return {
      success: true,
      action,
      message: `已应用样式到: ${action.selector}`,
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * 移除元素
   */
  private async removeElement(
    action: BrowserAction
  ): Promise<BrowserControlResult> {
    // 通过消息发送到content script进行真正的DOM操作
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "removeDOMElement",
          data: {
            selector: action.selector,
            reason: action.reason,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              action,
              message: `移除元素失败: ${chrome.runtime.lastError.message}`,
              appliedAt: new Date().toISOString(),
            });
            return;
          }

          if (response.success) {
            resolve({
              success: true,
              action,
              message: `已移除元素: ${action.selector}`,
              appliedAt: new Date().toISOString(),
            });
          } else {
            resolve({
              success: false,
              action,
              message: `移除元素失败: ${response.error || "未知错误"}`,
              appliedAt: new Date().toISOString(),
            });
          }
        }
      );
    });
  }

  /**
   * 高亮元素
   */
  private async highlightElement(
    action: BrowserAction
  ): Promise<BrowserControlResult> {
    const styleId = `highlight-${++this.styleIdCounter}`;
    const css = `${action.selector} { 
      outline: 3px solid #ff6b6b !important; 
      background-color: rgba(255, 107, 107, 0.1) !important;
      box-shadow: 0 0 10px rgba(255, 107, 107, 0.5) !important;
    }`;

    await this.injectCSS(styleId, css);
    this.activeStyles.set(styleId, css);

    return {
      success: true,
      action,
      message: `已高亮元素: ${action.selector}`,
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * 添加元素
   */
  private async addElement(
    action: BrowserAction
  ): Promise<BrowserControlResult> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "addDOMElement",
          data: {
            selector: action.selector,
            tag: action.tag || "div",
            content: action.content || "",
            attributes: action.attributes || {},
            position: action.position || "inside",
            reason: action.reason,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              action,
              message: `添加元素失败: ${chrome.runtime.lastError.message}`,
              appliedAt: new Date().toISOString(),
            });
            return;
          }

          if (response.success) {
            resolve({
              success: true,
              action,
              message: `已添加元素: ${action.tag} 到 ${action.selector}`,
              appliedAt: new Date().toISOString(),
            });
          } else {
            resolve({
              success: false,
              action,
              message: `添加元素失败: ${response.error || "未知错误"}`,
              appliedAt: new Date().toISOString(),
            });
          }
        }
      );
    });
  }

  /**
   * 修改元素
   */
  private async modifyElement(
    action: BrowserAction
  ): Promise<BrowserControlResult> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "modifyDOMElement",
          data: {
            selector: action.selector,
            content: action.content,
            attributes: action.attributes || {},
            reason: action.reason,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              action,
              message: `修改元素失败: ${chrome.runtime.lastError.message}`,
              appliedAt: new Date().toISOString(),
            });
            return;
          }

          if (response.success) {
            resolve({
              success: true,
              action,
              message: `已修改元素: ${action.selector}`,
              appliedAt: new Date().toISOString(),
            });
          } else {
            resolve({
              success: false,
              action,
              message: `修改元素失败: ${response.error || "未知错误"}`,
              appliedAt: new Date().toISOString(),
            });
          }
        }
      );
    });
  }

  /**
   * 移动元素
   */
  private async moveElement(
    action: BrowserAction
  ): Promise<BrowserControlResult> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "moveDOMElement",
          data: {
            selector: action.selector,
            targetSelector: action.targetSelector,
            position: action.position || "inside",
            reason: action.reason,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              action,
              message: `移动元素失败: ${chrome.runtime.lastError.message}`,
              appliedAt: new Date().toISOString(),
            });
            return;
          }

          if (response.success) {
            resolve({
              success: true,
              action,
              message: `已移动元素: ${action.selector} 到 ${action.targetSelector}`,
              appliedAt: new Date().toISOString(),
            });
          } else {
            resolve({
              success: false,
              action,
              message: `移动元素失败: ${response.error || "未知错误"}`,
              appliedAt: new Date().toISOString(),
            });
          }
        }
      );
    });
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
            reason: action.reason,
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
            resolve({
              success: true,
              action,
              message: `JavaScript执行成功: ${
                response.data?.message || "代码已执行"
              }`,
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
   * 注入CSS到页面
   */
  private async injectCSS(styleId: string, css: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 在content script中，直接通过background script执行CSS注入
      chrome.runtime.sendMessage(
        {
          action: "injectCSS",
          data: { css, styleId },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || "CSS注入失败"));
          }
        }
      );
    });
  }

  /**
   * 撤销所有应用的操作
   */
  async undoAllActions(): Promise<void> {
    try {
      // 通过background script移除所有注入的样式
      for (const [styleId, css] of this.activeStyles) {
        try {
          await new Promise<void>((resolve, reject) => {
            chrome.runtime.sendMessage(
              {
                action: "removeCSS",
                data: { css, styleId },
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                  resolve();
                } else {
                  reject(new Error(response?.error || "CSS移除失败"));
                }
              }
            );
          });
        } catch (error) {
          console.warn(`移除样式失败 ${styleId}:`, error);
        }
      }
      this.activeStyles.clear();
      console.log("已撤销所有浏览器控制操作");
    } catch (error) {
      console.error("撤销操作失败:", error);
    }
  }

  /**
   * 获取当前应用的操作列表
   */
  getActiveActions(): Array<{ id: string; css: string; action: string }> {
    return Array.from(this.activeStyles.entries()).map(([id, css]) => ({
      id,
      css,
      action: id.split("-")[0],
    }));
  }

  /**
   * 检查是否支持浏览器控制
   */
  static isSupported(): boolean {
    return (
      typeof chrome !== "undefined" &&
      typeof chrome.runtime !== "undefined" &&
      typeof chrome.runtime.sendMessage !== "undefined"
    );
  }
}

// 声明Chrome API类型
declare const chrome: any;
