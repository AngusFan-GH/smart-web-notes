export interface InteractiveElement {
  id: number;
  tagName: string;
  type?: string;
  text?: string;
  placeholder?: string;
  ariaLabel?: string;
  isVisible: boolean;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  path: string; // XPath or Selector
  // 增强的状态属性（借鉴 chrome-devtools-mcp）
  disabled?: boolean;
  checked?: boolean;
  focused?: boolean;
  value?: string;
  inViewport?: boolean; // 是否在视口内
}

// 定义可交互元素的选择器列表
const INTERACTIVE_SELECTORS = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'textarea',
  'select',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[contenteditable="true"]',
  '[onclick]',
  '[tabindex]:not([tabindex="-1"])'
];

/**
 * 交互元素提取器
 * 专注于提取页面上的可操作元素，为 Agent 提供操作目标
 */
export class InteractiveExtractor {
  
  /**
   * 提取页面上所有可见的交互元素
   * 并为每个元素生成唯一的数字 ID (Set-of-Mark)
   */
  public extractInteractiveElements(doc: Document = document): { 
    tree: InteractiveElement[], 
    elementMap: Map<number, Element> 
  } {
    const elementMap = new Map<number, Element>();
    const tree: InteractiveElement[] = [];
    let nextId = 1;

    // 获取视口信息
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };

    // 1. 查询所有潜在的交互元素
    const elements = doc.querySelectorAll(INTERACTIVE_SELECTORS.join(','));

    elements.forEach((el) => {
      // 2. 过滤不可见元素
      if (!this.isElementVisible(el)) return;

      // 3. 生成元素信息
      const id = nextId++;
      const rect = el.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(el);

      // 检查是否在视口内
      const inViewport = rect.top >= 0 && 
                        rect.left >= 0 && 
                        rect.bottom <= viewport.height && 
                        rect.right <= viewport.width;

      const info: InteractiveElement = {
        id,
        tagName: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || undefined,
        text: this.getElementText(el),
        placeholder: el.getAttribute('placeholder') || undefined,
        ariaLabel: el.getAttribute('aria-label') || el.getAttribute('title') || undefined,
        isVisible: true,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        path: this.getElementPath(el),
        // 增强的状态属性
        disabled: (el as HTMLInputElement).disabled || el.hasAttribute('disabled'),
        checked: (el as HTMLInputElement).checked,
        focused: document.activeElement === el,
        value: (el as HTMLInputElement | HTMLTextAreaElement).value || undefined,
        inViewport
      };

      // 4. 存入映射表
      elementMap.set(id, el);
      tree.push(info);
      
      // 临时调试：给元素打上标记属性（可选，方便 visually debug）
      el.setAttribute('data-agent-id', id.toString());
    });

    return { tree, elementMap };
  }

  private isElementVisible(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }

  private getElementText(el: Element): string | undefined {
    // 优先获取 value (input), 其次是 textContent
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value || el.placeholder;
    }
    // 截取过长的文本
    const text = el.textContent?.trim();
    return text ? (text.length > 50 ? text.substring(0, 50) + '...' : text) : undefined;
  }

  private getElementPath(el: Element): string {
    // 简单生成 CSS Selector
    const path: string[] = [];
    let current: Element | null = el;
    
    while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
            selector += `#${current.id}`;
            path.unshift(selector);
            break; // ID 通常唯一
        } else if (current.className) {
            // 取第一个 class
            const cls = current.className.toString().split(' ')[0];
            if(cls) selector += `.${cls}`;
        }
        path.unshift(selector);
        current = current.parentElement;
    }
    return path.join(' > ');
  }
}

export const interactiveExtractor = new InteractiveExtractor();
