import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css"; // 添加代码高亮样式

// 创建Markdown解析器
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true, // 将单个换行符转换为 <br> 标签
  highlight: function (str, lang) {
    // 特殊处理Vue模板，将其识别为XML
    if (lang === "vue" || (lang === "html" && str.includes("<template>"))) {
      try {
        return hljs.highlight(str, { language: "xml" }).value;
      } catch (error) {
        // 静默处理错误
      }
    }

    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (error) {
        // 静默处理错误
      }
    }

    // 如果没有指定语言或语言不支持，尝试自动检测
    try {
      return hljs.highlightAuto(str).value;
    } catch (error) {
      // 静默处理错误
    }

    // 如果所有方法都失败，返回空字符串让markdown-it使用默认处理
    return "";
  },
});

// @vscode/markdown-it-katex 会自动处理数学公式渲染

// 添加数学公式预处理
function escapeDollarNumber(text: string) {
  let escapedText = "";

  for (let i = 0; i < text.length; i += 1) {
    let char = text[i];
    const nextChar = text[i + 1] || " ";

    if (char === "$" && nextChar >= "0" && nextChar <= "9") char = "\\$";

    escapedText += char;
  }

  return escapedText;
}

function escapeBrackets(text: string) {
  const pattern =
    /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (match, codeBlock, squareBracket, roundBracket) => {
      if (codeBlock) return codeBlock;
      else if (squareBracket) return `$$${squareBracket}$$`;
      else if (roundBracket) return `$${roundBracket}$`;
      return match;
    }
  );
}

// 轻量级数学渲染器状态

// 轻量级数学公式渲染器
class LightweightMathRenderer {
  private static instance: LightweightMathRenderer;
  private isLoaded = false;

  static getInstance(): LightweightMathRenderer {
    if (!this.instance) {
      this.instance = new LightweightMathRenderer();
    }
    return this.instance;
  }

  // 检查是否已加载
  isReady(): boolean {
    return this.isLoaded;
  }

