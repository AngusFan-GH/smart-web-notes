import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

// 创建markdown-it实例
const md = new MarkdownIt({
  html: true,        // 允许HTML标签
  breaks: true,      // 将换行符转换为<br>
  linkify: true,     // 自动转换URL为链接
  typographer: true, // 启用智能引号和其他排版替换
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(str, { language: lang }).value +
               '</code></pre>';
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

// 渲染markdown文本
export function renderMarkdown(text: string): string {
  try {
    return md.render(text);
  } catch (error) {
    console.error('Markdown渲染失败:', error);
    return text; // 返回原始文本作为后备
  }
}

// 渲染markdown文本（内联模式）
export function renderMarkdownInline(text: string): string {
  try {
    return md.renderInline(text);
  } catch (error) {
    console.error('Markdown内联渲染失败:', error);
    return text; // 返回原始文本作为后备
  }
}

// 导出markdown-it实例供其他用途
export { md };
