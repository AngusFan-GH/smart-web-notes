import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import "@/shared/styles/reset.css"; // 引入reset.css
import "element-plus/dist/index.css"; // Element Plus CSS
import App from "./App.vue";

// 创建Vue应用实例
const app = createApp(App);

// 创建Pinia实例
const pinia = createPinia();

// 注册Pinia
app.use(pinia);

// 注册Element Plus
app.use(ElementPlus);

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

// 确保容器存在后再挂载
function mountApp() {
  // 确保document.body存在
  if (!document.body) {
    console.error("❌ document.body不存在，无法挂载Vue应用");
    return;
  }

  // 强制创建容器
  let container = document.getElementById("ai-assistant-content");
  if (container) {
    console.log("📦 找到现有容器:", container);
  } else {
    console.log("📦 创建新容器...");
    container = document.createElement("div");
    container.id = "ai-assistant-content";
    // 不要隐藏容器，让Vue应用正常渲染
    document.body.appendChild(container);
    console.log("📦 容器已添加到DOM:", container);
  }

  // 立即验证容器
  const targetContainer = document.getElementById("ai-assistant-content");
  console.log("🔍 验证容器:", targetContainer);

  if (!targetContainer) {
    console.error("❌ 容器验证失败，无法挂载Vue应用");
    return;
  }

  try {
    console.log("🚀 尝试挂载Vue应用到容器...");
    // 直接使用DOM元素而不是选择器
    app.mount(targetContainer);
    console.log("✅ Vue应用挂载成功");
    console.log("📱 Vue应用已挂载，悬浮球应该可见");
  } catch (error) {
    console.error("❌ Vue应用挂载失败:", error);
    console.error("错误详情:", error);
  }
}

// 简化的挂载逻辑
function initApp() {
  console.log("🚀 初始化Vue应用...");
  console.log("📊 当前状态:", {
    readyState: document.readyState,
    bodyExists: !!document.body,
    headExists: !!document.head,
  });

  // 如果body存在，立即尝试挂载
  if (document.body) {
    console.log("✅ document.body存在，立即挂载");
    mountApp();
  } else {
    console.log("⏳ 等待document.body...");
    // 使用多种方式确保DOM准备就绪
    const tryMount = () => {
      if (document.body) {
        mountApp();
      } else {
        console.log("⏳ 继续等待document.body...");
        setTimeout(tryMount, 50);
      }
    };

    // 立即尝试一次
    tryMount();

    // 同时监听DOMContentLoaded
    document.addEventListener("DOMContentLoaded", () => {
      console.log("📅 DOMContentLoaded事件触发");
      if (document.body) {
        mountApp();
      }
    });
  }
}

// 启动应用
initApp();