  // 初始化渲染器
  async init(): Promise<boolean> {
    if (this.isLoaded) return true;

    try {
      // 添加数学公式样式
      this.addMathStyles();
      this.isLoaded = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  // 同步初始化渲染器（用于立即使用）
  initSync(): boolean {
    if (this.isLoaded) return true;

    try {
      // 添加数学公式样式
      this.addMathStyles();
      this.isLoaded = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  // 添加数学公式样式
  private addMathStyles(): void {
    if (document.querySelector("#math-renderer-styles")) return;

    const style = document.createElement("style");
    style.id = "math-renderer-styles";
    style.textContent = `
      .math-block {
        display: block;
        text-align: center;
        margin: 1em 0;
        padding: 0.5em;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        font-family: 'KaTeX_Main', 'Times New Roman', serif;
        font-size: 1.1em;
        line-height: 1.4;
        overflow-x: auto;
      }
      .math-inline {
        display: inline;
        padding: 0.1em 0.3em;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        font-family: 'KaTeX_Main', 'Times New Roman', serif;
        font-size: 0.95em;
      }
      .math-superscript {
        font-size: 0.7em;
        vertical-align: super;
      }
      .math-subscript {
        font-size: 0.7em;
        vertical-align: sub;
      }
      .math-fraction {
        display: inline-block;
        vertical-align: middle;
        text-align: center;
      }
      .math-fraction .numerator {
        display: block;
        border-bottom: 1px solid currentColor;
        padding-bottom: 1px;
      }
      .math-fraction .denominator {
        display: block;
        padding-top: 1px;
      }
      .math-matrix {
        display: inline-block;
        text-align: center;
        margin: 0.5em 0;
        padding: 0.5em;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        font-family: 'Times New Roman', serif;
      }
      /* 代码块样式 - 参考前端项目实现 */
      pre {
        background: rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 1rem;
        margin: 1rem 0;
        overflow-x: auto;
        font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
        font-size: 0.9em;
        line-height: 1.5;
        position: relative;
      }
      code {
        background: rgba(0, 0, 0, 0.1);
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
        font-size: 0.9em;
      }
      pre code {
        background: transparent;
        padding: 0;
        border-radius: 0;
        display: block;
        overflow-x: auto;
      }
      /* 确保代码块有正确的样式 */
      .hljs {
        background: transparent !important;
        color: inherit;
      }
      /* 代码块语言标识 */
      pre[class*="language-"] {
        position: relative;
      }
      pre[class*="language-"]::before {
        content: attr(class);
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
      }
    `;
    document.head.appendChild(style);
  }

  // 渲染数学公式
  renderMath(formula: string, displayMode: boolean = false): string {
    try {
      // 简单的数学公式解析和渲染
      let rendered = this.parseMathFormula(formula);

      if (displayMode) {
        return `<div class="math-block">${rendered}</div>`;
      } else {
        return `<span class="math-inline">${rendered}</span>`;
      }
    } catch (error) {
      console.warn("数学公式渲染失败:", error);
      return displayMode
        ? `<div class="math-block">$$${formula}$$</div>`
        : `<span class="math-inline">$$${formula}$$</span>`;
    }
  }

  // 解析数学公式
  private parseMathFormula(formula: string): string {
    let result = formula.trim();

    // 处理上标 x^2 -> x²
    result = result.replace(
      /\^(\d+)/g,
      '<sup class="math-superscript">$1</sup>'
    );
    result = result.replace(
      /\^(\w+)/g,
      '<sup class="math-superscript">$1</sup>'
    );

    // 处理下标 x_1 -> x₁
    result = result.replace(/_(\d+)/g, '<sub class="math-subscript">$1</sub>');
    result = result.replace(/_(\w+)/g, '<sub class="math-subscript">$1</sub>');

    // 处理分数 \frac{a}{b} -> 分数显示
    result = result.replace(
      /\\frac\{([^}]+)\}\{([^}]+)\}/g,
      '<span class="math-fraction"><span class="numerator">$1</span><span class="denominator">$2</span></span>'
    );

    // 处理根号 \sqrt{x} -> √x
    result = result.replace(/\\sqrt\{([^}]+)\}/g, "√$1");

    // 处理n次方根 \sqrt[n]{x} -> ⁿ√x
    result = result.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, "$1√$2");

    // 处理积分 \int -> ∫
    result = result.replace(/\\int/g, "∫");

    // 处理定积分 \int_a^b -> ∫ₐᵇ
    result = result.replace(/\\int_([^}]+)\^([^}]+)/g, "∫$1$2");

    // 处理求和 \sum -> ∑
    result = result.replace(/\\sum/g, "∑");

    // 处理求和范围 \sum_{i=1}^n -> ∑ᵢ₌₁ⁿ
    result = result.replace(/\\sum_\{([^}]+)\}\^([^}]+)/g, "∑$1$2");

    // 处理乘积 \prod -> ∏
    result = result.replace(/\\prod/g, "∏");

    // 处理极限 \lim -> lim
    result = result.replace(/\\lim/g, "lim");

    // 处理极限 \lim_{x \to a} -> lim_{x→a}
    result = result.replace(
      /\\lim_\{([^}]+)\s*\\to\s*([^}]+)\}/g,
      "lim_{$1→$2}"
    );

    // 处理矩阵 \begin{matrix}...\end{matrix}
    result = result.replace(
      /\\begin\{matrix\}(.*?)\\end\{matrix\}/gs,
      (match, content) => {
        const rows = content
          .trim()
          .split("\\\\")
          .map((row) =>
            row
              .trim()
              .split("&")
              .map((cell) => cell.trim())
              .join(" & ")
          );
        return `<div class="math-matrix">${rows.join("<br>")}</div>`;
      }
    );

    // 处理括号
    result = result.replace(/\\left\(/g, "(");
    result = result.replace(/\\right\)/g, ")");
    result = result.replace(/\\left\[/g, "[");
    result = result.replace(/\\right\]/g, "]");
    result = result.replace(/\\left\{/g, "{");
    result = result.replace(/\\right\}/g, "}");

    // 处理函数名
    const functions = [
      "sin",
      "cos",
      "tan",
      "cot",
      "sec",
      "csc",
      "arcsin",
      "arccos",
      "arctan",
      "sinh",
      "cosh",
      "tanh",
      "log",
      "ln",
      "exp",
      "max",
      "min",
      "sup",
      "inf",
      "lim",
      "det",
      "rank",
      "dim",
      "span",
      "ker",
      "im",
    ];
    functions.forEach((func) => {
      result = result.replace(new RegExp(`\\\\${func}\\b`, "g"), func);
    });

    // 处理希腊字母
    const greekLetters: { [key: string]: string } = {
      "\\alpha": "α",
      "\\beta": "β",
      "\\gamma": "γ",
      "\\delta": "δ",
      "\\epsilon": "ε",
      "\\zeta": "ζ",
      "\\eta": "η",
      "\\theta": "θ",
      "\\lambda": "λ",
      "\\mu": "μ",
      "\\nu": "ν",
      "\\xi": "ξ",
      "\\pi": "π",
      "\\rho": "ρ",
      "\\sigma": "σ",
      "\\tau": "τ",
      "\\phi": "φ",
      "\\chi": "χ",
      "\\psi": "ψ",
      "\\omega": "ω",
      "\\Gamma": "Γ",
      "\\Delta": "Δ",
      "\\Theta": "Θ",
      "\\Lambda": "Λ",
      "\\Pi": "Π",
      "\\Sigma": "Σ",
      "\\Phi": "Φ",
      "\\Omega": "Ω",
    };

    for (const [latex, symbol] of Object.entries(greekLetters)) {
      result = result.replace(
        new RegExp(latex.replace(/\\/g, "\\\\"), "g"),
        symbol
      );
    }

    // 处理数学符号
    const mathSymbols: { [key: string]: string } = {
      "\\infty": "∞",
      "\\pm": "±",
      "\\mp": "∓",
      "\\times": "×",
      "\\div": "÷",
      "\\leq": "≤",
      "\\geq": "≥",
      "\\neq": "≠",
      "\\approx": "≈",
      "\\equiv": "≡",
      "\\propto": "∝",
      "\\in": "∈",
      "\\notin": "∉",
      "\\subset": "⊂",
      "\\supset": "⊃",
      "\\cup": "∪",
      "\\cap": "∩",
      "\\emptyset": "∅",
      "\\rightarrow": "→",
      "\\leftarrow": "←",
      "\\leftrightarrow": "↔",
      "\\Rightarrow": "⇒",
      "\\Leftarrow": "⇐",
      "\\Leftrightarrow": "⇔",
      "\\forall": "∀",
      "\\exists": "∃",
      "\\nabla": "∇",
      "\\partial": "∂",
      "\\angle": "∠",
      "\\triangle": "△",
      "\\square": "□",
      "\\diamond": "◇",
      "\\bullet": "•",
      "\\cdot": "·",
      "\\cdots": "⋯",
      "\\ldots": "…",
      "\\vdots": "⋮",
      "\\ddots": "⋱",
      "\\therefore": "∴",
      "\\because": "∵",
      "\\sim": "∼",
      "\\simeq": "≃",
      "\\cong": "≅",
      "\\asymp": "≍",
      "\\ll": "≪",
      "\\gg": "≫",
      "\\prec": "≺",
      "\\succ": "≻",
      "\\preceq": "≼",
      "\\succeq": "≽",
      "\\parallel": "∥",
      "\\perp": "⊥",
      "\\wedge": "∧",
      "\\vee": "∨",
      "\\neg": "¬",
      "\\oplus": "⊕",
      "\\ominus": "⊖",
      "\\otimes": "⊗",
      "\\odot": "⊙",
      "\\sum": "∑",
      "\\prod": "∏",
      "\\coprod": "∐",
      "\\int": "∫",
      "\\iint": "∬",
      "\\iiint": "∭",
      "\\oint": "∮",
      "\\bigcup": "⋃",
      "\\bigcap": "⋂",
      "\\bigwedge": "⋀",
      "\\bigvee": "⋁",
      "\\bigotimes": "⊗",
      "\\bigoplus": "⊕",
      "\\bigodot": "⊙",
      "\\biguplus": "⊎",
      "\\bigsqcup": "⊔",
    };

    for (const [latex, symbol] of Object.entries(mathSymbols)) {
      result = result.replace(
        new RegExp(latex.replace(/\\/g, "\\\\"), "g"),
        symbol
      );
    }

    return result;
  }
}

