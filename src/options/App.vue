<template>
  <div class="container">
    <!-- 固定的Tab切换栏 -->
    <div class="tab-header">
      <div class="header-content">
        <div class="title-section">
          <img src="/icons/icon32.png" alt="Web Assistant" class="app-logo" />
          <h3 class="title">Web Assistant 设置</h3>
        </div>
        <div class="status-indicator">
          <el-icon class="status-icon">
            <Setting />
          </el-icon>
          <span class="status-text">配置中心</span>
        </div>
      </div>
      <div class="tabs-container">
        <el-tabs v-model="activeTab" class="settings-tabs">
          <el-tab-pane label="API 配置" name="api"></el-tab-pane>
          <el-tab-pane label="常规设置" name="general"></el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- 可滚动的内容区域 -->
    <el-scrollbar class="content-scroll" ref="scrollbarRef">
      <div class="tab-content">
        <!-- API 配置内容 -->
        <div v-if="activeTab === 'api'" class="tab-pane-content">
          <el-card class="settings-card" shadow="hover">
            <el-form
              :model="settings"
              label-width="140px"
              label-position="top"
              class="settings-form"
            >
              <el-form-item label="API密钥" required>
                <el-input
                  v-model="settings.custom_apiKey"
                  type="password"
                  placeholder="请输入API密钥"
                  show-password
                  autocomplete="off"
                  spellcheck="false"
                  class="field"
                />
                <el-text class="help-text" type="info" size="small">
                  使用自定义API时必填
                </el-text>
              </el-form-item>

              <el-form-item label="请求URL" required>
                <el-input
                  v-model="settings.custom_apiBase"
                  placeholder="https://api.deepseek.com/chat/completions"
                  class="field"
                />
                <el-text class="help-text" type="info" size="small">
                  API接口地址
                </el-text>
              </el-form-item>

              <el-form-item label="AI模型" required>
                <el-input
                  v-model="settings.custom_model"
                  placeholder="deepseek-chat"
                  class="field"
                />
                <el-text class="help-text" type="info" size="small">
                  例如：deepseek-chat、gpt-4等
                </el-text>
              </el-form-item>

              <el-form-item label="最大回复长度">
                <el-slider
                  v-model="settings.maxTokens"
                  :min="128"
                  :max="4096"
                  :step="1"
                  show-input
                  :show-input-controls="false"
                  class="slider-field"
                />
                <el-text class="help-text" type="info" size="small">
                  调整范围：128 ~ 4096 tokens
                </el-text>
              </el-form-item>

              <el-form-item label="温度 (创造性)">
                <el-slider
                  v-model="settings.temperature"
                  :min="0"
                  :max="1"
                  :step="0.1"
                  show-input
                  :show-input-controls="false"
                  class="slider-field"
                />
                <el-text class="help-text" type="info" size="small">
                  调整范围：0.0 ~ 1.0 (值越大，回答越具有创造性)
                </el-text>
              </el-form-item>
            </el-form>
          </el-card>
        </div>

        <!-- 常规设置内容 -->
        <div v-if="activeTab === 'general'" class="tab-pane-content">
          <el-card class="settings-card" shadow="hover">
            <el-form
              :model="settings"
              label-width="140px"
              label-position="top"
              class="settings-form"
            >
              <el-form-item label="自动隐藏对话框">
                <el-switch
                  v-model="settings.autoHideDialog"
                  active-text="启用"
                  inactive-text="禁用"
                />
                <el-text class="help-text" type="info" size="small">
                  点击对话框外部时自动隐藏对话框
                </el-text>
              </el-form-item>

              <el-form-item label="显示处理进度">
                <el-switch
                  v-model="settings.showProcessingSteps"
                  active-text="启用"
                  inactive-text="禁用"
                />
                <el-text class="help-text" type="info" size="small">
                  显示AI处理过程中的详细步骤进度
                </el-text>
              </el-form-item>

              <el-form-item label="启用上下文聊天">
                <el-switch
                  v-model="settings.enableContext"
                  active-text="启用"
                  inactive-text="禁用"
                />
                <el-text class="help-text" type="info" size="small">
                  启用上下文聊天（包含历史对话记录）
                </el-text>
              </el-form-item>

              <el-form-item label="智能推荐问题">
                <el-switch
                  v-model="settings.enableSuggestedQuestions"
                  active-text="启用"
                  inactive-text="禁用"
                />
                <el-text class="help-text" type="info" size="small">
                  在对话框打开时自动生成基于页面内容的推荐问题
                </el-text>
              </el-form-item>

              <el-form-item label="浏览器控制功能">
                <el-switch
                  v-model="settings.enableBrowserControl"
                  active-text="启用"
                  inactive-text="禁用"
                />
                <el-text class="help-text" type="info" size="small">
                  允许AI通过对话控制浏览器行为（如隐藏广告、修改样式等）
                </el-text>
              </el-form-item>

              <el-form-item v-if="settings.enableContext" label="保留对话轮数">
                <el-input-number
                  v-model="settings.maxContextRounds"
                  :min="1"
                  :max="10"
                  controls-position="right"
                />
                <el-text class="help-text" type="info" size="small">
                  设置保留最近几轮对话作为上下文（1-10轮），每轮包含一问一答
                </el-text>
              </el-form-item>

              <el-form-item label="系统提示词">
                <!-- 预设模板选择 -->
                <div class="preset-templates">
                  <div class="preset-buttons">
                    <button
                      type="button"
                      class="preset-btn"
                      :class="{ active: settings.systemPrompt === '' }"
                      @click="applyPreset('default')"
                    >
                      智能模式
                    </button>
                    <button
                      type="button"
                      class="preset-btn"
                      :class="{ active: isPresetActive('technical') }"
                      @click="applyPreset('technical')"
                    >
                      技术专家
                    </button>
                    <button
                      type="button"
                      class="preset-btn"
                      :class="{ active: isPresetActive('concise') }"
                      @click="applyPreset('concise')"
                    >
                      简洁助手
                    </button>
                    <button
                      type="button"
                      class="preset-btn"
                      :class="{ active: isPresetActive('friendly') }"
                      @click="applyPreset('friendly')"
                    >
                      友好助手
                    </button>
                    <button
                      type="button"
                      class="preset-btn"
                      :class="{ active: isPresetActive('analyst') }"
                      @click="applyPreset('analyst')"
                    >
                      数据分析师
                    </button>
                  </div>
                </div>
                <div class="system-prompt-container">
                  <el-input
                    v-model="settings.systemPrompt"
                    type="textarea"
                    :rows="4"
                    placeholder="例如：你是一个智能网页助手，通过对话帮助用户理解和操作网页。你可以分析内容、控制页面元素、回答问题。使用Markdown格式组织回答，确保可读性。"
                    resize="vertical"
                    class="field"
                  />
                </div>

                <el-text class="help-text" type="info" size="small">
                  自定义AI助手的角色、行为风格和回复格式。留空则使用智能提示词系统。
                </el-text>
              </el-form-item>
            </el-form>
          </el-card>
        </div>
      </div>
    </el-scrollbar>

    <div class="action-bar">
      <!-- 悬浮状态提示 -->
      <div v-if="statusMessage" class="status-floating">
        <el-alert
          :title="statusMessage"
          :type="statusType as any"
          :closable="true"
          show-icon
          @close="closeStatus"
          class="status-alert"
        />
      </div>

      <div class="action-inner">
        <el-button
          @click="resetSettings"
          type="default"
          :icon="Refresh"
          class="action-button secondary-button"
        >
          还原
        </el-button>
        <div class="button-group">
          <el-button
            @click="saveSettings"
            type="primary"
            :icon="Check"
            class="action-button primary-button"
          >
            保存
          </el-button>
          <el-button
            @click="testConnection"
            :type="
              testStatus === 'success'
                ? 'success'
                : testStatus === 'error'
                ? 'danger'
                : 'success'
            "
            :loading="isLoading"
            :icon="Connection"
            :class="[
              'action-button',
              'test-button',
              testStatus === 'success'
                ? 'test-success'
                : testStatus === 'error'
                ? 'test-error'
                : '',
            ]"
          >
            {{ isLoading ? "测试中..." : "测试连接" }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, nextTick } from "vue";
