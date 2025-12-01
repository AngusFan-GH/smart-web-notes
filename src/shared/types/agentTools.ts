// Agent 原子操作工具定义

// 基础操作类型
export type AgentActionType = 
  | 'click' 
  | 'type' 
  | 'scroll' 
  | 'navigate' 
  | 'wait' 
  | 'extract'
  | 'execute_script' // 兜底通用脚本执行
  | 'done'
  // 新增：类似 chrome-devtools-mcp 的高级工具
  | 'take_screenshot' // 截图
  | 'take_snapshot' // 可访问性树快照
  | 'get_console_messages' // 获取控制台消息
  | 'hover' // 悬停
  | 'drag' // 拖拽
  | 'press_key' // 按键
  | 'resize_page' // 调整页面大小
  | 'get_network_requests' // 获取网络请求
  // chrome-devtools-mcp 完整功能
  | 'emulate' // 设备模拟（移动设备、平板等）
  | 'performance_start_trace' // 开始性能追踪
  | 'performance_stop_trace' // 停止性能追踪
  | 'performance_analyze_insight' // 性能分析洞察
  | 'get_network_request' // 获取单个网络请求详情
  | 'list_network_requests' // 列出所有网络请求
  | 'list_console_messages' // 列出所有控制台消息
  | 'get_console_message' // 获取单个控制台消息
  // 新增：增强的原子工具
  | 'wait_for_element' // 等待元素出现
  | 'extract_text' // 提取文本
  | 'extract_links' // 提取链接
  | 'extract_images' // 提取图片
  | 'get_element_info' // 获取元素信息
  | 'compare_screenshots'; // 比较截图

// 基础操作接口
export interface BaseAction {
  type: AgentActionType;
  reason?: string; // 操作原因（便于调试和展示）
}

// 具体操作定义
export interface ClickAction extends BaseAction {
  type: 'click';
  elementId: number; // 内部生成的唯一ID
}

export interface TypeAction extends BaseAction {
  type: 'type';
  elementId: number;
  text: string;
  submit?: boolean; // 是否回车
}

export interface ScrollAction extends BaseAction {
  type: 'scroll';
  direction: 'up' | 'down' | 'top' | 'bottom';
  amount?: number; // 像素值，可选
}

export interface NavigateAction extends BaseAction {
  type: 'navigate';
  url: string;
}

export interface WaitAction extends BaseAction {
  type: 'wait';
  duration: number; // 毫秒
}

export interface ExtractAction extends BaseAction {
  type: 'extract';
  selector?: string; // 可选，若无则提取全文或当前视口
  mode?: 'text' | 'html' | 'markdown';
}

export interface ExecuteScriptAction extends BaseAction {
  type: 'execute_script';
  script: string;
  description: string; // 必须描述该脚本的作用
}

export interface DoneAction extends BaseAction {
  type: 'done';
  text: string; // 最终回答
}

// 新增：高级工具
export interface TakeScreenshotAction extends BaseAction {
  type: 'take_screenshot';
  fullPage?: boolean; // 是否截取整页
  format?: 'png' | 'jpeg'; // 图片格式
}

export interface TakeSnapshotAction extends BaseAction {
  type: 'take_snapshot';
  // 返回可访问性树或简化 DOM 树
}

export interface GetConsoleMessagesAction extends BaseAction {
  type: 'get_console_messages';
  level?: 'all' | 'error' | 'warning' | 'info'; // 过滤级别
  limit?: number; // 返回数量限制
}

export interface HoverAction extends BaseAction {
  type: 'hover';
  elementId: number;
}

export interface DragAction extends BaseAction {
  type: 'drag';
  fromElementId: number;
  toElementId: number;
  // 或者使用坐标
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
}

export interface PressKeyAction extends BaseAction {
  type: 'press_key';
  key: string; // 如 'Enter', 'Escape', 'Tab' 等
  elementId?: number; // 可选，指定焦点元素
  modifiers?: ('Control' | 'Shift' | 'Alt' | 'Meta')[]; // 修饰键
}

export interface ResizePageAction extends BaseAction {
  type: 'resize_page';
  width: number;
  height: number;
}

export interface GetNetworkRequestsAction extends BaseAction {
  type: 'get_network_requests';
  filter?: {
    url?: string; // URL 过滤
    method?: string; // 方法过滤
    status?: number; // 状态码过滤
  };
  limit?: number; // 返回数量限制
}

