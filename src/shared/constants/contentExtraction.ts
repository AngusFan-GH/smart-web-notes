// 内容提取配置
export interface ContentExtractionConfig {
  // 基础设置
  enabled: boolean;
  maxLength: number;
  cacheTimeout: number;

  // 提取选项
  extractStructure: boolean;
  extractImageAlt: boolean;
  extractLinkText: boolean;
  extractTableContent: boolean;
  enableSmartContent: boolean;
  analyzeNetworkRequests: boolean;

  // 选择器配置
  mainContentSelectors: string[];
  excludeSelectors: string[];

  // 网站特定配置
  siteSpecificConfig: Record<string, Partial<ContentExtractionConfig>>;
}

export const DEFAULT_CONTENT_EXTRACTION_CONFIG: ContentExtractionConfig = {
  enabled: true,
  maxLength: 50000, // 50KB
  cacheTimeout: 5 * 60 * 1000, // 5分钟

  extractStructure: true,
  extractImageAlt: true,
  extractLinkText: true,
  extractTableContent: true,
  enableSmartContent: true,
  analyzeNetworkRequests: true,

  mainContentSelectors: [
    "main",
    "article",
    '[role="main"]',
    ".content",
    ".main-content",
    ".post-content",
    ".entry-content",
    "#content",
    ".container",
    ".wrapper",
    ".page-content",
    ".article-content",
    ".post-body",
    ".entry-body",
  ],

  excludeSelectors: [
    // 脚本和样式
    "script",
    "style",
    'link[rel="stylesheet"]',
    "noscript",

    // 导航和布局
    "header",
    "nav",
    "footer",
    "aside",
    ".sidebar",
    ".navigation",
    ".menu",
    ".breadcrumb",
    ".breadcrumbs",

    // 广告和推广
    ".advertisement",
    ".ad",
    ".ads",
    ".advertisement-container",
    ".promo",
    ".sponsor",
    ".sponsored",
    ".affiliate",

    // 社交媒体和分享
    ".social-share",
    ".share",
    ".social-media",
    ".social-links",
    ".follow-us",

    // 评论和互动
    ".comments",
    ".comment",
    ".comment-section",
    ".discussion",
    ".replies",

    // 相关内容和推荐
    ".related",
    ".recommend",
    ".recommendation",
    ".similar",
    ".also-read",
    ".you-might-like",
    ".trending",

    // 弹窗和覆盖层
    ".popup",
    ".modal",
    ".overlay",
    ".lightbox",
    ".dialog",
    ".tooltip",
    ".dropdown",

    // 表单和交互元素
    ".form",
    ".search-form",
    ".newsletter",
    ".subscribe",
    ".signup",
    ".login",

    // 页脚和版权信息
    ".copyright",
    ".legal",
    ".terms",
    ".privacy",
    ".disclaimer",

    // 隐藏元素
    '[style*="display: none"]',
    '[style*="visibility: hidden"]',
    ".hidden",
    ".sr-only",
    ".screen-reader-only",

    // ARIA 角色
    '[role="banner"]',
    '[role="navigation"]',
    '[role="complementary"]',
    '[role="contentinfo"]',
    '[role="search"]',
    '[role="form"]',

    // 其他干扰元素
    ".cookie-notice",
    ".cookie-banner",
    ".cookie-consent",
    ".gdpr-notice",
    ".age-verification",
    ".newsletter-popup",
    ".exit-intent",
  ],

  // 网站特定配置
  siteSpecificConfig: {
    // 新闻网站
    "cnn.com": {
      mainContentSelectors: [
        ".article__content",
        ".l-container",
        ".zn-body__paragraph",
      ],
      excludeSelectors: [".ad", ".advertisement", ".social-share", ".comments"],
    },
    "bbc.com": {
      mainContentSelectors: [".story-body", ".vxp-media__summary"],
      excludeSelectors: [".ad", ".advertisement", ".social-share"],
    },
    "nytimes.com": {
      mainContentSelectors: [".StoryBodyCompanionColumn", ".css-53u6y8"],
      excludeSelectors: [".ad", ".advertisement", ".social-share"],
    },

    // 技术博客
    "medium.com": {
      mainContentSelectors: [".postArticle-content", ".article-content"],
      excludeSelectors: [".ad", ".advertisement", ".social-share", ".comments"],
    },
    "dev.to": {
      mainContentSelectors: [".article-body", ".crayons-article__main"],
      excludeSelectors: [".ad", ".advertisement", ".social-share"],
    },

    // 社交媒体
    "twitter.com": {
      mainContentSelectors: ['[data-testid="tweet"]', ".tweet-text"],
      excludeSelectors: [".ad", ".advertisement", ".trending"],
    },
    "reddit.com": {
      mainContentSelectors: [".Post", ".usertext-body"],
      excludeSelectors: [".ad", ".advertisement", ".sidebar"],
    },

    // 电商网站
    "amazon.com": {
      mainContentSelectors: ["#dp-container", ".product-description"],
      excludeSelectors: [
        ".ad",
        ".advertisement",
        ".recommendations",
        ".reviews",
      ],
    },

    // 文档网站
    "docs.microsoft.com": {
      mainContentSelectors: [".content", ".main-container"],
      excludeSelectors: [".ad", ".advertisement", ".feedback"],
    },
    "developer.mozilla.org": {
      mainContentSelectors: [".main-content", ".article"],
      excludeSelectors: [".ad", ".advertisement", ".sidebar"],
    },
  },
};

// 获取网站特定的配置
export function getSiteSpecificConfig(
  hostname: string
): Partial<ContentExtractionConfig> {
  // 尝试完全匹配
  if (DEFAULT_CONTENT_EXTRACTION_CONFIG.siteSpecificConfig[hostname]) {
    return DEFAULT_CONTENT_EXTRACTION_CONFIG.siteSpecificConfig[hostname];
  }

  // 尝试子域名匹配
  for (const [domain, config] of Object.entries(
    DEFAULT_CONTENT_EXTRACTION_CONFIG.siteSpecificConfig
  )) {
    if (hostname.endsWith(domain)) {
      return config;
    }
  }

  return {};
}

// 合并配置
export function mergeConfig(
  baseConfig: ContentExtractionConfig,
  siteConfig: Partial<ContentExtractionConfig>
): ContentExtractionConfig {
  return {
    ...baseConfig,
    ...siteConfig,
    mainContentSelectors: [
      ...(siteConfig.mainContentSelectors || baseConfig.mainContentSelectors),
      ...baseConfig.mainContentSelectors,
    ],
    excludeSelectors: [
      ...baseConfig.excludeSelectors,
      ...(siteConfig.excludeSelectors || []),
    ],
  };
}
