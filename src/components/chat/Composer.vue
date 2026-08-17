<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ArrowUp, Paperclip, Square } from 'lucide-vue-next'
import IconButton from '../ui/IconButton.vue'
import FileChip from '../ui/FileChip.vue'
import type { ChatAttachment } from '../../types/chat'
import { filesToAttachments } from '../../composables/useFileKind'

const props = defineProps<{
  disabled?: boolean
  processing?: boolean
}>()

const emit = defineEmits<{
  send: [text: string, attachments: ChatAttachment[]]
  cancel: []
}>()

const text = ref('')
const attachments = ref<ChatAttachment[]>([])
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const isFocused = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const canSend = computed(() => !props.disabled && (text.value.trim().length > 0 || attachments.value.length > 0))

function autoGrow() {
  const el = textareaEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`
}

function handleInput() {
  nextTick(autoGrow)
}

function submit() {
  if (!canSend.value) return
  emit('send', text.value, attachments.value)
  text.value = ''
  attachments.value = []
  nextTick(autoGrow)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function addFiles(files: FileList | File[] | null) {
  if (!files || files.length === 0) return
  attachments.value.push(...filesToAttachments(files))
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((a) => a.id !== id)
}

function openFilePicker() {
  fileInput.value?.click()
}

function handleFileInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  addFiles(target.files)
  target.value = ''
}

defineExpose({ addFiles })
</script>

<template>
  <div class="composer" :class="{ focused: isFocused }">
    <div v-if="attachments.length" class="attachments">
      <FileChip
        v-for="a in attachments"
        :key="a.id"
        :attachment="a"
        removable
        @remove="removeAttachment(a.id)"
      />
    </div>

    <div class="input-row">
      <textarea
        ref="textareaEl"
        v-model="text"
        class="textarea"
        rows="1"
        placeholder="Demandez n'importe quoi ou déposez un fichier…"
        :disabled="disabled"
        @input="handleInput"
        @keydown="handleKeydown"
        @focus="isFocused = true"
        @blur="isFocused = false"
      />
    </div>

    <div class="toolbar">
      <IconButton label="Joindre un fichier" variant="neutral" :size="34" @click="openFilePicker">
        <Paperclip :size="18" :stroke-width="1.75" />
      </IconButton>

      <div class="spacer" />

      <IconButton
        v-if="processing"
        label="Arrêter"
        variant="neutral"
        :size="34"
        @click="$emit('cancel')"
      >
        <Square :size="14" :stroke-width="2" fill="currentColor" />
      </IconButton>
      <IconButton
        v-else
        label="Envoyer"
        variant="accent"
        :size="34"
        :disabled="!canSend"
        type="submit"
        @click="submit"
      >
        <ArrowUp :size="18" :stroke-width="2" />
      </IconButton>
    </div>

    <input
      ref="fileInput"
      type="file"
      multiple
      class="hidden-input"
      @change="handleFileInputChange"
    />
  </div>
</template>

<style scoped>
.composer {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  padding: var(--space-4);
  box-shadow: var(--shadow-composer);
  transition:
    box-shadow var(--duration-base) var(--ease-standard),
    border-color var(--duration-base) var(--ease-standard);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.composer.focused {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-composer-focus);
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding-bottom: var(--space-1);
}

.textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--leading-normal);
  min-height: 28px;
  max-height: 200px;
  padding: 0;
}

.textarea::placeholder {
  color: var(--color-text-muted);
}

.toolbar {
  display: flex;
  align-items: center;
}

.spacer {
  flex: 1;
}

.hidden-input {
  display: none;
}
</style>
