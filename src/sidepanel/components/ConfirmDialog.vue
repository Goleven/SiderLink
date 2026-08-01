<script setup lang="ts">
import { nextTick, useId, useTemplateRef, watch } from 'vue'

const props = defineProps<{
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

const titleId = useId()
const messageId = useId()
const cancelBtn = useTemplateRef<HTMLButtonElement>('cancelBtn')

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    // Safe default focus — agency: easy to dismiss without destroying
    cancelBtn.value?.focus()
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="overlay"
      @click.self="emit('cancel')"
    >
      <div
        class="dialog"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="messageId"
      >
        <h2 :id="titleId">{{ title }}</h2>
        <p :id="messageId" class="message">{{ message }}</p>
        <div class="actions" :class="{ stacked: danger }">
          <!-- Danger: destructive on top, Cancel last (iOS alert). Else: Cancel | Confirm -->
          <button
            v-if="!danger"
            ref="cancelBtn"
            type="button"
            class="secondary pressable"
            @click="emit('cancel')"
          >
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
          <button
            v-if="danger"
            ref="cancelBtn"
            type="button"
            class="secondary pressable"
            @click="emit('cancel')"
          >
            {{ cancelLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: color-mix(in srgb, #000 40%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.dialog {
  width: min(100%, 270px);
  border-radius: 18px;
  background: var(--elevated);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  padding: 18px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: var(--shadow-float);
  border: 1px solid color-mix(in srgb, var(--hairline) 70%, transparent);
}

h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.25;
  text-align: center;
  color: var(--text-primary);
}

.message {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  letter-spacing: -0.01em;
  text-align: center;
  color: var(--text-secondary);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.actions.stacked {
  flex-direction: column;
  gap: 8px;
}

.secondary,
.confirm {
  flex: 1;
  border: none;
  border-radius: 12px;
  padding: 11px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: -0.01em;
}

.actions.stacked .secondary,
.actions.stacked .confirm {
  flex: none;
  width: 100%;
}

.secondary {
  background: var(--row-bg);
  color: var(--text-primary);
}

.actions.stacked .secondary {
  font-weight: 650;
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
  .overlay {
    background: color-mix(in srgb, #000 55%, transparent);
  }

  .dialog {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--elevated);
  }
}
</style>
