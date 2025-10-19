import DOMPurify from "dompurify";

/**
 * HTML清理工具类
 * 使用DOMPurify进行安全的HTML清理，专门为AI分析优化
 */
export class HTMLSanitizer {
  private static instance: HTMLSanitizer;
  private purify: DOMPurify.DOMPurifyI;

  private constructor() {
    this.purify = DOMPurify;
    this.configurePurify();
  }

  public static getInstance(): HTMLSanitizer {
    if (!HTMLSanitizer.instance) {
      HTMLSanitizer.instance = new HTMLSanitizer();
    }
    return HTMLSanitizer.instance;
  }

  /**
   * 配置DOMPurify
   */
  private configurePurify(): void {
    // 配置DOMPurify，只保留结构相关的标签和属性
    this.purify.setConfig({
      // 允许的标签
      ALLOWED_TAGS: [
        "html",
        "head",
        "body",
        "title",
        "meta",
        "link",
        "div",
        "span",
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "a",
        "img",
        "ul",
        "ol",
        "li",
        "table",
        "tr",
        "td",
        "th",
        "thead",
        "tbody",
        "form",
        "input",
        "button",
        "select",
        "option",
        "textarea",
        "section",
        "article",
        "header",
        "footer",
        "nav",
        "aside",
        "main",
        "strong",
        "em",
        "b",
        "i",
        "u",
        "br",
        "hr",
      ],

      // 允许的属性
      ALLOWED_ATTR: [
        "id",
        "class",
        "href",
        "src",
        "alt",
        "title",
        "role",
        "aria-label",
        "type",
        "name",
        "value",
        "placeholder",
        "disabled",
        "checked",
        "data-id",
        "data-class",
        "data-role",
        "data-type",
      ],

      // 禁止的标签（确保script等被移除）
      FORBID_TAGS: [
        "script",
        "style",
        "iframe",
        "embed",
        "object",
        "video",
        "audio",
        "canvas",
      ],

      // 禁止的属性（暂时保留style属性，在后续处理中移除隐藏元素）
      FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover"],

      // 其他配置
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      SANITIZE_DOM: true,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
    });
  }

  /**
   * 清理HTML内容，为AI分析优化
   */
  public sanitizeForAI(html: string, maxSize: number = 80000): string {
    try {
      console.log("🧹 开始HTML清理流程");

      // 初始化处理统计
      const stats = {
        originalSize: html.length,
        afterPreprocessing: 0,
        afterDOMPurify: 0,
        afterQualityFilter: 0,
        afterEmptyRemoval: 0,
        afterNestingRemoval: 0,
        afterTextLimit: 0,
        afterFinalCleanup: 0,
        finalSize: 0,
      };

      // 第一步：先移除隐藏元素（在DOMPurify处理之前）
      console.log("📋 预处理：移除隐藏元素");
      let preprocessed = this.removeHiddenElementsFromHTML(html);
      stats.afterPreprocessing = preprocessed.length;

      // 第二步：使用DOMPurify进行基础清理
      console.log("📋 DOMPurify基础清理");
      let cleaned = this.purify.sanitize(preprocessed);
      stats.afterDOMPurify = cleaned.length;

      // 第三步：进一步优化（包含大小控制）
      console.log("📋 进一步优化");
      cleaned = this.optimizeForAI(cleaned, maxSize, stats);

      stats.finalSize = cleaned.length;

      console.log("🧹 HTML清理完成:", {
        原始大小: stats.originalSize,
        预处理后: stats.afterPreprocessing,
        DOMPurify后: stats.afterDOMPurify,
        质量过滤后: stats.afterQualityFilter,
        空元素移除后: stats.afterEmptyRemoval,
        深度嵌套移除后: stats.afterNestingRemoval,
        文本限制后: stats.afterTextLimit,
        最终清理后: stats.afterFinalCleanup,
        最终大小: stats.finalSize,
        总压缩率:
          (
            ((stats.originalSize - stats.finalSize) / stats.originalSize) *
            100
          ).toFixed(1) + "%",
      });

      return cleaned;
    } catch (error) {
      console.error("HTML清理失败:", error);
      return this.fallbackClean(html);
    }
  }

