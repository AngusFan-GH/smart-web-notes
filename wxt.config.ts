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
    manifest_version: 3,
    name: "Web Assistant",
    description: "AI-powered web content analysis",
    version: "1.0",
    permissions: ["activeTab", "scripting", "storage", "tabs"],
    icons: {
      16: "/icons/icon16.png",
      32: "/icons/icon32.png",
      48: "/icons/icon48.png",
      128: "/icons/icon128.png",
    },
    action: {
      default_popup: "popup.html",
      default_title: "Web Assistant",
    },
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["content-scripts/content.js"],
      },
    ],
    web_accessible_resources: [
      {
        resources: ["lib/*.js", "assets/*", "workers/*.js", "icons/*.png"],
        matches: ["<all_urls>"],
      },
    ],
  },
  // 开发模式配置
  dev: {
    port: 3001,
  },
});
