import {
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type Ref,
} from 'vue'

const EDGE_EPSILON = 1

export function useScrollEdgeFades(
  scrollEl: Ref<HTMLElement | null>,
  deps: Ref<unknown>[] = [],
) {
  const showTopFade = ref(false)
  const showBottomFade = ref(false)

  let resizeObserver: ResizeObserver | null = null
  let attachedEl: HTMLElement | null = null

  function update() {
    const el = scrollEl.value
    if (!el) {
      showTopFade.value = false
      showBottomFade.value = false
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = el
    const maxScroll = scrollHeight - clientHeight
    const canScroll = maxScroll > EDGE_EPSILON

    showTopFade.value = canScroll && scrollTop > EDGE_EPSILON
    showBottomFade.value = canScroll && scrollTop < maxScroll - EDGE_EPSILON
  }

  function detach() {
    if (attachedEl) {
      attachedEl.removeEventListener('scroll', update)
      attachedEl = null
    }
    resizeObserver?.disconnect()
    resizeObserver = null
  }

  function attach(el: HTMLElement) {
    detach()
    attachedEl = el
    el.addEventListener('scroll', update, { passive: true })
    resizeObserver = new ResizeObserver(() => update())
    resizeObserver.observe(el)
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild)
    }
    update()
  }

  watch(
    scrollEl,
    (el) => {
      if (el) attach(el)
      else {
        detach()
        showTopFade.value = false
        showBottomFade.value = false
      }
    },
    { immediate: true, flush: 'post' },
  )

  watch(
    deps,
    async () => {
      await nextTick()
      update()
    },
    { flush: 'post' },
  )

  onBeforeUnmount(() => {
    detach()
  })

  return { showTopFade, showBottomFade, updateScrollEdges: update }
}