import {
  ElCard,
  ElIcon,
  ElForm,
  ElFormItem,
  ElSwitch,
  ElInputNumber,
  ElInput,
  ElText,
  ElSlider,
  ElButton,
  ElAlert,
  ElScrollbar,
  ElTabs,
  ElTabPane,
} from "element-plus";
import { Setting, Connection, Refresh, Check } from "@element-plus/icons-vue";
import {
  DEFAULT_SETTINGS,
  API_CONFIG_INFO,
} from "../shared/constants/defaults";

// 声明chrome类型
declare const chrome: any;

// API类型的默认配置
const apiConfigs = API_CONFIG_INFO;

// 设置数据
const settings = reactive({ ...DEFAULT_SETTINGS });

const activeTab = ref("api");
const isLoading = ref(false);
const statusMessage = ref("");
const statusType = ref("");
const scrollbarRef = ref();

// 测试状态：'none' | 'success' | 'error'
const testStatus = ref("none");
let statusTimer: NodeJS.Timeout | null = null;

// 系统提示词预设模板
const systemPromptPresets = {
  default: "",
  technical:
    "你是一个技术专家AI助手，专门帮助分析和操作技术网页。你可以：\n• 分析代码、API和文档内容\n• 通过对话控制页面元素\n• 提供详细的技术解释和代码示例\n• 使用Markdown格式，确保代码高亮\n• 理解技术术语和概念",
  concise:
    "你是一个简洁高效的AI助手，专注于快速解决问题。你可以：\n• 快速分析网页内容\n• 通过对话执行页面操作\n• 用最少的文字给出核心要点\n• 直接提供可操作的解决方案\n• 避免冗余信息",
  friendly:
    "你是一个友好、幽默的AI助手，让网页浏览更有趣。你可以：\n• 用轻松语调分析网页内容\n• 通过对话控制页面元素\n• 适当使用表情符号和比喻\n• 让技术操作变得简单易懂\n• 提供个性化的建议和帮助",
  analyst:
    "你是一个数据分析专家AI助手，擅长深度分析网页数据。你可以：\n• 分析网络请求和API数据\n• 提取和解释数据模式\n• 通过对话控制页面元素\n• 提供数据驱动的洞察\n• 使用图表和结构化展示",
};

