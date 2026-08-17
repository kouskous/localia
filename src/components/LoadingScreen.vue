<script setup lang="ts">
import { computed } from 'vue'
import AppSpark from './ui/AppSpark.vue'
import ProgressBar from './ui/ProgressBar.vue'

const props = defineProps<{
  progress: number
}>()

const phase = computed(() => {
  if (props.progress < 35) return "L'IA prépare ses neurones… 🧠"
  if (props.progress < 70) return "L'IA prépare ses yeux… 👀"
  return 'Derniers réglages…'
})
</script>

<template>
  <div class="loading-screen">
    <div class="loading-content">
      <AppSpark :size="40" animated />
      <h1 class="title">Préparons votre IA</h1>
      <p class="phase">{{ phase }}</p>
      <div class="bar">
        <ProgressBar :progress="progress" show-label />
      </div>
      <p class="hint">Elle sera prête dans un instant.</p>
    </div>
  </div>
</template>

<style scoped>
.loading-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  z-index: var(--z-modal);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-4);
  width: min(320px, 84vw);
  animation: rise var(--duration-slow) var(--ease-out) both;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.title {
  margin: var(--space-2) 0 0;
  font-size: var(--text-title);
  font-weight: var(--weight-medium);
  color: var(--color-text-primary);
  letter-spacing: -0.2px;
}

.phase {
  margin: 0;
  font-size: var(--text-secondary);
  color: var(--color-text-secondary);
  min-height: 20px;
}

.bar {
  width: 100%;
  margin-top: var(--space-2);
}

.hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}
</style>
