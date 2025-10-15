// 建议问题生成服务

// 声明chrome类型
declare const chrome: any;

export interface PageContext {
  url: string;
  title: string;
}

interface PageAnalysis {
  isGitHub: boolean;
  isStackOverflow: boolean;
  isZhihu: boolean;
  isJuejin: boolean;
  isDocumentation: boolean;
  isTutorial: boolean;
  isAPI: boolean;
  isError: boolean;
  isConfig: boolean;
  isBlog: boolean;
  isProduct: boolean;
  hasCode: boolean;
  hasData: boolean;
  hasImage: boolean;
  hasVideo: boolean;
}

export class SuggestedQuestionsService {
  /**
   * 智能分析页面内容并生成个性化问题
   */
  static generateQuestionsFromContent(
    content: string,
    context: PageContext
  ): string[] {
    const questions: string[] = [];
    const contentLower = content.toLowerCase();

    // 分析页面类型和特征
    const pageAnalysis = this.analyzePageType(content, context);

    // 基于页面类型生成针对性问题
    questions.push(...this.generateTypeBasedQuestions(pageAnalysis, context));

    // 基于内容关键词生成问题
    questions.push(
      ...this.generateKeywordBasedQuestions(content, contentLower, pageAnalysis)
    );

    // 基于页面标题生成问题
    questions.push(...this.generateTitleBasedQuestions(context.title));

    // 基于URL特征生成问题
    questions.push(...this.generateUrlBasedQuestions(context.url));

    // 去重并返回最相关的3个问题
    return this.selectBestQuestions([...new Set(questions)], pageAnalysis);
  }

  /**
   * 判断是否为真正的错误页面
   */
  private static isActualErrorPage(contentLower: string, url: string): boolean {
    const urlLower = url.toLowerCase();

    // 检查URL是否包含错误相关路径
    const errorPaths = [
      "/error",
      "/404",
      "/500",
      "/403",
      "/401",
      "/not-found",
      "/error-page",
      "/exception",
      "/bug-report",
      "/issue",
    ];

    const hasErrorPath = errorPaths.some((path) => urlLower.includes(path));

    // 检查内容是否包含明确的错误信息
    const errorIndicators = [
      "error occurred",
      "an error has occurred",
      "something went wrong",
      "页面不存在",
      "访问被拒绝",
      "服务器错误",
      "网络错误",
      "error code",
      "error message",
      "exception details",
      "stack trace",
      "error log",
      "debug information",
    ];

    const hasErrorContent = errorIndicators.some((indicator) =>
      contentLower.includes(indicator)
    );

    // 检查是否包含错误状态码
    const hasErrorCode = /\b(4\d{2}|5\d{2})\b/.test(contentLower);

    // 检查是否包含错误相关的HTML类名或ID
    const hasErrorClass =
      contentLower.includes("error-page") ||
      contentLower.includes("error-container") ||
      contentLower.includes("not-found");

    // 排除一些常见的非错误场景
    const excludePatterns = [
      "error handling",
      "error management",
      "error recovery",
      "error prevention",
      "error detection",
      "error analysis",
      "错误处理",
      "错误管理",
      "错误恢复",
      "错误预防",
      "error code",
      "error message",
      "error log", // 这些可能是文档内容
    ];

    const isExcluded = excludePatterns.some(
      (pattern) =>
        contentLower.includes(pattern) && !hasErrorPath && !hasErrorCode
    );

    // 只有满足多个条件才认为是错误页面
    return (
      (hasErrorPath || hasErrorContent || hasErrorCode || hasErrorClass) &&
      !isExcluded
    );
  }

