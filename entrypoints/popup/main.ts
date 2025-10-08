import { createApp } from "vue";
import ElementPlus from "element-plus";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import "@/shared/styles/reset.css"; // 引入reset.css
import "element-plus/dist/index.css"; // Element Plus CSS after reset
import "../../src/popup/style.css";
import App from "../../src/popup/App.vue";

const app = createApp(App);

// 注册Element Plus
app.use(ElementPlus);

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.mount("#app");
