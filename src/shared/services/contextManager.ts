import {
  SmartContext,
  CachedContent,
  ConversationMessage,
  PageContent,
  ExtractedContent,
} from "../types/commandTypes";
import { contentExtractor } from "../utils/contentExtractor";
import { analyzeNetworkRequests } from "../utils/networkAnalyzer";

export class ContextManager {
  private static instance: ContextManager;
  private pageContentCache = new Map<string, CachedContent>();
  private conversationCache: ConversationMessage[] = [];
  private maxCacheSize = 50;
  private maxConversationHistory = 20;
  private cacheTimeout = 300000; // 5分钟

  private constructor() {}

  static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }

  // 智能获取页面内容
  async getPageContent(forceRefresh = false): Promise<PageContent> {
    const url = window.location.href;
    const pageVersion = this.getPageVersion();
    const cacheKey = `${url}_${pageVersion}`;

    if (!forceRefresh && this.pageContentCache.has(cacheKey)) {
      const cached = this.pageContentCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.content;
      }
    }

    // 提取页面内容
    const content: ExtractedContent = await contentExtractor.extractContent();
    const networkAnalysis = await analyzeNetworkRequests();

    const pageContent: PageContent = {
      text: content.text,
      structure: content.structure,
      networkAnalysis: networkAnalysis,
      domStructure: content.domStructure,
      metadata: content.metadata,
    };

    this.pageContentCache.set(cacheKey, {
      content: pageContent,
      timestamp: Date.now(),
    });

    this.cleanupCache();
    return pageContent;
  }

  // 智能压缩对话历史
  compressConversationHistory(
    messages: ConversationMessage[]
  ): ConversationMessage[] {
    if (messages.length <= this.maxConversationHistory) {
      return messages;
    }

    // 保留系统消息、重要消息和最近消息
    const systemMessages = messages.filter((msg) => msg.role === "system");
    const importantMessages = messages.filter(
      (msg) =>
        msg.content.includes("重要") ||
        msg.content.includes("错误") ||
        msg.content.includes("成功") ||
        msg.content.includes("失败")
    );
    const recentMessages = messages.slice(-10);

    const compressed = [
      ...systemMessages,
      ...importantMessages,
      ...recentMessages,
    ].slice(-this.maxConversationHistory);

    return this.deduplicateMessages(compressed);
  }

  // 去重消息
  private deduplicateMessages(
    messages: ConversationMessage[]
  ): ConversationMessage[] {
    const seen = new Set<string>();
    return messages.filter((msg) => {
      const key = `${msg.role}_${msg.content}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // 构建智能上下文
  async buildSmartContext(question: string): Promise<SmartContext> {
    const pageContent = await this.getPageContent();
    const compressedHistory = this.compressConversationHistory(
      this.conversationCache
    );

    return {
      question,
      pageContent,
      conversationHistory: compressedHistory,
      contextVersion: this.generateContextVersion(),
      timestamp: Date.now(),
      metadata: {
        url: window.location.href,
        title: document.title,
        userAgent: navigator.userAgent,
      },
    };
  }

  // 更新对话缓存
  updateConversationCache(messages: ConversationMessage[]): void {
    this.conversationCache = messages;
  }

  // 获取页面版本（用于缓存失效）
  private getPageVersion(): string {
    // 简单的页面版本检测，可以基于DOM变化
    const body = document.body;
    if (body) {
      return body.innerHTML.length.toString();
    }
    return Date.now().toString();
  }

  // 生成上下文版本
  private generateContextVersion(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 缓存清理
  private cleanupCache(): void {
    if (this.pageContentCache.size > this.maxCacheSize) {
      const entries = Array.from(this.pageContentCache.entries());
      const toDelete = entries.slice(0, entries.length - this.maxCacheSize);
      toDelete.forEach(([key]) => this.pageContentCache.delete(key));
    }
  }

  // 清理过期缓存
  cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.pageContentCache.entries()) {
      if (now - cached.timestamp > this.cacheTimeout) {
        this.pageContentCache.delete(key);
      }
    }
  }

  // 获取缓存统计
  getCacheStats(): {
    size: number;
    maxSize: number;
    conversationCount: number;
  } {
    return {
      size: this.pageContentCache.size,
      maxSize: this.maxCacheSize,
      conversationCount: this.conversationCache.length,
    };
  }

  // 清理所有缓存
  clearAllCache(): void {
    this.pageContentCache.clear();
    this.conversationCache = [];
  }
}