  /**
   * 分析页面类型和特征
   */
  private static analyzePageType(
    content: string,
    context: PageContext
  ): PageAnalysis {
    const contentLower = content.toLowerCase();
    const url = context.url.toLowerCase();

    return {
      isGitHub: url.includes("github.com"),
      isStackOverflow: url.includes("stackoverflow.com"),
      isZhihu: url.includes("zhihu.com"),
      isJuejin: url.includes("juejin.cn"),
      isDocumentation:
        contentLower.includes("documentation") ||
        contentLower.includes("文档") ||
        contentLower.includes("api reference"),
      isTutorial:
        contentLower.includes("tutorial") ||
        contentLower.includes("教程") ||
        contentLower.includes("guide") ||
        contentLower.includes("getting started"),
      isAPI:
        contentLower.includes("api") ||
        contentLower.includes("接口") ||
        contentLower.includes("endpoint") ||
        contentLower.includes("rest") ||
        contentLower.includes("graphql"),
      isError: this.isActualErrorPage(contentLower, context.url),
      isConfig:
        contentLower.includes("config") ||
        contentLower.includes("配置") ||
        contentLower.includes("setting") ||
        contentLower.includes("environment"),
      isBlog:
        contentLower.includes("blog") ||
        contentLower.includes("博客") ||
        contentLower.includes("article") ||
        contentLower.includes("post"),
      isProduct:
        contentLower.includes("product") ||
        contentLower.includes("产品") ||
        contentLower.includes("feature") ||
        contentLower.includes("pricing"),
      hasCode:
        contentLower.includes("function") ||
        contentLower.includes("class") ||
        contentLower.includes("代码") ||
        contentLower.includes("javascript") ||
        contentLower.includes("python"),
      hasData:
        contentLower.includes("data") ||
        contentLower.includes("数据") ||
        contentLower.includes("json") ||
        contentLower.includes("database"),
      hasImage:
        contentLower.includes("image") ||
        contentLower.includes("图片") ||
        contentLower.includes("photo") ||
        contentLower.includes("screenshot"),
      hasVideo:
        contentLower.includes("video") ||
        contentLower.includes("视频") ||
        contentLower.includes("youtube") ||
        contentLower.includes("demo"),
    };
  }

  /**
   * 基于页面类型生成问题
   */
  private static generateTypeBasedQuestions(
    analysis: PageAnalysis,
    context: PageContext
  ): string[] {
    const questions: string[] = [];

    if (analysis.isGitHub) {
      questions.push("这个项目的核心功能和技术栈是什么？");
      questions.push("如何快速上手这个项目？");
      questions.push("这个项目解决了什么问题？");
      questions.push("项目的安装和配置步骤是什么？");
    } else if (analysis.isStackOverflow) {
      questions.push("这个问题的根本原因是什么？");
      questions.push("除了这个解决方案，还有其他方法吗？");
      questions.push("如何避免类似问题再次发生？");
      questions.push("这个解决方案有什么优缺点？");
    } else if (analysis.isZhihu) {
      questions.push("这个回答的核心观点是什么？");
      questions.push("作者的观点有什么独到之处？");
      questions.push("这个回答对你有什么启发？");
      questions.push("作者分享的经验有什么价值？");
    } else if (analysis.isJuejin) {
      questions.push("这篇文章的主要技术点是什么？");
      questions.push("如何在实际项目中应用这些技术？");
      questions.push("作者分享的经验有什么价值？");
      questions.push("这个技术方案有什么优势？");
    }

    return questions;
  }

  /**
   * 基于关键词生成问题
   */
  private static generateKeywordBasedQuestions(
    content: string,
    contentLower: string,
    analysis: PageAnalysis
  ): string[] {
    const questions: string[] = [];

    if (analysis.isAPI) {
      questions.push("这个API的主要功能和使用场景是什么？");
      questions.push("如何正确调用这些API接口？");
      questions.push("API的返回数据格式是怎样的？");
      questions.push("API的认证和权限如何设置？");
    }

    if (analysis.isTutorial) {
      questions.push("这个教程的学习路径是什么？");
      questions.push("需要什么前置知识才能跟上？");
      questions.push("教程中的关键步骤有哪些？");
      questions.push("如何验证学习效果？");
    }

    if (analysis.isError) {
      questions.push("如何快速解决这个问题？");
      questions.push("这个问题的常见解决方案有哪些？");
      questions.push("如何避免再次遇到类似问题？");
    }

    if (analysis.isConfig) {
      questions.push("这些配置项的作用和影响是什么？");
      questions.push("如何根据需求调整配置？");
      questions.push("配置不当会导致什么问题？");
      questions.push("配置的最佳实践是什么？");
    }

    if (analysis.isDocumentation) {
      questions.push("这个文档的核心内容是什么？");
      questions.push("如何快速找到需要的信息？");
      questions.push("文档中的最佳实践有哪些？");
      questions.push("这个技术概念如何理解？");
    }

    if (analysis.hasCode) {
      questions.push("这段代码的核心逻辑是什么？");
      questions.push("如何优化这段代码的性能？");
      questions.push("代码中有什么设计模式？");
      questions.push("如何调试和测试这段代码？");
    }

    if (analysis.hasData) {
      questions.push("这些数据的结构和含义是什么？");
      questions.push("如何有效利用这些数据？");
      questions.push("数据之间的关系是怎样的？");
      questions.push("如何分析和处理这些数据？");
    }

    if (analysis.isBlog) {
      questions.push("这篇文章的主要观点是什么？");
      questions.push("作者分享了什么有价值的经验？");
      questions.push("文章中的案例有什么启发？");
      questions.push("如何应用文章中的建议？");
    }

    if (analysis.isProduct) {
      questions.push("这个产品的核心功能是什么？");
      questions.push("产品有什么特色和优势？");
      questions.push("如何评估这个产品？");
      questions.push("产品的使用场景有哪些？");
    }

    return questions;
  }

