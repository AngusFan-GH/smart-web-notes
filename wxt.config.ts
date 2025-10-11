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
    define: {
      global: "globalThis",
    },
    build: {
      rollupOptions: {
        output: {
          format: "es",
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
          assetFileNames: "[name].[ext]",
        },
      },
    },
  }),
  manifest: {
    name: "Smart Web Notes",
    description: "AI-powered web content analysis",
    version: "1.0",
    permissions: ["activeTab", "scripting", "storage"],
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["content-scripts/content.js"],
      },
    ],
  },
  // 开发模式配置
  dev: {
    port: 3001,
  },
});
