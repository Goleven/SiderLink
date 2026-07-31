<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()

function onAction(id: string, fn?: () => void) {
  fn?.()
  dismiss(id)
}
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast">
      <span>{{ t.message }}</span>
      <button
        v-if="t.actionLabel"
        type="button"
        class="pressable"
        @click="onAction(t.id, t.onAction)"
      >
        {{ t.actionLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 40;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--elevated);
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  font-size: 13px;
}

.toast button {
  border: none;
  background: transparent;
  color: var(--accent);
  font-weight: 650;
  cursor: pointer;
}
</style>
