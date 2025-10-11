<template>
  <div class="dialog-header" @mousedown="handleHeaderMouseDown">
    <div class="dialog-title">
      <el-icon><ChatDotRound /></el-icon>
      <span>{{ title }}</span>
    </div>
    <div class="dialog-controls">
      <el-button
        @click="handleClose"
        type="text"
        size="small"
        :icon="Close"
        circle
        class="control-btn"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElIcon, ElButton } from "element-plus";
import { ChatDotRound, Close } from "@element-plus/icons-vue";

interface Props {
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: "Smart Web Notes",
});

const emit = defineEmits<{
  close: [];
  "header-mousedown": [event: MouseEvent];
}>();

const handleClose = () => {
  emit("close");
};

const handleHeaderMouseDown = (event: MouseEvent) => {
  emit("header-mousedown", event);
};
</script>

<style scoped>
.dialog-header {
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.2) 0%,
    rgba(118, 75, 162, 0.2) 100%
  );
  border-radius: 20px 20px 0 0;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  position: relative;
  overflow: hidden;
  cursor: move;
  user-select: none;
}

.dialog-header::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(240, 248, 255, 0.6) 100%
  );
  pointer-events: none;
}

.dialog-header::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(99, 102, 241, 0.3) 50%,
    transparent 100%
  );
  pointer-events: none;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
  letter-spacing: -0.025em;
  position: relative;
  z-index: 1;
}

.dialog-title .el-icon {
  font-size: 20px;
  color: rgba(102, 126, 234, 0.9);
  filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.5));
}

.dialog-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 1;
}

.control-btn {
  padding: 8px;
  border-radius: 10px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(240, 248, 255, 0.9) 100%
  );
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.2),
    0 0 0 1px rgba(102, 126, 234, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(102, 126, 234, 0.3);
  min-width: 36px;
  min-height: 36px;
  color: #4a5568;
}

.control-btn:hover {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(240, 248, 255, 1) 100%
  );
  box-shadow: 0 6px 12px rgba(102, 126, 234, 0.3),
    0 0 0 1px rgba(102, 126, 234, 0.4);
  transform: translateY(-1px);
  color: #2d3748;
}

.control-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .dialog-header {
    padding: 14px 16px;
    border-radius: 16px 16px 0 0;
  }

  .dialog-title {
    font-size: 16px;
  }

  .dialog-title .el-icon {
    font-size: 18px;
  }

  .control-btn {
    padding: 6px;
    border-radius: 8px;
    min-width: 32px;
    min-height: 32px;
  }
}

@media (max-width: 480px) {
  .dialog-header {
    padding: 12px 14px;
    border-radius: 14px 14px 0 0;
  }

  .dialog-title {
    font-size: 15px;
  }

  .dialog-title .el-icon {
    font-size: 16px;
  }

  .control-btn {
    padding: 5px;
    border-radius: 6px;
    min-width: 28px;
    min-height: 28px;
  }
}
</style>
