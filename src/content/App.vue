<template>
  <div id="ai-assistant-content">
    <FloatingBall
      :visible="appState.showFloatingBall.value && !appState.showDialog.value"
      @click="appActions.openDialog"
    />
    <CustomDialog
      :visible="appState.showDialog.value"
      @close="appActions.closeDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, nextTick, watch } from "vue";
import FloatingBall from "./components/FloatingBall.vue";
import CustomDialog from "./components/CustomDialog.vue";
import { appState, appActions } from "../shared/stores/appStore";
import type { ChromeMessage, ChromeResponse } from "../shared/types";
import { streamManager } from "../shared/utils/streamManager";
import { completeStep, errorStep } from "../shared/utils/userFeedback";
import { stateManager } from "../shared/utils/stateManager";
import { interactiveExtractor } from "../shared/utils/interactiveExtractor";
import { conversationStore } from "../shared/stores/conversationStore";
import { persistentConnectionClient } from "./persistentConnectionClient";

// 声明chrome类型
declare const chrome: any;

// 数学渲染器已集成，无需声明KaTeX类型

// 临时存储交互元素映射 (ID -> Element)
// 这将被用于将 elementId 转换回真实的 DOM 元素
let elementMap = new Map<number, Element>();

/**
 * 刷新页面的交互元素映射
 * 通常在页面加载完成或 DOM 变动后调用
 */
function refreshElementMap() {
  console.log("🔄 刷新页面交互元素映射...");
  const result = interactiveExtractor.extractInteractiveElements(document);
  elementMap = result.elementMap; // 更新 Map
  console.log(`✅ 已索引 ${elementMap.size} 个交互元素`);
  return result.tree; // 返回给调用者 (通常是 Background/Agent)
}

/**
 * 执行 Agent 的原子操作
 * 这是 Content Script 端的核心执行器
 */
