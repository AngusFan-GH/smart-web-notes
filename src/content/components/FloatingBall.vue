<template>
  <div v-if="visible" class="floating-ball" @click="handleClick">
    <el-icon class="ball-icon">
      <MagicStick />
    </el-icon>
  </div>
</template>

<script setup lang="ts">
import { MagicStick } from "@element-plus/icons-vue";

interface Props {
  visible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
});

const emit = defineEmits<{
  click: [];
}>();

// 处理点击
function handleClick() {
  emit("click");
}
</script>

<style scoped>
.floating-ball {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10000;
  user-select: none;
  backdrop-filter: blur(20px);
}

.floating-ball:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
}

.floating-ball:active {
  transform: scale(0.95);
}

.ball-icon {
  color: white;
  font-size: 20px;
  filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.5));
}
</style>