// 应用预设模板
function applyPreset(presetKey: keyof typeof systemPromptPresets) {
  settings.systemPrompt = systemPromptPresets[presetKey];
}

// 检查预设是否激活
function isPresetActive(presetKey: keyof typeof systemPromptPresets) {
  return settings.systemPrompt === systemPromptPresets[presetKey];
}

// 显示状态提示并自动消失
function showStatus(message: string, type: string, duration = 3000) {
  // 清除之前的定时器
  if (statusTimer) {
    clearTimeout(statusTimer);
  }

  statusMessage.value = message;
  statusType.value = type;

  // 设置自动消失
  statusTimer = setTimeout(() => {
    statusMessage.value = "";
    statusType.value = "";
  }, duration);
}

// 手动关闭状态提示
function closeStatus() {
  // 清除定时器
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }

  // 清除状态
  statusMessage.value = "";
  statusType.value = "";
}

// 初始化
onMounted(async () => {
  await loadSettings();
});

// 监听Tab切换，自动滚动到顶部
watch(activeTab, () => {
  nextTick(() => {
    if (scrollbarRef.value) {
      scrollbarRef.value.setScrollTop(0);
    }
  });
});

// 加载设置
async function loadSettings() {
  try {
    console.log("正在加载设置...");
    // 首先尝试获取所有设置
    const result = await chrome.storage.sync.get(null);
    console.log("从存储加载的所有设置:", result);

    // 如果没有设置，使用默认设置
    if (Object.keys(result).length === 0) {
      console.log("存储中没有设置，使用默认设置");
      Object.assign(settings, DEFAULT_SETTINGS);
    } else {
      console.log("从存储加载的设置:", result);
      console.log("API配置检查:", {
        custom_apiKey: !!result.custom_apiKey,
        custom_apiBase: !!result.custom_apiBase,
        custom_model: !!result.custom_model,
        apiType: result.apiType,
      });

      // 合并存储的设置和默认设置
      Object.assign(settings, DEFAULT_SETTINGS, result);
    }

    console.log("合并后的设置:", settings);
  } catch (error) {
    console.error("加载设置失败:", error);
    // 如果加载失败，使用默认设置
    Object.assign(settings, DEFAULT_SETTINGS);
  }
}

