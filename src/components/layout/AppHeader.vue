<script setup lang="ts">
import { MoreHorizontal, SquarePen } from 'lucide-vue-next'
import AppSpark from '../ui/AppSpark.vue'
import IconButton from '../ui/IconButton.vue'

defineProps<{
  showActions?: boolean
}>()

defineEmits<{ 'new-chat': [] }>()
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <AppSpark :size="18" />
      <span class="name">Localia</span>
    </div>
    <div v-if="showActions" class="actions">
      <IconButton label="Nouvelle conversation" variant="neutral" @click="$emit('new-chat')">
        <SquarePen :size="18" :stroke-width="1.75" />
      </IconButton>
      <IconButton label="Plus d'options" variant="neutral">
        <MoreHorizontal :size="18" :stroke-width="1.75" />
      </IconButton>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-5);
  flex-shrink: 0;
  z-index: var(--z-header);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.name {
  font-size: var(--text-secondary);
  font-weight: var(--weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: -0.1px;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
</style>
