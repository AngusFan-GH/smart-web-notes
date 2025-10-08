<template>
  <el-button
    v-if="visible"
    id="ai-assistant-ball"
    class="floating-ball"
    type="primary"
    :icon="ChatDotRound"
    circle
    size="large"
    @click="handleClick"
    :title="'AI助手 - 点击开始对话'"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { ElButton } from "element-plus";
import { ChatDotRound } from "@element-plus/icons-vue";

// 声明chrome类型
declare const chrome: any;

interface Props {
  visible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
});

const emit = defineEmits<{
  click: [];
}>();

const handleClick = (e: MouseEvent) => {
  e.stopPropagation();
  emit("click");
};

const handleMouseEnter = () => {
  const ball = document.getElementById("ai-assistant-ball");
  if (ball) {
    ball.style.transform = "scale(1.1)";
    ball.style.boxShadow = "0 6px 25px rgba(102, 126, 234, 0.6)";
  }
};

const handleMouseLeave = () => {
  const ball = document.getElementById("ai-assistant-ball");
  if (ball) {
    ball.style.transform = "scale(1)";
    ball.style.boxShadow = "0 4px 20px rgba(102, 126, 234, 0.4)";
  }
};
</script>

<style scoped>
.floating-ball {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  box-shadow: 0 4px 20px rgba(64, 158, 255, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.floating-ball:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 25px rgba(64, 158, 255, 0.6);
}
</style>
