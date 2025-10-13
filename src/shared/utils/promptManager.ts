// 智能提示词管理器
export interface PromptContext {
  contentType:
    | "news"
    | "technical"
    | "academic"
    | "product"
    | "social"
    | "documentation"
    | "general";
  userIntent:
    | "question"
    | "summary"
    | "analysis"
    | "explanation"
    | "comparison"
    | "general";
  contentLength: "short" | "medium" | "long";
  hasImages: boolean;
  hasLinks: boolean;
  hasTables: boolean;
  hasCode: boolean;
}

export interface PromptTemplate {
  system: string;
  user: string;
  examples?: string[];
}

export class PromptManager {
  private static instance: PromptManager;

  public static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  /**
   * 分析内容类型
   */
  public analyzeContentType(
    content: string,
    url: string
  ): PromptContext["contentType"] {
    const hostname = new URL(url).hostname.toLowerCase();

    // 基于URL判断
    if (
      hostname.includes("news") ||
      hostname.includes("cnn") ||
      hostname.includes("bbc") ||
      hostname.includes("nytimes") ||
      hostname.includes("reuters")
    ) {
      return "news";
    }

    if (
      hostname.includes("github") ||
      hostname.includes("stackoverflow") ||
      hostname.includes("dev.to") ||
      hostname.includes("medium")
    ) {
      return "technical";
    }

    if (
      hostname.includes("arxiv") ||
      hostname.includes("scholar") ||
      hostname.includes("research") ||
      hostname.includes("academic")
    ) {
      return "academic";
    }

    if (
      hostname.includes("amazon") ||
      hostname.includes("shop") ||
      hostname.includes("product") ||
      hostname.includes("store")
    ) {
      return "product";
    }

    if (
      hostname.includes("twitter") ||
      hostname.includes("facebook") ||
      hostname.includes("instagram") ||
      hostname.includes("reddit")
    ) {
      return "social";
    }

    if (
      hostname.includes("docs") ||
      hostname.includes("documentation") ||
      hostname.includes("manual") ||
      hostname.includes("guide")
    ) {
      return "documentation";
    }

    // 基于内容特征判断
    if (
      content.includes("研究") ||
      content.includes("实验") ||
      content.includes("数据") ||
      content.includes("论文") ||
      content.includes("学术")
    ) {
      return "academic";
    }

    if (
      content.includes("代码") ||
      content.includes("API") ||
      content.includes("技术") ||
      content.includes("开发") ||
      content.includes("编程")
    ) {
      return "technical";
    }

    if (
      content.includes("新闻") ||
      content.includes("报道") ||
      content.includes("事件") ||
      content.includes("发生")
    ) {
      return "news";
    }

    return "general";
  }

  /**
   * 分析用户意图
   */
  public analyzeUserIntent(question: string): PromptContext["userIntent"] {
    const questionLower = question.toLowerCase();

    if (
      questionLower.includes("总结") ||
      questionLower.includes("概括") ||
      questionLower.includes("要点") ||
      questionLower.includes("摘要")
    ) {
      return "summary";
    }

    if (
      questionLower.includes("分析") ||
      questionLower.includes("解释") ||
      questionLower.includes("为什么") ||
      questionLower.includes("如何")
    ) {
      return "analysis";
    }

    if (
      questionLower.includes("比较") ||
      questionLower.includes("对比") ||
      questionLower.includes("区别") ||
      questionLower.includes("差异")
    ) {
      return "comparison";
    }

    if (
      questionLower.includes("什么是") ||
      questionLower.includes("定义") ||
      questionLower.includes("含义") ||
      questionLower.includes("概念")
    ) {
      return "explanation";
    }

    return "question";
  }

