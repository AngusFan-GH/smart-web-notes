// 智能意图识别服务
import {
  aiIntentService,
  type AIIntentRequest,
  type AIIntentResponse,
} from "./aiIntentService";

export interface IntentRecognitionResult {
  intent: string;
  confidence: number;
  reasoning: string;
  needsFullHTML: boolean;
  timestamp?: number;
}

export interface IntentRecognitionRequest {
  question: string;
  context?: string;
  url?: string;
}

export class IntentRecognitionService {
  private static instance: IntentRecognitionService;
  private intentCache = new Map<string, IntentRecognitionResult>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
  private useAI = true; // 启用AI识别，提供更智能的意图理解

  private constructor() {}

  public static getInstance(): IntentRecognitionService {
    if (!IntentRecognitionService.instance) {
      IntentRecognitionService.instance = new IntentRecognitionService();
    }
    return IntentRecognitionService.instance;
  }

  /**
   * 识别用户意图（AI + 规则引擎混合）
   */
  public async recognizeIntent(
    request: IntentRecognitionRequest
  ): Promise<IntentRecognitionResult> {
    const cacheKey = this.generateCacheKey(request);

    // 检查缓存
    const cached = this.intentCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached;
    }

    // 清除过期缓存
    this.clearExpiredCache();

    let result: IntentRecognitionResult;

    // 优先使用规则引擎（快速、可靠、低成本）
    result = this.fallbackRuleBasedRecognition(request);

    // 如果规则引擎识别为"question"且启用了AI，则尝试AI识别
    if (this.useAI && result.intent === "question") {
      try {
        const aiResponse = await aiIntentService.recognizeIntent({
          question: request.question,
          context: request.context,
          url: request.url,
        });

        result = {
          intent: aiResponse.intent,
          confidence: aiResponse.confidence,
          reasoning: aiResponse.reasoning,
          needsFullHTML: aiResponse.needsFullHTML,
        };
      } catch (error) {
        console.warn("AI意图识别失败，保持规则引擎结果:", error);
        // 保持规则引擎的结果
      }
    }

    // 缓存结果
    this.intentCache.set(cacheKey, {
      ...result,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * 回退规则引擎识别（公共方法，供同步调用使用）
   */
  public fallbackRuleBasedRecognition(
    request: IntentRecognitionRequest
  ): IntentRecognitionResult {
    const question = request.question.toLowerCase();

    // 浏览器控制关键词
    const browserControlKeywords = [
      "隐藏",
      "删除",
      "移除",
      "清除",
      "清理",
      "修改",
      "改变",
      "改为",
      "改成",
      "替换",
      "更新",
      "添加",
      "插入",
      "高亮",
      "标记",
      "点击",
      "操作",
      "控制",
      "调整",
      "设置",
      "样式",
      "元素",
      "按钮",
      "链接",
      "图片",
      "广告",
      "弹窗",
      "侧边栏",
      "导航",
      "页脚",
      "页头",
      "菜单",
      "表单",
      "改为", // 新增：匹配"改为"关键词
      "改成", // 新增：匹配"改成"关键词
      "设置", // 新增：匹配"设置"关键词
      "配置", // 新增：匹配"配置"关键词
      "替换", // 新增：匹配"替换"关键词
      "更新", // 新增：匹配"更新"关键词
      "搜索", // 新增：匹配"搜索"关键词
      "查找", // 新增：匹配"查找"关键词
      "寻找", // 新增：匹配"寻找"关键词
      "筛选", // 新增：匹配"筛选"关键词
      "过滤", // 新增：匹配"过滤"关键词
      "选择", // 新增：匹配"选择"关键词
    ];

    // 总结关键词
    const summaryKeywords = [
      "总结",
      "概括",
      "要点",
      "摘要",
      "概述",
      "简述",
      "简要",
      "简短",
      "精简",
    ];

    // 分析关键词
    const analysisKeywords = [
      "分析",
      "解释",
      "为什么",
      "如何",
      "怎么",
      "原因",
      "原理",
      "机制",
    ];

    // 比较关键词
    const comparisonKeywords = [
      "比较",
      "对比",
      "区别",
      "差异",
      "不同",
      "相同",
      "相似",
      "类似",
    ];

    // 解释关键词
    const explanationKeywords = [
      "什么是",
      "定义",
      "含义",
      "概念",
      "意思",
      "解释",
      "说明",
      "介绍",
    ];

    // 检查浏览器控制意图
    const matchedKeywords = browserControlKeywords.filter((keyword) => {
      return question.includes(keyword);
    });

    if (matchedKeywords.length > 0) {
      console.log(
        "🔍 规则引擎识别到浏览器控制意图 - 匹配的关键词:",
        matchedKeywords
      );
      return {
        intent: "browser_control",
        confidence: 0.8,
        reasoning: `检测到浏览器操作相关关键词: ${matchedKeywords.join(", ")}`,
        needsFullHTML: true,
      };
    }

    // 检查总结意图
    if (summaryKeywords.some((keyword) => question.includes(keyword))) {
      return {
        intent: "summary",
        confidence: 0.8,
        reasoning: "检测到总结相关关键词",
        needsFullHTML: false,
      };
    }

    // 检查分析意图
    if (analysisKeywords.some((keyword) => question.includes(keyword))) {
      return {
        intent: "analysis",
        confidence: 0.8,
        reasoning: "检测到分析相关关键词",
        needsFullHTML: false,
      };
    }

    // 检查比较意图
    if (comparisonKeywords.some((keyword) => question.includes(keyword))) {
      return {
        intent: "comparison",
        confidence: 0.8,
        reasoning: "检测到比较相关关键词",
        needsFullHTML: false,
      };
    }

    // 检查解释意图
    if (explanationKeywords.some((keyword) => question.includes(keyword))) {
      return {
        intent: "explanation",
        confidence: 0.8,
        reasoning: "检测到解释相关关键词",
        needsFullHTML: false,
      };
    }

    // 默认问答意图
    console.log("规则引擎未匹配到任何意图，使用默认问答模式");
    return {
      intent: "question",
      confidence: 0.6,
      reasoning: "未检测到特定意图，使用默认问答模式",
      needsFullHTML: false,
    };
  }

  /**
   * 设置是否使用AI识别
   */
  public setUseAI(useAI: boolean): void {
    this.useAI = useAI;
  }

  /**
   * 获取当前配置
   */
  public getConfig(): { useAI: boolean; cacheSize: number } {
    return {
      useAI: this.useAI,
      cacheSize: this.intentCache.size,
    };
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: IntentRecognitionRequest): string {
    return `${request.question}_${request.url || "no_url"}_${
      request.context || "no_context"
    }`;
  }

  /**
   * 清除过期缓存
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.intentCache.entries()) {
      if (value.timestamp && now - value.timestamp > this.CACHE_DURATION) {
        this.intentCache.delete(key);
      }
    }
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.intentCache.clear();
  }

  /**
   * 获取缓存统计
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.intentCache.size,
      keys: Array.from(this.intentCache.keys()),
    };
  }
}

// 导出单例实例
export const intentRecognitionService = IntentRecognitionService.getInstance();
