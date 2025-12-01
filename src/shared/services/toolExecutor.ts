import type {
  AgentAction,
  ToolExecutionResult,
  TakeScreenshotAction,
  GetConsoleMessagesAction,
  GetNetworkRequestsAction,
  ResizePageAction,
  WaitForElementAction,
  ExtractTextAction,
  ExtractLinksAction,
  ExtractImagesAction,
  GetElementInfoAction,
  CompareScreenshotsAction,
  EmulateAction,
  PerformanceStartTraceAction,
  PerformanceStopTraceAction,
  PerformanceAnalyzeInsightAction,
  GetNetworkRequestAction,
  ListNetworkRequestsAction,
  ListConsoleMessagesAction,
  GetConsoleMessageAction,
} from "../types/agentTools";
import { messageQueue } from "../utils/messageQueue";
import { globalTaskManager } from "./globalTaskManager";

// 声明 chrome 类型（在 Background Script 中使用）
declare const chrome: any;

export class ToolExecutor {
  private static instance: ToolExecutor;
  private currentTabId: number | null = null; // 当前操作的 tabId

  private constructor() {}

  static getInstance(): ToolExecutor {
    if (!ToolExecutor.instance) {
      ToolExecutor.instance = new ToolExecutor();
    }
    return ToolExecutor.instance;
  }

  /**
   * 设置当前操作的 tabId
   */
  setTabId(tabId: number) {
    this.currentTabId = tabId;
  }

