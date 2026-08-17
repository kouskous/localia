<template>
  <span class="typing-dots" aria-hidden="true">
    <span class="dot" />
    <span class="dot" />
    <span class="dot" />
  </span>
</template>

<style scoped>
.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  animation: dot-pulse 1.2s var(--ease-in-out) infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.15s;
}
.dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes dot-pulse {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.85);
  }
  40% {
    opacity: 1;
    transform: scale(1.1);
  }
}
</style>
