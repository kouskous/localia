<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number
    animated?: boolean
  }>(),
  {
    size: 20,
    animated: false,
  },
)
</script>

<template>
  <span class="spark" :class="{ animated }" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C12.6 8.2 15.8 11.4 22 12C15.8 12.6 12.6 15.8 12 22C11.4 15.8 8.2 12.6 2 12C8.2 11.4 11.4 8.2 12 2Z"
        fill="url(#spark-gradient)"
      />
      <defs>
        <linearGradient id="spark-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="var(--color-primary)" />
          <stop offset="1" stop-color="var(--color-primary-dark)" />
        </linearGradient>
      </defs>
    </svg>
  </span>
</template>

<style scoped>
.spark {
  display: inline-flex;
  flex-shrink: 0;
}

.spark svg {
  width: 100%;
  height: 100%;
}

.animated svg {
  animation: spark-breathe 2.4s var(--ease-in-out) infinite;
  transform-origin: center;
}

@keyframes spark-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.88);
    opacity: 0.75;
  }
}
</style>
