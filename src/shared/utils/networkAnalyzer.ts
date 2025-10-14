/**
 * 网络请求分析器
 * 用于分析页面的网络请求，提取API调用和关键数据
 */

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  responseType: string;
  timestamp: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseData?: any;
  requestData?: any;
}

export interface NetworkAnalysisResult {
  apiCalls: NetworkRequest[];
  dataEndpoints: string[];
  contentTypes: string[];
  summary: string;
  keyData: any[];
}

class NetworkAnalyzer {
  private requests: NetworkRequest[] = [];
  private maxRequests = 50; // 限制分析的请求数量
  private isMonitoring = false;

  constructor() {
    this.setupNetworkMonitoring();
  }

  /**
   * 设置网络请求监控
   */
  private setupNetworkMonitoring() {
    if (this.isMonitoring) return;

    // 拦截fetch请求
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options = {}] = args;
      const requestUrl = typeof url === "string" ? url : url.toString();

      try {
        const response = await originalFetch(...args);
        this.recordRequest({
          url: requestUrl,
          method: options.method || "GET",
          status: response.status,
          responseType: response.headers.get("content-type") || "unknown",
          timestamp: Date.now(),
          requestHeaders: this.extractHeaders(options.headers),
          responseHeaders: this.extractHeaders(response.headers),
        });
        return response;
      } catch (error) {
        this.recordRequest({
          url: requestUrl,
          method: options.method || "GET",
          status: 0,
          responseType: "error",
          timestamp: Date.now(),
          requestHeaders: this.extractHeaders(options.headers),
        });
        throw error;
      }
    };

    // 拦截XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      ...args: any[]
    ) {
      (this as any)._method = method;
      (this as any)._url = url.toString();
      return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function (data?: any) {
      const xhr = this as any;
      const requestUrl = xhr._url;
      const method = xhr._method || "GET";

      xhr.addEventListener("loadend", () => {
        this.recordRequest({
          url: requestUrl,
          method,
          status: xhr.status,
          responseType: xhr.getResponseHeader("content-type") || "unknown",
          timestamp: Date.now(),
          requestData: data,
          responseData: this.tryParseResponse(xhr.responseText),
        });
      });

      return originalXHRSend.call(this, data);
    };

    this.isMonitoring = true;
  }

  /**
   * 记录网络请求
   */
  private recordRequest(request: NetworkRequest) {
    // 过滤掉一些不重要的请求
    if (this.shouldIgnoreRequest(request.url)) {
      return;
    }

    this.requests.push(request);

    // 保持请求数量在限制范围内
    if (this.requests.length > this.maxRequests) {
      this.requests = this.requests.slice(-this.maxRequests);
    }
  }

  /**
   * 判断是否应该忽略某个请求
   */
  private shouldIgnoreRequest(url: string): boolean {
    // 基础忽略模式（静态资源、浏览器内部等）
    const basicIgnorePatterns = [
      /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i,
      /chrome-extension:/,
      /moz-extension:/,
      /safari-extension:/,
      /data:/,
      /blob:/,
      /about:/,
      /chrome:/,
      /edge:/,
      /firefox:/,
      /safari:/,
    ];

    // 如果匹配基础忽略模式，直接忽略
    if (basicIgnorePatterns.some((pattern) => pattern.test(url))) {
      return true;
    }

    // 智能分析：判断是否为有意义的API请求
    return !this.isMeaningfulApiRequest(url);
  }

  /**
   * 判断是否为有意义的API请求
   */
  private isMeaningfulApiRequest(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // 检查是否为API路径
      const apiIndicators = [
        "/api/",
        "/v1/",
        "/v2/",
        "/v3/",
        "/graphql",
        "/rest/",
        "/service/",
        "/data/",
        "/query/",
        "/search/",
        "/fetch/",
        "/load/",
        "/get/",
        "/post/",
        "/put/",
        "/delete/",
        "/patch/",
      ];

      const pathname = urlObj.pathname.toLowerCase();
      const hasApiIndicator = apiIndicators.some((indicator) =>
        pathname.includes(indicator)
      );

      // 检查查询参数中是否包含数据相关参数
      const dataParams = [
        "data",
        "content",
        "result",
        "response",
        "json",
        "xml",
        "query",
        "search",
        "filter",
        "sort",
        "page",
        "limit",
        "id",
        "key",
        "token",
        "session",
        "user",
        "auth",
      ];
      const hasDataParams = dataParams.some((param) =>
        urlObj.searchParams.has(param)
      );

      // 检查Content-Type相关的路径
      const contentTypePaths = [".json", ".xml", ".rss", ".atom", ".feed"];
      const hasContentTypePath = contentTypePaths.some((ext) =>
        pathname.endsWith(ext)
      );

      // 检查是否为常见的非API路径
      const nonApiPatterns = [
        /\/static\//,
        /\/assets\//,
        /\/public\//,
        /\/images\//,
        /\/css\//,
        /\/js\//,
        /\/fonts\//,
        /\/media\//,
        /\/uploads\//,
        /\/downloads\//,
        /\/favicon\.ico$/,
        /\/robots\.txt$/,
        /\/sitemap\.xml$/,
        /\/manifest\.json$/,
      ];

      const isNonApiPath = nonApiPatterns.some((pattern) =>
        pattern.test(pathname)
      );

      // 综合判断：有API指示器 OR 有数据参数 OR 有内容类型路径，且不是非API路径
      return (
        (hasApiIndicator || hasDataParams || hasContentTypePath) &&
        !isNonApiPath
      );
    } catch (error) {
      // URL解析失败，保守处理：不忽略
      return true;
    }
  }

  /**
   * 提取请求头信息
   */
  private extractHeaders(headers: any): Record<string, string> | undefined {
    if (!headers) return undefined;

    if (headers instanceof Headers) {
      const result: Record<string, string> = {};
      headers.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }

    if (typeof headers === "object") {
      return headers as Record<string, string>;
    }

    return undefined;
  }

  /**
   * 尝试解析响应数据
   */
  private tryParseResponse(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * 分析网络请求
   */
  public analyze(): NetworkAnalysisResult {
    // 首先过滤出有意义的请求
    const meaningfulRequests = this.requests.filter(
      (req) =>
        req.status >= 200 &&
        req.status < 300 &&
        this.isMeaningfulApiRequest(req.url)
    );

    // 进一步过滤：只保留JSON或文本响应，或者包含重要数据的请求
    const apiCalls = meaningfulRequests.filter((req) => {
      const hasJsonOrText =
        req.responseType.includes("json") || req.responseType.includes("text");
      const hasImportantData =
        req.responseData && this.hasImportantData(req.responseData);
      const isApiEndpoint = this.isApiEndpoint(req.url);

      return hasJsonOrText || hasImportantData || isApiEndpoint;
    });

    // 通过 Performance API 兜底采集历史资源端点（无响应体）
    const perfCandidates = this.getPerformanceApiCandidates();

    const dataEndpoints = apiCalls
      .map((req) => req.url)
      .concat(perfCandidates)
      .filter((url, index, arr) => arr.indexOf(url) === index)
      .slice(0, 10); // 只取前10个不同的端点

    const contentTypes = apiCalls
      .map((req) => req.responseType)
      .filter((type, index, arr) => arr.indexOf(type) === index);

    const keyData = this.extractKeyData(apiCalls);

    const summary = this.generateSummary(apiCalls, dataEndpoints, keyData);

    return {
      apiCalls: apiCalls.slice(0, 20), // 只返回前20个请求
      dataEndpoints,
      contentTypes,
      summary,
      keyData,
    };
  }

  /**
   * 使用 Performance API 采集已完成的资源请求，作为 API 端点候选
   * 注意：无法获取响应体，仅用于端点补全
   */
  private getPerformanceApiCandidates(): string[] {
    try {
      if (
        typeof performance === "undefined" ||
        typeof performance.getEntriesByType !== "function"
      ) {
        return [];
      }

      const entries = performance.getEntriesByType("resource") as any[];
      if (!Array.isArray(entries)) return [];

      const urls: string[] = [];
      for (const entry of entries) {
        const name = entry?.name as string | undefined;
        if (!name) continue;

        try {
          // 仅保留有意义的 API 端点
          if (this.isMeaningfulApiRequest(name)) {
            urls.push(name);
          }
        } catch {
          // 忽略无效 URL
        }
      }

      // 去重并限制数量
      return Array.from(new Set(urls)).slice(0, 20);
    } catch {
      return [];
    }
  }

  /**
   * 检查响应数据是否包含重要信息
   */
  private hasImportantData(responseData: any): boolean {
    if (!responseData || typeof responseData !== "object") {
      return false;
    }

    // 检查是否包含常见的数据结构
    const importantKeys = [
      "data",
      "result",
      "content",
      "message",
      "title",
      "description",
      "items",
      "list",
      "array",
      "objects",
      "users",
      "posts",
      "articles",
      "comments",
      "replies",
      "products",
      "categories",
      "tags",
    ];

    return importantKeys.some(
      (key) =>
        responseData.hasOwnProperty(key) &&
        responseData[key] !== null &&
        responseData[key] !== undefined
    );
  }

  /**
   * 检查是否为API端点
   */
  private isApiEndpoint(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();

      // 检查路径是否包含API相关关键词
      const apiKeywords = [
        "api",
        "v1",
        "v2",
        "v3",
        "graphql",
        "rest",
        "service",
        "data",
        "query",
        "search",
        "fetch",
        "load",
        "get",
        "post",
        "put",
        "delete",
        "patch",
        "update",
        "create",
        "remove",
      ];

      return apiKeywords.some((keyword) => pathname.includes(keyword));
    } catch {
      return false;
    }
  }

  /**
   * 提取关键数据
   */
  private extractKeyData(apiCalls: NetworkRequest[]): any[] {
    const keyData: any[] = [];

    apiCalls.forEach((req) => {
      if (req.responseData && typeof req.responseData === "object") {
        // 提取可能包含重要信息的字段
        const importantFields = [
          "data",
          "result",
          "content",
          "message",
          "title",
          "description",
          "items",
          "list",
        ];

        importantFields.forEach((field) => {
          if (req.responseData[field]) {
            keyData.push({
              url: req.url,
              field,
              value: req.responseData[field],
              timestamp: req.timestamp,
            });
          }
        });
      }
    });

    return keyData.slice(0, 10); // 只返回前10个关键数据
  }

  /**
   * 生成分析摘要
   */
  private generateSummary(
    apiCalls: NetworkRequest[],
    dataEndpoints: string[],
    keyData: any[]
  ): string {
    const totalRequests = apiCalls.length;
    const uniqueEndpoints = dataEndpoints.length;
    const hasJsonData = apiCalls.some((req) =>
      req.responseType.includes("json")
    );
    const hasTextData = apiCalls.some((req) =>
      req.responseType.includes("text")
    );

    let summary = `发现 ${totalRequests} 个网络请求，涉及 ${uniqueEndpoints} 个不同的API端点。`;

    if (hasJsonData) {
      summary += ` 检测到JSON数据响应。`;
    }

    if (hasTextData) {
      summary += ` 检测到文本数据响应。`;
    }

    if (keyData.length > 0) {
      summary += ` 提取到 ${keyData.length} 个关键数据字段。`;
    }

    return summary;
  }

  /**
   * 获取最近的请求
   */
  public getRecentRequests(limit = 10): NetworkRequest[] {
    return this.requests
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 清空请求记录
   */
  public clear() {
    this.requests = [];
  }

  /**
   * 停止监控
   */
  public stop() {
    this.isMonitoring = false;
    // 注意：这里没有恢复原始的fetch和XMLHttpRequest，因为可能会影响页面功能
  }

  /**
   * 获取调试信息
   */
  public getDebugInfo(): {
    totalRequests: number;
    meaningfulRequests: number;
    analyzedRequests: number;
    ignoredRequests: number;
    requestBreakdown: {
      apiCalls: number;
      staticResources: number;
      browserInternal: number;
      other: number;
    };
  } {
    const totalRequests = this.requests.length;
    const meaningfulRequests = this.requests.filter(
      (req) =>
        req.status >= 200 &&
        req.status < 300 &&
        this.isMeaningfulApiRequest(req.url)
    ).length;

    const analyzedRequests = this.analyze().apiCalls.length;
    const ignoredRequests = totalRequests - meaningfulRequests;

    // 分类统计
    const apiCalls = this.requests.filter((req) =>
      this.isApiEndpoint(req.url)
    ).length;
    const staticResources = this.requests.filter((req) => {
      const url = req.url.toLowerCase();
      return (
        /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url) ||
        /\/static\//.test(url) ||
        /\/assets\//.test(url) ||
        /\/public\//.test(url)
      );
    }).length;
    const browserInternal = this.requests.filter((req) => {
      const url = req.url.toLowerCase();
      return /chrome-extension:|moz-extension:|safari-extension:|data:|blob:|about:|chrome:|edge:|firefox:|safari:/.test(
        url
      );
    }).length;
    const other = totalRequests - apiCalls - staticResources - browserInternal;

    return {
      totalRequests,
      meaningfulRequests,
      analyzedRequests,
      ignoredRequests,
      requestBreakdown: {
        apiCalls,
        staticResources,
        browserInternal,
        other,
      },
    };
  }
}

// 创建全局实例
export const networkAnalyzer = new NetworkAnalyzer();

/**
 * 分析当前页面的网络请求
 */
export function analyzeNetworkRequests(): NetworkAnalysisResult {
  return networkAnalyzer.analyze();
}

/**
 * 获取网络请求摘要
 */
export function getNetworkSummary(): string {
  const analysis = networkAnalyzer.analyze();
  return analysis.summary;
}

/**
 * 获取关键数据
 */
export function getKeyData(): any[] {
  const analysis = networkAnalyzer.analyze();
  return analysis.keyData;
}
