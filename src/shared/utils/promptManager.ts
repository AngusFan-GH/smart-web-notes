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
  hasNetworkData: boolean;
  networkSummary?: string;
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
    url: string,
    networkAnalysis?: any,
    domStructure?: any
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
      hasNetworkData: !!networkAnalysis,
      networkSummary: networkAnalysis?.summary,
    };

    return this.buildPromptTemplate(
      context,
      question,
      content,
      networkAnalysis,
      domStructure
    );
  }

  /**
   * 构建提示词模板
   */
  private buildPromptTemplate(
    context: PromptContext,
    question: string,
    content: string,
    networkAnalysis?: any,
    domStructure?: any
  ): PromptTemplate {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(
      context,
      question,
      content,
      networkAnalysis,
      domStructure
    );

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
    const basePrompt = `你是一个智能网页助手，通过对话帮助用户理解和操作网页。你的核心能力包括：

## 🎯 核心能力
- **内容分析**：深度理解网页内容、数据和结构
- **智能对话**：自然语言交互，理解用户意图
- **浏览器控制**：通过对话控制页面元素和样式
- **数据提取**：分析网络请求和API数据
- **智能建议**：提供个性化的操作建议

## 💬 交互方式
- 支持自然语言对话
- 理解快捷命令（如"清空消息"、"获取数据"等）
- 提供实时的命令建议
- 智能识别用户意图

## 📋 回答原则
1. **准确性**：基于实际内容回答，不编造信息
2. **相关性**：回答与用户问题直接相关
3. **完整性**：提供充分的信息支持
4. **可读性**：使用Markdown格式，结构清晰
5. **实用性**：提供可操作的建议和解决方案

## 浏览器控制能力
**重要：只有在用户明确请求控制浏览器时才使用此功能！**

当用户明确要求以下操作时，你才可以使用浏览器控制：
- 隐藏或移除特定元素（如"隐藏广告"、"去掉弹窗"）
- 修改页面样式（如"改变字体大小"、"调整颜色"）
- 高亮重要内容（如"高亮标题"、"标记重点"）
- 控制页面布局（如"隐藏侧边栏"、"调整布局"）

### 浏览器控制指令格式
**仅在用户明确请求浏览器操作时使用：**

\`\`\`browser-control
{
  "type": "hide|show|style|remove|highlight|add|modify|move|execute_js",
  "selector": "CSS选择器（execute_js类型可选）",
  "css": "自定义CSS样式（仅style类型需要）",
  "reason": "操作原因说明",
  "content": "内容（add/modify类型需要）",
  "tag": "标签名（add类型需要）",
  "attributes": {"属性名": "属性值"}（add/modify类型需要）,
  "targetSelector": "目标选择器（move类型需要）",
  "position": "位置：before|after|inside（add/move类型需要）",
  "javascript": "JavaScript代码（execute_js类型需要）",
  "method": "推荐方法：css|dom|javascript"
}
\`\`\`

### 常用CSS选择器示例
- 广告：\`.ad, .advertisement, [class*="ad-"], [id*="ad-"]\`
- 弹窗：\`.modal, .popup, .overlay, [class*="popup"]\`
- 侧边栏：\`.sidebar, .aside, [class*="sidebar"]\`
- 导航：\`.nav, .navigation, [class*="nav"]\`
- 页脚：\`footer, .footer, [class*="footer"]\`

### 选择器注意事项
**重要：避免使用不兼容的选择器！**
- ❌ 不要使用 \`:has()\` 选择器（浏览器支持有限）
- ❌ 不要使用 \`:contains()\` 选择器（不是标准CSS，无法工作）
- ❌ 不要使用 \`:nth-of-type()\` 等复杂选择器
- ✅ 使用 \`[class*="关键词"]\` 匹配包含关键词的class
- ✅ 使用 \`[id*="关键词"]\` 匹配包含关键词的id
- ✅ 使用 \`[title*="关键词"]\` 匹配title属性
- ✅ 使用 \`[aria-label*="关键词"]\` 匹配aria-label属性
- ✅ 使用 \`element:nth-child(n)\` 选择第n个子元素
- ✅ 使用 \`element:first-child\` 和 \`element:last-child\`
- ✅ 使用 \`element:not(.class)\` 排除特定class的元素

### 文本匹配替代方案
**当需要匹配包含特定文本的元素时：**
- 使用 \`[title*="文本"]\` 而不是 \`:contains("文本")\`
- 使用 \`[aria-label*="文本"]\` 匹配无障碍标签
- 使用 \`[data-*="文本"]\` 匹配自定义数据属性
- 使用 \`[class*="关键词"]\` 匹配class名称
- 如果元素没有相关属性，使用父级选择器 + 位置选择器

### 特殊情况处理
**对于包含特定文本的元素，如果无法使用属性选择器：**
1. 首先尝试使用元素的class或ID
2. 如果元素有特定的class（如 \`.tts-b-hl\`），使用该class
3. 结合父级选择器来缩小范围
4. 使用多个选择器组合，用逗号分隔

**文本匹配策略：**
- 如果元素有独特的class，直接使用class选择器
- 如果元素有ID，使用ID选择器
- 如果元素有特定的属性值，使用属性选择器
- 如果以上都不适用，使用JavaScript方法进行文本匹配

**示例：**
- 不要使用：\`span:contains("一见")\` 或 \`a[href*="一见"]\`
- 应该使用：\`.tts-b-hl\` 或 \`span.tts-b-hl\`
- 或者使用JavaScript：\`document.querySelectorAll('*').forEach(el => { if(el.textContent && el.textContent.includes('一见')) { el.style.border = '2px solid blue'; } });\`

### 智能方法选择
**根据任务类型选择最合适的方法：**

#### 1. **CSS方法** (推荐用于样式操作)
- 适用场景：隐藏、显示、高亮、样式修改
- 优势：简单、高效、兼容性好
- 示例：\`{"type": "highlight", "selector": ".target", "css": "border: 2px solid blue;"}\`

#### 2. **DOM方法** (推荐用于结构操作)
- 适用场景：添加、删除、修改、移动元素
- 优势：真正的DOM操作，持久化
- 示例：\`{"type": "remove", "selector": ".advertisement"}\`

#### 3. **JavaScript方法** (推荐用于复杂操作)
- 适用场景：复杂逻辑、条件判断、动态操作
- 优势：最灵活，可以实现任何操作
- 示例：\`{"type": "execute_js", "javascript": "document.querySelectorAll('span').forEach(el => { if(el.textContent.includes('一见')) el.style.border = '2px solid blue'; });"}\`

### 方法选择策略
1. **简单样式操作** → 使用CSS方法
2. **元素结构操作** → 使用DOM方法  
3. **复杂逻辑操作** → 使用JavaScript方法
4. **文本匹配困难** → 使用JavaScript方法
5. **需要条件判断** → 使用JavaScript方法
6. **匹配包含特定文本的元素** → 优先使用JavaScript方法

### 文本匹配最佳实践
**当需要匹配包含特定文本的元素时：**
- 如果元素有独特的class或ID，可以使用CSS方法
- 如果元素没有独特的标识符，必须使用JavaScript方法
- JavaScript方法可以精确匹配textContent，不受选择器限制

**推荐做法：**
- 对于"高亮包含'X'文本的元素"这类任务，优先使用JavaScript方法
- 使用 \`document.querySelectorAll('*')\` 遍历所有元素
- 使用 \`textContent.includes()\` 进行文本匹配

### 精确选择器生成策略
**基于提供的DOM信息，按优先级选择：**
1. **ID选择器**：\`#elementId\` （最精确，优先使用）
2. **Class组合**：\`.class1.class2\` （多个相关class组合）
3. **属性选择器**：\`[title="具体值"]\` 或 \`[href*="部分值"]\`
4. **标签+属性**：\`div[class="specific-class"]\`
5. **层级选择器**：\`parent > child\` 或 \`ancestor descendant\`
6. **位置选择器**：\`element:nth-child(n)\` 或 \`element:first-child\`

### 选择器验证
**生成选择器后，请确保：**
- 选择器语法正确且兼容主流浏览器
- 优先使用ID和class组合，避免复杂的层级选择
- 如果元素有多个推荐选择器，选择最简洁且最精确的那个
- 避免使用可能匹配多个元素的模糊选择器

**注意：对于内容分析、总结、回答问题等任务，不需要使用浏览器控制功能！**`;

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
    content: string,
    networkAnalysis?: any,
    domStructure?: any
  ): string {
    const contentInfo = this.getContentInfo(context, content);
    const networkInfo = this.getNetworkInfo(networkAnalysis);
    const domInfo = this.getDOMInfo(domStructure);
    const htmlStructure = this.getPageHTMLStructure(domStructure);

    return `作为智能网页助手，请基于以下网页内容回答用户问题：

${contentInfo}

${networkInfo}

${domInfo}

${htmlStructure}

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
   * 获取网络分析信息
   */
  private getNetworkInfo(networkAnalysis?: any): string {
    if (!networkAnalysis) {
      return "";
    }

    let info = `**网络请求分析：**\n${networkAnalysis.summary}`;

    if (
      networkAnalysis.dataEndpoints &&
      networkAnalysis.dataEndpoints.length > 0
    ) {
      info += `\n\n**主要API端点：**\n${networkAnalysis.dataEndpoints
        .slice(0, 5)
        .map((endpoint: string) => `- ${endpoint}`)
        .join("\n")}`;
    }

    if (networkAnalysis.keyData && networkAnalysis.keyData.length > 0) {
      info += `\n\n**关键数据字段：**\n`;
      networkAnalysis.keyData.slice(0, 3).forEach((data: any) => {
        info += `- ${data.field}: ${JSON.stringify(data.value).substring(
          0,
          100
        )}...\n`;
      });
    }

    return info;
  }

  /**
   * 获取DOM结构信息
   */
  private getDOMInfo(domStructure?: any): string {
    if (!domStructure) {
      return "";
    }

    let info = `**页面DOM结构信息（仅供参考，不用于自动操作）：**\n`;

    // 显示常见选择器
    if (domStructure.commonSelectors) {
      const { ads, navigation, content, sidebars } =
        domStructure.commonSelectors;

      if (ads.length > 0) {
        info += `\n**广告相关元素（仅用于识别，不自动操作）：**\n${ads
          .map((s: string) => `- ${s}`)
          .join("\n")}`;
      }

      if (navigation.length > 0) {
        info += `\n**导航相关元素：**\n${navigation
          .map((s: string) => `- ${s}`)
          .join("\n")}`;
      }

      if (content.length > 0) {
        info += `\n**内容相关元素：**\n${content
          .map((s: string) => `- ${s}`)
          .join("\n")}`;
      }

      if (sidebars.length > 0) {
        info += `\n**侧边栏相关元素：**\n${sidebars
          .map((s: string) => `- ${s}`)
          .join("\n")}`;
      }
    }

    // 显示完整的页面结构信息
    if (domStructure.elements && domStructure.elements.length > 0) {
      info += `\n\n**完整页面DOM结构：**\n`;

      // 按层级显示所有元素，提供完整的页面结构
      const allElements = domStructure.elements.slice(0, 50); // 增加到50个元素

      // 按标签类型分组显示
      const elementsByTag = allElements.reduce((acc: any, element: any) => {
        const tag = element.tag;
        if (!acc[tag]) acc[tag] = [];
        acc[tag].push(element);
        return acc;
      }, {});

      // 显示每种标签类型的元素
      Object.entries(elementsByTag).forEach(
        ([tag, elements]: [string, any]) => {
          info += `\n**${tag.toUpperCase()} 元素 (${elements.length}个)：**\n`;
          elements.forEach((element: any, index: number) => {
            const text = element.text
              ? ` - "${element.text.substring(0, 150)}..."`
              : "";
            const position = element.position
              ? ` [位置: ${element.position.x},${element.position.y} 大小: ${element.position.width}x${element.position.height}]`
              : "";
            const parent = element.parentSelector
              ? ` [父元素: ${element.parentSelector}]`
              : "";
            const children =
              element.childrenCount > 0
                ? ` [子元素: ${element.childrenCount}个]`
                : "";

            // 生成更精确的选择器建议
            const preciseSelectors = element.preciseSelectors || [];
            const selectorInfo =
              preciseSelectors.length > 0
                ? ` [推荐选择器: ${preciseSelectors.join(", ")}]`
                : "";

            // 添加更多定位信息
            const xpathInfo = element.xpath ? ` [XPath: ${element.xpath}]` : "";
            const cssPathInfo = element.cssPath
              ? ` [CSS路径: ${element.cssPath}]`
              : "";
            const roleInfo = element.semanticRole
              ? ` [语义: ${element.semanticRole}]`
              : "";

            info += `  ${index + 1}. ${element.selector} (${
              element.tag
            })${text}${position}${parent}${children}${selectorInfo}${xpathInfo}${cssPathInfo}${roleInfo}\n`;
          });
        }
      );

      // 特别显示包含特定文本的元素
      const textElements = allElements.filter(
        (element: any) => element.text && element.text.includes("一见")
      );

      if (textElements.length > 0) {
        info += `\n\n**包含"一见"文本的元素：**\n`;
        textElements.forEach((element: any, index: number) => {
          const text = element.text ? ` - "${element.text}"` : "";
          const preciseSelectors = element.preciseSelectors || [];
          const selectorInfo =
            preciseSelectors.length > 0
              ? ` [推荐选择器: ${preciseSelectors.join(", ")}]`
              : "";
          info += `  ${index + 1}. ${element.selector} (${
            element.tag
          })${text}${selectorInfo}\n`;
        });
      }
    }

    return info;
  }

  /**
   * 获取页面完整HTML结构
   */
  private getPageHTMLStructure(domData?: any): string {
    try {
      // 如果传入了DOM数据，使用传入的数据
      if (domData && domData.htmlStructure) {
        return domData.htmlStructure;
      }

      // 检查是否在background script环境中
      if (typeof document === "undefined") {
        console.log("在background script环境中，跳过HTML结构获取");
        return "";
      }

      // 获取页面的主要结构
      const body = document.body;
      if (!body) return "";

      let html = `**页面完整HTML结构：**\n`;
      html += `\`\`\`html\n`;

      // 获取页面的主要部分
      const mainSections = [
        "header",
        "nav",
        "main",
        "article",
        "section",
        "aside",
        "footer",
      ];

      mainSections.forEach((tag) => {
        const elements = document.querySelectorAll(tag);
        if (elements.length > 0) {
          html += `<!-- ${tag.toUpperCase()} 部分 -->\n`;
          elements.forEach((el, index) => {
            const outerHTML = el.outerHTML;
            // 限制长度，避免过长
            const truncatedHTML =
              outerHTML.length > 500
                ? outerHTML.substring(0, 500) + "..."
                : outerHTML;
            html += `${truncatedHTML}\n`;
          });
          html += `\n`;
        }
      });

      // 获取包含特定文本的元素
      const textElements = document.querySelectorAll("*");
      const relevantElements: Element[] = [];

      textElements.forEach((el) => {
        if (el.textContent && el.textContent.includes("一见")) {
          relevantElements.push(el);
        }
      });

      if (relevantElements.length > 0) {
        html += `<!-- 包含"一见"文本的元素 -->\n`;
        relevantElements.forEach((el) => {
          const outerHTML = el.outerHTML;
          const truncatedHTML =
            outerHTML.length > 300
              ? outerHTML.substring(0, 300) + "..."
              : outerHTML;
          html += `${truncatedHTML}\n`;
        });
      }

      html += `\`\`\`\n`;
      return html;
    } catch (error) {
      console.error("获取页面HTML结构失败:", error);
      return "";
    }
  }

  /**
   * 生成精确的选择器建议
   */
  private generatePreciseSelectors(element: any): string[] {
    const selectors: string[] = [];

    // 1. 基于ID的选择器（最精确）
    if (element.id) {
      selectors.push(`#${element.id}`);
    }

    // 2. 基于class的组合选择器
    if (element.classes && element.classes.length > 0) {
      const relevantClasses = element.classes.filter(
        (cls: string) =>
          !cls.includes("ng-") && !cls.match(/^[a-f0-9]{6,}$/) && cls.length > 2
      );

      if (relevantClasses.length > 0) {
        // 单个class
        relevantClasses.forEach((cls: string) => {
          selectors.push(`.${cls}`);
        });

        // 多个class组合
        if (relevantClasses.length > 1) {
          selectors.push(`.${relevantClasses.join(".")}`);
        }
      }
    }

    // 3. 基于文本内容的选择器
    if (element.text && element.text.length > 0) {
      const cleanText = element.text.replace(/[^\w\s]/g, "").trim();
      if (cleanText.length > 3 && cleanText.length < 50) {
        // 使用属性选择器匹配文本
        selectors.push(`[title*="${cleanText.substring(0, 20)}"]`);
        selectors.push(`[alt*="${cleanText.substring(0, 20)}"]`);
      }
    }

    // 4. 基于位置的选择器
    if (element.parentSelector) {
      selectors.push(`${element.parentSelector} > ${element.tag}`);
      selectors.push(`${element.parentSelector} ${element.tag}`);
    }

    // 5. 基于标签和属性的组合
    if (element.attributes) {
      Object.entries(element.attributes).forEach(([key, value]) => {
        if (typeof value === "string" && value.length > 0) {
          selectors.push(`${element.tag}[${key}="${value}"]`);
          selectors.push(`${element.tag}[${key}*="${value.substring(0, 20)}"]`);
        }
      });
    }

    // 6. 基于语义的选择器
    const semanticSelectors = this.getSemanticSelectors(element);
    selectors.push(...semanticSelectors);

    // 去重并限制数量
    return [...new Set(selectors)].slice(0, 5);
  }

  /**
   * 获取语义化选择器
   */
  private getSemanticSelectors(element: any): string[] {
    const selectors: string[] = [];
    const tag = element.tag.toLowerCase();
    const text = element.text?.toLowerCase() || "";

    // 基于标签语义 - 使用兼容的选择器
    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
      // 使用属性选择器而不是:contains()
      if (text.length > 0) {
        selectors.push(`${tag}[title*="${text.substring(0, 20)}"]`);
        selectors.push(`${tag}[aria-label*="${text.substring(0, 20)}"]`);
      }
    }

    if (tag === "a" && text.includes("http")) {
      selectors.push("a[href]");
    }

    if (tag === "img") {
      selectors.push("img[src]");
    }

    if (["button", "input", "select", "textarea"].includes(tag)) {
      selectors.push(`${element.tag}[type]`);
    }

    // 基于文本内容的关键词 - 使用兼容的选择器
    const keywords = this.extractKeywords(text);
    keywords.forEach((keyword) => {
      if (keyword.length > 2) {
        // 使用属性选择器而不是:contains()
        selectors.push(`${tag}[title*="${keyword}"]`);
        selectors.push(`${tag}[aria-label*="${keyword}"]`);
        selectors.push(`${tag}[data-text*="${keyword}"]`);
      }
    });

    return selectors;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    if (!text) return [];

    // 简单的关键词提取
    const words = text
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .filter((word) => !/^[0-9]+$/.test(word)) // 排除纯数字
      .slice(0, 3); // 只取前3个词

    return words;
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

  /**
   * 解析AI回答中的浏览器控制指令
   */
  public parseBrowserControlInstructions(content: string): Array<{
    type:
      | "hide"
      | "show"
      | "style"
      | "remove"
      | "highlight"
      | "add"
      | "modify"
      | "move"
      | "execute_js";
    selector?: string;
    css?: string;
    reason?: string;
    content?: string;
    tag?: string;
    attributes?: Record<string, string>;
    targetSelector?: string;
    position?: "before" | "after" | "inside";
    javascript?: string;
    method?: "css" | "dom" | "javascript";
  }> {
    const instructions: Array<{
      type:
        | "hide"
        | "show"
        | "style"
        | "remove"
        | "highlight"
        | "add"
        | "modify"
        | "move"
        | "execute_js";
      selector?: string;
      css?: string;
      reason?: string;
      content?: string;
      tag?: string;
      attributes?: Record<string, string>;
      targetSelector?: string;
      position?: "before" | "after" | "inside";
      javascript?: string;
      method?: "css" | "dom" | "javascript";
    }> = [];

    // 首先尝试解析JSON格式的指令
    try {
      const jsonMatch = content.match(/\{[\s\S]*"type"[\s\S]*\}/);
      if (jsonMatch) {
        const instruction = JSON.parse(jsonMatch[0]);
        if (
          instruction.type &&
          this.isValidBrowserActionType(instruction.type)
        ) {
          instructions.push(instruction);
          return instructions;
        }
      }
    } catch (error) {
      // JSON解析失败，继续尝试其他格式
    }

    // 匹配 ```browser-control 代码块
    const browserControlRegex = /```browser-control\s*\n([\s\S]*?)\n```/g;
    let match;

    while ((match = browserControlRegex.exec(content)) !== null) {
      try {
        const instruction = JSON.parse(match[1].trim());
        if (
          instruction.type &&
          this.isValidBrowserActionType(instruction.type)
        ) {
          instructions.push(instruction);
        }
      } catch (error) {
        console.warn("解析浏览器控制指令失败:", error, match[1]);
      }
    }

    return instructions;
  }

  /**
   * 检查内容是否包含浏览器控制指令
   */
  public hasBrowserControlInstructions(content: string): boolean {
    // 检查browser-control代码块格式
    if (/```browser-control\s*\n[\s\S]*?\n```/.test(content)) {
      return true;
    }

    // 检查JSON格式的指令
    try {
      const jsonMatch = content.match(/\{[\s\S]*"type"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.type && this.isValidBrowserActionType(parsed.type);
      }
    } catch (error) {
      // JSON解析失败，继续检查其他格式
    }

    return false;
  }

  /**
   * 检查是否为有效的浏览器操作类型
   */
  private isValidBrowserActionType(type: string): boolean {
    const validTypes = [
      "hide",
      "show",
      "style",
      "remove",
      "highlight",
      "add",
      "modify",
      "move",
      "execute_js",
    ];
    return validTypes.includes(type);
  }
}

// 导出单例实例
export const promptManager = PromptManager.getInstance();

// 便捷函数
export function generateSmartPrompt(
  question: string,
  content: string,
  url: string,
  networkAnalysis?: any,
  domStructure?: any
): PromptTemplate {
  return promptManager.generatePrompt(
    question,
    content,
    url,
    networkAnalysis,
    domStructure
  );
}
