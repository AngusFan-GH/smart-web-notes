<template>
  <div class="container">
    <!-- 固定的Tab切换栏 -->
    <div class="tab-header">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <el-tab-pane label="API 配置" name="api"></el-tab-pane>
        <el-tab-pane label="常规设置" name="general"></el-tab-pane>
      </el-tabs>
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

          <el-alert
            v-if="statusMessage"
            :title="statusMessage"
            :type="statusType"
            :closable="false"
            show-icon
            class="status-alert"
          />
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
                <el-input
                  v-model="settings.systemPrompt"
                  type="textarea"
                  :rows="3"
                  placeholder="你是一个帮助理解网页内容的AI助手。请使用Markdown格式回复。"
                  resize="none"
                  class="field"
                />
                <el-text class="help-text" type="info" size="small">
                  设置AI助手的角色和行为。留空则使用默认提示词。
                </el-text>
              </el-form-item>
            </el-form>
          </el-card>
        </div>
      </div>
    </el-scrollbar>

    <div class="action-bar">
      <div class="action-inner">
        <el-button @click="resetSettings" type="default" :icon="Refresh">
          还原默认设置
        </el-button>
        <el-button
          @click="saveAndTest"
          type="primary"
          :loading="isLoading"
          :icon="Check"
        >
          {{ isLoading ? "测试中..." : "保存并测试" }}
        </el-button>
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
    const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    Object.assign(settings, result);
  } catch (error) {
    console.error("加载设置失败:", error);
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
          content: "Hello, please respond with 'API test successful' to confirm the connection is working."
        }
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
    const content = data.choices?.[0]?.message?.content || data.message?.content || "API响应格式异常";
    
    return content;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "API测试失败");
  }
}

// 保存并测试
async function saveAndTest() {
  isLoading.value = true;
  statusMessage.value = "";
  statusType.value = "";

  try {
    // 保存设置
    await chrome.storage.sync.set(settings);

    // 测试API配置
    const result = await testApiConfig();

    statusMessage.value = `测试成功！AI回复：${result}`;
    statusType.value = "success";
  } catch (error) {
    statusMessage.value = `测试失败：${
      error instanceof Error ? error.message : "未知错误"
    }`;
    statusType.value = "error";
  } finally {
    isLoading.value = false;
  }
}

// 重置设置
function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS);
  statusMessage.value = "";
}
</script>

<style scoped>
.container {
  display: flex;
  overflow: hidden;
  flex-direction: column;

  box-sizing: border-box;
  height: 500px;

  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/* 固定的Tab切换栏样式 - 类似之前的title栏 */
.tab-header {
  margin-bottom: 16px;
  padding: 16px 20px;

  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);

  backdrop-filter: blur(10px);
}

.settings-tabs {
  margin: 0;
}

.settings-tabs :deep(.el-tabs__header) {
  margin: 0;

  border-bottom: none;
}

.settings-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0;
}

.settings-tabs :deep(.el-tabs__item) {
  font-size: 16px;
  font-weight: 600;
  line-height: 40px;

  height: 40px;
  padding: 0 20px;

  color: #2c3e50;
}

.settings-tabs :deep(.el-tabs__item.is-active) {
  color: #409eff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  background-clip: text;

  -webkit-text-fill-color: transparent;
}

.settings-tabs :deep(.el-tabs__active-bar) {
  height: 3px;

  border-radius: 2px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 可滚动的内容区域 */
.content-scroll {
  flex: 1;

  height: calc(100% - 120px);
}

.tab-content {
  padding: 0 10px;
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
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);

  backdrop-filter: blur(10px);
}

.settings-card :deep(.el-card__header) {
  padding: 16px 20px;

  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.settings-card :deep(.el-card__header .card-header) {
  color: white;
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
}

.action-bar {
  position: sticky;
  bottom: 0;

  flex: 0 0 auto;

  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
}

.action-inner {
  display: flex;

  padding: 12px 16px;

  gap: 12px;
  justify-content: center;
}
</style>