// 不再需要切换API类型，保持为自定义(OpenAI兼容)

// 切换API密钥可见性
function toggleApiKeyVisibility() {
  const input = document.getElementById("apiKey") as HTMLInputElement;
  const button = document.querySelector(
    ".toggle-visibility"
  ) as HTMLButtonElement;

  if (input.type === "password") {
    input.type = "text";
    button.title = "点击隐藏";
  } else {
    input.type = "password";
    button.title = "点击显示";
  }
}

// 测试API配置
async function testApiConfig() {
  try {
    // 验证设置
    if (!settings.custom_apiKey) {
      throw new Error("API密钥未设置");
    }
    if (!settings.custom_apiBase) {
      throw new Error("API地址未设置");
    }
    if (!settings.custom_model) {
      throw new Error("模型名称未设置");
    }

    // 构建测试请求
    const request = {
      model: settings.custom_model,
      messages: [
        {
          role: "user",
          content:
            "Hello, please respond with 'API test successful' to confirm the connection is working.",
        },
      ],
      max_tokens: 50,
      temperature: 0.1,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (settings.custom_apiKey) {
      headers["Authorization"] = `Bearer ${settings.custom_apiKey}`;
    }

    // 发送测试请求
    const response = await fetch(settings.custom_apiBase, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.message?.content ||
      "API响应格式异常";

    return content;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "API测试失败");
  }
}

// 保存设置
async function saveSettings() {
  try {
    console.log("正在保存设置:", settings);
    console.log("API配置检查:", {
      custom_apiKey: !!settings.custom_apiKey,
      custom_apiBase: !!settings.custom_apiBase,
      custom_model: !!settings.custom_model,
      apiType: settings.apiType,
    });

    // 检查API配置是否完整
    if (
      !settings.custom_apiKey ||
      !settings.custom_apiBase ||
      !settings.custom_model
    ) {
      showStatus("请填写完整的API配置信息", "error");
      return;
    }

    console.log("开始保存到chrome.storage.sync...");
    await chrome.storage.sync.set(settings);
    console.log("保存到chrome.storage.sync完成");

    // 验证保存是否成功
    console.log("验证保存结果...");
    const saved = await chrome.storage.sync.get(null);
    console.log("保存后的设置:", saved);
    console.log("保存后的API配置检查:", {
      custom_apiKey: !!saved.custom_apiKey,
      custom_apiBase: !!saved.custom_apiBase,
      custom_model: !!saved.custom_model,
      apiType: saved.apiType,
    });

    if (saved.custom_apiKey && saved.custom_apiBase && saved.custom_model) {
      showStatus("设置保存成功！", "success");
    } else {
      showStatus("设置保存失败，请重试", "error");
    }
  } catch (error) {
    console.error("保存设置失败:", error);
    console.error("错误详情:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    showStatus(
      `保存失败：${error instanceof Error ? error.message : "未知错误"}`,
      "error"
    );
  }
}

// 测试连接
async function testConnection() {
  isLoading.value = true;
  statusMessage.value = "";
  statusType.value = "";
  testStatus.value = "none";

  try {
    // 测试API配置
    const result = await testApiConfig();

    testStatus.value = "success";
    showStatus("API连接测试成功！", "success");
  } catch (error) {
    testStatus.value = "error";
    showStatus(
      `测试失败：${error instanceof Error ? error.message : "未知错误"}`,
      "error"
    );
  } finally {
    isLoading.value = false;
  }
}

// 重置设置
function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS);
  statusMessage.value = "";
  statusType.value = "";
  testStatus.value = "none";

  // 清除定时器
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
}
</script>

