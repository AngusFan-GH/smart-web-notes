import {
  CommandPattern,
  CommandResult,
  CommandHandler,
} from "../types/commandTypes";

export class CommandParser {
  private static instance: CommandParser;
  private commandPatterns = new Map<string, CommandPattern>();
  private commandHistory: string[] = [];
  private maxHistorySize = 50;

  private constructor() {}

  static getInstance(): CommandParser {
    if (!CommandParser.instance) {
      CommandParser.instance = new CommandParser();
    }
    return CommandParser.instance;
  }

  // 注册命令模式
  registerCommand(
    pattern: string,
    handler: CommandHandler,
    priority = 0
  ): void {
    this.commandPatterns.set(pattern, {
      pattern: new RegExp(pattern, "i"),
      handler,
      priority,
    });
  }

  // 解析用户输入
  parseCommand(input: string): CommandResult {
    const normalizedInput = this.normalizeInput(input);

    // 按优先级排序匹配
    const sortedPatterns = Array.from(this.commandPatterns.values()).sort(
      (a, b) => b.priority - a.priority
    );

    for (const { pattern, handler } of sortedPatterns) {
      const match = normalizedInput.match(pattern);
      if (match) {
        return {
          type: "direct",
          command: handler,
          args: this.extractArgs(match),
          confidence: this.calculateConfidence(match),
        };
      }
    }

    return {
      type: "ai",
      command: null,
      args: null,
      confidence: 0,
    };
  }

  // 标准化输入
  private normalizeInput(input: string): string {
    return input.trim().toLowerCase();
  }

  // 提取参数
  private extractArgs(match: RegExpMatchArray): any {
    return {
      fullMatch: match[0],
      groups: match.slice(1),
      input: match.input,
    };
  }

  // 计算置信度
  private calculateConfidence(match: RegExpMatchArray): number {
    const matchLength = match[0].length;
    const inputLength = match.input.length;
    return Math.min(matchLength / inputLength, 1);
  }

  // 添加命令到历史
  addToHistory(command: string): void {
    this.commandHistory.unshift(command);
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.pop();
    }
  }

  // 获取命令建议
  getCommandSuggestions(prefix: string): string[] {
    if (!prefix.trim()) {
      return this.commandHistory.slice(0, 5);
    }

    return this.commandHistory
      .filter((cmd) => cmd.toLowerCase().includes(prefix.toLowerCase()))
      .slice(0, 5);
  }

  // 获取所有注册的命令
  getRegisteredCommands(): Array<{
    pattern: string;
    handler: CommandHandler;
    priority: number;
  }> {
    return Array.from(this.commandPatterns.entries()).map(
      ([pattern, config]) => ({
        pattern,
        handler: config.handler,
        priority: config.priority,
      })
    );
  }

  // 清理历史
  clearHistory(): void {
    this.commandHistory = [];
  }
}