  /**
   * 基于标题生成问题
   */
  private static generateTitleBasedQuestions(title: string): string[] {
    if (!title || title.trim().length === 0) return [];

    const questions: string[] = [];
    const titleLower = title.toLowerCase();

    // 根据标题特征生成问题
    if (titleLower.includes("如何") || titleLower.includes("how")) {
      questions.push(`关于"${title}"的具体步骤是什么？`);
      questions.push(`实现"${title}"需要注意什么？`);
      questions.push(`"${title}"有什么技巧和要点？`);
    } else if (titleLower.includes("为什么") || titleLower.includes("why")) {
      questions.push(`"${title}"的根本原因是什么？`);
      questions.push(`如何解决"${title}"这个问题？`);
      questions.push(`"${title}"有什么影响和后果？`);
    } else if (titleLower.includes("什么") || titleLower.includes("what")) {
      questions.push(`"${title}"的核心内容是什么？`);
      questions.push(`"${title}"有什么特点和优势？`);
      questions.push(`如何理解"${title}"这个概念？`);
    } else if (titleLower.includes("最佳") || titleLower.includes("best")) {
      questions.push(`"${title}"的具体做法是什么？`);
      questions.push(`如何实现"${title}"？`);
      questions.push(`"${title}"有什么注意事项？`);
    } else {
      questions.push(`"${title}"的主要内容是什么？`);
      questions.push(`关于"${title}"有什么重要信息？`);
      questions.push(`"${title}"有什么值得关注的点？`);
    }

    return questions;
  }

