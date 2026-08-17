<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { ChatMessage } from '../../types/chat'
import UserMessage from './UserMessage.vue'
import AssistantMessage from './AssistantMessage.vue'
import ProcessingIndicator from './ProcessingIndicator.vue'

const props = defineProps<{
  messages: ChatMessage[]
  isProcessing: boolean
  processingLabel: string
}>()

const scrollEl = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (scrollEl.value) {
      scrollEl.value.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
    }
  })
}

watch(
  () => [props.messages.length, props.isProcessing, props.messages.at(-1)?.content],
  scrollToBottom,
  { flush: 'post' },
)
</script>

<template>
  <div ref="scrollEl" class="message-list">
    <div class="message-list-inner">
      <TransitionGroup name="message" tag="div" class="messages">
        <component
          :is="m.role === 'user' ? UserMessage : AssistantMessage"
          v-for="m in messages"
          :key="m.id"
          :message="m"
        />
      </TransitionGroup>
      <ProcessingIndicator v-if="isProcessing" :label="processingLabel" />
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6) var(--space-5);
}

.message-list-inner {
  max-width: var(--conversation-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.messages {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.message-enter-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}
.message-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
</style>
