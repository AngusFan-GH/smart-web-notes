import { AgentAction, ToolExecutionResult } from "../types/agentTools";
import { toolExecutor } from "./toolExecutor";
import { ApiService } from "./apiService";
import { InteractiveElement } from "../utils/interactiveExtractor";
import { globalTaskManager } from "./globalTaskManager";

// 声明 chrome 类型（在 Background Script 中使用）
declare const chrome: any;

export interface AgentContext {
  goal: string;
  url: string;
  title: string;
  tabId: number; // 记录启动时的 tabId，确保始终向正确的 tab 发送消息
  history: AgentStep[];
  maxSteps: number;
  currentStep: number;
  // 最近一次页面状态（用于检测页面是否发生实质变化）
  lastState?: {
    url?: string;
    elementCount?: number;
  };
  // 连续“无明显变化”的成功步骤计数（用于检测死循环）
  stableStepCount?: number;
}

export interface AgentStep {
  stepId: number;
  observation: string; // 对当前页面状态的描述 (DOM概要)
  thought: string;     // LLM 的思考过程
  action: AgentAction; // LLM 决定的操作
  result?: ToolExecutionResult; // 操作执行结果
  retryCount?: number; // 重试次数
}

/**
 * Agent Service
 * 负责协调 "感知 -> 思考 -> 行动" 的循环
 * 支持多轮执行，直到任务完成或达到最大步数
 */
export class AgentService {
  private static instance: AgentService;
  private isRunning: boolean = false;
  private currentContext: AgentContext | null = null;
  private abortController: AbortController | null = null;

