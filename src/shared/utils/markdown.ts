import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

// 创建Markdown解析器
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true, // 将单个换行符转换为 <br> 标签
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (__) {}
    }
    return "";
  },
});

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

// 渲染Markdown内容
export function renderMarkdown(text: string): string {
  if (!text) return "";

  try {
    // 预处理数学公式
    const escapedText = escapeBrackets(escapeDollarNumber(text));
    const html = md.render(escapedText);

    // 简单的数学公式处理
    return html
      .replace(/\$\$(.*?)\$\$/g, '<div class="math-block">$$$1$$</div>')
      .replace(/\$(.*?)\$/g, '<span class="math-inline">$$$1$$</span>');
  } catch (error) {
    console.error("Markdown渲染失败:", error);
    return text.replace(/\n/g, "<br>");
  }
}

// 清理HTML内容
export function sanitizeHtml(html: string): string {
  // 简单的HTML清理，移除潜在的危险标签
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "");
}
