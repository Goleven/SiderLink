<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div
    v-if="open"
    class="overlay"
    @click.self="emit('cancel')"
  >
    <div
      class="dialog"
      role="alertdialog"
      aria-modal="true"
      :aria-label="title"
    >
      <h2>{{ title }}</h2>
      <p class="message">{{ message }}</p>
      <div class="actions">
        <button type="button" class="secondary pressable" @click="emit('cancel')">
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="confirm pressable"
          :class="{ danger }"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.36);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.dialog {
  width: min(100%, 300px);
  border-radius: 16px;
  background: var(--elevated);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  padding: 18px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: var(--shadow-float);
  border: 1px solid color-mix(in srgb, var(--hairline) 70%, transparent);
}

h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.015em;
  text-align: center;
  color: var(--text-primary);
}

.message {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
  color: var(--text-secondary);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.secondary,
.confirm {
  flex: 1;
  border: none;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
}

.secondary {
  background: var(--row-bg);
  color: var(--text-primary);
}

.confirm {
  background: var(--accent);
  color: #fff;
}

.confirm.danger {
  background: #ff3b30;
  color: #fff;
}

@media (prefers-reduced-transparency: reduce) {
  .dialog {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
