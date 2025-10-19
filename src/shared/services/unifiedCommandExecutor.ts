import { CommandExecutionResult, CommandHandler } from "../types/commandTypes";
import { CommandParser } from "./commandParser";
import { ContextManager } from "./contextManager";
import { EnhancedAISystem } from "./enhancedAISystem";
import { appActions } from "../stores/appStore";
import { BrowserControlService } from "./browserControlService";
import { analyzeNetworkRequests } from "../utils/networkAnalyzer";

export class UnifiedCommandExecutor {
  private static instance: UnifiedCommandExecutor;
  private commandParser: CommandParser;
  private contextManager: ContextManager;
  private enhancedAI: EnhancedAISystem;
  private isInitialized = false;

  private constructor() {
    this.commandParser = CommandParser.getInstance();
    this.contextManager = ContextManager.getInstance();
    this.enhancedAI = EnhancedAISystem.getInstance();
  }

  static getInstance(): UnifiedCommandExecutor {
    if (!UnifiedCommandExecutor.instance) {
      UnifiedCommandExecutor.instance = new UnifiedCommandExecutor();
    }
    return UnifiedCommandExecutor.instance;
  }

  // 初始化命令执行器
  initialize(): void {
    if (this.isInitialized) return;

    console.log("🔧 开始初始化命令执行器...");
    this.registerDirectCommands();
    this.isInitialized = true;
    console.log("✅ 命令执行器初始化完成");
  }

  // 注册直接命令
  private registerDirectCommands(): void {
    console.log("📝 开始注册直接命令...");

    // 清空消息
    this.commandParser.registerCommand(
      "^(清空|清除|清空消息|清除消息|clear|clear messages)$",
      this.createCommandHandler(
        "clearMessages",
        "清空消息",
        this.handleClearMessages.bind(this)
      ),
      100
    );
    console.log("✅ 注册清空消息命令");

    // 获取页面内容
    this.commandParser.registerCommand(
      "^(获取页面|获取内容|页面内容|page content|get page)$",
      this.createCommandHandler(
        "getPageContent",
        "获取页面内容",
        this.handleGetPageContent.bind(this)
      ),
      90
    );

    // 撤销浏览器控制
    this.commandParser.registerCommand(
      "^(撤销|撤销操作|undo|撤销浏览器控制)$",
      this.createCommandHandler(
        "undoBrowserControls",
        "撤销浏览器控制",
        this.handleUndoBrowserControls.bind(this)
      ),
      80
    );

    // 重新拉取API数据
    this.commandParser.registerCommand(
      "^(重新拉取|refetch|拉取数据|刷新数据|refresh data)$",
      this.createCommandHandler(
        "refetchData",
        "重新拉取API数据",
        this.handleRefetchData.bind(this)
      ),
      80
    );
    console.log("✅ 注册重新拉取API数据命令");

    // 显示帮助
    this.commandParser.registerCommand(
      "^(帮助|help|命令|commands)$",
      this.createCommandHandler(
        "showHelp",
        "显示帮助",
        this.handleShowHelp.bind(this)
      ),
      60
    );
  }

  // 创建命令处理器
  private createCommandHandler(
    name: string,
    description: string,
    handler: (args: any) => Promise<any>
  ): CommandHandler {
    // 创建一个包装函数，而不是直接修改原函数
    const commandHandler = async (args: any) => {
      return await handler(args);
    };

    // 使用 Object.defineProperty 来设置只读属性
    Object.defineProperty(commandHandler, "name", {
      value: name,
      writable: false,
      enumerable: true,
      configurable: true,
    });

    Object.defineProperty(commandHandler, "description", {
      value: description,
      writable: false,
      enumerable: true,
      configurable: true,
    });

    return commandHandler as CommandHandler;
  }

