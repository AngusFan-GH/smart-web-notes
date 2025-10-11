// Vue3 Content Script
export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.log("Smart Web Notes Vue3 Content Script Started");

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
