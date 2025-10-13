<template>
  <div v-if="showMonitor" class="memory-monitor">
    <div class="monitor-header">
      <div class="monitor-title">
        <span class="monitor-icon">💾</span>
        <span>内存监控</span>
      </div>
      <button class="close-btn" @click="hideMonitor" title="关闭">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 6L6 18M6 6L18 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <div class="monitor-content">
      <!-- 缓存统计 -->
      <div class="stats-section">
        <h4>缓存统计</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">缓存项数</span>
            <span class="stat-value">{{ cacheStats.totalItems }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">缓存大小</span>
            <span class="stat-value">{{
              formatBytes(cacheStats.totalSize)
            }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">命中率</span>
            <span class="stat-value">{{ cacheStats.hitRate.toFixed(1) }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">淘汰次数</span>
            <span class="stat-value">{{ cacheStats.evictionCount }}</span>
          </div>
        </div>
      </div>

      <!-- 内存使用情况 -->
      <div class="memory-section">
        <h4>内存使用</h4>
        <div class="memory-bars">
          <div class="memory-bar">
            <div class="bar-label">缓存内存</div>
            <div class="bar-container">
              <div
                class="bar-fill cache-memory"
                :style="{ width: `${cacheMemoryPercent}%` }"
              ></div>
            </div>
            <div class="bar-value">{{ formatBytes(cacheStats.totalSize) }}</div>
          </div>

          <div class="memory-bar">
            <div class="bar-label">总内存</div>
            <div class="bar-container">
              <div
                class="bar-fill total-memory"
                :style="{ width: `${totalMemoryPercent}%` }"
              ></div>
            </div>
            <div class="bar-value">{{ formatBytes(totalMemoryUsage) }}</div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions-section">
        <button class="action-btn primary" @click="clearCache">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 6H5H21"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          清空缓存
        </button>

        <button class="action-btn secondary" @click="cleanupCache">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 6H5H21"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          清理过期
        </button>

        <button class="action-btn secondary" @click="exportCache">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15V19C21 19.5523 20.5523 20 20 20H4C3.44772 20 3 19.5523 3 19V15"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M7 10L12 15L17 10"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M12 15V3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          导出缓存
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { cacheManager, type CacheStats } from "../../shared/utils/cacheManager";

const showMonitor = ref(false);
const cacheStats = ref<CacheStats>({
  totalItems: 0,
  totalSize: 0,
  hitCount: 0,
  missCount: 0,
  hitRate: 0,
  evictionCount: 0,
  lastCleanup: 0,
});

// 更新统计信息
function updateStats() {
  cacheStats.value = cacheManager.getStats();
}

// 计算内存使用百分比
const cacheMemoryPercent = computed(() => {
  const maxSize = cacheManager.getConfig().maxSize;
  return Math.min((cacheStats.value.totalSize / maxSize) * 100, 100);
});

const totalMemoryUsage = computed(() => {
  const sizeInfo = cacheManager.getSizeInfo();
  return sizeInfo.memoryUsage;
});

const totalMemoryPercent = computed(() => {
  const maxSize = cacheManager.getConfig().maxSize;
  return Math.min((totalMemoryUsage.value / maxSize) * 100, 100);
});

// 格式化字节数
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// 清空缓存
function clearCache() {
  cacheManager.clear();
  updateStats();
}

// 清理过期缓存
function cleanupCache() {
  cacheManager.cleanup();
  updateStats();
}

// 导出缓存
function exportCache() {
  const data = cacheManager.export();
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `cache-export-${new Date().toISOString().slice(0, 19)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 隐藏监控器
function hideMonitor() {
  showMonitor.value = false;
}

// 显示监控器
function show() {
  showMonitor.value = true;
  updateStats();
}

// 定时更新统计信息
let updateTimer: NodeJS.Timeout | null = null;

onMounted(() => {
  updateStats();
  updateTimer = setInterval(updateStats, 5000); // 每5秒更新一次
});

onUnmounted(() => {
  if (updateTimer) {
    clearInterval(updateTimer);
  }
});

// 暴露方法给父组件
defineExpose({
  show,
  hide: hideMonitor,
});
</script>

<style scoped>
.memory-monitor {
  background: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.95) 0%,
    rgba(22, 33, 62, 0.9) 100%
  );
  border-radius: 12px;
  padding: 16px;
  margin: 12px 0;
  border: 1px solid rgba(212, 175, 55, 0.3);
  backdrop-filter: blur(10px);
  max-width: 400px;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.monitor-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
}

.monitor-icon {
  font-size: 16px;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.monitor-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-section h4,
.memory-section h4 {
  margin: 0 0 12px 0;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.stat-value {
  font-size: 11px;
  font-weight: 600;
  color: #d4af37;
}

.memory-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.memory-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  min-width: 60px;
}

.bar-container {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.cache-memory {
  background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%);
}

.total-memory {
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
}

.bar-value {
  font-size: 10px;
  color: #ffffff;
  min-width: 50px;
  text-align: right;
}

.actions-section {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  justify-content: center;
  min-width: 0;
}

.action-btn.primary {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.action-btn.primary:hover {
  background: rgba(239, 68, 68, 0.3);
  transform: translateY(-1px);
}

.action-btn.secondary {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.action-btn.secondary:hover {
  background: rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

/* 响应式设计 */
@media (max-width: 480px) {
  .memory-monitor {
    padding: 12px;
    margin: 8px 0;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .actions-section {
    flex-direction: column;
  }

  .action-btn {
    flex: none;
  }
}
</style>
