<script setup lang="ts">
import AppSpark from '../ui/AppSpark.vue'
import TypingDots from '../ui/TypingDots.vue'

defineProps<{
  label: string
}>()
</script>

<template>
  <div class="processing">
    <AppSpark :size="18" animated />
    <TypingDots />
    <Transition name="fade-slide" mode="out-in">
      <span :key="label" class="label">{{ label }}</span>
    </Transition>
  </div>
</template>

<style scoped>
.processing {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  animation: enter var(--duration-base) var(--ease-out) both;
}

@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.label {
  font-size: var(--text-secondary);
  color: var(--color-text-secondary);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(3px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
</style>