  // 执行命令
  async executeCommand(input: string): Promise<CommandExecutionResult> {
    console.log("🚀 执行命令:", input);
    const commandResult = this.commandParser.parseCommand(input);
    console.log("🔍 命令解析结果:", commandResult);

    if (commandResult.type === "direct" && commandResult.command) {
      console.log("✅ 匹配到直接命令:", commandResult.command.name);
      try {
        const result = await commandResult.command(commandResult.args);
        this.commandParser.addToHistory(input);
        console.log("✅ 命令执行成功:", result);
        return {
          success: true,
          type: "direct",
          result,
          message: this.formatSuccessMessage(
            commandResult.command.name,
            result
          ),
        };
      } catch (error) {
        console.log("❌ 直接命令执行失败:", error);

        // 所有直接命令失败时都直接返回错误信息，不回退到AI
        return {
          success: false,
          type: "direct",
          result: null,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    } else {
      console.log("🤖 未匹配到直接命令，使用AI处理");
      // 直接使用AI处理
      return await this.handleAICommand(input);
    }
  }

  // AI命令处理
  private async handleAICommand(
    input: string
  ): Promise<CommandExecutionResult> {
    const smartContext = await this.contextManager.buildSmartContext(input);

    // 直接发送到background script进行流式处理
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "generateAnswer",
          data: {
            question: smartContext.question,
            pageContent: smartContext.pageContent.text,
            conversationHistory: smartContext.conversationHistory,
            url: smartContext.metadata.url,
            networkAnalysis: smartContext.pageContent.networkAnalysis,
            domStructure: smartContext.pageContent.domStructure,
            tabId: "current", // 添加标签页ID参数
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response.success) {
            // 对于AI命令，不返回消息，让流式响应处理
            resolve({
              success: true,
              type: "ai",
              result: { content: "" },
              message: "", // 不返回消息，避免重复显示
            });
          } else {
            reject(new Error(response.error || "AI请求失败"));
          }
        }
      );
    });
  }

  // 回退到AI处理
  private async fallbackToAI(
    input: string,
    error: Error
  ): Promise<CommandExecutionResult> {
    const smartContext = await this.contextManager.buildSmartContext(input);

    // 直接发送到background script进行流式处理
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "generateAnswer",
          data: {
            question: smartContext.question,
            pageContent: smartContext.pageContent.text,
            conversationHistory: smartContext.conversationHistory,
            url: smartContext.metadata.url,
            networkAnalysis: smartContext.pageContent.networkAnalysis,
            domStructure: smartContext.pageContent.domStructure,
            tabId: "current", // 添加标签页ID参数
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response.success) {
            // 对于AI命令，不返回消息，让流式响应处理
            resolve({
              success: true,
              type: "ai_fallback",
              result: { content: "" },
              message: "", // 不返回消息，避免重复显示
            });
          } else {
            reject(new Error(response.error || "AI请求失败"));
          }
        }
      );
    });
  }

  // 获取命令建议
  getCommandSuggestions(prefix: string): string[] {
    return this.commandParser.getCommandSuggestions(prefix);
  }

  // 格式化成功消息
  private formatSuccessMessage(commandName: string, result: any): string {
    // 特殊命令需要显示具体内容
    if (commandName === "showHelp" && result?.helpText) {
      return result.helpText;
    }

    if (commandName === "getPageContent" && result?.pageContent) {
      return "✅ 已获取页面内容，包含文本、结构和元数据";
    }

    if (commandName === "refetchData" && result?.refetchResults) {
      const successCount = result.successCount || 0;
      const totalCount = result.totalCount || 0;
      if (successCount === totalCount) {
        return `✅ 已成功重新拉取 ${successCount} 个API端点，获取最新数据`;
      } else {
        return `⚠️ 已重新拉取 ${successCount}/${totalCount} 个API端点，${
          totalCount - successCount
        } 个失败`;
      }
    }

    const messages = {
      clearMessages: "✅ 已清空所有消息",
      undoBrowserControls: "✅ 已撤销所有浏览器控制操作",
    };

    return messages[commandName as keyof typeof messages] || "✅ 命令执行成功";
  }

  // 直接命令处理器
  private async handleClearMessages(): Promise<any> {
    appActions.clearMessages();
    return { cleared: true };
  }

  private async handleGetPageContent(): Promise<any> {
    const pageContent = await this.contextManager.getPageContent(true);

    return {
      pageContent,
      timestamp: Date.now(),
    };
  }

  private async handleUndoBrowserControls(): Promise<any> {
    if (!BrowserControlService.isSupported()) {
      throw new Error("浏览器控制功能不可用");
    }

    const browserControl = BrowserControlService.getInstance();
    await browserControl.undoAllActions();

    return { undone: true };
  }

  private async handleRefetchData(): Promise<any> {
    const networkAnalysis = await analyzeNetworkRequests();
    console.log("🔍 网络分析结果:", networkAnalysis);

    // 从apiCalls中过滤GET请求
    const getEndpoints = networkAnalysis.apiCalls.filter(
      (req) => req.method === "GET"
    );

    console.log("🔍 找到的GET端点:", getEndpoints);

    if (getEndpoints.length === 0) {
      // 提供更友好的错误信息，包含所有可用的端点信息
      const allEndpoints = networkAnalysis.apiCalls.map((req) => ({
        url: req.url,
        method: req.method,
        status: req.status,
      }));

      console.log("🔍 所有检测到的端点:", allEndpoints);

      if (allEndpoints.length === 0) {
        throw new Error(
          "当前页面没有检测到任何API请求。请确保页面已完全加载并包含网络请求。"
        );
      } else {
        const methods = [...new Set(allEndpoints.map((ep) => ep.method))];
        const nonGetEndpoints = allEndpoints.filter(
          (ep) => ep.method !== "GET"
        );

        if (nonGetEndpoints.length > 0) {
          // 如果有其他类型的请求，提供建议
          throw new Error(
            `当前页面没有检测到GET请求。检测到 ${
              allEndpoints.length
            } 个其他类型的请求 (${methods.join(
              ", "
            )})。GET请求通常用于获取数据，其他请求类型无法安全地重新执行。`
          );
        } else {
          throw new Error(
            `当前页面没有检测到GET请求。检测到的请求方法: ${methods.join(
              ", "
            )}。请尝试其他操作或等待页面加载更多内容。`
          );
        }
      }
    }

    // 重新拉取GET端点
    const refetchResults = [];
    for (const endpoint of getEndpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          let data;
          try {
            data = await response.json();
          } catch {
            data = await response.text();
          }
          refetchResults.push({
            url: endpoint.url,
            status: response.status,
            data: data,
            success: true,
          });
        } else {
          refetchResults.push({
            url: endpoint.url,
            status: response.status,
            error: `HTTP ${response.status}`,
            success: false,
          });
        }
      } catch (error) {
        refetchResults.push({
          url: endpoint.url,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    }

    return {
      endpoints: getEndpoints,
      refetchResults: refetchResults,
      successCount: refetchResults.filter((r) => r.success).length,
      totalCount: refetchResults.length,
    };
  }

  private async handleShowHelp(): Promise<any> {
    const commands = this.commandParser.getRegisteredCommands();

    // 生成更美观的帮助文本
    const helpText = `# 🤖 智能网页助手

## 📋 快捷命令

${commands
  .map((cmd, index) => {
    const examples = this.getCommandExamples(cmd.handler.name);
    return `### ${index + 1}. ${cmd.handler.description}
**触发词：** ${examples.join("、")}
**功能：** ${this.getCommandDescription(cmd.handler.name)}`;
  })
  .join("\n\n")}

## 💬 智能对话

除了快捷命令，你也可以直接输入问题，我会通过AI来回答：
- 分析网页内容和数据
- 控制页面元素（隐藏广告、修改样式等）
- 回答各种问题
- 执行复杂操作

## 🚀 使用提示

- 直接输入命令关键词即可触发
- 支持中英文混合输入
- 所有功能都支持自然语言表达

## 📝 功能说明

- **获取页面内容**：提取页面的文本、结构和元数据，用于内容分析
- **重新拉取API数据**：重新执行页面中的API请求，获取最新动态数据
- **撤销浏览器控制**：恢复之前对页面元素的所有修改操作
- **清空消息**：重置对话历史，开始新的对话`;

    return {
      helpText,
    };
  }

  // 获取命令示例
  private getCommandExamples(commandName: string): string[] {
    const examples = {
      clearMessages: [
        "清空",
        "清除",
        "清空消息",
        "清除消息",
        "clear",
        "clear messages",
      ],
      getPageContent: [
        "获取页面",
        "获取内容",
        "页面内容",
        "page content",
        "get page",
      ],
      undoBrowserControls: ["撤销", "撤销操作", "undo", "撤销浏览器控制"],
      refetchData: [
        "重新拉取",
        "refetch",
        "拉取数据",
        "刷新数据",
        "refresh data",
      ],
      showHelp: ["帮助", "help", "命令", "commands"],
    };
    return examples[commandName as keyof typeof examples] || [];
  }

  // 获取命令详细描述
  private getCommandDescription(commandName: string): string {
    const descriptions = {
      clearMessages: "清空当前对话中的所有消息，重新开始对话",
      getPageContent: "获取当前页面的文本内容、DOM结构和元数据，用于内容分析",
      undoBrowserControls: "撤销之前对页面元素的所有控制操作",
      refetchData: "重新执行页面中的API请求，获取最新的动态数据",
      showHelp: "显示所有可用命令和使用说明",
    };
    return (
      descriptions[commandName as keyof typeof descriptions] || "执行相关操作"
    );
  }

  // 清理资源
  cleanup(): void {
    this.contextManager.clearAllCache();
    this.commandParser.clearHistory();
  }
}
