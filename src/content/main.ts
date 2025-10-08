import { createApp } from "vue";
import ElementPlus from "element-plus";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import "@/shared/styles/reset.css"; // 引入reset.css
import "element-plus/dist/index.css"; // Element Plus CSS
import App from "./App.vue";
import "./style.css";

// 创建Vue应用实例
const app = createApp(App);

// 注册Element Plus
app.use(ElementPlus);

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

// 挂载到页面
app.mount("#ai-assistant-content");

// 确保容器存在
if (!document.getElementById("ai-assistant-content")) {
  const container = document.createElement("div");
  container.id = "ai-assistant-content";
  document.body.appendChild(container);

  // 重新挂载
  app.mount("#ai-assistant-content");
}