// chrome-devtools-mcp 完整功能
export interface EmulateAction extends BaseAction {
  type: 'emulate';
  device: {
    name: string; // 设备名称，如 'iPhone 12', 'iPad Pro', 'Desktop'
    userAgent?: string; // 自定义 User Agent
    viewport: {
      width: number;
      height: number;
      deviceScaleFactor?: number; // 设备像素比，默认1
      isMobile?: boolean; // 是否为移动设备
      hasTouch?: boolean; // 是否支持触摸
    };
  };
}

export interface PerformanceStartTraceAction extends BaseAction {
  type: 'performance_start_trace';
  categories?: string[]; // 性能追踪类别，如 ['performance', 'network']
}

export interface PerformanceStopTraceAction extends BaseAction {
  type: 'performance_stop_trace';
}

export interface PerformanceAnalyzeInsightAction extends BaseAction {
  type: 'performance_analyze_insight';
  traceId?: string; // 追踪ID，如果不提供则分析最新的追踪
}

export interface GetNetworkRequestAction extends BaseAction {
  type: 'get_network_request';
  requestId: string; // 网络请求ID
}

export interface ListNetworkRequestsAction extends BaseAction {
  type: 'list_network_requests';
  filter?: {
    url?: string;
    method?: string;
    status?: number;
    resourceType?: string; // 资源类型：document, script, stylesheet, image, etc.
  };
  limit?: number;
}

export interface ListConsoleMessagesAction extends BaseAction {
  type: 'list_console_messages';
  level?: 'all' | 'error' | 'warning' | 'info' | 'log' | 'debug';
  limit?: number;
}

export interface GetConsoleMessageAction extends BaseAction {
  type: 'get_console_message';
  messageId: string; // 控制台消息ID
}

// 新增：增强的原子工具
export interface WaitForElementAction extends BaseAction {
  type: 'wait_for_element';
  selector?: string; // CSS选择器
  elementId?: number; // 或使用元素ID
  timeout?: number; // 超时时间（毫秒），默认5000
  visible?: boolean; // 是否要求可见，默认true
}

export interface ExtractTextAction extends BaseAction {
  type: 'extract_text';
  selector?: string; // CSS选择器
  elementId?: number; // 或使用元素ID
  mode?: 'text' | 'html' | 'markdown'; // 提取模式
}

export interface ExtractLinksAction extends BaseAction {
  type: 'extract_links';
  selector?: string; // 限制范围的选择器
  filter?: {
    text?: string; // 文本过滤
    url?: string; // URL过滤
  };
}

export interface ExtractImagesAction extends BaseAction {
  type: 'extract_images';
  selector?: string; // 限制范围的选择器
  includeDataUrl?: boolean; // 是否包含Base64数据
}

export interface GetElementInfoAction extends BaseAction {
  type: 'get_element_info';
  elementId: number; // 元素ID
  includeChildren?: boolean; // 是否包含子元素信息
}

export interface CompareScreenshotsAction extends BaseAction {
  type: 'compare_screenshots';
  reference: string; // 参考截图（Base64或URL）
  current?: boolean; // 是否使用当前页面截图
  threshold?: number; // 相似度阈值（0-1），默认0.95
}

export type AgentAction = 
  | ClickAction 
  | TypeAction 
  | ScrollAction 
  | NavigateAction 
  | WaitAction 
  | ExtractAction 
  | ExecuteScriptAction
  | DoneAction
  | TakeScreenshotAction
  | TakeSnapshotAction
  | GetConsoleMessagesAction
  | HoverAction
  | DragAction
  | PressKeyAction
  | ResizePageAction
  | GetNetworkRequestsAction
  | EmulateAction
  | PerformanceStartTraceAction
  | PerformanceStopTraceAction
  | PerformanceAnalyzeInsightAction
  | GetNetworkRequestAction
  | ListNetworkRequestsAction
  | ListConsoleMessagesAction
  | GetConsoleMessageAction
  | WaitForElementAction
  | ExtractTextAction
  | ExtractLinksAction
  | ExtractImagesAction
  | GetElementInfoAction
  | CompareScreenshotsAction;

// 工具执行结果
export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  newState?: {
    url?: string; // 执行后的 URL（用于检测导航）
    elementCount?: number; // 页面元素数量变化
    screenshot?: string; // Base64 截图（可选）
    consoleMessages?: Array<{
      level: string;
      message: string;
      timestamp: number;
    }>;
    networkRequests?: Array<{
      url: string;
      method: string;
      status: number;
      timestamp: number;
    }>;
  };
}

