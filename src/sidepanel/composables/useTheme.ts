import { onMounted, onUnmounted, watch } from 'vue'
import { getBackgroundColor } from '@/shared/backgrounds'
import { resolveTheme } from '@/shared/theme'
import type { ThemeMode } from '@/shared/types'

type ViewTransitionLike = {
  finished: Promise<void>
  skipTransition?: () => void
}

export function useTheme(
  getMode: () => ThemeMode,
  getBackgroundId: () => string,
) {
  let activeTransition: ViewTransitionLike | null = null

  function systemScheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }

  function applyNow() {
    const resolved = resolveTheme(getMode(), systemScheme())
    document.documentElement.dataset.theme = resolved
    document.documentElement.style.setProperty(
      '--app-bg',
      getBackgroundColor(getBackgroundId(), resolved),
    )
  }

  function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function apply() {
    const run = () => applyNow()
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => ViewTransitionLike
    }

    // Skip VT when unsupported, reduced-motion, hidden, or already animating —
    // overlapping startViewTransition aborts the prior one with InvalidStateError.
    if (
      typeof doc.startViewTransition !== 'function' ||
      prefersReducedMotion() ||
      document.hidden ||
      activeTransition
    ) {
      run()
      return
    }

    try {
      const transition = doc.startViewTransition(run)
      activeTransition = transition
      void transition.finished
        .catch(() => {
          /* aborted / invalid state — safe to ignore */
        })
        .finally(() => {
          if (activeTransition === transition) activeTransition = null
        })
    } catch {
      activeTransition = null
      run()
    }
  }

  let mql: MediaQueryList | null = null

  onMounted(() => {
    mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', apply)
    applyNow()
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', apply)
    activeTransition?.skipTransition?.()
    activeTransition = null
  })

  watch([getMode, getBackgroundId], apply)

  return { apply }
}
