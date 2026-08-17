<script setup lang="ts">
import AppSpark from '../ui/AppSpark.vue'
import SuggestionChip from './SuggestionChip.vue'
import type { Suggestion } from '../../types/chat'

const suggestions: Suggestion[] = [
  { id: 'analyze', label: 'Analyser un document', icon: 'file-search' },
  { id: 'summarize', label: 'Résumer ce PDF', icon: 'scan-text' },
  { id: 'read-image', label: 'Lire cette image', icon: 'image' },
  { id: 'extract', label: "Extraire l'essentiel", icon: 'sparkles' },
]

defineEmits<{ pick: [text: string] }>()
</script>

<template>
  <div class="empty-state">
    <AppSpark :size="32" />
    <h1 class="headline">Que puis-je faire pour vous ?</h1>
    <div class="suggestions">
      <SuggestionChip
        v-for="s in suggestions"
        :key="s.id"
        :icon="s.icon"
        :label="s.label"
        @click="$emit('pick', s.label)"
      />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-5);
  padding: var(--space-8) var(--space-5);
  animation: fade-up var(--duration-slow) var(--ease-out) both;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.headline {
  margin: 0;
  font-size: var(--text-display);
  font-weight: var(--weight-medium);
  color: var(--color-text-primary);
  letter-spacing: -0.4px;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  max-width: 480px;
}
</style>
