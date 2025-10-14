import {
  DEFAULT_CONTENT_EXTRACTION_CONFIG,
  getSiteSpecificConfig,
  mergeConfig,
  type ContentExtractionConfig,
} from "../constants/contentExtraction";
import { cacheManager } from "./cacheManager";
import {
  analyzeNetworkRequests,
  type NetworkAnalysisResult,
} from "./networkAnalyzer";

// 网页内容提取器 - 优化版本
export interface ContentExtractionOptions {
  // 是否提取结构化信息（标题、段落等）
  extractStructure?: boolean;
  // 是否提取图片alt文本
  extractImageAlt?: boolean;
  // 是否提取链接文本
  extractLinkText?: boolean;
  // 是否提取表格内容
  extractTableContent?: boolean;
  // 最大内容长度
  maxLength?: number;
  // 是否启用智能内容识别
  enableSmartContent?: boolean;
  // 自定义选择器（用于识别主要内容区域）
  mainContentSelectors?: string[];
  // 要排除的选择器
  excludeSelectors?: string[];
  // 是否使用网站特定配置
  useSiteSpecificConfig?: boolean;
  // 是否分析网络请求
  analyzeNetworkRequests?: boolean;
}

export interface ExtractedContent {
  text: string;
  structure?: {
    title?: string;
    headings: Array<{ level: number; text: string }>;
    paragraphs: string[];
    lists: Array<{ type: "ul" | "ol"; items: string[] }>;
    links: Array<{ text: string; href: string }>;
    images: Array<{ alt: string; src: string }>;
  };
  networkAnalysis?: NetworkAnalysisResult;
  metadata?: {
    url: string;
    title: string;
    description?: string;
    wordCount: number;
    extractedAt: number;
  };
}

export class ContentExtractor {
  private config: ContentExtractionConfig;

  constructor(config: Partial<ContentExtractionConfig> = {}) {
    // 获取网站特定配置
    const hostname = window.location.hostname;
    const siteConfig = getSiteSpecificConfig(hostname);

    // 合并配置
    this.config = mergeConfig(
      { ...DEFAULT_CONTENT_EXTRACTION_CONFIG, ...config },
      siteConfig
    );
  }

  /**
   * 提取网页内容
   */
  public extractContent(
    options: ContentExtractionOptions = {}
  ): ExtractedContent {
    // 检查是否启用
    if (!this.config.enabled) {
      return this.createEmptyResult();
    }

    const finalOptions = this.mergeOptions(options);
    const cacheKey = this.generateCacheKey(finalOptions);

    // 检查缓存
    const cached = cacheManager.get<ExtractedContent>(cacheKey);
    if (
      cached &&
      Date.now() - cached.metadata!.extractedAt < this.config.cacheTimeout
    ) {
      return cached;
    }

    const result = this.performExtraction(finalOptions);

    // 缓存结果
    cacheManager.set(cacheKey, result, {
      ttl: this.config.cacheTimeout,
      priority: "medium",
    });

    return result;
  }

  /**
   * 合并选项
   */
  private mergeOptions(
    options: ContentExtractionOptions
  ): Required<ContentExtractionOptions> {
    return {
      extractStructure:
        options.extractStructure ?? this.config.extractStructure,
      extractImageAlt: options.extractImageAlt ?? this.config.extractImageAlt,
      extractLinkText: options.extractLinkText ?? this.config.extractLinkText,
      extractTableContent:
        options.extractTableContent ?? this.config.extractTableContent,
      maxLength: options.maxLength ?? this.config.maxLength,
      enableSmartContent:
        options.enableSmartContent ?? this.config.enableSmartContent,
      mainContentSelectors:
        options.mainContentSelectors ?? this.config.mainContentSelectors,
      excludeSelectors:
        options.excludeSelectors ?? this.config.excludeSelectors,
      useSiteSpecificConfig: options.useSiteSpecificConfig ?? true,
    };
  }

  /**
   * 执行内容提取
   */
  private performExtraction(
    options: Required<ContentExtractionOptions>
  ): ExtractedContent {
    const docClone = document.cloneNode(true) as Document;

    // 清理文档
    this.cleanDocument(docClone, options);

    // 查找主要内容区域
    const mainContent = this.findMainContent(docClone, options);

    if (!mainContent) {
      return this.createEmptyResult();
    }

    // 提取内容
    const text = this.extractText(mainContent, options);
    const structure = options.extractStructure
      ? this.extractStructure(mainContent, options)
      : undefined;
    const metadata = this.extractMetadata();

    // 分析网络请求（如果启用）
    let networkAnalysis: NetworkAnalysisResult | undefined;
    if (options.analyzeNetworkRequests) {
      try {
        networkAnalysis = analyzeNetworkRequests();
      } catch (error) {
        console.warn("网络分析失败:", error);
      }
    }

    return {
      text: this.truncateText(text, options.maxLength),
      structure,
      networkAnalysis,
      metadata: {
        ...metadata,
        wordCount: this.countWords(text),
        extractedAt: Date.now(),
      },
    };
  }

