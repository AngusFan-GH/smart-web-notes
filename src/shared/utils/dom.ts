// DOM 操作工具函数
export function parseWebContent(): string {
  // 克隆当前文档以供解析，不影响原始页面
  const docClone = document.cloneNode(true) as Document;

  // 在克隆的文档中移除不需要的元素
  const scripts = docClone.querySelectorAll("script");
  const styles = docClone.querySelectorAll('style, link[rel="stylesheet"]');
  const headers = docClone.querySelectorAll("header, nav");
  const footers = docClone.querySelectorAll("footer");

  // 从克隆的文档中移除元素
  [...scripts, ...styles, ...headers, ...footers].forEach((element) => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });

  // 获取主要内容（从body中提取）
  const mainContent = docClone.querySelector("body");

  // 如果找到了body元素，获取其文本内容
  const textContent = mainContent ? mainContent.innerText : "";

  // 清理文本
  return textContent
    .replace(/\s+/g, " ") // 将多个空白字符替换为单个空格
    .trim(); // 移除首尾空白
}

export function createElement(
  tag: string,
  className?: string,
  id?: string
): HTMLElement {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (id) element.id = id;
  return element;
}

export function addEventListeners(
  element: HTMLElement,
  events: { [key: string]: EventListener }
): void {
  Object.entries(events).forEach(([event, listener]) => {
    element.addEventListener(event, listener);
  });
}

export function removeEventListeners(
  element: HTMLElement,
  events: { [key: string]: EventListener }
): void {
  Object.entries(events).forEach(([event, listener]) => {
    element.removeEventListener(event, listener);
  });
}