<style scoped>
.container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  display: flex;
  overflow: hidden;
  flex-direction: column;

  box-sizing: border-box;
  height: 500px;

  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  box-shadow: 0 12px 40px rgba(15, 52, 96, 0.4);
}

/* 固定的Tab切换栏样式 */
.tab-header {
  padding: 16px 20px;

  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.15);

  backdrop-filter: blur(20px);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(15, 52, 96, 0.3);
  transition: transform 0.3s ease;
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
  gap: 6px;

  font-size: 12px;
  font-weight: 500;

  padding: 4px 8px;
  border-radius: 12px;

  color: rgba(212, 175, 55, 0.9);
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid rgba(212, 175, 55, 0.3);

  transition: all 0.3s ease;
}

.status-icon {
  font-size: 14px;
}

.status-text {
  font-size: 11px;
}

.tabs-container {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.settings-tabs {
  margin: 0;
}

.settings-tabs :deep(.el-tabs__header) {
  margin: 0;
  border-bottom: none;
  background: transparent;
}

.settings-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0;
  background: transparent;
}

.settings-tabs :deep(.el-tabs__nav) {
  border: none;
  display: flex;
  width: 100%;
}

.settings-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: 600;
  line-height: 44px;

  height: 44px;
  padding: 0 24px !important;
  margin: 0;
  flex: 1;

  color: rgba(255, 255, 255, 0.7);
  background: transparent;
  border: none;
  border-radius: 0;

  transition: all 0.3s ease;
  position: relative;
  text-align: center;
}

.settings-tabs :deep(.el-tabs__item:hover) {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.settings-tabs :deep(.el-tabs__item.is-active) {
  color: white;
  background: rgba(255, 255, 255, 0.2);
  font-weight: 700;
}

.settings-tabs :deep(.el-tabs__item.is-active::after) {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(135deg, #d4af37 0%, #ffc107 100%);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.4);
}

.settings-tabs :deep(.el-tabs__active-bar) {
  display: none;
}

/* 可滚动的内容区域 */
.content-scroll {
  flex: 1;
  height: calc(100% - 140px);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
}

.tab-content {
  padding: 16px;
}

.tab-pane-content {
  padding-bottom: 20px;
}

.card-header {
  font-weight: 600;

  display: flex;

  color: #2c3e50;

  align-items: center;
  gap: 8px;
}

.settings-card {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);

  backdrop-filter: blur(20px);
}

.settings-card :deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 16px 16px 0 0;
}

.settings-card :deep(.el-card__header .card-header) {
  color: white;
}

.settings-card :deep(.el-card__body) {
  padding: 20px;
}

.settings-form {
  margin-top: 12px;
}

.settings-form :deep(.el-form-item) {
  align-items: flex-start;
}

.settings-form :deep(.el-form-item__content) {
  display: flex;
  flex-direction: column;

  gap: 6px;
}

.field {
  width: 100%;
  max-width: 520px;
}

.slider-field {
  width: 100%;
  max-width: 640px;
}

.help-text {
  font-size: 12px;

  display: block;

  width: 100%;
  margin-top: 2px;

  color: #909399;
}