  /**
   * 清理文档，移除不需要的元素
   */
  private cleanDocument(
    doc: Document,
    options: Required<ContentExtractionOptions>
  ): void {
    const allExcludeSelectors = [
      ...this.config.excludeSelectors,
      ...options.excludeSelectors,
    ];

    allExcludeSelectors.forEach((selector) => {
      try {
        const elements = doc.querySelectorAll(selector);
        elements.forEach((element) => {
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
        });
      } catch (error) {
        console.warn(`无效的选择器: ${selector}`, error);
      }
    });
  }

  /**
   * 查找主要内容区域
   */
  private findMainContent(
    doc: Document,
    options: Required<ContentExtractionOptions>
  ): Element | null {
    if (!options.enableSmartContent) {
      return doc.querySelector("body");
    }

    // 尝试按优先级查找主要内容区域
    const allMainContentSelectors = [
      ...this.config.mainContentSelectors,
      ...options.mainContentSelectors,
    ];

    for (const selector of allMainContentSelectors) {
      try {
        const element = doc.querySelector(selector);
        if (element && this.isValidContent(element)) {
          return element;
        }
      } catch (error) {
        console.warn(`无效的选择器: ${selector}`, error);
      }
    }

    // 如果没找到，尝试智能识别
    const body = doc.querySelector("body");
    if (body) {
      const mainContent = this.findLargestTextContainer(body);
      if (mainContent) {
        return mainContent;
      }
    }

    return body;
  }

  /**
   * 验证内容是否有效
   */
  private isValidContent(element: Element): boolean {
    const text = element.textContent || "";
    const wordCount = this.countWords(text);

    // 至少要有50个单词才认为是有效内容
    return wordCount >= 50;
  }

  /**
   * 查找最大的文本容器
   */
  private findLargestTextContainer(element: Element): Element | null {
    let largestElement: Element | null = null;
    let maxWordCount = 0;

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const element = node as Element;
        // 跳过已知的非内容元素
        if (
          ["script", "style", "nav", "header", "footer", "aside"].includes(
            element.tagName.toLowerCase()
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node = walker.nextNode();
    while (node) {
      const element = node as Element;
      const text = element.textContent || "";
      const wordCount = this.countWords(text);

      if (wordCount > maxWordCount && wordCount > 50) {
        maxWordCount = wordCount;
        largestElement = element;
      }

      node = walker.nextNode();
    }

    return largestElement;
  }

  /**
   * 提取文本内容
   */
  private extractText(
    element: Element,
    options: Required<ContentExtractionOptions>
  ): string {
    let text = "";

    if (options.extractStructure) {
      // 结构化提取
      text = this.extractStructuredText(element, options);
    } else {
      // 简单文本提取
      text = element.innerText || element.textContent || "";
    }

    return this.cleanText(text);
  }

  /**
   * 结构化文本提取
   */
  private extractStructuredText(
    element: Element,
    options: Required<ContentExtractionOptions>
  ): string {
    const parts: string[] = [];

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();

        // 只处理文本相关的元素
        if (
          [
            "p",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "li",
            "td",
            "th",
            "div",
            "span",
            "a",
            "img",
          ].includes(tagName)
        ) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    });

    let node = walker.nextNode();
    while (node) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
        const text = element.textContent?.trim();
        if (text) {
          parts.push(`\n## ${text}\n`);
        }
      } else if (tagName === "p") {
        const text = element.textContent?.trim();
        if (text) {
          parts.push(`\n${text}\n`);
        }
      } else if (["li"].includes(tagName)) {
        const text = element.textContent?.trim();
        if (text) {
          parts.push(`- ${text}`);
        }
      } else if (["td", "th"].includes(tagName)) {
        const text = element.textContent?.trim();
        if (text) {
          parts.push(text);
        }
      } else if (tagName === "a" && options.extractLinkText) {
        const text = element.textContent?.trim();
        const href = element.getAttribute("href");
        if (text && href) {
          parts.push(`[${text}](${href})`);
        } else if (text) {
          parts.push(text);
        }
      } else if (tagName === "img" && options.extractImageAlt) {
        const alt = element.getAttribute("alt");
        if (alt) {
          parts.push(`[图片: ${alt}]`);
        }
      } else {
        // 其他元素，直接提取文本
        const text = element.textContent?.trim();
        if (text && !this.hasTextChildren(element)) {
          parts.push(text);
        }
      }