// 轻量级数学渲染器实例
const mathRenderer = LightweightMathRenderer.getInstance();

// 检查数学渲染器是否可用
function isMathRendererAvailable(): boolean {
  return mathRenderer.isReady();
}

// 加载数学渲染器
async function loadMathRenderer(): Promise<boolean> {
  return await mathRenderer.init();
}

// 轻量级数学公式渲染
function renderMathWithRenderer(html: string): string {
  // 如果渲染器未初始化，先同步初始化
  if (!isMathRendererAvailable()) {
    const initSuccess = mathRenderer.initSync();
    if (!initSuccess) {
      return renderSimpleMath(html);
    }
  }

  try {
    // 处理块级数学公式 $$...$$
    html = html.replace(/\$\$(.*?)\$\$/gs, (match, formula) => {
      try {
        const rendered = mathRenderer.renderMath(formula.trim(), true);
        return rendered;
      } catch (error) {
        return `<div class="math-block">$$${formula}$$</div>`;
      }
    });

    // 处理行内数学公式 $...$
    html = html.replace(/\$(.*?)\$/g, (match, formula) => {
      try {
        const rendered = mathRenderer.renderMath(formula.trim(), false);
        return rendered;
      } catch (error) {
        return `<span class="math-inline">$$${formula}$$</span>`;
      }
    });

    return html;
  } catch (error) {
    return renderSimpleMath(html);
  }
}

