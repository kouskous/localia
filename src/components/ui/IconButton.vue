<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'accent' | 'neutral' | 'ghost'
    size?: number
    disabled?: boolean
    label: string
    type?: 'button' | 'submit'
  }>(),
  {
    variant: 'neutral',
    size: 36,
    disabled: false,
    type: 'button',
  },
)
</script>

<template>
  <button
    :type="type"
    class="icon-button"
    :class="variant"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :disabled="disabled"
    :aria-label="label"
    :title="label"
  >
    <slot />
  </button>
</template>

<style scoped>
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    transform var(--duration-instant) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard),
    opacity var(--duration-fast) var(--ease-standard);
}

.icon-button:active:not(:disabled) {
  transform: scale(0.94);
}

.icon-button:disabled {
  cursor: not-allowed;
}

.neutral {
  background: transparent;
  color: var(--color-text-secondary);
}
.neutral:hover:not(:disabled) {
  background: var(--color-surface-subtle);
  color: var(--color-text-primary);
}

.ghost {
  background: transparent;
  color: var(--color-text-muted);
}
.ghost:hover:not(:disabled) {
  color: var(--color-text-secondary);
}

.accent {
  background: var(--color-text-muted);
  color: var(--color-text-on-accent);
  opacity: 0.5;
}
.accent:not(:disabled) {
  background: var(--color-primary);
  opacity: 1;
}
.accent:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}
.accent:disabled {
  background: var(--color-border-strong);
  color: var(--color-surface);
}

.icon-button:focus-visible {
  box-shadow: var(--shadow-focus);
  outline: none;
}
</style>