.status-alert {
  margin-top: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.status-alert :deep(.el-alert__closebtn) {
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  font-weight: bold;
  transition: color 0.2s ease;
}

.status-alert :deep(.el-alert__closebtn:hover) {
  color: rgba(255, 255, 255, 1);
}

.action-bar {
  position: sticky;
  bottom: 0;
  flex: 0 0 auto;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.1);
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(20px);
}

.status-floating {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: calc(100% - 32px);
  max-width: 400px;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.action-inner {
  display: flex;

  padding: 16px;

  gap: 12px;
  justify-content: center;
  align-items: center;
}

.button-group {
  display: flex;
  gap: 8px;
}

.action-button {
  font-size: 13px;
  font-weight: 600;

  height: 36px;
  padding: 0 20px;

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

.primary-button {
  color: white;
  border-color: rgba(255, 255, 255, 0.3);
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.1) 100%
  );
}

.primary-button:hover {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.3) 0%,
    rgba(255, 255, 255, 0.2) 100%
  );
}

.secondary-button {
  color: white;
  background: rgba(255, 255, 255, 0.15);
}

.secondary-button:hover {
  background: rgba(255, 255, 255, 0.25);
}

.test-button {
  color: white;
  border-color: rgba(76, 175, 80, 0.6);
  background: linear-gradient(
    135deg,
    rgba(76, 175, 80, 0.3) 0%,
    rgba(76, 175, 80, 0.2) 100%
  );
}

.test-button:hover {
  background: linear-gradient(
    135deg,
    rgba(76, 175, 80, 0.4) 0%,
    rgba(76, 175, 80, 0.3) 100%
  );
  border-color: rgba(76, 175, 80, 0.8);
}

/* 测试成功状态 */
.test-success {
  background: linear-gradient(
    135deg,
    rgba(76, 175, 80, 0.4) 0%,
    rgba(76, 175, 80, 0.3) 100%
  ) !important;
  border-color: rgba(76, 175, 80, 0.8) !important;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3) !important;
}

.test-success:hover {
  background: linear-gradient(
    135deg,
    rgba(76, 175, 80, 0.5) 0%,
    rgba(76, 175, 80, 0.4) 100%
  ) !important;
  border-color: rgba(76, 175, 80, 1) !important;
}

/* 测试失败状态 */
.test-error {
  background: linear-gradient(
    135deg,
    rgba(244, 67, 54, 0.4) 0%,
    rgba(244, 67, 54, 0.3) 100%
  ) !important;
  border-color: rgba(244, 67, 54, 0.8) !important;
  box-shadow: 0 0 0 2px rgba(244, 67, 54, 0.3) !important;
}

.test-error:hover {
  background: linear-gradient(
    135deg,
    rgba(244, 67, 54, 0.5) 0%,
    rgba(244, 67, 54, 0.4) 100%
  ) !important;
  border-color: rgba(244, 67, 54, 1) !important;
}

/* 系统提示词预设模板样式 */
.system-prompt-container {
  width: 100%;
}

.preset-templates {
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
}

.preset-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  align-items: stretch;
}

@media (max-width: 600px) {
  .preset-buttons {
    grid-template-columns: repeat(2, 1fr);
  }
}

.preset-btn {
  font-size: 12px;
  font-weight: 500;
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  transition: all 0.2s ease;
  white-space: nowrap;
  width: 100%;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-family: inherit;
  outline: none;
}

.preset-btn:hover {
  color: #d4af37;
  border-color: #d4af37;
  background: rgba(212, 175, 55, 0.1);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(212, 175, 55, 0.2);
}

.preset-btn.active {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-color: #d4af37;
  color: #d4af37;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(26, 26, 46, 0.3);
}

.preset-btn.active:hover {
  background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
  border-color: #ffc107;
  color: #ffc107;
  box-shadow: 0 6px 16px rgba(26, 26, 46, 0.4);
  transform: translateY(-2px);
}
</style>
