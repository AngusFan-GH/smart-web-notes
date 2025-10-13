<template>
  <div class="container">
    <div class="header">
      <div class="title-section">
        <img src="/icons/icon32.png" alt="Web Assistant" class="app-logo" />
        <h3 class="title">Web Assistant</h3>
      </div>
      <div class="status-indicator" :class="statusClass">
        <el-icon class="status-icon">
          <component :is="statusIcon" />
        </el-icon>
        <span class="status-text">{{ statusText }}</span>
      </div>
    </div>

    <div class="quick-actions">
      <!-- 主要操作按钮 -->
      <el-button
        :type="primaryAction.type as any"
        :icon="primaryAction.icon"
        @click="primaryAction.action"
        class="action-button primary-action"
      >
        {{ primaryAction.text }}
      </el-button>

      <!-- 次要操作按钮 -->
      <el-button
        v-if="secondaryAction"
        type="default"
        :icon="secondaryAction.icon"
        @click="secondaryAction.action"
        class="action-button secondary-action"
      >
        {{ secondaryAction.text }}
      </el-button>

      <!-- 设置按钮 -->
      <el-button
        type="default"
        :icon="Setting"
        @click="openSettings"
        class="action-button settings-button"
      >
        设置
      </el-button>
    </div>

    <div class="footer">
      <p class="tip">{{ footerTip }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { ElButton, ElIcon } from "element-plus";
import {
  ChatDotRound,
  Setting,
  View,
  Hide,
  Close,
  CircleCheck,
  Warning,
} from "@element-plus/icons-vue";

// 声明chrome类型
declare const chrome: any;

// 状态管理
const showFloatingBall = ref(true);
const isDialogOpen = ref(false);
const isLoading = ref(false);

// 状态计算
const statusClass = computed(() => {
  if (isLoading.value) return "loading";
  if (isDialogOpen.value) return "active";
  if (!showFloatingBall.value) return "hidden";
  return "ready";
});

const statusIcon = computed(() => {
  if (isLoading.value) return Warning;
  if (isDialogOpen.value) return CircleCheck;
  if (!showFloatingBall.value) return Hide;
  return View;
});

const statusText = computed(() => {
  if (isLoading.value) return "加载中...";
  if (isDialogOpen.value) return "对话已打开";
  if (!showFloatingBall.value) return "悬浮球已隐藏";
  return "就绪";
});

// 主要操作按钮
const primaryAction = computed(() => {
  if (isDialogOpen.value) {
    return {
      type: "danger",
      icon: Close,
      text: "关闭对话",
      action: closeDialog,
    };
  }

  if (!showFloatingBall.value) {
    return {
      type: "primary",
      icon: View,
      text: "显示悬浮球",
      action: showFloatingBallAction,
    };
  }

  return {
    type: "primary",
    icon: ChatDotRound,
    text: "快速对话",
    action: openChatDialog,
  };
});

// 次要操作按钮
const secondaryAction = computed(() => {
  if (isDialogOpen.value) {
    return {
      icon: Hide,
      text: "隐藏悬浮球",
      action: hideFloatingBallAction,
    };
  }

  if (showFloatingBall.value) {
    return {
      icon: Hide,
      text: "隐藏悬浮球",
      action: hideFloatingBallAction,
    };
  }

  return null;
});

// 底部提示
const footerTip = computed(() => {
  if (isDialogOpen.value) {
    return "💬 对话窗口已打开，可以开始交流";
  }

  if (!showFloatingBall.value) {
    return "💡 悬浮球已隐藏，点击按钮重新显示";
  }

  return "💡 点击悬浮球或使用快捷键开始对话";
});

// 初始化
onMounted(async () => {
  isLoading.value = true;

  try {
    // 获取悬浮球状态
    const { showFloatingBall: storedValue = true } =
      await chrome.storage.sync.get("showFloatingBall");
    showFloatingBall.value = storedValue;

    // 检查对话窗口状态
    await checkDialogStatus();
  } catch (error) {
    console.error("初始化失败:", error);
  } finally {
    isLoading.value = false;
  }
});

// 检查对话窗口状态
async function checkDialogStatus() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab.id) {
      // 向content script查询对话窗口状态
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getDialogStatus",
      });
      isDialogOpen.value = response?.isOpen || false;
    }
  } catch (error) {
    console.error("检查对话状态失败:", error);
    isDialogOpen.value = false;
  }
}

// 打开对话窗口
async function openChatDialog() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, { action: "openDialog" });
      isDialogOpen.value = true;
      window.close();
    }
  } catch (error) {
    console.error("打开对话窗口失败:", error);
  }
}

// 关闭对话窗口
async function closeDialog() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, { action: "closeDialog" });
      isDialogOpen.value = false;
      window.close();
    }
  } catch (error) {
    console.error("关闭对话窗口失败:", error);
  }
}

// 显示悬浮球
async function showFloatingBallAction() {
  showFloatingBall.value = true;
  await chrome.storage.sync.set({ showFloatingBall: true });

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, {
        action: "toggleFloatingBall",
        showFloatingBall: true,
      });
    }
  } catch (error) {
    console.error("显示悬浮球失败:", error);
  }
}

// 隐藏悬浮球
async function hideFloatingBallAction() {
  showFloatingBall.value = false;
  await chrome.storage.sync.set({ showFloatingBall: false });

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, {
        action: "toggleFloatingBall",
        showFloatingBall: false,
      });
    }
  } catch (error) {
    console.error("隐藏悬浮球失败:", error);
  }
}

// 打开设置页面
function openSettings() {
  chrome.runtime.openOptionsPage();
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
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  box-shadow: 0 12px 40px rgba(15, 52, 96, 0.4);
}

.header {
  padding: 12px;

  text-align: center;

  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.15);

  backdrop-filter: blur(20px);
}

.title-section {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 4px;
  margin-bottom: 6px;
}

.app-logo {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(15, 52, 96, 0.3);
  transition: transform 0.3s ease;
  display: flex;
  align-items: center;
}

.app-logo:hover {
  transform: scale(1.05);
}

.title {
  font-size: 18px;
  font-weight: 700;

  margin: 0;

  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  font-size: 12px;
  font-weight: 500;

  padding: 4px 8px;
  border-radius: 12px;

  transition: all 0.3s ease;
}

.status-indicator.ready {
  color: rgba(212, 175, 55, 0.9);
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid rgba(212, 175, 55, 0.3);
}

.status-indicator.active {
  color: rgba(255, 193, 7, 0.9);
  background: rgba(255, 193, 7, 0.15);
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.status-indicator.hidden {
  color: rgba(255, 152, 0, 0.9);
  background: rgba(255, 152, 0, 0.15);
  border: 1px solid rgba(255, 152, 0, 0.3);
}

.status-indicator.loading {
  color: rgba(255, 193, 7, 0.9);
  background: rgba(255, 193, 7, 0.15);
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.status-icon {
  font-size: 14px;
}

.status-text {
  font-size: 11px;
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

.primary-action {
  color: white;
  border-color: rgba(255, 255, 255, 0.3);
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.1) 100%
  );
}

.primary-action:hover {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.3) 0%,
    rgba(255, 255, 255, 0.2) 100%
  );
}

.secondary-action {
  color: white;
  background: rgba(255, 255, 255, 0.15);
}

.secondary-action:hover {
  background: rgba(255, 255, 255, 0.25);
}

.settings-button {
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
}

.settings-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.25);
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
