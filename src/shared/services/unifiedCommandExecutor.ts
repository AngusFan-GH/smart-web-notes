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

    this.registerDirectCommands();
    this.isInitialized = true;
  }

  // 注册直接命令
  private registerDirectCommands(): void {
    // 清空消息
    this.commandParser.registerCommand(
      /^(清空|清除|清空消息|清除消息|clear|clear messages)$/i,
      this.createCommandHandler(
        "clearMessages",
        "清空消息",
        this.handleClearMessages.bind(this)
      ),
      100
    );

    // 获取数据
    this.commandParser.registerCommand(
      /^(获取数据|获取页面数据|get data|fetch data|拉取数据)$/i,
      this.createCommandHandler(
        "getData",
        "获取页面数据",
        this.handleGetData.bind(this)
      ),
      90
    );

    // 撤销浏览器控制
    this.commandParser.registerCommand(
      /^(撤销|撤销操作|undo|撤销浏览器控制)$/i,
      this.createCommandHandler(
        "undoBrowserControls",
        "撤销浏览器控制",
        this.handleUndoBrowserControls.bind(this)
      ),
      80
    );

    // 重新拉取GET端点
    this.commandParser.registerCommand(
      /^(重新拉取|refetch|重新获取端点|拉取端点)$/i,
      this.createCommandHandler(
        "refetchEndpoints",
        "重新拉取端点",
        this.handleRefetchEndpoints.bind(this)
      ),
      70
    );

    // 显示帮助
    this.commandParser.registerCommand(
      /^(帮助|help|命令|commands)$/i,
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
    const commandResult = this.commandParser.parseCommand(input);

    if (commandResult.type === "direct" && commandResult.command) {
      try {
        const result = await commandResult.command(commandResult.args);
        this.commandParser.addToHistory(input);
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
        // 直接命令失败，回退到AI处理
        return await this.fallbackToAI(input, error);
      }
    } else {
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

    if (commandName === "getData" && result?.pageContent) {
      return "✅ 已获取页面数据，包含内容分析和网络请求信息";
    }

    if (commandName === "refetchEndpoints" && result?.endpoints) {
      return `✅ 已重新拉取 ${result.endpoints.length} 个GET端点`;
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

  private async handleGetData(): Promise<any> {
    const pageContent = await this.contextManager.getPageContent(true);
    const networkAnalysis = await analyzeNetworkRequests();

    return {
      pageContent,
      networkAnalysis,
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

  private async handleRefetchEndpoints(): Promise<any> {
    const networkAnalysis = await analyzeNetworkRequests();
    const getEndpoints = networkAnalysis.endpoints.filter(
      (ep) => ep.method === "GET"
    );

    if (getEndpoints.length === 0) {
      throw new Error("没有可重新拉取的GET端点");
    }

    // 这里可以添加重新拉取端点的逻辑
    return { endpoints: getEndpoints };
  }

  private async handleShowHelp(): Promise<any> {
    const commands = this.commandParser.getRegisteredCommands();

    // 生成更美观的帮助文本
    const helpText = `# 🤖 智能网页助手 - 可用命令

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
- 所有功能都支持自然语言表达`;

    return {
      helpText,
    };
  }

  // 获取命令示例
  private getCommandExamples(commandName: string): string[] {
    const examples = {
      clearMessages: ["清空", "清除", "clear"],
      getData: ["获取数据", "get data", "拉取数据"],
      undoBrowserControls: ["撤销", "undo", "撤销操作"],
      refetchEndpoints: ["重新拉取", "refetch", "拉取端点"],
      showHelp: ["帮助", "help", "命令"],
    };
    return examples[commandName as keyof typeof examples] || [];
  }

  // 获取命令详细描述
  private getCommandDescription(commandName: string): string {
    const descriptions = {
      clearMessages: "清空当前对话中的所有消息，重新开始对话",
      getData: "获取当前页面的内容和网络请求数据，用于分析",
      undoBrowserControls: "撤销之前对页面元素的所有控制操作",
      refetchEndpoints: "重新拉取页面中的GET接口，获取最新数据",
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
