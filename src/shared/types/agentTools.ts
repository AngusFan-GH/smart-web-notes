// Agent 工具定义 - 对齐 chrome-devtools-mcp 工具集合
// 参考: https://github.com/ChromeDevTools/chrome-devtools-mcp

// ============================================================================
// 工具类型枚举（按功能分组，对齐 chrome-devtools-mcp）
// ============================================================================

export type AgentActionType =
  // Navigation (导航)
  | 'navigate'
  // DOM & Interaction (DOM 操作与交互)
  | 'click'
  | 'type'
  | 'scroll'
  | 'wait'
  | 'wait_for_element'
  | 'extract_text'
  | 'extract_links'
  | 'extract_images'
  | 'get_element_info'
  | 'take_snapshot'
  // Debugging (调试)
  | 'evaluate_script'
  | 'execute_script' // 兼容旧接口，语义同 evaluate_script
  | 'take_screenshot'
  | 'get_console_message'
  | 'list_console_messages'
  | 'get_console_messages' // 兼容旧接口：批量获取控制台消息
  // Emulation (设备模拟)
  | 'emulate'
  | 'resize_page'
  // Network (网络)
  | 'get_network_request'
  | 'list_network_requests'
  | 'get_network_requests' // 兼容旧接口：批量获取网络请求
  // Performance (性能)
  | 'performance_start_trace'
  | 'performance_stop_trace'
  | 'performance_analyze_insight'
  // Task Completion (任务完成)
  | 'done';

// ============================================================================
// 基础接口
// ============================================================================

export interface BaseAction {
  type: AgentActionType;
  reason?: string; // 操作原因（便于调试和展示）
}

// ============================================================================
// Navigation Tools (导航工具)
// ============================================================================

export interface NavigateAction extends BaseAction {
  type: 'navigate';
  url: string;
}

// ============================================================================
// DOM & Interaction Tools (DOM 操作与交互工具)
// ============================================================================

export interface ClickAction extends BaseAction {
  type: 'click';
  elementId: number; // 内部生成的唯一ID（通过 take_snapshot 获取）
}

export interface TypeAction extends BaseAction {
  type: 'type';
  elementId: number;
  text: string;
  submit?: boolean; // 是否在输入后提交（回车或触发表单提交）
}

export interface ScrollAction extends BaseAction {
  type: 'scroll';
  direction: 'up' | 'down' | 'top' | 'bottom';
  amount?: number; // 像素值，可选（默认使用视口高度的 80%）
}

export interface WaitAction extends BaseAction {
  type: 'wait';
  duration: number; // 等待时间（毫秒）
}

export interface WaitForElementAction extends BaseAction {
  type: 'wait_for_element';
  selector?: string; // CSS选择器
  elementId?: number; // 或使用元素ID（通过 take_snapshot 获取）
  timeout?: number; // 超时时间（毫秒），默认5000
  visible?: boolean; // 是否要求可见，默认true
}

export interface ExtractTextAction extends BaseAction {
  type: 'extract_text';
  selector?: string; // CSS选择器
  elementId?: number; // 或使用元素ID
  mode?: 'text' | 'html' | 'markdown'; // 提取模式，默认 'text'
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
  includeDataUrl?: boolean; // 是否包含Base64数据，默认false
}

export interface GetElementInfoAction extends BaseAction {
  type: 'get_element_info';
  elementId: number; // 元素ID
  includeChildren?: boolean; // 是否包含子元素信息，默认false
}

export interface TakeSnapshotAction extends BaseAction {
  type: 'take_snapshot';
  // 返回可访问性树或简化 DOM 树（包含交互元素的 elementId 映射）
}

// ============================================================================
// Debugging Tools (调试工具)
// ============================================================================

export interface EvaluateScriptAction extends BaseAction {
  type: 'evaluate_script';
  script: string; // JavaScript 代码
  description?: string; // 脚本作用描述（可选，但建议提供）
}

export interface ExecuteScriptAction extends BaseAction {
  type: 'execute_script'; // 兼容旧接口，语义同 evaluate_script
  script: string;
  description?: string;
}

export interface TakeScreenshotAction extends BaseAction {
  type: 'take_screenshot';
  fullPage?: boolean; // 是否截取整页，默认false
  format?: 'png' | 'jpeg'; // 图片格式，默认'png'
}

export interface GetConsoleMessageAction extends BaseAction {
  type: 'get_console_message';
  messageId: string; // 控制台消息ID
}