  /**
   * 预处理：从HTML字符串中移除隐藏元素
   * 在DOMPurify处理之前先移除隐藏元素
   */
  private removeHiddenElementsFromHTML(html: string): string {
    try {
      console.log("🔍 开始预处理移除隐藏元素");

      // 使用正则表达式移除包含隐藏样式的元素
      let processed = html;

      // 移除包含隐藏样式的完整标签（包括内容）
      const hiddenStyleRegex =
        /<[^>]*style="[^"]*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0)?)(?:\s*!important)?[^"]*"[^>]*>.*?<\/[^>]*>/gi;
      const hiddenStyleMatches = processed.match(hiddenStyleRegex);
      if (hiddenStyleMatches) {
        console.log(
          `🗑️ 发现 ${hiddenStyleMatches.length} 个包含隐藏样式的元素`
        );
        processed = processed.replace(hiddenStyleRegex, "");
      }

      // 移除包含隐藏样式的自闭合标签
      const hiddenSelfClosingRegex =
        /<[^>]*style="[^"]*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0)?)(?:\s*!important)?[^"]*"[^>]*\/>/gi;
      const hiddenSelfClosingMatches = processed.match(hiddenSelfClosingRegex);
      if (hiddenSelfClosingMatches) {
        console.log(
          `🗑️ 发现 ${hiddenSelfClosingMatches.length} 个包含隐藏样式的自闭合标签`
        );
        processed = processed.replace(hiddenSelfClosingRegex, "");
      }

      // 移除包含隐藏类名的元素
      const hiddenClassRegex =
        /<[^>]*class="[^"]*(?:hidden|hide|invisible|d-none|display-none|visually-hidden|sr-only|screen-reader-only)[^"]*"[^>]*>.*?<\/[^>]*>/gi;
      const hiddenClassMatches = processed.match(hiddenClassRegex);
      if (hiddenClassMatches) {
        console.log(
          `🗑️ 发现 ${hiddenClassMatches.length} 个包含隐藏类名的元素`
        );
        processed = processed.replace(hiddenClassRegex, "");
      }

      // 移除包含隐藏类名的自闭合标签
      const hiddenClassSelfClosingRegex =
        /<[^>]*class="[^"]*(?:hidden|hide|invisible|d-none|display-none|visually-hidden|sr-only|screen-reader-only)[^"]*"[^>]*\/>/gi;
      const hiddenClassSelfClosingMatches = processed.match(
        hiddenClassSelfClosingRegex
      );
      if (hiddenClassSelfClosingMatches) {
        console.log(
          `🗑️ 发现 ${hiddenClassSelfClosingMatches.length} 个包含隐藏类名的自闭合标签`
        );
        processed = processed.replace(hiddenClassSelfClosingRegex, "");
      }

      // 移除aria-hidden="true"的元素
      const ariaHiddenRegex = /<[^>]*aria-hidden="true"[^>]*>.*?<\/[^>]*>/gi;
      const ariaHiddenMatches = processed.match(ariaHiddenRegex);
      if (ariaHiddenMatches) {
        console.log(
          `🗑️ 发现 ${ariaHiddenMatches.length} 个aria-hidden="true"的元素`
        );
        processed = processed.replace(ariaHiddenRegex, "");
      }

      // 移除aria-hidden="true"的自闭合标签
      const ariaHiddenSelfClosingRegex = /<[^>]*aria-hidden="true"[^>]*\/>/gi;
      const ariaHiddenSelfClosingMatches = processed.match(
        ariaHiddenSelfClosingRegex
      );
      if (ariaHiddenSelfClosingMatches) {
        console.log(
          `🗑️ 发现 ${ariaHiddenSelfClosingMatches.length} 个aria-hidden="true"的自闭合标签`
        );
        processed = processed.replace(ariaHiddenSelfClosingRegex, "");
      }

      console.log("✅ 预处理完成", {
        原始大小: html.length,
        处理后大小: processed.length,
        移除的元素数:
          (hiddenStyleMatches?.length || 0) +
          (hiddenSelfClosingMatches?.length || 0) +
          (hiddenClassMatches?.length || 0) +
          (hiddenClassSelfClosingMatches?.length || 0) +
          (ariaHiddenMatches?.length || 0) +
          (ariaHiddenSelfClosingMatches?.length || 0),
      });

      return processed;
    } catch (error) {
      console.error("预处理移除隐藏元素失败:", error);
      return html;
    }
  }

  /**
   * 为AI分析进一步优化HTML
   * 层层递进的处理策略
   */
  private optimizeForAI(
    html: string,
    maxSize: number = 80000,
    stats?: any
  ): string {
    try {
      // 创建临时DOM进行进一步处理
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      console.log("🔄 开始层层递进的HTML优化处理");
      console.log("🔍 DOM解析结果:", {
        hasHead: !!doc.head,
        hasBody: !!doc.body,
        headType: doc.head ? typeof doc.head : "null",
        bodyType: doc.body ? typeof doc.body : "null",
      });

      // 注意：隐藏元素已在预处理阶段移除，这里跳过第一层
      console.log("📋 第一层：隐藏元素已在预处理阶段移除，跳过");

      // 第二层：智能内容质量过滤（移除低质量内容）
      console.log("📋 第二层：智能内容质量过滤");
      console.log("🔍 过滤前:", {
        headExists: !!doc.head,
        bodyExists: !!doc.body,
        allElements: doc.querySelectorAll("*").length,
      });
      this.filterLowQualityContent(doc);
      console.log("🔍 过滤后:", {
        headExists: !!doc.head,
        bodyExists: !!doc.body,
        allElements: doc.querySelectorAll("*").length,
      });
      if (stats) stats.afterQualityFilter = this.getHTMLSize(doc);

      // 第三层：移除空元素（清理无内容元素）
      console.log("📋 第三层：移除空元素");
      this.removeEmptyElements(doc);
      if (stats) stats.afterEmptyRemoval = this.getHTMLSize(doc);

      // 第四层：移除深度嵌套（简化结构）
      console.log("📋 第四层：移除深度嵌套");
      this.removeDeepNesting(doc);
      if (stats) stats.afterNestingRemoval = this.getHTMLSize(doc);

      // 第五层：限制文本长度（控制内容大小）
      console.log("📋 第五层：限制文本长度");
      this.limitTextLength(doc);
      if (stats) stats.afterTextLimit = this.getHTMLSize(doc);

      // 第六层：最终清理（移除残留的无用元素）
      console.log("📋 第六层：最终清理");
      this.finalCleanup(doc);
      if (stats) stats.afterFinalCleanup = this.getHTMLSize(doc);

      // 重新生成HTML，添加安全检查
      console.log("🔍 准备重新生成HTML:", {
        headExists: !!doc.head,
        bodyExists: !!doc.body,
        headOuterHTML: doc.head ? "exists" : "null",
        bodyOuterHTML: doc.body ? "exists" : "null",
        documentElement: doc.documentElement
          ? doc.documentElement.tagName
          : "null",
        allElements: doc.querySelectorAll("*").length,
        headElements: doc.head ? doc.head.children.length : 0,
        bodyElements: doc.body ? doc.body.children.length : 0,
      });

      let finalHTML = `<!DOCTYPE html>
<html>
<head>
${doc.head ? doc.head.outerHTML : ""}
</head>
<body>
${doc.body ? doc.body.outerHTML : ""}
</body>
</html>`;

      // 如果head或body为null，使用原始HTML作为回退
      if (!doc.head || !doc.body) {
        console.warn("⚠️ HTML结构不完整，使用原始HTML作为回退");
        finalHTML = html;
      }

      console.log("🎉 层层递进处理完成！", {
        原始大小: html.length,
        最终大小: finalHTML.length,
        压缩率:
          (((html.length - finalHTML.length) / html.length) * 100).toFixed(1) +
          "%",
      });

      return finalHTML;
    } catch (error) {
      console.error("HTML优化失败:", error);
      return html;
    }
  }

  /**
   * 第一层：移除隐藏元素
   * 目标：移除所有不可见的元素，减少无用内容
   */
  private removeHiddenElements(doc: Document): void {
    const elements = doc.querySelectorAll("*");
    const elementsToRemove: Element[] = [];
    let removedByStyle = 0;
    let removedByClass = 0;
    let removedByAria = 0;
    let removedByComputed = 0;

    elements.forEach((element) => {
      // 检查内联样式
      const style = element.getAttribute("style");
      if (style) {
        // 更全面的隐藏样式检测
        const normalizedStyle = style.toLowerCase().replace(/\s+/g, "");
        const isHidden =
          normalizedStyle.includes("display:none") ||
          normalizedStyle.includes("display:none!important") ||
          normalizedStyle.includes("visibility:hidden") ||
          normalizedStyle.includes("visibility:hidden!important") ||
          normalizedStyle.includes("opacity:0") ||
          normalizedStyle.includes("opacity:0!important") ||
          normalizedStyle.includes("opacity:0.0") ||
          normalizedStyle.includes("opacity:0.0!important") ||
          // 检查更复杂的样式组合
          (normalizedStyle.includes("display:none") &&
            normalizedStyle.includes("!important")) ||
          (normalizedStyle.includes("visibility:hidden") &&
            normalizedStyle.includes("!important"));

        if (isHidden) {
          elementsToRemove.push(element);
          removedByStyle++;
          console.log(`🗑️ 发现隐藏元素: ${element.tagName}`, {
            style: style,
            normalized: normalizedStyle,
          });
          return;
        }
      }

      // 检查CSS类名中可能包含隐藏相关的类
      const className = element.className;
      if (typeof className === "string") {
        const hiddenClasses = [
          "hidden",
          "hide",
          "invisible",
          "d-none",
          "display-none",
          "visually-hidden",
          "sr-only",
          "screen-reader-only",
        ];

        const hasHiddenClass = hiddenClasses.some((hiddenClass) =>
          className.toLowerCase().includes(hiddenClass.toLowerCase())
        );

        if (hasHiddenClass) {
          elementsToRemove.push(element);
          removedByClass++;
          return;
        }
      }

      // 检查aria-hidden属性
      const ariaHidden = element.getAttribute("aria-hidden");
      if (ariaHidden === "true") {
        elementsToRemove.push(element);
        removedByAria++;
        return;
      }

      // 检查元素是否在视口外（通过计算样式）
      try {
        const computedStyle = window.getComputedStyle(element);
        if (
          computedStyle.display === "none" ||
          computedStyle.visibility === "hidden" ||
          computedStyle.opacity === "0"
        ) {
          elementsToRemove.push(element);
          removedByComputed++;
        }
      } catch (error) {
        // 如果无法获取计算样式，跳过
      }
    });

    // 移除所有隐藏元素
    elementsToRemove.forEach((element) => {
      element.remove();
    });

    console.log(`✅ 第一层完成：移除了 ${elementsToRemove.length} 个隐藏元素`, {
      内联样式: removedByStyle,
      CSS类名: removedByClass,
      aria属性: removedByAria,
      计算样式: removedByComputed,
    });
  }

  /**
   * 获取当前DOM的HTML大小
   */
  private getHTMLSize(doc: Document): number {
    try {
      const html = `<!DOCTYPE html>
<html>
<head>
${doc.head ? doc.head.outerHTML : ""}
</head>
<body>
${doc.body ? doc.body.outerHTML : ""}
</body>
</html>`;
      return html.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 智能内容质量过滤
   * 根据内容质量移除低价值元素
   */
  private filterLowQualityContent(doc: Document): void {
    const elementsToRemove: Element[] = [];
    let removedCount = 0;

    // 获取所有元素
    const allElements = doc.querySelectorAll("*");

    for (const element of allElements) {
      // 跳过script、style、meta等标签
      if (this.isStructuralTag(element)) {
        continue;
      }

      const contentQuality = this.assessContentQuality(element);
      const threshold = this.getQualityThreshold(element);

      // 如果内容质量过低，标记为删除
      if (contentQuality.score < threshold) {
        elementsToRemove.push(element);
        removedCount++;
      }
      // 如果内容质量中等，考虑简化
      else if (
        contentQuality.score < threshold + 0.3 &&
        contentQuality.canSimplify
      ) {
        this.simplifyElement(element);
      }
    }

    // 移除低质量元素
    elementsToRemove.forEach((element) => {
      try {
        element.remove();
      } catch (error) {
        console.warn("移除元素失败:", error);
      }
    });

    console.log(`✅ 第二层完成：移除了 ${removedCount} 个低质量内容元素`);
  }

  /**
   * 根据元素类型获取质量阈值
   */
  private getQualityThreshold(element: Element): number {
    const tagName = element.tagName.toLowerCase();

    // 重要内容使用更宽松的阈值
    if (
      [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "article",
        "main",
        "section",
      ].includes(tagName)
    ) {
      return 0.2; // 更宽松，保留更多内容
    }

    // 低价值内容使用更严格的阈值
    if (["span", "div", "aside", "footer", "header", "nav"].includes(tagName)) {
      return 0.4; // 更严格，移除更多低价值内容
    }

    // 默认阈值
    return 0.3;
  }

  /**
   * 评估元素内容质量
   */
  private assessContentQuality(element: Element): {
    score: number;
    canSimplify: boolean;
  } {
    const text = element.textContent || "";
    const tagName = element.tagName.toLowerCase();

    // 基础分数
    let score = 0.5;
    let canSimplify = false;

    // 1. 文本长度评估
    const textLength = text.trim().length;
    if (textLength === 0) {
      return { score: 0, canSimplify: false };
    } else if (textLength < 10) {
      score -= 0.3;
    } else if (textLength > 100) {
      score += 0.2;
    }

    // 2. 标签重要性评估
    const importantTags = [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "article",
      "section",
      "main",
    ];
    const lowValueTags = [
      "span",
      "div",
      "section",
      "aside",
      "footer",
      "header",
      "nav",
    ];

    if (importantTags.includes(tagName)) {
      score += 0.3;
    } else if (lowValueTags.includes(tagName)) {
      score -= 0.2;
    }

    // 3. 内容质量评估
    const meaningfulWords = this.countMeaningfulWords(text);
    const totalWords = this.countWords(text);
    const meaningfulRatio = totalWords > 0 ? meaningfulWords / totalWords : 0;

    if (meaningfulRatio > 0.7) {
      score += 0.3;
    } else if (meaningfulRatio < 0.3) {
      score -= 0.4;
    }

    // 4. 重复内容检测
    if (this.isRepetitiveContent(text)) {
      score -= 0.5;
    }

    // 5. 广告/推广内容检测
    if (this.isAdContent(element)) {
      score -= 0.8;
    }

    // 6. 导航/菜单内容检测
    if (this.isNavigationContent(element)) {
      score -= 0.3;
      canSimplify = true;
    }

    // 7. 评论/互动内容检测
    if (this.isInteractiveContent(element)) {
      score -= 0.4;
      canSimplify = true;
    }

    // 8. 版权/法律声明检测
    if (this.isLegalContent(text)) {
      score -= 0.6;
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      canSimplify,
    };
  }

  /**
   * 计算总单词数量
   */
  private countWords(text: string): number {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    return words.length;
  }

  /**
   * 计算有意义的单词数量
   */
  private countMeaningfulWords(text: string): number {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const stopWords = new Set([
      "的",
      "了",
      "在",
      "是",
      "我",
      "有",
      "和",
      "就",
      "不",
      "人",
      "都",
      "一",
      "一个",
      "上",
      "也",
      "很",
      "到",
      "说",
      "要",
      "去",
      "你",
      "会",
      "着",
      "没有",
      "看",
      "好",
      "自己",
      "这",
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
    ]);

    return words.filter(
      (word) =>
        word.length > 2 &&
        !stopWords.has(word) &&
        !/^\d+$/.test(word) &&
        !/^[^\w\u4e00-\u9fff]+$/.test(word)
    ).length;
  }

  /**
   * 检测是否为重复内容
   */
  private isRepetitiveContent(text: string): boolean {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    if (words.length < 10) return false;

    const wordCounts = new Map<string, number>();
    words.forEach((word) => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const maxCount = Math.max(...wordCounts.values());
    const repetitionRatio = maxCount / words.length;

    return repetitionRatio > 0.3;
  }

  /**
   * 检测是否为广告内容
   */
  private isAdContent(element: Element): boolean {
    const adKeywords = [
      "广告",
      "推广",
      "赞助",
      "advertisement",
      "ad",
      "sponsor",
      "promotion",
    ];
    const text = element.textContent?.toLowerCase() || "";
    const className = element.className?.toLowerCase() || "";
    const id = element.id?.toLowerCase() || "";

    return adKeywords.some(
      (keyword) =>
        text.includes(keyword) ||
        className.includes(keyword) ||
        id.includes(keyword)
    );
  }

  /**
   * 检测是否为导航内容
   */
  private isNavigationContent(element: Element): boolean {
    const navKeywords = [
      "nav",
      "menu",
      "navigation",
      "breadcrumb",
      "导航",
      "菜单",
    ];
    const tagName = element.tagName.toLowerCase();
    const className = element.className?.toLowerCase() || "";
    const role = element.getAttribute("role")?.toLowerCase() || "";

    return (
      tagName === "nav" ||
      navKeywords.some(
        (keyword) => className.includes(keyword) || role.includes(keyword)
      )
    );
  }

  /**
   * 检测是否为互动内容
   */
  private isInteractiveContent(element: Element): boolean {
    const interactiveKeywords = [
      "comment",
      "reply",
      "like",
      "share",
      "follow",
      "评论",
      "回复",
      "点赞",
      "分享",
    ];
    const className = element.className?.toLowerCase() || "";
    const text = element.textContent?.toLowerCase() || "";

    return interactiveKeywords.some(
      (keyword) => className.includes(keyword) || text.includes(keyword)
    );
  }

  /**
   * 检测是否为法律声明内容
   */
  private isLegalContent(text: string): boolean {
    const legalKeywords = [
      "版权",
      "copyright",
      "隐私",
      "privacy",
      "条款",
      "terms",
      "法律",
      "legal",
      "免责",
      "disclaimer",
    ];
    const lowerText = text.toLowerCase();

    return legalKeywords.some((keyword) => lowerText.includes(keyword));
  }

  /**
   * 判断是否为结构标签
   */
  private isStructuralTag(element: Element): boolean {
    const structuralTags = [
      "html",
      "head",
      "body",
      "title",
      "meta",
      "link",
      "script",
      "style",
    ];
    const isStructural = structuralTags.includes(element.tagName.toLowerCase());

    // 添加调试信息
    if (isStructural) {
      console.log(`🛡️ 保护结构标签: ${element.tagName}`, {
        tagName: element.tagName,
        parentTag: element.parentElement?.tagName || "none",
      });
    }

    return isStructural;
  }

  /**
   * 简化元素内容
   */
  private simplifyElement(element: Element): void {
    try {
      // 保留文本内容，移除子元素
      const textContent = element.textContent || "";
      if (textContent.trim().length > 0) {
        element.innerHTML = textContent.trim();
      }
    } catch (error) {
      console.warn("简化元素失败:", error);
    }
  }

  /**
   * 第二层：移除空元素
   * 目标：清理无内容元素，简化DOM结构
   */
  private removeEmptyElements(doc: Document): void {
    const elements = doc.querySelectorAll("*");
    let removedCount = 0;

    elements.forEach((element) => {
      // 移除没有文本内容且没有子元素的元素
      if (!element.textContent?.trim() && element.children.length === 0) {
        element.remove();
        removedCount++;
      }
    });

    console.log(`✅ 第二层完成：移除了 ${removedCount} 个空元素`);
  }

  /**
   * 第三层：移除深度嵌套
   * 目标：简化DOM结构，移除过深的嵌套
   */
  private removeDeepNesting(doc: Document): void {
    const elements = doc.querySelectorAll("*");
    const depthMap = new Map<Element, number>();
    let removedCount = 0;

    // 计算深度
    elements.forEach((element) => {
      let depth = 0;
      let parent = element.parentElement;
      while (parent) {
        depth++;
        parent = parent.parentElement;
      }
      depthMap.set(element, depth);
    });

    // 移除过深的元素（超过8层）
    elements.forEach((element) => {
      const depth = depthMap.get(element) || 0;
      if (depth > 8) {
        element.remove();
        removedCount++;
      }
    });

    console.log(`✅ 第三层完成：移除了 ${removedCount} 个深度嵌套元素（>8层）`);
  }

  /**
   * 第四层：限制文本长度
   * 目标：控制内容大小，避免过长文本
   */
  private limitTextLength(doc: Document): void {
    const elements = doc.querySelectorAll("*");
    let truncatedCount = 0;

    elements.forEach((element) => {
      if (element.textContent && element.textContent.length > 150) {
        element.textContent = element.textContent.substring(0, 150) + "...";
        truncatedCount++;
      }
    });

    console.log(
      `✅ 第四层完成：截断了 ${truncatedCount} 个元素的文本内容（>150字符）`
    );
  }

  /**
   * 第五层：最终清理
   * 目标：移除残留的无用元素，确保HTML结构干净
   */
  private finalCleanup(doc: Document): void {
    const elements = doc.querySelectorAll("*");
    let removedCount = 0;

    elements.forEach((element) => {
      // 移除只包含空白字符的元素
      if (
        element.textContent &&
        !element.textContent.trim() &&
        element.children.length === 0
      ) {
        element.remove();
        removedCount++;
        return;
      }

      // 移除只包含换行符和空格的元素
      if (
        element.textContent &&
        element.textContent.replace(/\s+/g, "").length === 0 &&
        element.children.length === 0
      ) {
        element.remove();
        removedCount++;
        return;
      }

      // 移除只有注释的元素
      if (
        element.children.length === 1 &&
        element.children[0].nodeType === Node.COMMENT_NODE
      ) {
        element.remove();
        removedCount++;
        return;
      }
    });

    console.log(`✅ 第五层完成：最终清理移除了 ${removedCount} 个残留无用元素`);
  }

  /**
   * 回退清理方法
   */
  private fallbackClean(html: string): string {
    // 简单的正则清理
    return (
      html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
        .replace(/on\w+="[^"]*"/gi, "")
        // 移除包含隐藏样式的元素（增强版）
        .replace(
          /<[^>]*style="[^"]*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0)?)(?:\s*!important)?[^"]*"[^>]*>.*?<\/[^>]*>/gi,
          ""
        )
        // 移除包含隐藏样式的自闭合标签
        .replace(
          /<[^>]*style="[^"]*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0)?)(?:\s*!important)?[^"]*"[^>]*\/>/gi,
          ""
        )
        // 移除包含隐藏类名的元素
        .replace(
          /<[^>]*class="[^"]*(?:hidden|hide|invisible|d-none|display-none|visually-hidden|sr-only|screen-reader-only)[^"]*"[^>]*>.*?<\/[^>]*>/gi,
          ""
        )
        // 移除包含隐藏类名的自闭合标签
        .replace(
          /<[^>]*class="[^"]*(?:hidden|hide|invisible|d-none|display-none|visually-hidden|sr-only|screen-reader-only)[^"]*"[^>]*\/>/gi,
          ""
        )
        // 移除aria-hidden="true"的元素
        .replace(/<[^>]*aria-hidden="true"[^>]*>.*?<\/[^>]*>/gi, "")
        // 移除aria-hidden="true"的自闭合标签
        .replace(/<[^>]*aria-hidden="true"[^>]*\/>/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  /**
   * 获取清理后的页面HTML
   */
  public getCleanPageHTML(maxSize: number = 80000): string {
    try {
      const fullHTML = `<!DOCTYPE html>
<html>
<head>
${document.head ? document.head.outerHTML : ""}
</head>
<body>
${document.body ? document.body.outerHTML : ""}
</body>
</html>`;

      return this.sanitizeForAI(fullHTML, maxSize);
    } catch (error) {
      console.error("获取清理页面HTML失败:", error);
      return this.fallbackClean(document.body ? document.body.innerHTML : "");
    }
  }
}

// 导出单例实例
export const htmlSanitizer = HTMLSanitizer.getInstance();