async function executeAgentAction(
  action: any
): Promise<{ success: boolean; error?: string; result?: any }> {
  console.log("🤖 Content Script 收到操作指令:", action);

  try {
    switch (action.type) {
      case "click": {
        const el = elementMap.get(action.elementId);
        if (!el) {
          console.warn(
            `⚠️ click 操作找不到元素 ID=${action.elementId}，当前已索引元素数=${elementMap.size}`
          );
          return {
            success: false,
            error: `找不到 ID=${action.elementId} 的元素`,
            result: {
              elementId: action.elementId,
              notFound: true,
            },
          };
        }

        // 记录点击前的元素数量（用于检测页面变化）
        const beforeCount = document.querySelectorAll("*").length;

        // 尝试多种点击方式
        (el as HTMLElement).click();
        // 对于某些 React/Vue 元素，可能需要触发更底层的事件
        el.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          })
        );

        // 等待页面响应（弹窗、新元素等可能需要时间出现）
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // 记录点击后的元素数量
        const afterCount = document.querySelectorAll("*").length;
        const elementCountChanged = afterCount !== beforeCount;

        return {
          success: true,
          result: {
            elementId: action.elementId,
            elementCountChanged,
            beforeCount,
            afterCount,
          },
        };
      }

      case "type": {
        const el = elementMap.get(action.elementId);
        if (!el) {
          console.warn(
            `⚠️ type 操作找不到元素 ID=${action.elementId}，当前已索引元素数=${elementMap.size}`
          );
          return {
            success: false,
            error: `找不到 ID=${action.elementId} 的元素`,
            result: {
              elementId: action.elementId,
              notFound: true,
            },
          };
        }

        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          el.value = action.text;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));

          if (action.submit) {
            el.form?.submit();
            // 或者触发 Enter 键
            el.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
            );
          }
        } else {
          // 尝试设置 textContent (对于 contenteditable)
          el.textContent = action.text;
        }
        return { success: true };
      }

      case "scroll": {
        const amount = action.amount || window.innerHeight * 0.8;
        const behavior = "smooth";

        if (action.direction === "top") window.scrollTo({ top: 0, behavior });
        else if (action.direction === "bottom")
          window.scrollTo({ top: document.body.scrollHeight, behavior });
        else if (action.direction === "up")
          window.scrollBy({ top: -amount, behavior });
        else window.scrollBy({ top: amount, behavior }); // down

        // 等待滚动完成
        await new Promise((r) => setTimeout(r, 500));
        return { success: true };
      }

      case "wait": {
        await new Promise((r) => setTimeout(r, action.duration || 1000));
        return { success: true };
      }

      case "execute_script": {
        // 仍然保留最后的通用执行能力，但不依赖 chrome-inject-eval
        // 直接使用 Function 构造函数 (在 content script 作用域下)
        // 注意：这无法访问页面上下文的变量 (window.React 等)，只能操作 DOM
        const func = new Function(action.script);
        const result = func();
        return { success: true, result };
      }

      case "hover": {
        const el = elementMap.get(action.elementId);
        if (!el) throw new Error(`找不到 ID=${action.elementId} 的元素`);

        // 触发鼠标悬停事件
        el.dispatchEvent(
          new MouseEvent("mouseenter", { bubbles: true, cancelable: true })
        );
        el.dispatchEvent(
          new MouseEvent("mouseover", { bubbles: true, cancelable: true })
        );
        return { success: true };
      }

      case "drag": {
        const fromEl = action.fromElementId
          ? elementMap.get(action.fromElementId)
          : null;
        const toEl = action.toElementId
          ? elementMap.get(action.toElementId)
          : null;

        if (action.fromElementId && !fromEl) {
          throw new Error(`找不到源元素 ID=${action.fromElementId}`);
        }
        if (action.toElementId && !toEl) {
          throw new Error(`找不到目标元素 ID=${action.toElementId}`);
        }

        // 使用坐标或元素进行拖拽
        if (fromEl && toEl) {
          const fromRect = fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();

          // 模拟拖拽：mousedown -> mousemove -> mouseup
          fromEl.dispatchEvent(
            new MouseEvent("mousedown", {
              bubbles: true,
              cancelable: true,
              clientX: fromRect.left + fromRect.width / 2,
              clientY: fromRect.top + fromRect.height / 2,
            })
          );

          // 模拟移动
          document.dispatchEvent(
            new MouseEvent("mousemove", {
              bubbles: true,
              cancelable: true,
              clientX: toRect.left + toRect.width / 2,
              clientY: toRect.top + toRect.height / 2,
            })
          );

          // 在目标元素上释放
          toEl.dispatchEvent(
            new MouseEvent("mouseup", {
              bubbles: true,
              cancelable: true,
              clientX: toRect.left + toRect.width / 2,
              clientY: toRect.top + toRect.height / 2,
            })
          );

          toEl.dispatchEvent(
            new MouseEvent("drop", { bubbles: true, cancelable: true })
          );
        } else if (action.fromX !== undefined && action.toX !== undefined) {
          // 使用坐标拖拽
          document.dispatchEvent(
            new MouseEvent("mousedown", {
              bubbles: true,
              cancelable: true,
              clientX: action.fromX!,
              clientY: action.fromY!,
            })
          );
          document.dispatchEvent(
            new MouseEvent("mousemove", {
              bubbles: true,
              cancelable: true,
              clientX: action.toX!,
              clientY: action.toY!,
            })
          );
          document.dispatchEvent(
            new MouseEvent("mouseup", {
              bubbles: true,
              cancelable: true,
              clientX: action.toX!,
              clientY: action.toY!,
            })
          );
        }

        return { success: true };
      }

      case "press_key": {
        const el = action.elementId
          ? elementMap.get(action.elementId)
          : document.activeElement || document.body;
        if (!el) throw new Error(`找不到元素 ID=${action.elementId}`);

        // 聚焦元素（如果需要）
        if (el instanceof HTMLElement) {
          el.focus();
        }

        // 构建键盘事件选项
        const keyEventOptions: KeyboardEventInit = {
          key: action.key,
          code: action.key, // 简化处理
          bubbles: true,
          cancelable: true,
        };

        // 添加修饰键
        if (action.modifiers) {
          keyEventOptions.ctrlKey = action.modifiers.includes("Control");
          keyEventOptions.shiftKey = action.modifiers.includes("Shift");
          keyEventOptions.altKey = action.modifiers.includes("Alt");
          keyEventOptions.metaKey = action.modifiers.includes("Meta");
        }

        // 触发按键事件序列
        el.dispatchEvent(new KeyboardEvent("keydown", keyEventOptions));
        el.dispatchEvent(new KeyboardEvent("keypress", keyEventOptions));
        el.dispatchEvent(new KeyboardEvent("keyup", keyEventOptions));

        return { success: true };
      }

      case "resize_page": {
        // 调整窗口大小（注意：这只能调整当前窗口，不能调整浏览器窗口）
        // 实际应用中，可能需要通过 chrome.windows.update API
        window.resizeTo(action.width, action.height);
        return { success: true };
      }

      case "wait_for_element": {
        const timeout = action.timeout || 5000;
        const startTime = Date.now();

        const checkElement = (): Promise<Element | null> => {
          return new Promise((resolve) => {
            const check = () => {
              let element: Element | null = null;

              if (action.elementId) {
                element = elementMap.get(action.elementId) || null;
              } else if (action.selector) {
                element = document.querySelector(action.selector);
              }

              if (element) {
                // 检查可见性（如果需要）
                if (action.visible !== false) {
                  const rect = element.getBoundingClientRect();
                  const isVisible =
                    rect.width > 0 &&
                    rect.height > 0 &&
                    rect.top < window.innerHeight &&
                    rect.bottom > 0;
                  if (isVisible) {
                    resolve(element);
                    return;
                  }
                } else {
                  resolve(element);
                  return;
                }
              }

              // 检查超时
              if (Date.now() - startTime >= timeout) {
                resolve(null);
                return;
              }

              // 继续检查
              setTimeout(check, 100);
            };
            check();
          });
        };

        const element = await checkElement();
        if (element) {
          return { success: true, result: "元素已出现" };
        } else {
          return { success: false, error: "等待元素超时" };
        }
      }

      case "extract_text": {
        let element: Element | null = null;

        if (action.elementId) {
          element = elementMap.get(action.elementId) || null;
        } else if (action.selector) {
          element = document.querySelector(action.selector);
        } else {
          element = document.body;
        }

        if (!element) {
          throw new Error("找不到目标元素");
        }

        let text = "";
        if (action.mode === "html") {
          text = element.innerHTML;
        } else if (action.mode === "markdown") {
          // 简单的Markdown转换
          text = element.textContent || "";
        } else {
          text = element.textContent || "";
        }

        return { success: true, result: text };
      }

      case "extract_links": {
        const container = action.selector
          ? document.querySelector(action.selector) || document.body
          : document.body;

        const links = Array.from(container.querySelectorAll("a[href]"))
          .map((link) => {
            const anchor = link as HTMLAnchorElement;
            return {
              text: anchor.textContent?.trim() || "",
              url: anchor.href,
            };
          })
          .filter((link) => {
            if (action.filter) {
              if (
                action.filter.text &&
                !link.text.includes(action.filter.text)
              ) {
                return false;
              }
              if (action.filter.url && !link.url.includes(action.filter.url)) {
                return false;
              }
            }
            return true;
          });

        return { success: true, result: links };
      }

      case "extract_images": {
        const container = action.selector
          ? document.querySelector(action.selector) || document.body
          : document.body;

        const images = Array.from(container.querySelectorAll("img")).map(
          (img) => {
            const image = img as HTMLImageElement;
            const result: any = {
              src: image.src,
              alt: image.alt || "",
              width: image.width,
              height: image.height,
            };

            if (action.includeDataUrl) {
              // 尝试获取Base64数据（需要图片已加载）
              try {
                const canvas = document.createElement("canvas");
                canvas.width = image.width;
                canvas.height = image.height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(image, 0, 0);
                  result.dataUrl = canvas.toDataURL("image/png");
                }
              } catch (e) {
                // 忽略错误
              }
            }

            return result;
          }
        );

        return { success: true, result: images };
      }

      case "get_element_info": {
        const element = elementMap.get(action.elementId);
        if (!element) {
          throw new Error(`找不到元素 ID=${action.elementId}`);
        }

        const info: any = {
          tagName: element.tagName,
          id: element.id || null,
          className: element.className || null,
          textContent: element.textContent?.substring(0, 100) || null,
          attributes: {},
        };

        // 获取所有属性
        Array.from(element.attributes).forEach((attr) => {
          info.attributes[attr.name] = attr.value;
        });

        // 获取位置信息
        const rect = element.getBoundingClientRect();
        info.position = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          inViewport: rect.top < window.innerHeight && rect.bottom > 0,
        };

        // 如果包含子元素信息
        if (action.includeChildren) {
          info.children = Array.from(element.children).map((child, index) => ({
            index,
            tagName: child.tagName,
            id: child.id || null,
            className: child.className || null,
          }));
        }

        return { success: true, result: info };
      }

      case "compare_screenshots": {
        // 简单的截图比较（实际实现可能需要更复杂的算法）
        // 这里只是占位实现
        return {
          success: true,
          result: {
            similar: true,
            similarity: 0.95,
            message: "截图比较功能需要更复杂的实现",
          },
        };
      }

      default:
        return { success: false, error: `未知的操作类型: ${action.type}` };
    }
  } catch (error) {
    console.error("❌ 执行 Agent 操作失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 控制台消息存储
const consoleMessages: Array<{
  id: string;
  level: string;
  message: string;
  timestamp: number;
}> = [];

// 初始化控制台消息捕获
function setupConsoleCapture() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  console.log = (...args: any[]) => {
    consoleMessages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level: "info",
      message: args.map((a) => String(a)).join(" "),
      timestamp: Date.now(),
    });
    return originalLog.apply(console, args);
  };

  console.error = (...args: any[]) => {
    consoleMessages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level: "error",
      message: args.map((a) => String(a)).join(" "),
      timestamp: Date.now(),
    });
    return originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    consoleMessages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level: "warning",
      message: args.map((a) => String(a)).join(" "),
      timestamp: Date.now(),
    });
    return originalWarn.apply(console, args);
  };

  console.info = (...args: any[]) => {
    consoleMessages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level: "info",
      message: args.map((a) => String(a)).join(" "),
      timestamp: Date.now(),
    });
    return originalInfo.apply(console, args);
  };
}