export interface ListConsoleMessagesAction extends BaseAction {
  type: 'list_console_messages';
  level?: 'all' | 'error' | 'warning' | 'info' | 'log' | 'debug'; // 过滤级别
  limit?: number; // 返回数量限制，默认100
}

export interface GetConsoleMessagesAction extends BaseAction {
  type: 'get_console_messages'; // 兼容旧接口：批量获取控制台消息
  level?: 'all' | 'error' | 'warning' | 'info';
  limit?: number;
}

// ============================================================================
// Emulation Tools (设备模拟工具)
// ============================================================================

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

export interface ResizePageAction extends BaseAction {
  type: 'resize_page';
  width: number;
  height: number;
}

// ============================================================================
// Network Tools (网络工具)
// ============================================================================

export interface GetNetworkRequestAction extends BaseAction {
  type: 'get_network_request';
  requestId: string; // 网络请求ID（通过 list_network_requests 获取）
}

export interface ListNetworkRequestsAction extends BaseAction {
  type: 'list_network_requests';
  filter?: {
    url?: string; // URL 过滤（支持部分匹配）
    method?: string; // HTTP 方法过滤（GET, POST, etc.）
    status?: number; // 状态码过滤
    resourceType?: string; // 资源类型：document, script, stylesheet, image, xhr, fetch, etc.
  };
  limit?: number; // 返回数量限制，默认100
}

export interface GetNetworkRequestsAction extends BaseAction {
  type: 'get_network_requests'; // 兼容旧接口：批量获取网络请求
  filter?: {
    url?: string;
    method?: string;
    status?: number;
  };
  limit?: number;
}

// ============================================================================
// Performance Tools (性能工具)
// ============================================================================

export interface PerformanceStartTraceAction extends BaseAction {
  type: 'performance_start_trace';
  categories?: string[]; // 性能追踪类别，如 ['performance', 'network']，默认 ['performance', 'network']
}

export interface PerformanceStopTraceAction extends BaseAction {
  type: 'performance_stop_trace';
  // 停止当前活动的性能追踪，返回 traceId 和 traceData
}

export interface PerformanceAnalyzeInsightAction extends BaseAction {
  type: 'performance_analyze_insight';
  traceId?: string; // 追踪ID，如果不提供则分析最新的追踪
}

// ============================================================================
// Task Completion (任务完成)
// ============================================================================

export interface DoneAction extends BaseAction {
  type: 'done';
  text: string; // 最终回答或任务总结
}

// ============================================================================
// 工具联合类型
// ============================================================================

export type AgentAction =
  // Navigation
  | NavigateAction
  // DOM & Interaction
  | ClickAction
  | TypeAction
  | ScrollAction
  | WaitAction
  | WaitForElementAction
  | ExtractTextAction
  | ExtractLinksAction
  | ExtractImagesAction
  | GetElementInfoAction
  | TakeSnapshotAction
  // Debugging
  | EvaluateScriptAction
  | ExecuteScriptAction
  | TakeScreenshotAction
  | GetConsoleMessageAction
  | ListConsoleMessagesAction
  | GetConsoleMessagesAction
  // Emulation
  | EmulateAction
  | ResizePageAction
  // Network
  | GetNetworkRequestAction
  | ListNetworkRequestsAction
  | GetNetworkRequestsAction
  // Performance
  | PerformanceStartTraceAction
  | PerformanceStopTraceAction
  | PerformanceAnalyzeInsightAction
  // Task Completion
  | DoneAction;

// ============================================================================
// 工具执行结果
// ============================================================================

export interface ToolExecutionResult {
  success: boolean;
  // 工具本身的结果主体：可以是 string / 对象 / 列表，按具体工具定义
  result?: any;
  // 错误信息（失败时）
  error?: string;
  // 与页面整体状态相关的附加信息，用于 Agent 做决策
  newState?: {
    url?: string; // 执行后的 URL（用于检测导航）
    elementCount?: number; // 页面元素数量变化（用于检测页面是否发生实质变化）
    screenshot?: string; // Base64 截图（take_screenshot 工具使用）
    consoleMessages?: Array<{
      id?: string;
      level: string;
      message: string;
      timestamp: number;
    }>;
    networkRequests?: Array<{
      id?: string;
      url: string;
      method: string;
      status: number;
      timestamp: number;
      resourceType?: string;
    }>;
    // 性能追踪数据（performance_analyze_insight 工具使用）
    performanceInsights?: {
      traceId?: string;
      duration?: number;
      resourceCount?: number;
      navigationTime?: number;
      domContentLoaded?: number;
      loadComplete?: number;
      averageResourceTime?: number;
      maxResourceTime?: number;
    };
  };
}
