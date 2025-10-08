import { defineConfig } from "wxt";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  vite: () => ({
    resolve: {
      alias: {
        "@/styles": path.resolve(__dirname, "styles"),
        "@/src": path.resolve(__dirname, "src"),
        "@/shared": path.resolve(__dirname, "src/shared"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          format: "es",
          // 确保文件编码
          banner: "// UTF-8",
        },
      },
    },
  }),
  manifest: {
    name: "Smart Web Notes",
    description: "基于当前网页内容的AI增强问答系统",
    version: "1.0",
    permissions: ["activeTab", "scripting", "storage"],
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["lib/marked.min.js", "content-scripts/content.js"],
        css: ["styles/content.css"],
      },
    ],
    web_accessible_resources: [
      {
        resources: ["lib/marked.min.js"],
        matches: ["<all_urls>"],
      },
    ],
  },
  // 开发模式配置
  dev: {
    port: 3001,
  },
});