// 获取控制台消息
function getConsoleMessages(options: { level?: string; limit?: number } = {}) {
  let filtered = consoleMessages;

  if (options.level && options.level !== "all") {
    filtered = consoleMessages.filter((m) => m.level === options.level);
  }

  if (options.limit) {
    filtered = filtered.slice(-options.limit);
  }

  return filtered;
}

// 获取可访问性树快照（简化版）
function takeSnapshot() {
  const snapshot: any = {
    url: window.location.href,
    title: document.title,
    elements: [],
  };

  // 遍历主要元素
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  let node = walker.nextNode();
  let count = 0;
  while (node && count < 200) {
    // 限制数量
    const el = node as Element;
    const rect = el.getBoundingClientRect();

    snapshot.elements.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: Array.from(el.classList),
      text: el.textContent?.trim().substring(0, 100),
      role: el.getAttribute("role") || undefined,
      ariaLabel: el.getAttribute("aria-label") || undefined,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      visible: rect.width > 0 && rect.height > 0,
    });

    count++;
    node = walker.nextNode();
  }

  return snapshot;
}

/**
 * 获取页面状态（URL、元素数量等）
 */
function getPageState() {
  return {
    url: window.location.href,
    elementCount: elementMap.size,
    title: document.title,
  };
}

// 使用chrome-inject-eval库创建eval实例（已废弃，保留用于向后兼容）
// const evil = getEvalInstance(window);

// 执行JavaScript代码的函数（已废弃，使用 execute_script action 代替）
function executeJavaScriptCode(code: string): {
  success: boolean;
  result?: any;
  error?: string;
} {
  try {
    console.log("原始JavaScript代码:", code);
    console.log("代码长度:", code.length);

    // 直接使用 Function 构造函数执行代码
    const func = new Function(code);
    const result = func();
    console.log("JavaScript执行结果:", result);

    return {
      success: true,
      result: result || "JavaScript执行成功",
    };
  } catch (error) {
    console.error("JavaScript执行错误:", error);
    console.error("错误详情:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error:
        "JavaScript执行失败: " +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

// 加载悬浮球状态
async function loadFloatingBallState() {
  try {
    const { showFloatingBall = true } = await chrome.storage.sync.get(
      "showFloatingBall"
    );
    if (showFloatingBall) {
      appActions.showFloatingBall();
    } else {
      appActions.hideFloatingBall();
    }
    console.log("悬浮球状态已加载:", showFloatingBall);
  } catch (error) {
    console.error("加载悬浮球状态失败:", error);
    appActions.showFloatingBall(); // 默认显示
  }
}

// 初始化
// 关键：页面跳转后 Content Script 会重新加载，此时需要立即从 storage 恢复所有状态
// 确保对话历史完全独立于页面，页面跳转后仍能保持完整
onMounted(async () => {
  // 首先确保 ConversationStore 已完全加载（从 chrome.storage 恢复）
  // 这样即使页面跳转，对话历史也能立即恢复
  await conversationStore.loadFromStorage();
  console.log("✅ ConversationStore 状态已从存储恢复（独立于页面）");

  // 加载悬浮球状态
  await loadFloatingBallState();

  // 加载设置
  await loadSettings();

  // 设置消息监听
  setupMessageListener();

  // 初始化流式管理器回调
  setupStreamManagerCallbacks();

  // 初始化控制台消息捕获
  setupConsoleCapture();

  // 数学渲染器已集成
  console.log("数学渲染器已集成");

  // 监听停止流式事件
  window.addEventListener("stopStreaming", handleStopStreaming);

  // 监听消息清除事件，重置流式完成标志
  window.addEventListener("messagesCleared", () => {
    console.log("收到消息清除事件，重置流式完成标志");
    isStreamingCompleted = false;
  });

  // 获取当前标签页ID
  let currentTabId: number | null = null;
  // 在 Content Script 中，chrome.tabs.getCurrent() 不可用
  // 需要通过 chrome.runtime.sendMessage 请求 Background Script 获取
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getCurrentTabId",
    });
    if (response && response.success && response.tabId) {
      currentTabId = response.tabId;
    }
  } catch (error) {
    console.warn("无法获取当前标签页ID:", error);
  }

  // 检查并同步任务状态
  const syncTaskState = async () => {
    try {
      // 重新获取当前标签页ID（页面刷新后可能变化）
      try {
        const tabIdResponse = await chrome.runtime.sendMessage({
          action: "getCurrentTabId",
        });
        if (tabIdResponse && tabIdResponse.success && tabIdResponse.tabId) {
          currentTabId = tabIdResponse.tabId;
        }
      } catch (error) {
        console.warn("获取标签页ID失败:", error);
      }

      // 1. 检查全局任务状态
      const response = await chrome.runtime.sendMessage({
        action: "getTaskState",
      });
      if (response && response.success && response.data) {
        const taskState = response.data;

        if (taskState.isRunning) {
          // 2. 如果有任务在运行，同步UI状态
          await conversationStore.setActiveTask(
            taskState.taskId,
            taskState.activeTabId
          );

          // 3. 如果当前标签页是活动标签页，显示对话窗口并更新生成状态
          if (taskState.activeTabId === currentTabId) {
            appActions.openDialog();
            // 确保UI状态反映任务正在运行
            appActions.setGenerating(true);
            console.log(
              "📥 同步任务状态: 任务正在运行，已打开对话框并设置生成状态"
            );
          } else {
            // 如果当前标签页不是活动标签页，但任务在运行，只更新状态不打开对话框
            console.log(
              "📥 同步任务状态: 任务正在运行，但当前标签页不是活动标签页"
            );
          }

          console.log("📥 同步任务状态:", taskState);
        } else {
          // 任务已完成或停止，清除活动任务和生成状态
          await conversationStore.clearActiveTask();
          appActions.setGenerating(false);
          appActions.setStreaming(false);
          console.log("📥 同步任务状态: 任务已停止或完成");
        }
      } else {
        // 没有任务状态，清除生成状态
        appActions.setGenerating(false);
        appActions.setStreaming(false);
      }
    } catch (error) {
      console.warn("同步任务状态失败:", error);
      // 出错时也清除生成状态，避免UI卡住
      appActions.setGenerating(false);
      appActions.setStreaming(false);
    }
  };

  // 监听UI状态变化（跨标签页同步）
  let unwatchUIState: (() => void) | null = null;

  // 通知 Background Content Script 已就绪
  // 注意：在 Content Script 中，chrome.tabs.getCurrent() 不可用
  // 直接发送消息，Background Script 会从 sender.tab.id 获取 tabId
  const notifyReady = async () => {
    try {
      chrome.runtime.sendMessage(
        {
          action: "contentScriptReady",
        },
        (response: any) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "通知 Background 失败:",
              chrome.runtime.lastError.message
            );
          } else {
            console.log("✅ 已通知 Background Content Script 就绪");
          }
        }
      );
    } catch (error) {
      console.warn("通知 Background 失败:", error);
    }
  };

  // 立即通知
  notifyReady();

  // 延迟再次通知（确保 Background 已准备好接收）
  setTimeout(() => {
    notifyReady();
  }, 1000);

  // 同步任务状态（页面加载时）
  syncTaskState();

  // 监听页面可见性变化（处理页面刷新）
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      // 页面变为可见时，重新同步任务状态
      console.log("📄 页面可见性变化，重新同步任务状态");
      syncTaskState();
    }
  });

  // 监听页面加载完成事件（处理页面刷新）
  window.addEventListener("load", () => {
    console.log("📄 页面加载完成，重新同步任务状态");
    // 延迟一点，确保所有初始化完成
    setTimeout(() => {
      syncTaskState();
    }, 500);
  });

  // 监听存储变化（跨标签页任务状态同步）
  chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
    if (areaName === "local" && changes["global_task_state"]) {
      console.log("📥 检测到任务状态变化，重新同步");
      syncTaskState();
    }
  });

  // 监听UI状态变化（跨标签页同步）
  unwatchUIState = conversationStore.watchUIState((newState) => {
    // 同步对话窗口状态
    if (newState.showDialog !== appState.showDialog.value) {
      if (newState.showDialog) {
        appActions.openDialog();
      } else {
        appActions.closeDialog();
      }
    }

    // 同步悬浮球状态
    if (newState.showFloatingBall !== appState.showFloatingBall.value) {
      if (newState.showFloatingBall) {
        appActions.showFloatingBall();
      } else {
        appActions.hideFloatingBall();
      }
    }

    // 如果当前标签页是活动任务标签页，显示任务相关UI
    if (newState.activeTabId === currentTabId && newState.activeTaskId) {
      // 可以在这里显示任务进度等
      console.log("当前标签页是活动任务标签页");
    }
  });

  // 监听全局任务状态变化
  chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
    if (areaName === "local" && changes.global_task_state) {
      const taskState = changes.global_task_state.newValue;
      if (taskState) {
        // 任务状态变化，同步UI
        syncTaskState();
      } else {
        // 任务已清除
        conversationStore.clearActiveTask();
      }
    }
  });

  console.log("App.vue 初始化完成");

  // 调试：检查数学公式渲染状态
  setTimeout(() => {
    console.log("数学公式渲染状态检查:", {
      windowExists: typeof window !== "undefined",
      markdownItKatex: "已启用",
    });
  }, 1000);
});

