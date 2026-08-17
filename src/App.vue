<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LoadingScreen from './components/LoadingScreen.vue'
import AppHeader from './components/layout/AppHeader.vue'
import EmptyState from './components/chat/EmptyState.vue'
import Composer from './components/chat/Composer.vue'
import MessageList from './components/chat/MessageList.vue'
import DropOverlay from './components/chat/DropOverlay.vue'
import { useAgent } from './composables/useAgent'
import { filesToAttachments } from './composables/useFileKind'

const { booting, bootProgress, messages, isProcessing, processingLabel, sendMessage, cancel, reset } = useAgent()

const composerRef = ref<InstanceType<typeof Composer> | null>(null)
const isDragging = ref(false)
let dragDepth = 0

onMounted(() => {
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('drop', onDrop)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('drop', onDrop)
})

function onDragEnter(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  dragDepth += 1
  isDragging.value = true
}

function onDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragDepth = 0
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length) {
    composerRef.value?.addFiles(files)
  }
}

function handleSend(text: string, attachments: ReturnType<typeof filesToAttachments>) {
  sendMessage(text, attachments)
}

function handlePickSuggestion(label: string) {
  sendMessage(label)
}

function handleNewChat() {
  cancel()
  reset()
}
</script>

<template>
  <LoadingScreen v-if="booting" :progress="bootProgress" />

  <div v-else class="app-shell">
    <AppHeader :show-actions="messages.length > 0" @new-chat="handleNewChat" />

    <main v-if="messages.length === 0" class="hero-main">
      <div class="hero-inner">
        <EmptyState @pick="handlePickSuggestion" />
        <div class="composer-wrap hero-composer">
          <Composer ref="composerRef" :processing="isProcessing" @send="handleSend" @cancel="cancel" />
        </div>
      </div>
    </main>

    <template v-else>
      <MessageList :messages="messages" :is-processing="isProcessing" :processing-label="processingLabel" />
      <div class="composer-dock">
        <div class="composer-wrap">
          <Composer ref="composerRef" :processing="isProcessing" @send="handleSend" @cancel="cancel" />
        </div>
      </div>
    </template>

    <DropOverlay :visible="isDragging" />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  animation: shell-in var(--duration-slow) var(--ease-out) both;
}

@keyframes shell-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.hero-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  overflow-y: auto;
}

.hero-inner {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-8);
}

.composer-dock {
  flex-shrink: 0;
  padding: var(--space-3) var(--space-5) var(--space-5);
  background: linear-gradient(to top, var(--color-bg) 60%, transparent);
}

.composer-wrap {
  max-width: var(--conversation-max-width);
  margin: 0 auto;
  width: 100%;
}

.hero-composer {
  width: 100%;
  max-width: 100%;
}

@media (max-width: 640px) {
  .hero-main {
    padding: var(--space-4);
  }

  .composer-dock {
    padding: var(--space-2) var(--space-3) var(--space-3);
    padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
  }
}
</style>
