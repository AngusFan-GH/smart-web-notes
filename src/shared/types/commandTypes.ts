export interface CommandPattern {
  pattern: RegExp;
  handler: CommandHandler;
  priority: number;
}

export interface CommandResult {
  type: "direct" | "ai";
  command: CommandHandler | null;
  args: any;
  confidence: number;
}

export interface CommandExecutionResult {
  success: boolean;
  type: "direct" | "ai" | "ai_fallback";
  result: any;
  message: string;
}

export interface CommandHandler {
  (args: any): Promise<any>;
  name: string;
  description: string;
}

export interface SmartContext {
  question: string;
  pageContent: PageContent;
  conversationHistory: ConversationMessage[];
  contextVersion: string;
  timestamp: number;
  metadata: {
    url: string;
    title: string;
    userAgent: string;
  };
}

export interface CachedContent {
  content: PageContent;
  timestamp: number;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface PageContent {
  text: string;
  structure?: any;
  networkAnalysis?: any;
  domStructure?: any;
  metadata?: any;
}

export interface ExtractedContent {
  text: string;
  structure?: {
    headings: Array<{ level: number; text: string; id?: string }>;
    paragraphs: string[];
    lists: Array<{ type: "ordered" | "unordered"; items: string[] }>;
    links: Array<{ text: string; href: string }>;
    images: Array<{ alt: string; src: string }>;
  };
  networkAnalysis?: any;
  domStructure?: {
    elements: Array<{
      tag: string;
      id?: string;
      classes?: string[];
      text?: string;
      selector: string;
    }>;
    commonSelectors: {
      ads: string[];
      navigation: string[];
      content: string[];
      sidebars: string[];
    };
  };
  metadata?: {
    title: string;
    url: string;
    description?: string;
    keywords?: string[];
  };
}

export interface AIProcessingOptions {
  fallbackReason?: string;
  originalError?: Error;
}

export interface AIResponse {
  content: string;
  metadata?: any;
}
