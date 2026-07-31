import { ref } from 'vue'

export interface ToastItem {
  id: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

const toasts = ref<ToastItem[]>([])

export function useToast() {
  function show(
    message: string,
    opts?: { actionLabel?: string; onAction?: () => void; durationMs?: number },
  ) {
    const id = crypto.randomUUID()
    const item: ToastItem = {
      id,
      message,
      actionLabel: opts?.actionLabel,
      onAction: opts?.onAction,
    }
    toasts.value = [...toasts.value, item]
    const duration = opts?.durationMs ?? 4000
    window.setTimeout(() => dismiss(id), duration)
    return id
  }

  function dismiss(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, show, dismiss }
}
