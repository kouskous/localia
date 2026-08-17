<script setup lang="ts">
import { FileText, Image, File, X } from 'lucide-vue-next'
import type { ChatAttachment } from '../../types/chat'
import { formatFileSize } from '../../composables/useFileKind'

defineProps<{
  attachment: ChatAttachment
  removable?: boolean
}>()

defineEmits<{ remove: [] }>()

const iconMap = {
  image: Image,
  pdf: FileText,
  document: FileText,
  file: File,
}
</script>

<template>
  <div class="file-chip" :class="{ 'has-preview': attachment.kind === 'image' }">
    <div class="thumb">
      <img v-if="attachment.previewUrl" :src="attachment.previewUrl" :alt="attachment.name" />
      <component :is="iconMap[attachment.kind]" v-else :size="18" :stroke-width="1.75" />
    </div>
    <div class="meta">
      <span class="name">{{ attachment.name }}</span>
      <span class="size">{{ formatFileSize(attachment.size) }}</span>
    </div>
    <button v-if="removable" class="remove" type="button" aria-label="Retirer le fichier" @click="$emit('remove')">
      <X :size="14" :stroke-width="2" />
    </button>
  </div>
</template>

<style scoped>
.file-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  padding-right: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-width: 240px;
  position: relative;
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.file-chip:hover {
  border-color: var(--color-border-strong);
}

.thumb {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.name {
  font-size: var(--text-caption);
  font-weight: var(--weight-medium);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.size {
  font-size: var(--text-micro);
  color: var(--color-text-muted);
}

.remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--color-text-primary);
  color: var(--color-surface);
  border: 2px solid var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.85);
  transition:
    opacity var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.file-chip:hover .remove,
.file-chip:focus-within .remove {
  opacity: 1;
  transform: scale(1);
}
</style>