  /**
   * 基于URL生成问题
   */
  private static generateUrlBasedQuestions(url: string): string[] {
    if (!url) return [];

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      const questions: string[] = [];

      // 根据URL路径特征生成问题
      if (pathname.includes("/docs/") || pathname.includes("/documentation/")) {
        questions.push("这个文档页面的核心内容是什么？");
        questions.push("如何快速理解这个技术概念？");
        questions.push("文档中的关键信息有哪些？");
      } else if (
        pathname.includes("/api/") ||
        pathname.includes("/v1/") ||
        pathname.includes("/v2/")
      ) {
        questions.push("这个API端点的功能和使用方法是什么？");
        questions.push("API的参数和返回值格式是怎样的？");
        questions.push("如何正确调用这个API？");
      } else if (
        pathname.includes("/tutorial/") ||
        pathname.includes("/guide/")
      ) {
        questions.push("这个教程的学习重点是什么？");
        questions.push("如何按照教程步骤进行操作？");
        questions.push("教程中的关键步骤有哪些？");
      } else if (
        pathname.includes("/blog/") ||
        pathname.includes("/article/")
      ) {
        questions.push("这篇文章的主要观点是什么？");
        questions.push("作者分享了什么有价值的经验？");
        questions.push("文章中的案例有什么启发？");
      } else if (pathname.includes("/issue/") || pathname.includes("/bug/")) {
        questions.push("这个问题的具体情况是什么？");
        questions.push("如何解决这个问题？");
        questions.push("问题的根本原因是什么？");
      }

      return questions;
    } catch (error) {
      return [];
    }
  }

  /**
   * 选择最相关的问题
   */
  private static selectBestQuestions(
    questions: string[],
    analysis: PageAnalysis
  ): string[] {
    // 根据页面类型和内容特征给问题打分
    const scoredQuestions = questions.map((question) => {
      let score = 0;
      const questionLower = question.toLowerCase();

      // 根据页面类型加分
      if (
        analysis.isGitHub &&
        (questionLower.includes("项目") || questionLower.includes("仓库"))
      )
        score += 3;
      if (analysis.isStackOverflow && questionLower.includes("问题"))
        score += 3;
      if (
        analysis.isZhihu &&
        (questionLower.includes("观点") || questionLower.includes("回答"))
      )
        score += 3;
      if (
        analysis.isJuejin &&
        (questionLower.includes("技术") || questionLower.includes("文章"))
      )
        score += 3;

      // 根据内容特征加分
      if (analysis.isAPI && questionLower.includes("api")) score += 2;
      if (analysis.isTutorial && questionLower.includes("教程")) score += 2;
      if (analysis.isError && questionLower.includes("错误")) score += 2;
      if (analysis.hasCode && questionLower.includes("代码")) score += 2;
      if (analysis.isDocumentation && questionLower.includes("文档"))
        score += 2;
      if (analysis.isConfig && questionLower.includes("配置")) score += 2;

      // 避免过于通用的问题
      if (
        questionLower.includes("主要内容") ||
        questionLower.includes("核心功能")
      )
        score += 1;
      if (questionLower.includes("如何") || questionLower.includes("什么"))
        score += 1;

      // 优先选择更具体的问题
      if (
        questionLower.includes("具体") ||
        questionLower.includes("步骤") ||
        questionLower.includes("方法")
      )
        score += 1;

      return { question, score };
    });

    // 按分数排序并返回前3个
    return scoredQuestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.question);
  }

  /**
   * 使用AI模型生成建议问题
   */
  static async generateSuggestedQuestions(
    parseWebContent: () => string,
    pageContext: PageContext
  ): Promise<string[]> {
    try {
      const pageContent = parseWebContent();

      if (!pageContent || pageContent.length < 50) {
        return [];
      }

      // 构建提示词
      const prompt = this.buildSuggestionPrompt(pageContent, pageContext);

      // 调用AI模型生成问题
      const questions = await this.callAIModel(prompt);

      return questions.slice(0, 3); // 最多返回3个问题
    } catch (error) {
      console.warn("生成建议问题失败:", error);
      // 如果AI调用失败，回退到规则生成
      return this.generateQuestionsFromContent(parseWebContent(), pageContext);
    }
  }

  /**
   * 构建建议问题生成的提示词
   */
  private static buildSuggestionPrompt(
    content: string,
    context: PageContext
  ): string {
    const contentPreview = content.substring(0, 2000); // 限制内容长度

    return `你是一个智能助手，需要根据网页内容为用户生成3个最有价值的建议问题。

网页信息：
- 标题：${context.title}
- URL：${context.url}
- 内容预览：${contentPreview}

请分析这个网页的内容和类型，生成3个用户最可能想问的问题。要求：
1. 问题要具体、实用，不是泛泛而谈
2. 要结合网页的实际内容，而不是通用问题
3. 问题要能帮助用户快速理解或使用网页内容
4. 语言要自然，符合中文表达习惯
5. 每个问题控制在20字以内
6. 不要生成关于控制台错误、技术错误、调试等用户看不到的问题
7. 专注于用户可见的内容和功能

请直接返回3个问题，每行一个，不要编号，不要其他解释：

问题1
问题2
问题3`;
  }

  /**
   * 调用AI模型生成问题
   */
  private static async callAIModel(prompt: string): Promise<string[]> {
    try {
      // 使用Chrome runtime API调用background script
      const response = await chrome.runtime.sendMessage({
        action: "generateSuggestedQuestions",
        data: {
          prompt: prompt,
          max_tokens: 200,
          temperature: 0.7,
        },
      });

      if (!response.success) {
        throw new Error(response.error || "AI模型调用失败");
      }

      const questions =
        response.data?.choices?.[0]?.message?.content ||
        response.data?.text ||
        "";

      // 解析返回的问题
      return this.parseQuestions(questions);
    } catch (error) {
      console.warn("AI模型调用失败:", error);
      throw error;
    }
  }

  /**
   * 解析AI返回的问题文本
   */
  private static parseQuestions(questionsText: string): string[] {
    if (!questionsText) return [];

    // 按行分割并清理
    const lines = questionsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.match(/^\d+[\.\)]\s*/)) // 移除编号
      .filter((line) => line.includes("？") || line.includes("?")) // 只保留问题
      .filter((line) => this.isValidQuestion(line)) // 过滤不合适的问题
      .slice(0, 3); // 最多3个

    return lines;
  }

  /**
   * 检查问题是否合适
   */
  private static isValidQuestion(question: string): boolean {
    const questionLower = question.toLowerCase();

    // 过滤掉关于控制台错误、技术错误等用户看不到的问题
    const invalidPatterns = [
      "控制台错误",
      "console error",
      "控制台",
      "console",
      "技术错误",
      "调试",
      "debug",
      "错误日志",
      "error log",
      "异常堆栈",
      "stack trace",
      "错误代码",
      "error code",
      "网络请求错误",
      "network error",
      "api错误",
      "api error",
      "服务器错误",
      "server error",
      "内部错误",
      "internal error",
    ];

    // 如果问题包含这些模式，则过滤掉
    const hasInvalidPattern = invalidPatterns.some((pattern) =>
      questionLower.includes(pattern)
    );

    return !hasInvalidPattern;
  }
}