// 检测并包装Vue模板为代码块
function wrapVueTemplateAsCodeBlock(text: string): string {
  // 检测Vue模板模式
  const vueTemplatePattern = /<template>[\s\S]*?<\/template>/;
  const vueScriptPattern = /<script[^>]*>[\s\S]*?<\/script>/;

  // 如果包含Vue模板但没有代码块标记，则自动包装
  if (vueTemplatePattern.test(text) && !text.includes("```")) {
    return `\`\`\`vue\n${text}\n\`\`\``;
  }

  // 检测其他代码模式（HTML、JavaScript、CSS等）
  const htmlPattern = /<[^>]+>.*<\/[^>]+>/;
  const jsPattern = /(function|const|let|var|import|export|class)\s+\w+/;
  const cssPattern = /[.#]?\w+\s*\{[^}]*\}/;

  if (
    (htmlPattern.test(text) || jsPattern.test(text) || cssPattern.test(text)) &&
    !text.includes("```")
  ) {
    return `\`\`\`\n${text}\n\`\`\``;
  }

  return text;
}

// 渲染Markdown内容
export async function renderMarkdown(text: string): Promise<string> {
  if (!text) {
    return "";
  }

  try {
    // 检测并包装Vue模板为代码块
    const wrappedText = wrapVueTemplateAsCodeBlock(text);

    // 预处理数学公式
    const escapedText = escapeBrackets(escapeDollarNumber(wrappedText));

    const html = md.render(escapedText);

    // 检查是否有数学公式
    const hasMath = text.includes("$");

    if (hasMath) {
      try {
        const mathRendererLoaded = await loadMathRenderer();

        if (mathRendererLoaded && isMathRendererAvailable()) {
          return renderMathWithRenderer(html);
        } else {
          return renderSimpleMath(html);
        }
      } catch (error) {
        return renderSimpleMath(html);
      }
    }

    // 确保HTML不为空
    if (!html || html.trim() === "") {
      return wrapAsPlainText(text);
    }

    return html;
  } catch (error) {
    return wrapAsPlainText(text);
  }
}

// 简单数学公式渲染（降级方案）
function renderSimpleMath(html: string): string {
  return html
    .replace(/\$\$(.*?)\$\$/g, '<div class="math-block">$$$1$$</div>')
    .replace(/\$(.*?)\$/g, '<span class="math-inline">$$$1$$</span>');
}

// 降级处理：将文本包装为可显示的HTML
function wrapAsPlainText(text: string): string {
  if (!text || text.trim() === "") {
    return "<p>内容为空</p>";
  }

  // 转义HTML特殊字符
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // 将换行符转换为<br>标签
  const withBreaks = escapedText.replace(/\n/g, "<br>");

  // 包装在段落中
  return `<p>${withBreaks}</p>`;
}

// 清理HTML内容
export function sanitizeHtml(html: string): string {
  // 简单的HTML清理，移除潜在的危险标签
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "");
}