// 清理
onUnmounted(() => {
  // 清理消息监听器
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.removeListener(handleMessage);
  }

  // 清理停止流式事件监听器
  window.removeEventListener("stopStreaming", handleStopStreaming);
});

// 加载设置
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getSettings",
    });

    if (response.success) {
      appActions.setSettings(response.data);
      // 同步设置到apiService
      apiService.setSettings(response.data);
      console.log("设置加载完成:", response.data);
    } else {
      console.error("加载设置失败:", response.error);
    }
  } catch (error) {
    console.error("加载设置异常:", error);
  }
}

// 设置消息监听
function setupMessageListener() {
  // 注册持久连接的消息处理器
  persistentConnectionClient.setDefaultMessageHandler(async (data: any) => {
    // 将持久连接的消息格式转换为 handleMessage 期望的格式
    const message: ChromeMessage = {
      action: data.action || data,
      data: data.data || data,
    };

    // 调用 handleMessage，但不使用 sendResponse（因为持久连接会自己处理响应）
    // 创建一个空的 sendResponse 函数，但不会被调用
    const emptySendResponse = () => {};
    return await handleMessage(message, {}, emptySendResponse);
  });

  // 注册特定的消息处理器（用于需要特殊处理的消息）
  persistentConnectionClient.registerHandler(
    "executeAgentAction",
    async (data) => {
      return await executeAgentAction(data);
    }
  );

  persistentConnectionClient.registerHandler("getDOMInfo", async () => {
    const domInfo = refreshElementMap();
    return {
      success: true,
      data: {
        interactiveTree: domInfo,
      },
    };
  });

  // 保留传统的消息监听器作为后备（向后兼容）
  chrome.runtime.onMessage.addListener(handleMessage);
}

// 设置流式管理器回调
function setupStreamManagerCallbacks() {
  streamManager.setCallbacks({
    onChunk: (chunk: any) => {
      console.log("StreamManager onChunk:", chunk);
      // 状态由stateManager统一管理
    },
    onComplete: (fullResponse: string) => {
      console.log("StreamManager onComplete:", fullResponse);
      // 状态由stateManager统一管理
    },
    onError: (error: string) => {
      console.error("StreamManager onError:", error);
      // 使用stateManager重置状态
      stateManager.reset();
    },
    onStateChange: (state: any) => {
      console.log("StreamManager state changed:", state);
      // 状态由stateManager统一管理
    },
  });
}

// 处理 JavaScript 执行请求（提前定义，供 handleMessage 使用）
function handleExecuteJavaScript(
  data: any,
  sendResponse: (response: any) => void
) {
  try {
    const { javascript, reason } = data;
    console.log("执行JavaScript代码:", { javascript, reason });

    if (!javascript) {
      sendResponse({
        success: false,
        error: "JavaScript代码不能为空",
      });
      return;
    }

    // 使用本地的eval5解释器执行JavaScript代码
    try {
      const result = executeJavaScriptCode(javascript);

      if (result.success) {
        console.log("JavaScript执行成功:", result.result);
        sendResponse({
          success: true,
          data: {
            message: "操作完成",
            result: result.result,
          },
        });
      } else {
        console.error("JavaScript执行失败:", result.error);
        sendResponse({
          success: false,
          error: result.error || "执行失败",
        });
      }
    } catch (error) {
      console.error("执行JavaScript时出错:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "执行时发生未知错误",
      });
    }
  } catch (error) {
    console.error("处理JavaScript执行请求时出错:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "处理请求时发生未知错误",
    });
  }
}

