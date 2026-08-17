<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '../../types/chat'
import AppSpark from '../ui/AppSpark.vue'
import { formatMessage } from '../../composables/useMarkdownLite'

const props = defineProps<{
  message: ChatMessage
}>()

const html = computed(() => formatMessage(props.message.content))
</script>

<template>
  <div class="assistant-message-row">
    <div class="avatar">
      <AppSpark :size="16" />
    </div>
    <div class="content" v-html="html" />
  </div>
</template>

<style scoped>
.assistant-message-row {
  display: flex;
  gap: var(--space-3);
  max-width: min(85%, 640px);
}

.avatar {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.content {
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
  color: var(--color-text-primary);
  min-width: 0;
}

.content :deep(p) {
  margin: 0 0 var(--space-3);
}

.content :deep(p:last-child) {
  margin-bottom: 0;
}

.content :deep(strong) {
  font-weight: var(--weight-semibold);
}

.content :deep(ol) {
  margin: 0 0 var(--space-3);
  padding-left: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.content :deep(ol:last-child) {
  margin-bottom: 0;
}
</style>