  /**
   * 获取当前操作的 tabId，如果没有设置则查询活动 tab
   */
  private async getTabId(): Promise<number> {
    if (this.currentTabId) {
      // 验证 tab 是否还存在
      try {
        await chrome.tabs.get(this.currentTabId);
        return this.currentTabId;
      } catch (error) {
        console.warn("保存的 tabId 无效，查询活动 tab");
        this.currentTabId = null;
      }
    }

    // 回退到查询活动 tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      throw new Error("未找到激活的标签页");
    }
    return tabs[0].id;
  }

  async execute(action: AgentAction): Promise<ToolExecutionResult> {
    console.log("🛠 执行工具指令:", action);
    
    // 防御性检查：确保 action 和 action.type 存在
    if (!action || typeof action !== 'object') {
      console.error("❌ 无效的 action 对象:", action);
      return {
        success: false,
        error: "无效的操作对象",
      };
    }
    
    if (!action.type || typeof action.type !== 'string') {
      console.error("❌ action.type 无效:", action, "type:", action.type);
      return {
        success: false,
        error: `未知的操作类型: ${action.type || 'undefined'}`,
      };
    }

    try {
      switch (action.type) {
        case "click":
        case "type":
        case "scroll":
        case "wait":
        case "hover":
        case "drag":
        case "press_key":
          return await this.sendToContentScript(action);

        case "navigate":
          return await this.handleNavigation(action.url);

        case "execute_script":
        case "evaluate_script":
          // evaluate_script 语义等同于 execute_script，这里统一走同一实现
          return await this.sendToContentScript(action);

        case "take_screenshot":
          return await this.handleScreenshot(action);

        case "take_snapshot":
          return await this.handleSnapshot();

        case "get_console_messages":
          return await this.handleGetConsoleMessages(action);

        case "get_network_requests":
          return await this.handleGetNetworkRequests(action);

        case "resize_page":
          return await this.handleResizePage(action);

        case "wait_for_element":
          return await this.handleWaitForElement(action);

        case "extract_text":
          return await this.handleExtractText(action);

        case "extract_links":
          return await this.handleExtractLinks(action);

        case "extract_images":
          return await this.handleExtractImages(action);

        case "get_element_info":
          return await this.handleGetElementInfo(action);

        case "compare_screenshots":
          return await this.handleCompareScreenshots(action);

        case "emulate":
          return await this.handleEmulate(action);

        case "performance_start_trace":
          return await this.handlePerformanceStartTrace(action);

        case "performance_stop_trace":
          return await this.handlePerformanceStopTrace();

        case "performance_analyze_insight":
          return await this.handlePerformanceAnalyzeInsight(action);

        case "get_network_request":
          return await this.handleGetNetworkRequest(action);

        case "list_network_requests":
          return await this.handleListNetworkRequests(action);

        case "list_console_messages":
          return await this.handleListConsoleMessages(action);

        case "get_console_message":
          return await this.handleGetConsoleMessage(action);

        case "done":
          return { success: true, result: action.text };

        default:
          return {
            success: false,
            error: `未知的操作类型: ${(action as any).type}`,
          };
      }
    } catch (error) {
      console.error("❌ 工具执行失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async sendToContentScript(
    action: AgentAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();
    
    try {
      // 使用持久连接发送消息（更稳定，减少 PORT_CLOSED 错误）
      const { persistentConnection } = await import("../utils/persistentConnection");
      
      const response = await persistentConnection.sendMessage(tabId, {
        action: "executeAgentAction",
        data: action,
      }, 30000); // 30秒超时

      const result = response || { success: false, error: "无响应" };

      // 如果执行成功，获取页面状态
      if (result.success) {
        try {
          const state = await this.capturePageState(tabId);
          return {
            ...result,
            newState: state,
          };
        } catch (error) {
          return result;
        }
      } else {
        return result;
      }
    } catch (error: any) {
      // 持久连接已经处理了连接错误，这里直接返回错误
      const errorMsg = error.message || String(error);
      
      // 如果是 PORT_CLOSED 错误，返回明确的错误信息，让 Agent 层决定是否重试
      if (errorMsg.includes("PORT_CLOSED") || errorMsg.includes("port closed") || errorMsg.includes("连接超时")) {
        return {
          success: false,
          error: "PORT_CLOSED", // 统一错误标识，让 Agent 层处理重试
        };
      }
      
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  private async handleNavigation(url: string): Promise<ToolExecutionResult> {
    try {
      const tabId = await this.getTabId();
      
      // 更新全局任务管理器的活动标签页（导航时保持任务连续性）
      await globalTaskManager.updateActiveTabId(tabId);
      
      await chrome.tabs.update(tabId, { url });

      // 等待导航完成 - 使用 chrome.tabs.onUpdated 监听
      await new Promise<void>((resolve) => {
        const listener = (updatedTabId: number, changeInfo: any) => {
          if (updatedTabId === tabId && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);

        // 超时保护（10秒）
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 10000);
      });

      return {
        success: true,
        result: "导航完成",
        newState: { url },
      };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * 捕获页面状态（URL、元素数量等）
   */
  private async capturePageState(
    tabId: number
  ): Promise<ToolExecutionResult["newState"]> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { action: "getPageState" },
        (response: any) => {
          if (chrome.runtime.lastError || !response?.success) {
            resolve({});
          } else {
            resolve({
              url: response.data?.url,
              elementCount: response.data?.elementCount,
            });
          }
        }
      );
    });
  }

  /**
   * 处理截图
   */
  private async handleScreenshot(
    action: TakeScreenshotAction
  ): Promise<ToolExecutionResult> {
    try {
      const tabId = await this.getTabId();

      // 使用 chrome.tabs.captureVisibleTab API
      // 注意：captureVisibleTab 只能捕获当前窗口的可见 tab，所以需要先切换到目标 tab
      const tab = await chrome.tabs.get(tabId);
      const window = await chrome.windows.get(tab.windowId);

      // 如果目标 tab 不在当前窗口，需要切换到它
      if (window.focused && tab.active) {
        const dataUrl = await chrome.tabs.captureVisibleTab(window.id, {
          format: action.format || "png",
        });

        return {
          success: true,
          result: "截图成功",
          newState: {
            screenshot: dataUrl, // Base64 编码的图片
          },
        };
      } else {
        // 如果 tab 不在当前窗口或不是活动的，先激活它
        await chrome.tabs.update(tabId, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
        await new Promise((resolve) => setTimeout(resolve, 500)); // 等待切换完成

        const updatedTab = await chrome.tabs.get(tabId);
        const updatedWindow = await chrome.windows.get(updatedTab.windowId);
        const dataUrl = await chrome.tabs.captureVisibleTab(updatedWindow.id, {
          format: action.format || "png",
        });

        return {
          success: true,
          result: "截图成功",
          newState: {
            screenshot: dataUrl,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 处理可访问性树快照
   */
  private async handleSnapshot(): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "takeSnapshot",
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data,
        };
      } else {
        return {
          success: false,
          error: "获取快照失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "获取快照失败",
      };
    }
  }

  /**
   * 处理获取控制台消息
   */
  private async handleGetConsoleMessages(
    action: GetConsoleMessagesAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "getConsoleMessages",
        data: {
          level: action.level || "all",
          limit: action.limit || 50,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.messages || [],
          newState: {
            consoleMessages: response.data?.messages || [],
          },
        };
      } else {
        return {
          success: false,
          error: "获取控制台消息失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "获取控制台消息失败",
      };
    }
  }

  /**
   * 处理获取网络请求
   */
  private async handleGetNetworkRequests(
    action: GetNetworkRequestsAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "getNetworkRequests",
        data: {
          filter: action.filter,
          limit: action.limit || 100,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.requests || [],
          newState: {
            networkRequests: response.data?.requests || [],
          },
        };
      } else {
        return {
          success: false,
          error: "获取网络请求失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "获取网络请求失败",
      };
    }
  }

  /**
   * 处理调整页面大小
   */
  private async handleResizePage(
    action: ResizePageAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "resizePage",
        data: {
          width: action.width,
          height: action.height,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: "页面大小已调整",
        };
      } else {
        return {
          success: false,
          error: "调整页面大小失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "调整页面大小失败",
      };
    }
  }

  /**
   * 处理设备模拟
   */
  private async handleEmulate(
    action: EmulateAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "emulate",
        data: {
          device: action.device,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: `设备模拟已设置为: ${action.device.name}`,
        };
      } else {
        return {
          success: false,
          error: response?.error || "设备模拟失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "设备模拟失败",
      };
    }
  }

  /**
   * 处理开始性能追踪
   */
  private async handlePerformanceStartTrace(
    action: PerformanceStartTraceAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "performanceStartTrace",
        data: {
          categories: action.categories || ['performance', 'network'],
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: {
            traceId: response.data?.traceId,
            message: "性能追踪已开始",
          },
        };
      } else {
        return {
          success: false,
          error: response?.error || "开始性能追踪失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "开始性能追踪失败",
      };
    }
  }

  /**
   * 处理停止性能追踪
   */
  private async handlePerformanceStopTrace(): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "performanceStopTrace",
      });

      if (response?.success) {
        return {
          success: true,
          result: {
            traceId: response.data?.traceId,
            data: response.data?.traceData,
            message: "性能追踪已停止",
          },
        };
      } else {
        return {
          success: false,
          error: response?.error || "停止性能追踪失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "停止性能追踪失败",
      };
    }
  }

  /**
   * 处理性能分析洞察
   */
  private async handlePerformanceAnalyzeInsight(
    action: PerformanceAnalyzeInsightAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "performanceAnalyzeInsight",
        data: {
          traceId: action.traceId,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.insights || {},
        };
      } else {
        return {
          success: false,
          error: response?.error || "性能分析失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "性能分析失败",
      };
    }
  }

  /**
   * 处理获取单个网络请求
   */
  private async handleGetNetworkRequest(
    action: GetNetworkRequestAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "getNetworkRequest",
        data: {
          requestId: action.requestId,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.request || null,
        };
      } else {
        return {
          success: false,
          error: response?.error || "获取网络请求失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "获取网络请求失败",
      };
    }
  }

  /**
   * 处理列出所有网络请求
   */
  private async handleListNetworkRequests(
    action: ListNetworkRequestsAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "listNetworkRequests",
        data: {
          filter: action.filter,
          limit: action.limit || 100,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.requests || [],
          newState: {
            networkRequests: response.data?.requests || [],
          },
        };
      } else {
        return {
          success: false,
          error: response?.error || "列出网络请求失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "列出网络请求失败",
      };
    }
  }

  /**
   * 处理列出所有控制台消息
   */
  private async handleListConsoleMessages(
    action: ListConsoleMessagesAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "listConsoleMessages",
        data: {
          level: action.level || "all",
          limit: action.limit || 100,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.messages || [],
          newState: {
            consoleMessages: response.data?.messages || [],
          },
        };
      } else {
        return {
          success: false,
          error: response?.error || "列出控制台消息失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "列出控制台消息失败",
      };
    }
  }

  /**
   * 处理获取单个控制台消息
   */
  private async handleGetConsoleMessage(
    action: GetConsoleMessageAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "getConsoleMessage",
        data: {
          messageId: action.messageId,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.message || null,
        };
      } else {
        return {
          success: false,
          error: response?.error || "获取控制台消息失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "获取控制台消息失败",
      };
    }
  }

  /**
   * 处理等待元素出现
   */
  private async handleWaitForElement(
    action: WaitForElementAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "wait_for_element",
        data: {
          selector: action.selector,
          elementId: action.elementId,
          timeout: action.timeout || 5000,
          visible: action.visible !== false,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.result || "元素已出现",
        };
      } else {
        return {
          success: false,
          error: response?.error || "等待元素超时",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "等待元素失败",
      };
    }
  }

  /**
   * 处理提取文本
   */
  private async handleExtractText(
    action: ExtractTextAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "extract_text",
        data: {
          selector: action.selector,
          elementId: action.elementId,
          mode: action.mode || "text",
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.result || "",
        };
      } else {
        return {
          success: false,
          error: response?.error || "提取文本失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "提取文本失败",
      };
    }
  }

  /**
   * 处理提取链接
   */
  private async handleExtractLinks(
    action: ExtractLinksAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "extract_links",
        data: {
          selector: action.selector,
          filter: action.filter,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.result || [],
        };
      } else {
        return {
          success: false,
          error: response?.error || "提取链接失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "提取链接失败",
      };
    }
  }

  /**
   * 处理提取图片
   */
  private async handleExtractImages(
    action: ExtractImagesAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "extract_images",
        data: {
          selector: action.selector,
          includeDataUrl: action.includeDataUrl || false,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.result || [],
        };
      } else {
        return {
          success: false,
          error: response?.error || "提取图片失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "提取图片失败",
      };
    }
  }

  /**
   * 处理获取元素信息
   */
  private async handleGetElementInfo(
    action: GetElementInfoAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      const response = await messageQueue.sendMessage(tabId, {
        action: "get_element_info",
        data: {
          elementId: action.elementId,
          includeChildren: action.includeChildren || false,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.result || null,
        };
      } else {
        return {
          success: false,
          error: response?.error || "获取元素信息失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "获取元素信息失败",
      };
    }
  }

  /**
   * 处理比较截图
   */
  private async handleCompareScreenshots(
    action: CompareScreenshotsAction
  ): Promise<ToolExecutionResult> {
    const tabId = await this.getTabId();

    try {
      // 如果需要当前页面截图，先获取
      let currentScreenshot: string | undefined;
      if (action.current) {
        const screenshotResult = await this.handleScreenshot({
          type: "take_screenshot",
          format: "png",
        });
        if (screenshotResult.success && screenshotResult.newState?.screenshot) {
          currentScreenshot = screenshotResult.newState.screenshot;
        }
      }

      const response = await messageQueue.sendMessage(tabId, {
        action: "compare_screenshots",
        data: {
          reference: action.reference,
          current: currentScreenshot,
          threshold: action.threshold || 0.95,
        },
      });

      if (response?.success) {
        return {
          success: true,
          result: response.data?.result || {
            similar: true,
            similarity: 0.95,
            message: "截图比较功能需要更复杂的实现",
          },
        };
      } else {
        return {
          success: false,
          error: response?.error || "比较截图失败",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "比较截图失败",
      };
    }
  }
}

export const toolExecutor = ToolExecutor.getInstance();
