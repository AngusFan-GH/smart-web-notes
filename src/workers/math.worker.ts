// Math Worker - 处理数学公式相关计算
import { renderMarkdown } from "../shared/utils/markdown";

// Worker消息处理
self.addEventListener("message", async (e) => {
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case "render-markdown":
        const result = await renderMarkdown(payload.text);
        self.postMessage({
          id,
          type: "success",
          result,
        });
        break;

      case "process-math":
        // 处理数学公式相关计算
        const mathResult = processMathFormulas(payload.formulas);
        self.postMessage({
          id,
          type: "success",
          result: mathResult,
        });
        break;

      default:
        self.postMessage({
          id,
          type: "error",
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
