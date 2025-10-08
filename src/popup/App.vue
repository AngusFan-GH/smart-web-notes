<template>
  <div class="container">
    <div class="header">
      <h3 class="title">Smart Web Notes</h3>
    </div>

    <div class="quick-actions">
      <el-button
        type="primary"
        :icon="ChatDotRound"
        @click="openChatDialog"
        class="action-button"
      >
        打开对话窗口
      </el-button>

      <el-button
        type="default"
        :icon="Setting"
        @click="openSettings"
        class="action-button"
      >
        设置
      </el-button>

      <el-button
        type="default"
        :icon="showFloatingBall ? View : Hide"
        @click="toggleFloatingBall"
        class="action-button"
      >
        {{ showFloatingBall ? "隐藏悬浮球" : "显示悬浮球" }}
      </el-button>
    </div>

    <div class="footer">
      <p class="tip">💡 点击悬浮球或使用快捷键开始对话</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElButton } from "element-plus";
import { ChatDotRound, Setting, View, Hide } from "@element-plus/icons-vue";
import { renderMarkdown } from "../shared/utils/markdown";

// 声明chrome类型
declare const chrome: any;

const showFloatingBall = ref(true);

// 初始化
onMounted(async () => {
  // 初始化悬浮球开关状态
  const { showFloatingBall: storedValue = true } =
    await chrome.storage.sync.get("showFloatingBall");
  showFloatingBall.value = storedValue;
});

// 打开对话窗口
async function openChatDialog() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      // 向content script发送消息打开对话窗口
      await chrome.tabs.sendMessage(tab.id, { action: "openDialog" });
      // 关闭popup
      window.close();
    }
  } catch (error) {
    console.error("打开对话窗口失败:", error);
  }
}

// 打开设置页面
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// 切换悬浮球
async function toggleFloatingBall() {
  showFloatingBall.value = !showFloatingBall.value;
  await chrome.storage.sync.set({ showFloatingBall: showFloatingBall.value });

  // 向content script发送消息
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: "toggleFloatingBall" });
    }
  } catch (error) {
    console.error("切换悬浮球失败:", error);
  }
}
</script>

<style scoped>
.container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  display: flex;
  overflow: hidden;
  flex-direction: column;

  width: 320px;
  height: 240px;

  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.3);
}

.header {
  padding: 10px;

  text-align: center;

  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.15);

  backdrop-filter: blur(20px);
}

.title {
  font-size: 18px;
  font-weight: 700;

  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.subtitle {
  font-size: 12px;
  font-weight: 400;

  margin: 0;

  color: rgba(255, 255, 255, 0.8);
}

.quick-actions {
  display: flex;
  flex-direction: column;
  flex: 1;

  padding: 16px;

  background: rgba(255, 255, 255, 0.1);

  gap: 8px;
  backdrop-filter: blur(20px);
}

.action-button {
  font-size: 13px;
  font-weight: 600;

  width: 100%;
  height: 36px;
  margin-left: 0;

  transition: all 0.2s ease;

  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;

  backdrop-filter: blur(10px);
}

.action-button:hover {
  transform: translateY(-1px);

  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.action-button:first-child {
  color: #667eea;
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.9);
}

.action-button:not(:first-child) {
  color: white;
  background: rgba(255, 255, 255, 0.15);
}

.footer {
  padding: 12px 16px;

  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.1);

  backdrop-filter: blur(20px);
}

.tip {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;

  margin: 0;

  text-align: center;

  color: rgba(255, 255, 255, 0.7);
}
</style>