      node = walker.nextNode();
    }

    return parts.join(" ");
  }

  /**
   * 检查元素是否有文本子元素
   */
  private hasTextChildren(element: Element): boolean {
    const children = Array.from(element.children);
    return children.some((child) =>
      ["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "td", "th"].includes(
        child.tagName.toLowerCase()
      )
    );
  }

  /**
   * 提取结构化信息
   */
  private extractStructure(
    element: Element,
    options: Required<ContentExtractionOptions>
  ): ExtractedContent["structure"] {
    const headings: Array<{ level: number; text: string }> = [];
    const paragraphs: string[] = [];
    const lists: Array<{ type: "ul" | "ol"; items: string[] }> = [];
    const links: Array<{ text: string; href: string }> = [];
    const images: Array<{ alt: string; src: string }> = [];

    // 提取标题
    for (let i = 1; i <= 6; i++) {
      const headingElements = element.querySelectorAll(`h${i}`);
      headingElements.forEach((heading) => {
        const text = heading.textContent?.trim();
        if (text) {
          headings.push({ level: i, text });
        }
      });
    }

    // 提取段落
    const paragraphElements = element.querySelectorAll("p");
    paragraphElements.forEach((p) => {
      const text = p.textContent?.trim();
      if (text) {
        paragraphs.push(text);
      }
    });

    // 提取列表
    const listElements = element.querySelectorAll("ul, ol");
    listElements.forEach((list) => {
      const type = list.tagName.toLowerCase() as "ul" | "ol";
      const items: string[] = [];
      const listItems = list.querySelectorAll("li");
      listItems.forEach((li) => {
        const text = li.textContent?.trim();
        if (text) {
          items.push(text);
        }
      });
      if (items.length > 0) {
        lists.push({ type, items });
      }
    });

    // 提取链接
    if (options.extractLinkText) {
      const linkElements = element.querySelectorAll("a[href]");
      linkElements.forEach((link) => {
        const text = link.textContent?.trim();
        const href = link.getAttribute("href");
        if (text && href) {
          links.push({ text, href });
        }
      });
    }

    // 提取图片
    if (options.extractImageAlt) {
      const imgElements = element.querySelectorAll("img");
      imgElements.forEach((img) => {
        const alt = img.getAttribute("alt");
        const src = img.getAttribute("src");
        if (alt) {
          images.push({ alt, src: src || "" });
        }
      });
    }

    return {
      headings,
      paragraphs,
      lists,
      links,
      images,
    };
  }

  /**
   * 提取元数据
   */
  private extractMetadata(): Omit<
    ExtractedContent["metadata"],
    "wordCount" | "extractedAt"
  > {
    return {
      url: typeof window !== "undefined" ? window.location.href : "",
      title: typeof document !== "undefined" ? document.title || "" : "",
      description: this.getMetaDescription(),
    };
  }

  /**
   * 获取页面描述
   */
  private getMetaDescription(): string {
    const meta = document.querySelector('meta[name="description"]');
    return meta?.getAttribute("content") || "";
  }

  /**
   * 清理文本
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ") // 将多个空白字符替换为单个空格
      .replace(/\n\s*\n/g, "\n\n") // 清理多余的空行
      .trim();
  }

  /**
   * 截断文本
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // 在单词边界截断
    const truncated = text.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(" ");

    if (lastSpaceIndex > maxLength * 0.8) {
      return truncated.substring(0, lastSpaceIndex) + "...";
    }

    return truncated + "...";
  }

  /**
   * 计算单词数
   */
  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(
    options: Required<ContentExtractionOptions>
  ): string {
    return JSON.stringify({
      url: typeof window !== "undefined" ? window.location.href : "",
      options: {
        extractStructure: options.extractStructure,
        extractImageAlt: options.extractImageAlt,
        extractLinkText: options.extractLinkText,
        extractTableContent: options.extractTableContent,
        maxLength: options.maxLength,
        enableSmartContent: options.enableSmartContent,
      },
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    // 使用全局缓存管理器的清理功能
    cacheManager.cleanup();
  }

  /**
   * 创建空结果
   */
  private createEmptyResult(): ExtractedContent {
    return {
      text: "",
      metadata: {
        url: typeof window !== "undefined" ? window.location.href : "",
        title: typeof document !== "undefined" ? document.title || "" : "",
        description: "",
        wordCount: 0,
        extractedAt: Date.now(),
      },
    };
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    cacheManager.clear();
  }

  /**
   * 获取缓存统计
   */
  public getCacheStats() {
    return cacheManager.getStats();
  }
}

// 创建默认实例
export const contentExtractor = new ContentExtractor();

// 便捷函数
export function extractWebContent(
  options: ContentExtractionOptions = {}
): ExtractedContent {
  return contentExtractor.extractContent(options);
}

// 向后兼容的简单函数
export function parseWebContent(): string {
  const result = contentExtractor.extractContent({
    extractStructure: false,
    extractImageAlt: false,
    extractLinkText: false,
    extractTableContent: false,
    enableSmartContent: false,
  });
  return result.text;
}
