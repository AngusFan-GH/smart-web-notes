// 功能包懒加载管理
import { workerManager } from "./worker";

// 使用import.meta.glob进行功能包切分
const features = import.meta.glob("../features/*.ts", { eager: false });
const components = import.meta.glob("../components/*.vue", { eager: false });

// 功能加载器
export class FeatureLoader {
  private loadedFeatures = new Set<string>();
  private loadedComponents = new Set<string>();

  // 加载功能模块
  async loadFeature(featureName: string): Promise<any> {
    if (this.loadedFeatures.has(featureName)) {
      return features[`../features/${featureName}.ts`];
    }

    try {
      const feature = await features[`../features/${featureName}.ts`]();
      this.loadedFeatures.add(featureName);
      console.log(`Feature ${featureName} loaded`);
      return feature;
    } catch (error) {
      console.error(`Failed to load feature ${featureName}:`, error);
      throw error;
    }
  }

  // 加载组件
  async loadComponent(componentName: string): Promise<any> {
    if (this.loadedComponents.has(componentName)) {
      return components[`../components/${componentName}.vue`];
    }

    try {
      const component = await components[
        `../components/${componentName}.vue`
      ]();
      this.loadedComponents.add(componentName);
      console.log(`Component ${componentName} loaded`);
      return component;
    } catch (error) {
      console.error(`Failed to load component ${componentName}:`, error);
      throw error;
    }
  }

  // 预加载功能
  async preloadFeatures(featureNames: string[]): Promise<void> {
    const promises = featureNames.map((name) => this.loadFeature(name));
    await Promise.allSettled(promises);
  }

  // 检查功能是否已加载
  isFeatureLoaded(featureName: string): boolean {
    return this.loadedFeatures.has(featureName);
  }

  // 检查组件是否已加载
  isComponentLoaded(componentName: string): boolean {
    return this.loadedComponents.has(componentName);
  }
}

// 全局功能加载器实例
export const featureLoader = new FeatureLoader();

// 数学公式处理功能
export async function processMathInWorker(text: string): Promise<string> {
  try {
    // 创建数学Worker
    const mathWorker = workerManager.createWorker(
      "math",
      "../workers/math.worker.ts"
    );

    // 发送渲染任务到Worker
    const response = await workerManager.postMessage("math", {
      type: "render-markdown",
      payload: { text },
    });

    return response.result;
  } catch (error) {
    console.error("Math worker processing failed:", error);
    // 降级到主线程处理
    const { renderMarkdown } = await import("./utils/markdown");
    return await renderMarkdown(text);
  }
}

// 重计算功能
export async function runHeavyCalculation(data: any): Promise<any> {
  try {
    // 动态加载重计算功能
    const { runCalculation } = await featureLoader.loadFeature("heavy-calc");
    return await runCalculation(data);
  } catch (error) {
    console.error("Heavy calculation failed:", error);
    throw error;
  }
}
