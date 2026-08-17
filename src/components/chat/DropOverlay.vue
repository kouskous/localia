<script setup lang="ts">
import { UploadCloud } from 'lucide-vue-next'

defineProps<{ visible: boolean }>()
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="visible" class="drop-overlay">
      <div class="drop-zone">
        <UploadCloud :size="28" :stroke-width="1.5" class="icon" />
        <p>Déposez votre fichier ici</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: rgba(109, 93, 251, 0.05);
  backdrop-filter: blur(1px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-10) var(--space-16);
  border: 1.5px dashed var(--color-primary);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  color: var(--color-primary-dark);
  font-size: var(--text-body);
  font-weight: var(--weight-medium);
  animation: pulse-scale 1.6s var(--ease-in-out) infinite;
}

.icon {
  color: var(--color-primary);
}

.drop-zone p {
  margin: 0;
}

@keyframes pulse-scale {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.015);
  }
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
</style>
