// Math Worker - 处理数学公式相关计算
import { renderMarkdown } from "../shared/utils/markdown";

// Worker消息类型常量
const WORKER_MESSAGE_TYPES = {
  RENDER_MARKDOWN: "render-markdown",
  PROCESS_MATH: "process-math",
} as const;

const WORKER_RESPONSE_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
} as const;

// Worker消息处理
self.addEventListener("message", async (e) => {
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case WORKER_MESSAGE_TYPES.RENDER_MARKDOWN:
        const result = await renderMarkdown(payload.text);
        self.postMessage({
          id,
          type: WORKER_RESPONSE_TYPES.SUCCESS,
          result,
        });
        break;

      case WORKER_MESSAGE_TYPES.PROCESS_MATH:
        // 处理数学公式相关计算
        const mathResult = processMathFormulas(payload.formulas);
        self.postMessage({
          id,
          type: WORKER_RESPONSE_TYPES.SUCCESS,
          result: mathResult,
        });
        break;

      default:
        self.postMessage({
          id,
          type: WORKER_RESPONSE_TYPES.ERROR,
          error: `Unknown message type: ${type}`,
        });
    }
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 处理数学公式
function processMathFormulas(formulas: string[]): any {
  // 这里可以添加复杂的数学公式处理逻辑
  return {
    processed: formulas.length,
    formulas: formulas.map((formula) => ({
      original: formula,
      processed: formula.trim(),
    })),
  };
}

// 导出类型
export type WorkerMessage = {
  id: string;
  type: "render-markdown" | "process-math";
  payload: any;
};

export type WorkerResponse = {
  id: string;
  type: "success" | "error";
  result?: any;
  error?: string;
};
