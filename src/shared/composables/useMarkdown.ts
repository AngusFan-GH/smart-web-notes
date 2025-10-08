import { ref, onMounted } from "vue";
import { marked } from "marked";

// Markdown 渲染组合式函数
export function useMarkdown() {
  const isMarkedLoaded = ref(false);
  const markedInstance = ref<any>(null);

  // 初始化 marked
  const initMarked = async () => {
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false,
      });
      markedInstance.value = marked.parse;
      isMarkedLoaded.value = true;
      console.log("Marked初始化成功");
    } catch (error) {
      console.error("Marked初始化失败:", error);
      // 提供一个后备方案
      markedInstance.value = (text: string) => text;
      isMarkedLoaded.value = false;
    }
  };

  // 渲染 Markdown
  const renderMarkdown = (text: string): string => {
    if (markedInstance.value && isMarkedLoaded.value) {
      try {
        return markedInstance.value(text);
      } catch (error) {
        console.error("Markdown渲染失败:", error);
        return text;
      }
    }
    // 简单的Markdown渲染作为后备
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  };

  onMounted(() => {
    initMarked();
  });

  return {
    isMarkedLoaded,
    renderMarkdown,
    initMarked,
  };
}
