// Vue3 Content Script
export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.log("Smart Web Notes Vue3 Content Script Started");

    // 导入Vue3应用
    import("../src/content/main.ts").catch(console.error);
  },
});