  private constructor() {}

  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  /**
   * 启动一个新的 Agent 任务（支持多轮执行）
   */
  async startGoal(
    goal: string, 
    context: { url: string; title: string; tabId?: number; taskId?: string }
  ): Promise<void> {
    // 检查全局任务管理器是否允许启动新任务
    if (!globalTaskManager.canStartNewTask()) {
      const currentTask = globalTaskManager.getCurrentTask();
      throw new Error(
        `已有任务正在运行 (${currentTask?.goal})，请先停止当前任务`
      );
    }

    if (this.isRunning) {
      throw new Error("Agent is already running");
    }

    // 如果没有提供 tabId，尝试获取当前活动 tab
    let tabId = context.tabId;
    if (!tabId) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error("无法获取活动标签页");
      }
      tabId = tabs[0].id;
    }

    // 生成任务ID（如果没有提供）
    const taskId = context.taskId || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const maxSteps = 15;

    // 在全局任务管理器中注册任务
    await globalTaskManager.startTask(taskId, tabId, goal, maxSteps);

    console.log("🚀 Agent 启动任务:", goal, "Tab ID:", tabId, "Task ID:", taskId);
    
    // 在启动任务前，确保 Content Script 已就绪
    console.log("⏳ 等待 Content Script 就绪...");
    const { waitForContentScriptReady } = await import("../utils/contentScriptReady");
    const { messageQueue } = await import("../utils/messageQueue");
    
    const isReady = await waitForContentScriptReady(tabId, 30000); // 30秒超时
    if (isReady) {
      messageQueue.markTabReady(tabId);
      console.log("✅ Content Script 已就绪，开始执行任务");
    } else {
      console.warn("⚠️ Content Script 等待超时，但继续执行任务（可能已就绪）");
      // 即使超时，也尝试标记为就绪（可能 Content Script 已经加载但 ping 失败）
      messageQueue.markTabReady(tabId);
    }
    
    this.isRunning = true;
    this.abortController = new AbortController();
    this.currentContext = {
      goal,
      url: context.url,
      title: context.title,
      tabId, // 保存 tabId，确保后续操作都使用这个 tab
      taskId,
      history: [],
      maxSteps,
      currentStep: 0
    };

    try {
      await this.runLoop();
      // 任务成功完成
      await globalTaskManager.completeTask();
    } catch (error) {
      console.error("❌ Agent 运行出错:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.notifyFrontend("error", errorMsg);
      // 任务失败
      await globalTaskManager.failTask(errorMsg);
    } finally {
      this.isRunning = false;
      this.currentContext = null;
      this.abortController = null;
    }
  }

  /**
   * 停止当前任务
   */
  async stop() {
    console.log("🛑 Agent 任务被停止");
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.notifyFrontend("stopped", "任务已停止");
    // 更新全局任务管理器
    await globalTaskManager.stopTask();
  }

  /**
   * Agent 主循环（多轮执行的核心）
   */
  private async runLoop() {
    if (!this.currentContext) return;

    while (this.isRunning && 
           this.currentContext.currentStep < this.currentContext.maxSteps) {
      
      // 检查是否被中止（在每次循环开始时检查）
      if (this.abortController?.signal.aborted || !this.isRunning) {
        console.log("🛑 Agent 循环被中止");
        this.notifyFrontend("stopped", "任务执行被中断");
        break;
      }

      // 在 try 块外增加步骤计数，确保即使失败也不会重复执行
      this.currentContext.currentStep++;
      const stepId = this.currentContext.currentStep;
      
      console.log(`🔄 Agent Loop Step ${stepId}/${this.currentContext.maxSteps}`);

      // 记录步骤开始（即使后续失败，也记录这个步骤）
      const currentStep: AgentStep = {
        stepId,
        observation: "",
        thought: "",
        action: { type: "wait", reason: "步骤初始化" }
      };
      this.currentContext.history.push(currentStep);

      try {
        // 1. Observe: 获取页面状态 (交互元素树)
        const domSnapshot = await this.observePage();
        console.log(`📊 观察到 ${domSnapshot.length} 个交互元素`);
        
        // 更新步骤观察结果
        currentStep.observation = `页面包含 ${domSnapshot.length} 个交互元素`;
        
        // 2. Think: 询问 LLM 下一步操作
        const decision = await this.think(domSnapshot);
        console.log(`💭 思考结果: ${decision.thought}`);
        console.log(`🎯 决定执行: ${decision.action.type}`);
        
        // 更新步骤信息（仅记录在上下文中，前端展示统一在执行完成后处理）
        currentStep.thought = decision.thought;
        currentStep.action = decision.action;

        // 3. Act: 执行操作
        if (decision.action.type === 'done') {
          console.log("✅ Agent 任务完成:", decision.action.text);
          this.notifyFrontend("done", decision.action.text);
          break;
        }

        // 在执行前检测是否为“重复无效操作”（例如重复点击同一元素且页面无变化）
        if (decision.action.type === "click") {
          const currentElementId = (decision.action as any).elementId;
          if (typeof currentElementId === "number") {
            const recentClicks = this.currentContext.history
              .slice(-3) // 只看最近三步
              .filter((h) => {
                if (!h.result || !h.result.success) return false;
                if (h.action.type !== "click") return false;
                const hElementId = (h.action as any).elementId;
                const resultData = (h.result as any).result;
                // 需要满足：同一个 elementId，且上一次点击后 elementCount 未变化
                return (
                  hElementId === currentElementId &&
                  resultData &&
                  resultData.elementId === currentElementId &&
                  resultData.elementCountChanged === false
                );
              });

            if (recentClicks.length > 0) {
              console.warn(
                `♻️ 检测到重复点击同一元素 (ID=${currentElementId}) 且页面元素数量未变化，本步骤将被跳过`
              );
              this.notifyFrontend(
                "warning",
                `检测到重复点击同一元素 (ID=${currentElementId}) 且页面无明显变化，本步骤已自动跳过`
              );

              // 记录一个“跳过”的结果到当前步骤，方便后续思考参考
              currentStep.result = {
                success: false,
                error: "重复点击同一元素且页面无变化，已跳过执行",
              } as any;

              // 直接进入下一轮循环，不真正执行 click
              continue;
            }
          }
        }

        // 设置 ToolExecutor 的 tabId（确保在正确的 Tab 上执行）
        if (this.currentContext) {
          toolExecutor.setTabId(this.currentContext.tabId);
        }

        let result = await toolExecutor.execute(decision.action);
        currentStep.result = result;

        // 4. Feedback: 处理执行结果
        if (!result.success) {
          let errorMsg = result.error || "未知错误";
          console.warn(`⚠️ Step ${stepId} 执行失败:`, errorMsg);

          // 如果是配置类/不可恢复的错误（例如 API 配置未设置），直接结束任务
          if (errorMsg.includes("API配置未设置") || errorMsg.includes("API 配置未设置")) {
            this.notifyFrontend("error", `步骤 ${stepId} 失败: ${errorMsg}`);
            console.error("❌ 检测到致命配置错误（如 API 未配置），立即停止任务");
            this.notifyFrontend("error", "检测到 API 配置错误，任务已停止，请先在设置中完成配置");
            break;
          }
          
          // 改进的错误恢复机制（仅对可重试错误生效）
          const isRetryableError = this.isRetryableError(errorMsg);
          
          if (isRetryableError) {
            const retryCount = this.getRetryCount(stepId);
            const maxRetries = 2; // 减少重试次数，避免重复执行
            
            if (retryCount < maxRetries) {
              console.log(`⏳ 检测到可重试错误，尝试恢复 (${retryCount + 1}/${maxRetries})...`);
              
              // 等待并重试（增加等待时间，确保 Content Script 完全就绪）
              await this.retryWithBackoff(stepId, retryCount);
              
              // 注意：不要使用 continue，因为步骤计数已经增加
              // 重新执行操作，但不增加步骤计数
              // 在重试前，等待 Content Script 完全就绪
              const { waitForContentScriptReady } = await import("../utils/contentScriptReady");
              const { messageQueue } = await import("../utils/messageQueue");
              
              // 使用持久连接，不需要等待就绪（连接会自动管理）
              const { persistentConnection } = await import("../utils/persistentConnection");
              if (persistentConnection.isConnected(this.currentContext!.tabId)) {
                console.log("✅ Content Script 连接正常，开始重试");
              } else {
                console.warn("⚠️ Content Script 连接未建立，等待连接...");
                // 等待连接建立（最多 5 秒）
                let waited = 0;
                while (waited < 5000 && !persistentConnection.isConnected(this.currentContext!.tabId)) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                  waited += 500;
                }
              }
              
              const retryResult = await toolExecutor.execute(decision.action);
              currentStep.result = retryResult;
              
              if (retryResult.success) {
                console.log("✅ 重试成功");
                // 继续处理成功的结果
                result = retryResult;
              } else {
                // 重试失败，继续错误处理流程
                errorMsg = retryResult.error || "重试失败";
                // 更新重试计数
                const step = this.currentContext!.history.find(h => h.stepId === stepId);
                if (step) {
                  step.retryCount = (step.retryCount || 0) + 1;
                }
              }
            } else {
              console.warn(`⚠️ 重试次数已达上限 (${maxRetries})，不再重试`);
              // 不再尝试降级策略，直接报告错误，避免无限重试
            }
          }
          
          // 如果重试或降级成功，result 会被设置，跳过错误处理
          if (!result || !result.success) {
            // 继续错误处理
            this.notifyFrontend("error", `步骤 ${stepId} 失败: ${errorMsg}`);
            
            // 如果连续失败多次，停止循环
            const recentFailures = this.currentContext.history
              .slice(-3)
              .filter(h => h.result && !h.result.success).length;
            
            if (recentFailures >= 3) {
              console.error("❌ 连续失败过多，停止任务");
              this.notifyFrontend("error", "连续执行失败，任务已停止");
              break;
            }
          }
        }
        
        // 如果步骤执行成功（包括重试或降级成功），处理成功逻辑
        if (result && result.success) {
          console.log(`✅ Step ${stepId} 执行成功`);

          // 记录新的页面状态
          const prevState = this.currentContext.lastState || {};
          const newState = {
            url: result.newState?.url ?? this.currentContext.url,
            elementCount: result.newState?.elementCount,
          };

          // 用于检测页面是否“基本稳定”（URL 和元素数量都没有变化）
          const isUrlSame =
            prevState.url && newState.url && prevState.url === newState.url;
          const isElementCountSame =
            typeof prevState.elementCount === "number" &&
            typeof newState.elementCount === "number" &&
            prevState.elementCount === newState.elementCount;

          if (isUrlSame && isElementCountSame) {
            this.currentContext.stableStepCount =
              (this.currentContext.stableStepCount || 0) + 1;
          } else {
            this.currentContext.stableStepCount = 0;
          }

          this.currentContext.lastState = newState;

          // 执行完成后，再次通知前端，包含执行结果
          this.notifyFrontend("step", {
            stepId,
            thought: decision.thought,
            action: decision.action.type,
            reason: decision.action.reason,
            result: result, // 包含执行结果
          });

          // 更新全局任务管理器的进度
          await globalTaskManager.updateProgress(stepId);

          // 如果 URL 发生变化，说明可能发生了导航，需要等待页面加载
          if (result.newState?.url && result.newState.url !== this.currentContext.url) {
            console.log(
              `🌐 检测到页面导航: ${this.currentContext.url} -> ${result.newState.url}`
            );
            this.currentContext.url = result.newState.url;

            // 更新全局任务管理器的活动标签页（导航时保持任务连续性）
            await globalTaskManager.updateActiveTabId(this.currentContext.tabId);

            // 标记 tab 为未就绪（页面跳转时 Content Script 会重新加载）
            const { messageQueue } = await import("../utils/messageQueue");
            messageQueue.markTabNotReady(this.currentContext.tabId);

            // 等待页面加载完成
            await new Promise<void>((resolve) => {
              const listener = (updatedTabId: number, changeInfo: any) => {
                if (
                  updatedTabId === this.currentContext!.tabId &&
                  changeInfo.status === "complete"
                ) {
                  chrome.tabs.onUpdated.removeListener(listener);
                  console.log("✅ 页面导航完成，等待 Content Script 就绪...");
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

            // 等待 Content Script 就绪（使用 waitForContentScriptReady）
            const { waitForContentScriptReady } = await import(
              "../utils/contentScriptReady"
            );
            const isReady = await waitForContentScriptReady(
              this.currentContext.tabId,
              15000
            );

            if (isReady) {
              // Content Script 已就绪，标记为就绪状态
              messageQueue.markTabReady(this.currentContext.tabId);
              console.log("✅ Content Script 已就绪，可以继续执行");
            } else {
              console.warn(
                "⚠️ Content Script 未就绪，但继续执行（可能已超时）"
              );
            }

            // 额外等待，确保 Content Script 完全初始化
            await new Promise((r) => setTimeout(r, 500));
          }

          // 如果页面在最近多步中一直“稳定不变”，认为任务可能已经完成或陷入死循环，主动停止
          const stableSteps = this.currentContext.stableStepCount || 0;
          const maxStableSteps = 3; // 连续 3 步页面完全无变化则停止
          if (stableSteps >= maxStableSteps) {
            console.warn(
              `⚠️ 连续 ${stableSteps} 步页面状态（URL + 元素数量）无变化，任务将自动停止以避免死循环`
            );
            this.notifyFrontend(
              "warning",
              "检测到页面在多步操作后仍无明显变化，任务已自动结束以避免重复操作"
            );
            break;
          }
        }

        // 等待页面稳定（给 DOM 更新和网络请求时间）
        await new Promise((r) => setTimeout(r, 1000));
        
      } catch (error) {
        console.error(`❌ Step ${stepId} 出错:`, error);
        this.notifyFrontend("error", `步骤 ${stepId} 出错: ${error instanceof Error ? error.message : String(error)}`);
        
        // 单步错误不中断循环，继续尝试
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // 检查是否因为达到最大步数而停止
    if (this.currentContext.currentStep >= this.currentContext.maxSteps) {
      console.warn("⚠️ 达到最大步数限制，任务未完成");
      this.notifyFrontend("warning", `已达到最大步数 (${this.currentContext.maxSteps})，任务可能未完全完成`);
    }
  }

  /**
   * 获取页面感知信息
   */
  private async observePage(): Promise<InteractiveElement[]> {
    if (!this.currentContext) throw new Error("No context");
    
    const tabId = this.currentContext.tabId;
    
    // 验证 tab 是否还存在
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        throw new Error(`Tab ${tabId} 不存在`);
      }
    } catch (error) {
      console.error("Tab 验证失败:", error);
      throw new Error(`Tab ${tabId} 已关闭或不存在`);
    }

    // 使用持久连接获取 DOM 信息（更稳定）
    const { persistentConnection } = await import("../utils/persistentConnection");
    
    try {
      const response = await persistentConnection.sendMessage(tabId, {
        action: "getDOMInfo",
      }, 60000); // 60秒超时

      if (response && response.success && response.data && response.data.interactiveTree) {
        return response.data.interactiveTree;
      } else {
        throw new Error("Failed to get interactive tree");
      }
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error(`❌ 获取 DOM 信息失败 (Tab ${tabId}):`, errorMsg);
      throw new Error(`获取 DOM 信息失败: ${errorMsg}`);
    }
  }

  /**
   * 调用 LLM 进行决策
   */
  private async think(domSnapshot: InteractiveElement[]): Promise<{ thought: string; action: AgentAction }> {
    if (!this.currentContext) throw new Error("No context");

    // 构建 System Prompt
    const systemPrompt = `你是一个浏览器自动化 Agent。你的目标是在当前网页上帮助用户完成他们的请求。

你将收到当前页面的状态（交互元素树），每个元素都有一个唯一的数字 ID。
你必须以 JSON 格式输出你的决策，包含 "thought" 和 "action" 两个字段。

⚠️ 重要：你必须直接返回纯 JSON 对象，不要使用 markdown 代码块包裹，不要添加任何解释文字。

可用操作（工具）：
**基础操作**：
- { "type": "click", "elementId": <id>, "reason": "为什么点击" } : 点击一个元素
- { "type": "type", "elementId": <id>, "text": "<文本>", "submit": <bool>, "reason": "为什么输入" } : 在输入框中输入文本
- { "type": "scroll", "direction": "up"|"down"|"top"|"bottom", "reason": "为什么滚动" } : 滚动页面
- { "type": "wait", "duration": <毫秒>, "reason": "为什么等待" } : 等待一段时间
- { "type": "navigate", "url": "<URL>", "reason": "为什么导航" } : 导航到新页面
- { "type": "hover", "elementId": <id>, "reason": "为什么悬停" } : 悬停在一个元素上
- { "type": "drag", "fromElementId": <id>, "toElementId": <id>, "reason": "为什么拖拽" } : 拖拽元素
- { "type": "press_key", "key": "<按键>", "elementId": <id>, "modifiers": ["Control"], "reason": "为什么按键" } : 按下键盘按键

**设备与页面**：
- { "type": "emulate", "device": { "name": "iPhone 12", "viewport": { "width": 390, "height": 844, "deviceScaleFactor": 3, "isMobile": true, "hasTouch": true } }, "reason": "为什么模拟设备" } : 模拟设备（移动设备、平板等）
- { "type": "resize_page", "width": <宽度>, "height": <高度>, "reason": "为什么调整页面大小" } : 调整页面大小

**性能分析**：
- { "type": "performance_start_trace", "categories": ["performance", "network"], "reason": "为什么开始性能追踪" } : 开始性能追踪
- { "type": "performance_stop_trace", "reason": "为什么停止性能追踪" } : 停止性能追踪
- { "type": "performance_analyze_insight", "traceId": "<追踪ID>", "reason": "为什么分析性能" } : 分析性能数据并获取洞察

**网络请求**：
- { "type": "get_network_request", "requestId": "<请求ID>", "reason": "为什么获取网络请求" } : 获取单个网络请求详情
- { "type": "list_network_requests", "filter": { "url": "<URL>", "method": "GET", "status": 200, "resourceType": "xhr" }, "limit": 100, "reason": "为什么列出网络请求" } : 列出所有网络请求
- { "type": "get_network_requests", "filter": {...}, "limit": 100, "reason": "为什么获取网络请求" } : 获取网络请求（兼容旧接口）

**控制台消息**：
- { "type": "get_console_message", "messageId": "<消息ID>", "reason": "为什么获取控制台消息" } : 获取单个控制台消息
- { "type": "list_console_messages", "level": "error"|"warning"|"info"|"all", "limit": 100, "reason": "为什么列出控制台消息" } : 列出所有控制台消息
- { "type": "get_console_messages", "level": "error", "limit": 50, "reason": "为什么获取控制台消息" } : 获取控制台消息（兼容旧接口）

**调试工具**：
- { "type": "take_screenshot", "fullPage": true, "format": "png", "reason": "为什么截图" } : 截图
- { "type": "take_snapshot", "reason": "为什么获取快照" } : 获取可访问性树快照
- { "type": "execute_script", "script": "<JavaScript代码>", "description": "脚本作用描述", "reason": "为什么执行脚本" } : 执行JavaScript代码

**完成**：
- { "type": "done", "text": "<总结>", "reason": "为什么完成" } : 任务完成，提供总结

规则：
1. 只能使用交互元素树中提供的 element ID，不要编造 ID
2. 如果目标是信息性的（如"总结这个页面"），提取内容后立即使用 "done" 操作
3. 在思考过程中要简洁明了
4. 如果元素不在视口内（inViewport: false），先滚动到该元素附近
5. **重要：检查执行历史，避免重复操作同一个元素（elementId）。如果历史中显示已经点击过某个 elementId，且操作成功，不要再点击同一个元素。**
6. **如果点击操作后页面没有明显变化（elementCountChanged: false），说明操作可能无效，应该尝试其他方法或等待更长时间。**
7. 如果连续失败，尝试不同的策略
8. 如果操作成功但目标未达成，检查是否有新的元素出现（如弹窗、表单等），优先操作新出现的元素
9. 必须返回有效的 JSON 对象，格式：{"thought": "...", "action": {...}}`;

    // 构建 User Prompt（包含目标和历史）
    // 包含更详细的历史信息，特别是 elementId，避免重复操作
    const historySummary = this.currentContext.history
      .slice(-5) // 只保留最近 5 步
      .map(h => {
        const summary: any = {
          step: h.stepId,
          action: h.action.type,
          success: h.result?.success,
          error: h.result?.error
        };
        
        // 对于点击和输入操作，记录 elementId，避免重复操作
        if (h.action.type === 'click' && 'elementId' in h.action) {
          summary.elementId = (h.action as any).elementId;
        }
        if (h.action.type === 'type' && 'elementId' in h.action) {
          summary.elementId = (h.action as any).elementId;
        }
        
        // 记录页面变化信息
        if (h.result?.result?.elementCountChanged) {
          summary.pageChanged = true;
        }
        
        return summary;
      });

    // 简化元素树（只保留关键信息，避免 token 过多）
    const simplifiedElements = domSnapshot
      .slice(0, 50) // 限制元素数量
      .map(el => ({
        id: el.id,
        tag: el.tagName,
        text: el.text?.substring(0, 30), // 截断文本
        label: el.ariaLabel,
        type: el.type,
        inViewport: el.inViewport,
        disabled: el.disabled
      }));

    const userPrompt = `目标: ${this.currentContext.goal}

执行历史（最近 ${historySummary.length} 步）:
${JSON.stringify(historySummary, null, 2)}

⚠️ 特别注意：
- 如果历史中显示已经成功点击过某个 elementId，不要再点击同一个 elementId
- 如果点击后 pageChanged 为 false，说明操作可能无效，需要尝试其他方法
- 检查是否有新的元素出现（如弹窗、表单等），优先操作新元素

当前页面交互元素（共 ${domSnapshot.length} 个，显示前 ${simplifiedElements.length} 个）:
${JSON.stringify(simplifiedElements, null, 2)}

下一步应该做什么？请直接返回 JSON 对象（不要使用 markdown 代码块），格式：
{
  "thought": "你的思考过程（必须说明为什么选择这个操作，以及如何避免重复操作）",
  "action": { "type": "...", ... }
}

记住：直接返回 JSON，不要添加任何其他文字或代码块标记。`;

    // 调用 ApiService
    const apiService = ApiService.getInstance();
    const response = await apiService.chatAgent({
      systemPrompt,
      userPrompt,
      temperature: 0.3 // 较低温度以保证决策稳定性
    });

    // 解析 JSON
    try {
      // 尝试提取 JSON（可能被 markdown 代码块包裹）
      let jsonStr = response.trim();
      
      // 移除可能的 markdown 代码块标记
      if (jsonStr.startsWith('```')) {
        const lines = jsonStr.split('\n');
        const startIdx = lines.findIndex(l => l.includes('{'));
        const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('}'));
        if (startIdx >= 0 && endIdx >= 0) {
          jsonStr = lines.slice(startIdx, endIdx + 1).join('\n');
        }
      }
      
      // 提取 JSON 对象
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        // 验证 action 格式
        if (!result.action || !result.action.type) {
          throw new Error("Invalid action format");
        }
        
        return {
          thought: result.thought || "思考中...",
          action: result.action as AgentAction
        };
      }
      
      throw new Error("No JSON found in response");
    } catch (e) {
      console.error("Failed to parse LLM response:", response);
      console.error("Parse error:", e);
      
      // 返回安全的默认操作
      return {
        thought: "解析响应失败，任务可能无法继续",
        action: { 
          type: 'done', 
          text: "抱歉，无法理解 AI 的响应。请重试或简化任务描述。",
          reason: "LLM 响应解析失败"
        }
      };
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(errorMsg: string): boolean {
    const retryablePatterns = [
      "PORT_CLOSED",
      "port closed",
      "Content Script 未就绪",
      "消息超时",
      "timeout",
      "网络错误",
      "连接失败",
    ];
    
    return retryablePatterns.some(pattern => 
      errorMsg.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * 获取重试次数
   */
  private getRetryCount(stepId: number): number {
    if (!this.currentContext) return 0;
    
    const step = this.currentContext.history.find(h => h.stepId === stepId);
    return step?.retryCount || 0;
  }

  /**
   * 带退避的重试
   */
  private async retryWithBackoff(stepId: number, retryCount: number): Promise<void> {
    // 指数退避：1s, 2s, 4s
    const delay = Math.min(1000 * Math.pow(2, retryCount), 4000);
    console.log(`⏳ 等待 ${delay}ms 后重试...`);
    
    await new Promise(r => setTimeout(r, delay));
    
    // 使用持久连接，不需要等待就绪（连接会自动管理）
    const { persistentConnection } = await import("../utils/persistentConnection");
    if (!persistentConnection.isConnected(this.currentContext!.tabId)) {
      console.log("⏳ 等待 Content Script 连接建立...");
      // 等待连接建立（最多 5 秒）
      let waited = 0;
      while (waited < 5000 && !persistentConnection.isConnected(this.currentContext!.tabId)) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waited += 500;
      }
      if (persistentConnection.isConnected(this.currentContext!.tabId)) {
        console.log("✅ Content Script 连接已建立");
      } else {
        console.warn("⚠️ Content Script 连接等待超时，但继续重试");
      }
    }
    
    // 更新重试计数
    const step = this.currentContext!.history.find(h => h.stepId === stepId);
    if (step) {
      step.retryCount = (step.retryCount || 0) + 1;
    }
  }

  /**
   * 尝试降级策略
   */
  private async tryFallbackStrategy(
    originalAction: AgentAction,
    errorMsg: string
  ): Promise<ToolExecutionResult | null> {
    // 如果点击失败，尝试等待元素后再点击
    if (originalAction.type === "click" && errorMsg.includes("element")) {
      console.log("🔄 尝试降级：等待元素后重试点击");
      const { toolExecutor } = await import("./toolExecutor");
      
      // 先等待元素
      const waitResult = await toolExecutor.execute({
        type: "wait_for_element",
        elementId: (originalAction as any).elementId,
        timeout: 5000,
      });
      
      if (waitResult.success) {
        // 再次尝试点击
        return await toolExecutor.execute(originalAction);
      }
    }
    
    // 如果导航失败，尝试使用 execute_script 导航
    if (originalAction.type === "navigate") {
      console.log("🔄 尝试降级：使用脚本导航");
      const { toolExecutor } = await import("./toolExecutor");
      
      return await toolExecutor.execute({
        type: "execute_script",
        script: `window.location.href = "${(originalAction as any).url}";`,
        description: "使用脚本进行页面导航",
      });
    }
    
    return null;
  }

  /**
   * 通知前端 Agent 状态更新
   */
  private async notifyFrontend(type: string, data: any) {
    if (!this.currentContext) return;
    
    const tabId = this.currentContext.tabId;
    
    // 使用 try-catch 包装，避免端口关闭错误导致任务失败
    try {
      // 对于 step 类型，如果data中已经包含result，直接使用；否则从history中查找
      const updateData: any = { type };
      if (type === "step") {
        // 如果data中已经有result，说明是执行完成后的通知
        if (data.result) {
          updateData.data = data;
        } else {
          // 否则从history中查找执行结果
          const step = this.currentContext.history.find(h => h.stepId === data.stepId);
          if (step && step.result) {
            updateData.data = {
              ...data,
              result: step.result, // 包含执行结果
            };
          } else {
            updateData.data = data;
          }
        }
      } else {
        updateData.data = data;
      }
      
      // 使用持久连接发送 agentUpdate（更稳定）
      const { persistentConnection } = await import("../utils/persistentConnection");
      try {
        await persistentConnection.sendMessage(tabId, {
          action: "agentUpdate",
          data: updateData,
        }, 10000); // 10秒超时，agentUpdate 不需要等待响应
      } catch (error: any) {
        // 静默忽略错误（agentUpdate 是通知性的，失败不影响主流程）
        const errorMsg = error.message || String(error);
        if (!errorMsg.includes("PORT_CLOSED") && !errorMsg.includes("连接超时")) {
          console.warn("发送 agentUpdate 失败:", errorMsg);
        }
      }
    } catch (error) {
      console.warn("发送 agentUpdate 异常:", error);
    }
  }

  /**
   * 获取当前任务状态（用于调试）
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentStep: this.currentContext?.currentStep || 0,
      maxSteps: this.currentContext?.maxSteps || 0,
      historyLength: this.currentContext?.history.length || 0
    };
  }
}

export const agentService = AgentService.getInstance();