  /**
   * 分析内容特征
   */
  public analyzeContentFeatures(content: string): Partial<PromptContext> {
    return {
      contentLength:
        content.length < 1000
          ? "short"
          : content.length < 5000
          ? "medium"
          : "long",
      hasImages: content.includes("[图片:") || content.includes("<img"),
      hasLinks: content.includes("](") || content.includes("<a href"),
      hasTables: content.includes("|") || content.includes("<table"),
      hasCode: content.includes("```") || content.includes("<code"),
    };
  }

  /**
   * 生成智能提示词
   */
  public generatePrompt(
    question: string,
    content: string,
    url: string
  ): PromptTemplate {
    const contentType = this.analyzeContentType(content, url);
    const userIntent = this.analyzeUserIntent(question);
    const features = this.analyzeContentFeatures(content);

    const context: PromptContext = {
      contentType,
      userIntent,
      contentLength: features.contentLength || "medium",
      hasImages: features.hasImages || false,
      hasLinks: features.hasLinks || false,
      hasTables: features.hasTables || false,
      hasCode: features.hasCode || false,
    };

    return this.buildPromptTemplate(context, question, content);
  }

  /**
   * 构建提示词模板
   */
  private buildPromptTemplate(
    context: PromptContext,
    question: string,
    content: string
  ): PromptTemplate {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(context, question, content);

    return {
      system: systemPrompt,
      user: userPrompt,
      examples: this.getExamples(context),
    };
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(context: PromptContext): string {
    const basePrompt = `你是一个专业的AI助手，专门帮助用户理解和分析网页内容。你的任务是：

## 核心能力
- 准确理解网页内容的核心信息
- 根据用户问题提供精准、相关的回答
- 使用Markdown格式组织回答，确保可读性
- 提供结构化的分析和总结

## 回答原则
1. **准确性**：基于提供的内容回答，不编造信息
2. **相关性**：回答要与用户问题直接相关
3. **完整性**：提供充分的信息支持你的观点
4. **可读性**：使用清晰的逻辑结构和格式
5. **实用性**：提供可操作的建议和见解`;

    const contentTypeGuidance = this.getContentTypeGuidance(
      context.contentType
    );
    const userIntentGuidance = this.getUserIntentGuidance(context.userIntent);
    const featureGuidance = this.getFeatureGuidance(context);

    return `${basePrompt}

${contentTypeGuidance}

${userIntentGuidance}

${featureGuidance}

请根据以上指导原则回答用户的问题。`;
  }

  /**
   * 获取内容类型指导
   */
  private getContentTypeGuidance(
    contentType: PromptContext["contentType"]
  ): string {
    const guidance = {
      news: `## 新闻内容处理
- 重点提取事实、时间、地点、人物等关键信息
- 区分事实陈述和观点表达
- 关注事件的影响和意义
- 提供客观、平衡的分析`,

      technical: `## 技术内容处理
- 注重准确性和实用性
- 解释技术概念和实现原理
- 提供代码示例和最佳实践
- 关注技术方案的优缺点`,

      academic: `## 学术内容处理
- 关注研究方法和结论
- 分析数据支撑和论证逻辑
- 评估研究的局限性和意义
- 提供批判性思考`,

      product: `## 产品内容处理
- 突出产品特性和价值主张
- 分析目标用户和使用场景
- 比较竞品和差异化优势
- 提供购买建议和注意事项`,

      social: `## 社交媒体内容处理
- 识别主要观点和情感倾向
- 分析讨论热点和争议点
- 提供多角度观点
- 注意信息的真实性和时效性`,

      documentation: `## 文档内容处理
- 提供清晰的使用说明
- 解释概念和术语
- 提供实际应用示例
- 关注常见问题和解决方案`,

      general: `## 通用内容处理
- 提取核心信息和关键观点
- 提供结构化的分析
- 关注内容的逻辑性和完整性
- 提供实用的见解和建议`,
    };

    return guidance[contentType];
  }

  /**
   * 获取用户意图指导
   */
  private getUserIntentGuidance(
    userIntent: PromptContext["userIntent"]
  ): string {
    const guidance = {
      question: `## 问答模式
- 直接回答用户的具体问题
- 提供详细的信息和解释
- 引用相关内容支持回答
- 如果信息不足，明确说明`,

      summary: `## 总结模式
- 提取3-5个核心要点
- 保持客观和简洁
- 突出关键信息和结论
- 使用列表或结构化格式`,

      analysis: `## 分析模式
- 深入分析内容的各个方面
- 提供多角度的见解
- 解释原因和影响
- 提供批判性思考`,

      explanation: `## 解释模式
- 用通俗易懂的语言解释概念
- 提供背景信息和上下文
- 使用类比和示例
- 确保解释的准确性`,

      comparison: `## 比较模式
- 列出相似点和不同点
- 提供客观的对比分析
- 突出各自的优势和劣势
- 给出选择建议`,

      general: `## 通用模式
- 根据内容特点调整回答方式
- 提供全面而有用的信息
- 保持回答的相关性和实用性`,
    };

    return guidance[userIntent];
  }

  /**
   * 获取内容特征指导
   */
  private getFeatureGuidance(context: PromptContext): string {
    let guidance = "";

    if (context.hasImages) {
      guidance += `- 如果内容包含图片，请描述图片的相关信息\n`;
    }

    if (context.hasLinks) {
      guidance += `- 如果内容包含链接，请说明链接的相关性和价值\n`;
    }

    if (context.hasTables) {
      guidance += `- 如果内容包含表格，请分析表格数据的关键信息\n`;
    }

    if (context.hasCode) {
      guidance += `- 如果内容包含代码，请解释代码的功能和用途\n`;
    }

    if (context.contentLength === "long") {
      guidance += `- 内容较长，请重点关注核心信息和关键观点\n`;
    } else if (context.contentLength === "short") {
      guidance += `- 内容较短，请尽可能提供详细的分析和解释\n`;
    }

    return guidance ? `## 内容特征处理\n${guidance}` : "";
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(
    context: PromptContext,
    question: string,
    content: string
  ): string {
    const contentInfo = this.getContentInfo(context, content);

    return `基于以下网页内容回答用户问题：

${contentInfo}

**用户问题：** ${question}

请根据内容类型（${context.contentType}）和用户意图（${context.userIntent}）提供精准、有用的回答。`;
  }

  /**
   * 获取内容信息
   */
  private getContentInfo(context: PromptContext, content: string): string {
    let info = `**网页内容：**\n${content}`;

    if (context.hasImages) {
      info += `\n\n*注：内容包含图片信息`;
    }

    if (context.hasLinks) {
      info += `\n\n*注：内容包含相关链接`;
    }

    if (context.hasTables) {
      info += `\n\n*注：内容包含表格数据`;
    }

    if (context.hasCode) {
      info += `\n\n*注：内容包含代码示例`;
    }

    return info;
  }

  /**
   * 获取示例
   */
  private getExamples(context: PromptContext): string[] {
    const examples = {
      news: [
        "Q: 这篇新闻的主要观点是什么？\nA: 根据报道，主要观点包括...",
        "Q: 事件的影响如何？\nA: 从多个角度来看，该事件的影响体现在...",
      ],
      technical: [
        "Q: 这个技术方案有什么优势？\nA: 该技术方案的主要优势包括...",
        "Q: 如何实现这个功能？\nA: 实现该功能需要以下步骤...",
      ],
      academic: [
        "Q: 研究的主要结论是什么？\nA: 研究得出以下主要结论...",
        "Q: 研究方法是否可靠？\nA: 从研究设计来看，该方法...",
      ],
    };

    return examples[context.contentType] || [];
  }
}

// 导出单例实例
export const promptManager = PromptManager.getInstance();

// 便捷函数
export function generateSmartPrompt(
  question: string,
  content: string,
  url: string
): PromptTemplate {
  return promptManager.generatePrompt(question, content, url);
}
