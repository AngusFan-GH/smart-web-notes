import { ref } from "vue";
import { parseWebContent } from "../utils/dom";

// 网页内容处理组合式函数
export function useWebContent() {
  const pageContent = ref<string>("");
  const isLoading = ref(false);

  // 获取页面内容
  const getPageContent = async (): Promise<string> => {
    isLoading.value = true;
    try {
      const content = parseWebContent();
      pageContent.value = content;
      return content;
    } catch (error) {
      console.error("获取页面内容失败:", error);
      return "";
    } finally {
      isLoading.value = false;
    }
  };

  // 刷新页面内容
  const refreshContent = async (): Promise<string> => {
    return await getPageContent();
  };

  return {
    pageContent,
    isLoading,
    getPageContent,
    refreshContent,
  };
}
