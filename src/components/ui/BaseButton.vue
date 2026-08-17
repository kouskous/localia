<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'tertiary'
    size?: 'sm' | 'md'
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    disabled: false,
    type: 'button',
  },
)
</script>

<template>
  <button
    :type="type"
    class="base-button"
    :class="[`variant-${variant}`, `size-${size}`]"
    :disabled="disabled"
  >
    <slot name="icon-left" />
    <span v-if="$slots.default" class="label"><slot /></span>
    <slot name="icon-right" />
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-weight: var(--weight-medium);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-instant) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}

.base-button:active:not(:disabled) {
  transform: scale(0.98);
}

.base-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.size-md {
  height: 40px;
  padding: 0 var(--space-4);
  font-size: var(--text-secondary);
}

.size-sm {
  height: 32px;
  padding: 0 var(--space-3);
  font-size: var(--text-caption);
  border-radius: var(--radius-sm);
}

.variant-primary {
  background: var(--color-primary);
  color: var(--color-text-on-accent);
}
.variant-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}
.variant-primary:focus-visible {
  box-shadow: var(--shadow-focus);
}

.variant-secondary {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text-primary);
}
.variant-secondary:hover:not(:disabled) {
  background: var(--color-surface-subtle);
  border-color: var(--color-border-strong);
}

.variant-tertiary {
  background: transparent;
  color: var(--color-text-secondary);
}
.variant-tertiary:hover:not(:disabled) {
  background: var(--color-surface-subtle);
  color: var(--color-text-primary);
}

.label {
  display: inline-flex;
  align-items: center;
}
</style>
