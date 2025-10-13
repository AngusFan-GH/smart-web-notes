<template>
  <div v-if="visible" class="floating-ball" @click="handleClick">
    <img src="../icons/icon16.png" alt="Web Assistant" class="ball-icon" />
  </div>
</template>

<script setup lang="ts">
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
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(15, 52, 96, 0.4),
    0 0 0 1px rgba(212, 175, 55, 0.3);
  border: 1px solid rgba(212, 175, 55, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10000;
  user-select: none;
  backdrop-filter: blur(20px);
}

.floating-ball:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 40px rgba(15, 52, 96, 0.5),
    0 0 0 1px rgba(212, 175, 55, 0.5);
  background: linear-gradient(135deg, #0f1419 0%, #1a1a2e 50%, #16213e 100%);
}

.floating-ball:active {
  transform: scale(0.95);
}

.ball-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  transition: transform 0.3s ease;
}

.ball-icon:hover {
  transform: scale(1.1);
}
</style>
