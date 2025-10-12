// Worker管理工具
import type { WorkerMessage, WorkerResponse } from "../workers/math.worker";

export class WorkerManager {
  private workers: Map<string, Worker> = new Map();
  private messageHandlers: Map<string, (response: WorkerResponse) => void> =
    new Map();
  private messageId = 0;

  // 创建Worker
  createWorker(name: string, workerPath: string): Worker {
    if (this.workers.has(name)) {
      return this.workers.get(name)!;
    }

    const worker = new Worker(new URL(workerPath, import.meta.url), {
      type: "module",
    });

    worker.addEventListener("message", (e) => {
      const response = e.data as WorkerResponse;
      const handler = this.messageHandlers.get(response.id);
      if (handler) {
        handler(response);
        this.messageHandlers.delete(response.id);
      }
    });

    this.workers.set(name, worker);
    return worker;
  }

  // 发送消息到Worker
  postMessage(
    workerName: string,
    message: Omit<WorkerMessage, "id">
  ): Promise<WorkerResponse> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      return Promise.reject(new Error(`Worker ${workerName} not found`));
    }

    const id = `msg_${++this.messageId}`;
    const fullMessage: WorkerMessage = { ...message, id };

    return new Promise((resolve, reject) => {
      this.messageHandlers.set(id, (response) => {
        if (response.type === "success") {
          resolve(response);
        } else {
          reject(new Error(response.error || "Worker error"));
        }
      });

      worker.postMessage(fullMessage);
    });
  }

  // 销毁Worker
  destroyWorker(name: string): void {
    const worker = this.workers.get(name);
    if (worker) {
      worker.terminate();
      this.workers.delete(name);
    }
  }

  // 销毁所有Worker
  destroyAll(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers.clear();
    this.messageHandlers.clear();
  }
}

// 全局Worker管理器实例
export const workerManager = new WorkerManager();
