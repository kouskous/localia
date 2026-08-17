<script setup lang="ts">
import { FileSearch, Image, ScanText, Sparkles, type LucideIcon } from 'lucide-vue-next'

const props = defineProps<{
  icon: string
  label: string
}>()

const icons: Record<string, LucideIcon> = {
  'file-search': FileSearch,
  image: Image,
  'scan-text': ScanText,
  sparkles: Sparkles,
}

defineEmits<{ click: [] }>()
</script>

<template>
  <button type="button" class="suggestion-chip" @click="$emit('click')">
    <component :is="icons[props.icon]" :size="16" :stroke-width="1.75" class="icon" />
    <span>{{ label }}</span>
  </button>
</template>

<style scoped>
.suggestion-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.icon {
  color: var(--color-text-muted);
  transition: color var(--duration-fast) var(--ease-standard);
}

.suggestion-chip:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.suggestion-chip:hover .icon {
  color: var(--color-primary);
}
</style>
