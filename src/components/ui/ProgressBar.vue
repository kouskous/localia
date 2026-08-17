<script setup lang="ts">
withDefaults(
  defineProps<{
    progress: number
    showLabel?: boolean
  }>(),
  {
    showLabel: false,
  },
)
</script>

<template>
  <div class="progress-wrap">
    <div class="progress-track" role="progressbar" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-fill" :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }" />
    </div>
    <span v-if="showLabel" class="progress-label">{{ Math.round(progress) }}%</span>
  </div>
</template>

<style scoped>
.progress-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
}

.progress-track {
  flex: 1;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-surface-subtle);
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-dark));
  transition: width var(--duration-slow) var(--ease-out);
}

.progress-label {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 32px;
  text-align: right;
}
</style>
