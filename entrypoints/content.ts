// Vue3 Content Script
// 提前初始化网络监控，尽量早拦截后续请求
import "../src/shared/utils/networkAnalyzer";
export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.log("Web Assistant Vue3 Content Script Started");

    // 确保DOM准备就绪后再导入Vue3应用
    function initVueApp() {
      if (document.body) {
        import("../src/content/main.ts").catch((error) => {
          console.error("❌ Vue应用导入失败:", error);
        });
      } else {
        // 如果body还不存在，等待DOMContentLoaded
        document.addEventListener("DOMContentLoaded", () => {
          import("../src/content/main.ts").catch((error) => {
            console.error("❌ Vue应用导入失败:", error);
          });
        });
      }
    }

    // 立即尝试初始化
    initVueApp();
  },
});