// 处理消息
async function handleMessage(
  message: ChromeMessage,
  sender: any,
  sendResponse: (response: ChromeResponse) => void
) {
  console.log("Content Script收到消息:", message.action);

  switch (message.action) {
    case "streamChunk":
      // 处理流式数据块
      handleStreamChunk(message.data);
      break;

    case "streamError":
      // 处理流式错误
      handleStreamError(message.data);
      break;

    case "openDialog":
      // 打开对话窗口
      console.log("收到打开对话窗口消息");
      appActions.openDialog();
      break;

    case "closeDialog":
      // 关闭对话窗口
      console.log("收到关闭对话窗口消息");
      appActions.closeDialog();
      break;

    case "executeJavaScript":
      // 执行JavaScript代码
      handleExecuteJavaScript(message.data, sendResponse);
      break;

    case "getDialogStatus":
      // 获取对话窗口状态
      console.log("收到获取对话状态消息");
      sendResponse({
        success: true,
        isOpen: appState.showDialog.value,
      });
      break;

    case "toggleFloatingBall":
      // 切换悬浮球显示状态
      console.log("收到切换悬浮球消息", message.showFloatingBall);
      if (message.showFloatingBall !== undefined) {
        // 如果消息中包含具体状态，直接设置
        if (message.showFloatingBall) {
          appActions.showFloatingBall();
        } else {
          appActions.hideFloatingBall();
        }
      } else {
        // 否则切换状态
        appActions.toggleFloatingBall();
      }
      break;

    case "ping":
      // 简单的 ping 响应，用于检查 Content Script 是否准备好
      sendResponse({ success: true, ready: true });
      break;

    case "getDOMInfo":
      // 获取DOM信息
      console.log("收到获取DOM信息消息");
      try {
        // 使用新的 InteractiveExtractor 获取交互式 DOM 树
        const domInfo = refreshElementMap();
        sendResponse({
          success: true,
          data: {
            interactiveTree: domInfo,
          },
        });
      } catch (error) {
        console.error("获取DOM信息失败:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      break;

    case "executeAgentAction":
      // 执行 Agent 原子操作
      executeAgentAction(message.data).then(sendResponse);
      return true; // 保持通道打开

    case "getPageState":
      // 获取页面状态
      try {
        const state = getPageState();
        sendResponse({
          success: true,
          data: state,
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      break;

    case "takeSnapshot":
      // 获取可访问性树快照
      try {
        const snapshot = takeSnapshot();
        sendResponse({
          success: true,
          data: snapshot,
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      break;

    case "getConsoleMessages":
      // 获取控制台消息
      try {
        const messages = getConsoleMessages(message.data || {});
        sendResponse({
          success: true,
          data: { messages },
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      break;

    case "getNetworkRequests":
      // 获取网络请求（使用现有的 networkAnalyzer）
      (async () => {
        try {
          const { analyzeNetworkRequests } = await import(
            "../shared/utils/networkAnalyzer"
          );
          const analysis = analyzeNetworkRequests();
          let requests = analysis.apiCalls || [];

          // 应用过滤
          if (message.data?.filter) {
            const filter = message.data.filter;
            requests = requests.filter((req: any) => {
              if (filter.url && !req.url.includes(filter.url)) return false;
              if (filter.method && req.method !== filter.method) return false;
              if (filter.status && req.status !== filter.status) return false;
              return true;
            });
          }

          // 限制数量
          if (message.data?.limit) {
            requests = requests.slice(-message.data.limit);
          }

          sendResponse({
            success: true,
            data: { requests },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true; // 保持通道打开

    case "emulate":
      // 设备模拟
      (async () => {
        try {
          const device = message.data?.device;
          if (!device) {
            sendResponse({
              success: false,
              error: "缺少设备配置",
            });
            return;
          }

          // 设置 viewport meta 标签
          if (device.viewport) {
            let metaViewport = document.querySelector('meta[name="viewport"]');
            if (!metaViewport) {
              metaViewport = document.createElement("meta");
              metaViewport.setAttribute("name", "viewport");
              document.head.appendChild(metaViewport);
            }
            const scale = device.viewport.deviceScaleFactor || 1;
            metaViewport.setAttribute(
              "content",
              `width=${device.viewport.width}, initial-scale=${scale}, user-scalable=no`
            );
          }

          // 通过 CSS 模拟设备（添加设备类）
          document.documentElement.setAttribute(
            "data-emulated-device",
            device.name
          );
          if (device.viewport?.isMobile) {
            document.documentElement.classList.add("mobile-device");
          }
          if (device.viewport?.hasTouch) {
            document.documentElement.classList.add("touch-device");
          }

          sendResponse({
            success: true,
            data: { message: `设备模拟已设置为: ${device.name}` },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "performanceStartTrace":
      // 开始性能追踪
      (async () => {
        try {
          const categories = message.data?.categories || [
            "performance",
            "network",
          ];
          const traceId = `trace_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;

          // 使用 Performance Observer API 开始追踪
          if (typeof PerformanceObserver !== "undefined") {
            // 存储追踪 ID 和开始时间
            (window as any).__performanceTrace = {
              traceId,
              startTime: performance.now(),
              categories,
              entries: [],
            };

            // 创建 Performance Observer
            const observer = new PerformanceObserver((list) => {
              if ((window as any).__performanceTrace) {
                (window as any).__performanceTrace.entries.push(
                  ...list.getEntries()
                );
              }
            });

            // 观察性能条目
            try {
              observer.observe({
                entryTypes: ["navigation", "resource", "measure", "mark"],
              });
            } catch (e) {
              // 某些浏览器可能不支持所有类型
            }

            (window as any).__performanceObserver = observer;
          }

          sendResponse({
            success: true,
            data: { traceId },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "performanceStopTrace":
      // 停止性能追踪
      (async () => {
        try {
          const trace = (window as any).__performanceTrace;
          const observer = (window as any).__performanceObserver;

          if (observer) {
            observer.disconnect();
            (window as any).__performanceObserver = null;
          }

          if (trace) {
            const traceData = {
              traceId: trace.traceId,
              startTime: trace.startTime,
              endTime: performance.now(),
              duration: performance.now() - trace.startTime,
              entries: trace.entries,
            };

            (window as any).__performanceTrace = null;

            sendResponse({
              success: true,
              data: {
                traceId: trace.traceId,
                traceData,
              },
            });
          } else {
            sendResponse({
              success: false,
              error: "没有活动的性能追踪",
            });
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "performanceAnalyzeInsight":
      // 性能分析洞察
      (async () => {
        try {
          const traceId = message.data?.traceId;
          let traceData = null;

          if (traceId) {
            // 从存储中获取追踪数据（实际应用中应该存储在后台）
            const trace = (window as any).__performanceTrace;
            if (trace && trace.traceId === traceId) {
              traceData = {
                traceId: trace.traceId,
                startTime: trace.startTime,
                endTime: performance.now(),
                duration: performance.now() - trace.startTime,
                entries: trace.entries,
              };
            }
          } else {
            // 使用当前活动的追踪
            const trace = (window as any).__performanceTrace;
            if (trace) {
              traceData = {
                traceId: trace.traceId,
                startTime: trace.startTime,
                endTime: performance.now(),
                duration: performance.now() - trace.startTime,
                entries: trace.entries,
              };
            }
          }

          if (!traceData) {
            sendResponse({
              success: false,
              error: "找不到性能追踪数据",
            });
            return;
          }

          // 分析性能数据
          const insights: any = {
            totalEntries: traceData.entries.length,
            duration: traceData.duration,
            resourceCount: traceData.entries.filter(
              (e: any) => e.entryType === "resource"
            ).length,
            navigationTime: 0,
            domContentLoaded: 0,
            loadComplete: 0,
          };

          // 查找导航时间
          const navigationEntry = traceData.entries.find(
            (e: any) => e.entryType === "navigation"
          );
          if (navigationEntry) {
            insights.navigationTime = navigationEntry.duration || 0;
            insights.domContentLoaded =
              (navigationEntry as any).domContentLoadedEventEnd -
                (navigationEntry as any).domContentLoadedEventStart || 0;
            insights.loadComplete =
              (navigationEntry as any).loadEventEnd -
                (navigationEntry as any).loadEventStart || 0;
          }

          // 计算资源加载时间
          const resourceEntries = traceData.entries.filter(
            (e: any) => e.entryType === "resource"
          );
          if (resourceEntries.length > 0) {
            const totalResourceTime = resourceEntries.reduce(
              (sum: number, e: any) => sum + (e.duration || 0),
              0
            );
            insights.averageResourceTime =
              totalResourceTime / resourceEntries.length;
            insights.maxResourceTime = Math.max(
              ...resourceEntries.map((e: any) => e.duration || 0)
            );
          }

          sendResponse({
            success: true,
            data: { insights },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "getNetworkRequest":
      // 获取单个网络请求
      (async () => {
        try {
          const requestId = message.data?.requestId;
          if (!requestId) {
            sendResponse({
              success: false,
              error: "缺少请求ID",
            });
            return;
          }

          const { analyzeNetworkRequests } = await import(
            "../shared/utils/networkAnalyzer"
          );
          const analysis = analyzeNetworkRequests();
          const request = analysis.apiCalls.find(
            (req: any) => req.id === requestId
          );

          if (request) {
            sendResponse({
              success: true,
              data: { request },
            });
          } else {
            sendResponse({
              success: false,
              error: "找不到指定的网络请求",
            });
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "listNetworkRequests":
      // 列出所有网络请求
      (async () => {
        try {
          const { analyzeNetworkRequests } = await import(
            "../shared/utils/networkAnalyzer"
          );
          const analysis = analyzeNetworkRequests();
          let requests = analysis.apiCalls || [];

          // 应用过滤
          if (message.data?.filter) {
            const filter = message.data.filter;
            requests = requests.filter((req: any) => {
              if (filter.url && !req.url.includes(filter.url)) return false;
              if (filter.method && req.method !== filter.method) return false;
              if (filter.status && req.status !== filter.status) return false;
              if (
                filter.resourceType &&
                req.resourceType !== filter.resourceType
              )
                return false;
              return true;
            });
          }

          // 限制数量
          if (message.data?.limit) {
            requests = requests.slice(-message.data.limit);
          }

          sendResponse({
            success: true,
            data: { requests },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "listConsoleMessages":
      // 列出所有控制台消息
      try {
        const messages = getConsoleMessages(message.data || {});
        sendResponse({
          success: true,
          data: { messages },
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      break;

    case "getConsoleMessage":
      // 获取单个控制台消息
      try {
        const messageId = message.data?.messageId;
        if (!messageId) {
          sendResponse({
            success: false,
            error: "缺少消息ID",
          });
          return;
        }

        const messages = getConsoleMessages({ limit: 1000 });
        const msg = messages.find((m: any) => m.id === messageId);

        if (msg) {
          sendResponse({
            success: true,
            data: { message: msg },
          });
        } else {
          sendResponse({
            success: false,
            error: "找不到指定的控制台消息",
          });
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      break;

    case "wait_for_element":
      // 等待元素出现
      (async () => {
        try {
          const result = await executeAgentAction({
            type: "wait_for_element",
            ...message.data,
          });
          sendResponse(result);
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "extract_text":
      // 提取文本
      (async () => {
        try {
          const result = await executeAgentAction({
            type: "extract_text",
            ...message.data,
          });
          sendResponse({
            success: result.success,
            data: { result: result.result },
            error: result.error,
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "extract_links":
      // 提取链接
      (async () => {
        try {
          const result = await executeAgentAction({
            type: "extract_links",
            ...message.data,
          });
          sendResponse({
            success: result.success,
            data: { result: result.result },
            error: result.error,
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "extract_images":
      // 提取图片
      (async () => {
        try {
          const result = await executeAgentAction({
            type: "extract_images",
            ...message.data,
          });
          sendResponse({
            success: result.success,
            data: { result: result.result },
            error: result.error,
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "get_element_info":
      // 获取元素信息
      (async () => {
        try {
          const result = await executeAgentAction({
            type: "get_element_info",
            ...message.data,
          });
          sendResponse({
            success: result.success,
            data: { result: result.result },
            error: result.error,
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "compare_screenshots":
      // 比较截图
      (async () => {
        try {
          const result = await executeAgentAction({
            type: "compare_screenshots",
            ...message.data,
          });
          sendResponse({
            success: result.success,
            data: { result: result.result },
            error: result.error,
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case "resizePage":
      // 调整页面大小（通过 CSS 模拟）
      try {
        const { width, height } = message.data || {};
        if (!width || !height) {
          sendResponse({
            success: false,
            error: "缺少宽度或高度参数",
          });
          return;
        }

        // 通过 CSS 设置页面大小（注意：这只能调整视口，不能真正改变浏览器窗口大小）
        document.documentElement.style.width = `${width}px`;
        document.documentElement.style.height = `${height}px`;
        document.body.style.width = `${width}px`;
        document.body.style.height = `${height}px`;

        sendResponse({
          success: true,
          data: { message: "页面大小已调整" },
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      break;

    case "agentUpdate":
      // 处理 Agent 状态更新
      // 确保 message.data 存在且格式正确
      // 使用异步处理，确保消息列表状态正确
      (async () => {
        try {
          if (message.data && typeof message.data === "object") {
            await handleAgentUpdate(message.data);
          } else {
            console.warn("⚠️ agentUpdate 消息缺少 data 字段或格式不正确", {
              message,
              data: message.data,
              dataType: typeof message.data,
            });
          }
        } catch (error) {
          console.error("❌ 处理 agentUpdate 消息时出错:", error, {
            message,
            data: message.data,
          });
        }
      })();
      break;
  }

  sendResponse({ success: true });
}

// 处理 Agent 状态更新
// 参考 chrome-devtools-mcp 的展示方式，优化消息格式
async function handleAgentUpdate(
  update: { type: string; data: any } | undefined | null
) {
  // 防御性检查：如果 update 为 undefined 或 null，直接返回
  if (!update || typeof update !== "object") {
    console.warn("⚠️ Agent Update 数据为空或格式不正确，跳过处理", {
      update,
      updateType: typeof update,
    });
    return;
  }

  console.log("🤖 Agent Update:", update);

  // 检查 type 是否存在
  if (!update.type || typeof update.type !== "string") {
    console.warn(
      "⚠️ Agent Update 缺少 type 字段或 type 不是字符串，跳过处理",
      update
    );
    return;
  }

  // 安全解构
  const { type, data } = update;

  // 格式化操作类型名称（参考 chrome-devtools-mcp）
  const formatActionType = (actionType: string): string => {
    const actionNames: Record<string, string> = {
      // Navigation
      navigate: "导航",
      // DOM & Interaction
      click: "点击",
      type: "输入",
      scroll: "滚动",
      wait: "等待",
      wait_for_element: "等待元素",
      extract_text: "提取文本",
      extract_links: "提取链接",
      extract_images: "提取图片",
      get_element_info: "获取元素信息",
      take_snapshot: "快照",
      // Debugging
      evaluate_script: "执行脚本",
      execute_script: "执行脚本",
      take_screenshot: "截图",
      get_console_message: "获取控制台消息",
      list_console_messages: "列出控制台消息",
      get_console_messages: "获取控制台消息",
      // Emulation
      emulate: "设备模拟",
      resize_page: "调整页面大小",
      // Network
      get_network_request: "获取网络请求",
      list_network_requests: "列出网络请求",
      get_network_requests: "获取网络请求",
      // Performance
      performance_start_trace: "开始性能追踪",
      performance_stop_trace: "停止性能追踪",
      performance_analyze_insight: "性能分析",
      // Legacy (兼容旧接口)
      extract: "提取",
      hover: "悬停",
      drag: "拖拽",
      press_key: "按键",
      compare_screenshots: "比较截图",
      // Task Completion
      done: "完成",
    };
    return actionNames[actionType] || actionType;
  };

  if (type === "step") {
    // 显示步骤信息（参考 chrome-devtools-mcp 的格式）
    const actionTypeName = formatActionType(data.action);
    let stepInfo = `\n\n---\n\n### 🔄 步骤 ${data.stepId}\n\n`;

    // 思考过程
    if (data.thought) {
      stepInfo += `**💭 思考**: ${data.thought}\n\n`;
    }

    // 执行操作
    stepInfo += `**🎯 操作**: ${actionTypeName}`;
    if (data.reason) {
      stepInfo += `\n**📝 原因**: ${data.reason}`;
    }

    // 执行结果（如果有）
    if (data.result) {
      stepInfo += `\n\n**📊 执行结果**: `;
      if (data.result.success) {
        stepInfo += `✅ **成功**`;
        if (data.result.result) {
          const resultStr =
            typeof data.result.result === "string"
              ? data.result.result
              : JSON.stringify(data.result.result, null, 2);
          // 限制结果长度，避免消息过长
          if (resultStr.length > 500) {
            stepInfo += `\n\`\`\`\n${resultStr.substring(0, 500)}...\n\`\`\``;
          } else {
            stepInfo += `\n\`\`\`\n${resultStr}\n\`\`\``;
          }
        }
      } else {
        stepInfo += `❌ **失败**`;
        if (data.result.error) {
          stepInfo += `\n**错误**: ${data.result.error}`;
        }
      }

      // 显示状态变化（如果有）
      if (data.result.newState) {
        if (data.result.newState.url) {
          stepInfo += `\n**📍 URL**: ${data.result.newState.url}`;
        }
        if (data.result.newState.elementCount !== undefined) {
          stepInfo += `\n**📦 元素数**: ${data.result.newState.elementCount}`;
        }
      }
    }

    // 每个步骤单独作为一条 AI 消息，避免与用户消息混淆
    appActions.addMessage(stepInfo, false);
  } else if (type === "thought") {
    // 思考过程（单独一条消息）
    const thoughtText = `\n\n💭 **思考中**: ${data}\n`;
    appActions.addMessage(thoughtText, false);
  } else if (type === "done") {
    // 任务完成
    const summary = `\n\n---\n\n### ✅ 任务完成\n\n${data}`;
    appActions.addMessage(summary, false);
    stateManager.completeStreaming();
    streamManager.complete(summary);
    appActions.setGenerating(false);
    appActions.setStreaming(false);
  } else if (type === "error") {
    // 错误信息
    const errorText = `\n\n---\n\n### ❌ 错误\n\n${data}`;
    appActions.addMessage(errorText, false);
  } else if (type === "warning") {
    // 警告信息
    const warningText = `\n\n---\n\n### ⚠️ 警告\n\n${data}`;
    appActions.addMessage(warningText, false);
  } else if (type === "stopped") {
    // 任务停止
    const stoppedText = `\n\n---\n\n### 🛑 任务已停止\n\n${
      data || "用户主动停止了任务"
    }`;
    appActions.addMessage(stoppedText, false);
    stateManager.reset();
    appActions.setGenerating(false);
    appActions.setStreaming(false);
  }
}

// 重置流式状态
function resetStreamState() {
  console.log("重置流式状态");

  // 重置完成标志
  isStreamingCompleted = false;

  // 清除超时器
  if (streamingTimeout) {
    clearTimeout(streamingTimeout);
    streamingTimeout = null;
  }

  streamManager.abort();
  stateManager.reset();
}

// 仅重置流式完成标志（用于新对话开始）
function resetStreamingCompletedFlag() {
  console.log("重置流式完成标志");
  isStreamingCompleted = false;
}

// 暴露重置函数到全局，供其他组件调用
(window as any).resetStreamState = resetStreamState;
(window as any).resetStreamingCompletedFlag = resetStreamingCompletedFlag;

// 获取DOM信息
function getDOMInfo() {
  try {
    const body = document.body;
    if (!body) return { htmlStructure: "" };

    let html = `**页面完整HTML结构：**\n`;
    html += `\`\`\`html\n`;

    // 获取页面的主要部分
    const mainSections = [
      "header",
      "nav",
      "main",
      "article",
      "section",
      "aside",
      "footer",
    ];

    mainSections.forEach((tag) => {
      const elements = document.querySelectorAll(tag);
      if (elements.length > 0) {
        html += `<!-- ${tag.toUpperCase()} 部分 -->\n`;
        elements.forEach((el, index) => {
          const outerHTML = el.outerHTML;
          // 限制长度，避免过长
          const truncatedHTML =
            outerHTML.length > 500
              ? outerHTML.substring(0, 500) + "..."
              : outerHTML;
          html += `${truncatedHTML}\n`;
        });
        html += `\n`;
      }
    });

    // 获取包含特定文本的元素
    const textElements = document.querySelectorAll("*");
    const relevantElements: Element[] = [];

    textElements.forEach((el) => {
      if (el.textContent && el.textContent.includes("一见")) {
        relevantElements.push(el);
      }
    });

    if (relevantElements.length > 0) {
      html += `<!-- 包含"一见"文本的元素 -->\n`;
      relevantElements.forEach((el) => {
        const outerHTML = el.outerHTML;
        const truncatedHTML =
          outerHTML.length > 300
            ? outerHTML.substring(0, 300) + "..."
            : outerHTML;
        html += `${truncatedHTML}\n`;
      });
    }

    html += `\`\`\`\n`;

    return {
      htmlStructure: html,
      domStructure: {
        // 可以添加更多DOM结构信息
        mainSections: mainSections.map((tag) => ({
          tag,
          count: document.querySelectorAll(tag).length,
        })),
        totalElements: document.querySelectorAll("*").length,
        relevantElements: relevantElements.length,
      },
    };
  } catch (error) {
    console.error("获取DOM信息失败:", error);
    return { htmlStructure: "", domStructure: {} };
  }
}

// 处理停止流式事件
function handleStopStreaming() {
  resetStreamState();
}

// 流式处理超时器
let streamingTimeout: NodeJS.Timeout | null = null;

// 流式处理状态标志
let isStreamingCompleted = false;

// 处理流式数据块
function handleStreamChunk(data: any) {
  if (data.type === "chunk") {
    // 如果流式处理已经完成，忽略后续的chunk消息
    if (isStreamingCompleted) {
      console.log("流式处理已完成，忽略后续chunk消息");
      return;
    }

    // 开始流式处理（只在第一次chunk时设置）
    if (!appState.isStreaming.value) {
      // 重置流式完成标志，准备接收新的流式消息
      isStreamingCompleted = false;
      console.log("开始新的流式处理，重置完成标志");

      stateManager.startStreaming();

      // 设置超时保护，确保状态最终会被重置
      streamingTimeout = setTimeout(() => {
        if (appState.isStreaming.value || appState.isGenerating.value) {
          console.warn("流式处理超时，强制重置状态");
          stateManager.reset();
        }
        streamingTimeout = null;
      }, 30000); // 30秒超时
    }

    // 使用流式管理器处理chunk
    streamManager.handleChunk(data);

    // 如果还没有AI消息，先添加一个
    if (
      appState.messages.value.length === 0 ||
      appState.messages.value[appState.messages.value.length - 1].isUser
    ) {
      nextTick(() => {
        appActions.addMessage("", false);
      });
    }

    // 处理思考内容
    if (data.reasoningContent) {
      nextTick(() => {
        appActions.updateLastMessageThinking(data.reasoningContent);
      });
    }

    // 处理回答内容
    // 注意：Agent 系统使用 agentUpdate 消息，这里只处理非 Agent 的流式响应
    if (data.content) {
      nextTick(() => {
        // 确保最后一条消息是AI消息，才更新
        const messages = appState.messages.value;
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          if (!lastMessage.isUser) {
            appActions.updateLastMessage(data.content);
          } else {
            console.warn(
              "⚠️ handleStreamChunk: 最后一条消息是用户消息，跳过更新。这可能是 Agent 系统的消息，应该使用 agentUpdate 处理。"
            );
          }
        }
      });
    }
  } else if (data.type === "done") {
    // 检测到流式完成信号
    console.log("收到流式完成信号，设置完成标志");
    isStreamingCompleted = true;

    // 清除超时器
    if (streamingTimeout) {
      clearTimeout(streamingTimeout);
      streamingTimeout = null;
    }

    // 完成流式处理
    stateManager.completeStreaming();

    // 调用streamManager.complete
    streamManager.complete(data.fullResponse || "");

    // 完成AI对话处理步骤
    completeStep("ai_conversation", "AI对话处理完成");

    // 自动折叠思考内容（如果存在）
    if (appState.messages.value.length > 0) {
      const lastMessage =
        appState.messages.value[appState.messages.value.length - 1];
      if (!lastMessage.isUser && lastMessage.thinkingContent) {
        // 延迟一点时间再折叠，让用户看到思考过程
        setTimeout(() => {
          // 检查组件是否仍然存在
          if (document.querySelector("#ai-assistant-content")) {
            nextTick(() => {
              appActions.toggleThinkingCollapse(lastMessage.id);
            });
          }
        }, 2000); // 2秒后自动折叠
      }
    }

    // 处理浏览器控制指令（已废弃，现在使用 Agent 系统）
    // if (data.fullResponse) {
    //   // 使用 nextTick 确保在下一个事件循环中执行
    //   nextTick(async () => {
    //     await handleBrowserControlInstructions(data.fullResponse);
    //     // 注意：不要在这里重置状态，因为状态已经由stateManager.completeStreaming()重置
    //   });
    // }
    // 状态已经由stateManager.completeStreaming()重置，无需重复设置
  }
}

// 处理流式错误
function handleStreamError(data: any) {
  console.error("流式处理错误:", data.error);

  // 重置完成标志
  isStreamingCompleted = false;

  // 清除超时器
  if (streamingTimeout) {
    clearTimeout(streamingTimeout);
    streamingTimeout = null;
  }

  // 停止流式处理
  stateManager.stopStreaming();

  // 标记当前步骤为错误
  errorStep("ai_conversation", `处理失败: ${data.error}`);

  // 添加错误消息
  nextTick(() => {
    appActions.addMessage(`❌ 处理失败: ${data.error}`, false);
  });

  // 状态已经由stateManager.stopStreaming()重置，无需重复设置
}

import { parseWebContent as extractContent } from "../shared/utils/contentExtractor";
// 已迁移到 Agent 系统，不再需要这些服务
// import { promptManager } from "../shared/utils/promptManager";
// import { BrowserControlService } from "../shared/services/browserControlService";
import { apiService } from "../shared/services/apiService";

// 解析网页内容 - 使用优化后的提取器
function parseWebContent(): string {
  return extractContent();
}

// 将函数暴露给全局，供其他组件使用
(window as any).parseWebContent = parseWebContent;

// 已迁移到 Agent 系统，不再需要此函数
// Agent 系统会自动处理浏览器控制操作
// 此函数已完全废弃并删除

// handleExecuteJavaScript 函数已在 handleMessage 之前定义（第 634 行），此处不再重复定义
</script>

<style>
#ai-assistant-content {
  /* 确保Vue组件不会影响页面样式 */
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* 重置Vue组件内的样式 */
#ai-assistant-content * {
  box-sizing: border-box;
}

/* 恢复列表样式，因为all: initial会重置它们 */
#ai-assistant-content ol,
#ai-assistant-content ul {
  margin: 0.5em 0;
  padding-left: 1.5em;
  line-height: 1.6;
}

#ai-assistant-content ol {
  list-style-type: decimal;
}

#ai-assistant-content ul {
  list-style-type: disc;
}

#ai-assistant-content li {
  margin: 0.25em 0;
  padding-left: 0.25em;
}

/* 嵌套列表 */
#ai-assistant-content ol ol,
#ai-assistant-content ul ul,
#ai-assistant-content ol ul,
#ai-assistant-content ul ol {
  margin: 0.25em 0;
  padding-left: 1em;
}

/* 列表项内容 */
#ai-assistant-content li p {
  margin: 0.25em 0;
  display: inline;
}
</style>
