/**
 * Edge overscroll → switch to the adjacent group (trackpad / wheel).
 *
 * State machine while at scroll top/bottom and wheel continues outward:
 * 1. Accumulate |deltaY| until OVERSCROLL_THRESHOLD
 * 2. Switch selectedGroupId; scroll next group to top (down) or bottom (up)
 * 3. Enter SWITCH_COOLDOWN_MS so momentum does not chain-switch groups
 *
 * Reversing wheel direction or leaving the edge clears the accumulator.
 * Uses `{ passive: false }` so preventDefault can block native bounce.
 */
import {
  nextTick,
  onBeforeUnmount,
  watch,
  type Ref,
} from 'vue'

/** Treat sub-pixel remainder as "at edge". */
const EDGE_EPSILON = 1
/** Cumulative |deltaY| at the edge required before switching groups. */
const OVERSCROLL_THRESHOLD = 80
/** Ignore further wheel after a switch (trackpad inertia). */
const SWITCH_COOLDOWN_MS = 400

export function useAdjacentGroupScroll(opts: {
  scrollEl: Ref<HTMLElement | null>
  orderedGroupIds: Ref<string[]>
  selectedGroupId: Ref<string | null>
  enabled: Ref<boolean>
}) {
  let attachedEl: HTMLElement | null = null
  let accumulated = 0
  /** +1 down / -1 up; used to reset accum when the user reverses. */
  let lastSign = 0
  let cooldownUntil = 0

  function clearAccum() {
    accumulated = 0
    lastSign = 0
  }

  function edges(el: HTMLElement) {
    const { scrollTop, scrollHeight, clientHeight } = el
    const maxScroll = scrollHeight - clientHeight
    // Content shorter than viewport: both edges are "active".
    const fits = maxScroll <= EDGE_EPSILON
    return {
      atTop: fits || scrollTop <= EDGE_EPSILON,
      atBottom: fits || scrollTop >= maxScroll - EDGE_EPSILON,
    }
  }

  async function switchTo(id: string, place: 'top' | 'bottom') {
    opts.selectedGroupId.value = id
    clearAccum()
    cooldownUntil = performance.now() + SWITCH_COOLDOWN_MS
    await nextTick()
    const el = opts.scrollEl.value
    if (!el) return
    // Continuity: arriving from below opens at top; from above opens at bottom.
    if (place === 'top') {
      el.scrollTop = 0
    } else {
      el.scrollTop = el.scrollHeight
    }
  }

  function onWheel(e: WheelEvent) {
    if (!opts.enabled.value) return
    const el = opts.scrollEl.value
    if (!el) return
    if (performance.now() < cooldownUntil) {
      e.preventDefault()
      return
    }

    const dy = e.deltaY
    if (dy === 0) return

    const { atTop, atBottom } = edges(el)
    const goingUp = dy < 0
    const goingDown = dy > 0
    const overscrollUp = atTop && goingUp
    const overscrollDown = atBottom && goingDown

    // Normal in-list scrolling — do not interfere.
    if (!overscrollUp && !overscrollDown) {
      clearAccum()
      return
    }

    e.preventDefault()

    const sign = goingDown ? 1 : -1
    if (lastSign !== 0 && sign !== lastSign) {
      clearAccum()
    }
    lastSign = sign
    accumulated += Math.abs(dy)

    if (accumulated < OVERSCROLL_THRESHOLD) return

    const ids = opts.orderedGroupIds.value
    const current = opts.selectedGroupId.value
    if (!current || ids.length < 2) {
      clearAccum()
      return
    }

    const index = ids.indexOf(current)
    if (index < 0) {
      clearAccum()
      return
    }

    if (overscrollDown) {
      const next = ids[index + 1]
      if (!next) {
        clearAccum()
        return
      }
      void switchTo(next, 'top')
      return
    }

    const prev = ids[index - 1]
    if (!prev) {
      clearAccum()
      return
    }
    void switchTo(prev, 'bottom')
  }

  function detach() {
    if (!attachedEl) return
    attachedEl.removeEventListener('wheel', onWheel)
    attachedEl = null
    clearAccum()
  }

  function attach(el: HTMLElement) {
    detach()
    attachedEl = el
    el.addEventListener('wheel', onWheel, { passive: false })
  }

  watch(
    opts.scrollEl,
    (el) => {
      if (el) attach(el)
      else detach()
    },
    { immediate: true, flush: 'post' },
  )

  watch(
    () => opts.selectedGroupId.value,
    () => {
      clearAccum()
    },
  )

  onBeforeUnmount(() => {
    detach()
  })
}
