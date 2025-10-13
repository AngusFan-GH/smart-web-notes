// 内容提取器使用示例

import {
  ContentExtractor,
  extractWebContent,
  parseWebContent,
} from "./contentExtractor";
import { DEFAULT_CONTENT_EXTRACTION_CONFIG } from "../constants/contentExtraction";

// 示例1: 使用默认配置
function example1() {
  // 简单使用 - 向后兼容
  const simpleText = parseWebContent();
  console.log("简单文本提取:", simpleText);

  // 完整功能使用
  const fullContent = extractWebContent();
  console.log("完整内容:", fullContent);
}

// 示例2: 自定义配置
function example2() {
  const extractor = new ContentExtractor({
    maxLength: 10000, // 限制为10KB
    extractStructure: true,
    extractImageAlt: true,
    extractLinkText: true,
    enableSmartContent: true,
  });

  const content = extractor.extractContent();
  console.log("自定义配置提取:", content);
}

// 示例3: 针对特定网站优化
function example3() {
  // 针对新闻网站优化
  const newsExtractor = new ContentExtractor({
    mainContentSelectors: [
      ".article-content",
      ".story-body",
      ".post-content",
      "article",
    ],
    excludeSelectors: [
      ".advertisement",
      ".ad",
      ".social-share",
      ".comments",
      ".related-articles",
    ],
    extractStructure: true,
    enableSmartContent: true,
  });

  const newsContent = newsExtractor.extractContent();
  console.log("新闻内容:", newsContent);
}

// 示例4: 高级用法 - 获取结构化信息
function example4() {
  const content = extractWebContent({
    extractStructure: true,
    extractImageAlt: true,
    extractLinkText: true,
    extractTableContent: true,
  });

  if (content.structure) {
    console.log("页面标题:", content.structure.title);
    console.log("标题列表:", content.structure.headings);
    console.log("段落列表:", content.structure.paragraphs);
    console.log("链接列表:", content.structure.links);
    console.log("图片列表:", content.structure.images);
  }

  console.log("元数据:", content.metadata);
}

// 示例5: 性能优化 - 使用缓存
function example5() {
  const extractor = new ContentExtractor({
    cacheTimeout: 10 * 60 * 1000, // 10分钟缓存
  });

  // 第一次提取
  const content1 = extractor.extractContent();
  console.log("第一次提取:", content1);

  // 第二次提取（从缓存获取）
  const content2 = extractor.extractContent();
  console.log("第二次提取（缓存）:", content2);

  // 获取缓存统计
  const stats = extractor.getCacheStats();
  console.log("缓存统计:", stats);
}

// 示例6: 错误处理和边界情况
function example6() {
  try {
    const content = extractWebContent({
      maxLength: 1000, // 限制长度
      enableSmartContent: true,
    });

    if (content.text.length === 0) {
      console.warn("未提取到任何内容");
    } else if (content.text.length >= 1000) {
      console.warn("内容被截断");
    } else {
      console.log("内容提取成功:", content.text);
    }
  } catch (error) {
    console.error("内容提取失败:", error);
  }
}

// 示例7: 动态配置更新
function example7() {
  const extractor = new ContentExtractor();

  // 根据页面类型动态调整配置
  const hostname = window.location.hostname;

  if (
    hostname.includes("news") ||
    hostname.includes("cnn") ||
    hostname.includes("bbc")
  ) {
    // 新闻网站配置
    const newsConfig = {
      mainContentSelectors: [".article-content", ".story-body"],
      excludeSelectors: [".ad", ".advertisement", ".social-share"],
    };

    const content = extractor.extractContent(newsConfig);
    console.log("新闻网站内容:", content);
  } else if (
    hostname.includes("github") ||
    hostname.includes("stackoverflow")
  ) {
    // 技术网站配置
    const techConfig = {
      mainContentSelectors: [".markdown-body", ".post-text", ".answer"],
      excludeSelectors: [".ad", ".advertisement", ".sidebar"],
    };

    const content = extractor.extractContent(techConfig);
    console.log("技术网站内容:", content);
  } else {
    // 默认配置
    const content = extractor.extractContent();
    console.log("默认内容:", content);
  }
}

// 示例8: 批量处理多个页面
function example8() {
  const extractor = new ContentExtractor();
  const results: Array<{ url: string; content: string; wordCount: number }> =
    [];

  // 模拟处理多个页面
  const urls = ["page1.html", "page2.html", "page3.html"];

  urls.forEach((url) => {
    try {
      const content = extractor.extractContent();
      results.push({
        url,
        content: content.text,
        wordCount: content.metadata?.wordCount || 0,
      });
    } catch (error) {
      console.error(`处理 ${url} 失败:`, error);
    }
  });

  console.log("批量处理结果:", results);
}

// 导出示例函数
export {
  example1,
  example2,
  example3,
  example4,
  example5,
  example6,
  example7,
  example8,
};
