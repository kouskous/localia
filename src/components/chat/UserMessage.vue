<script setup lang="ts">
import type { ChatMessage } from '../../types/chat'
import FileChip from '../ui/FileChip.vue'

defineProps<{
  message: ChatMessage
}>()
</script>

<template>
  <div class="user-message-row">
    <div class="bubble-group">
      <div v-if="message.attachments?.length" class="attachments">
        <FileChip v-for="a in message.attachments" :key="a.id" :attachment="a" />
      </div>
      <div v-if="message.content" class="bubble">{{ message.content }}</div>
    </div>
  </div>
</template>

<style scoped>
.user-message-row {
  display: flex;
  justify-content: flex-end;
}

.bubble-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
  max-width: min(70%, 560px);
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

.bubble {
  background: var(--color-surface-subtle);
  color: var(--color-text-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  border-bottom-right-radius: var(--radius-sm);
  font-size: var(--text-body);
  line-height: var(--leading-normal);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
