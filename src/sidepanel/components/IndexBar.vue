<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildIndexBarAnchors } from '@/shared/indexBar'
import type { Group } from '@/shared/types'
import { useReducedMotion } from '../composables/useReducedMotion'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  groups: Group[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  settings: []
  add: []
  select: [id: string]
}>()

const { t } = useI18n()
const { reduced } = useReducedMotion()

const barRef = ref<HTMLElement | null>(null)
/** Non-reactive DOM refs — mutating these must not trigger Vue updates. */
let itemEls: (HTMLElement | null)[] = []

const hot = ref(false)
const hoveredId = ref<string | null>(null)

/** Match CSS item base size / gap / vertical padding (resting layout). */
const ITEM_BASE = 18
const ITEM_GAP = 8
const PAD_Y = 5
/** Fixed separator height (matches `.separator`); not a Dock magnet. */
const SEP_HEIGHT = 1
/** Extra vertical offset after groups: separator + the flex gap before first action. */
const SEP_BLOCK = SEP_HEIGHT + ITEM_GAP

const SETTINGS_ID = '__settings'
const ADD_ID = '__add'

/** Influence radius (px) and peak scale — Dock-like falloff. */
const DOCK_RANGE = 72
const DOCK_MAX = 3.44

/** Pinned bar top while hot — keeps magnets stable as height grows. */
let pinnedTop: number | null = null
let pendingPointerY: number | null = null
let dockRaf = 0

const anchors = computed(() => buildIndexBarAnchors(props.groups))

const dockItems = computed(() => [
  ...anchors.value.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    kind: 'group' as const,
  })),
  {
    id: SETTINGS_ID,
    name: t('a11y.settings'),
    icon: 'settings' as const,
    kind: 'settings' as const,
  },
  {
    id: ADD_ID,
    name: t('a11y.add'),
    icon: 'plus' as const,
    kind: 'add' as const,
  },
])

watch(
  dockItems,
  () => {
    itemEls = itemEls.slice(0, dockItems.value.length)
  },
  { flush: 'post' },
)

function setItemRef(el: unknown, index: number) {
  const next = (el as HTMLElement | null) ?? null
  if (itemEls[index] === next) return
  itemEls[index] = next
}

function scaleAtDistance(distance: number): number {
  if (distance >= DOCK_RANGE) return 1
  return (
    1 +
    (DOCK_MAX - 1) * 0.5 * (1 + Math.cos((Math.PI * distance) / DOCK_RANGE))
  )
}

/** Resting slot centers from pinned/current bar top (unscaled magnets). */
function restingCenterY(index: number, bar: HTMLElement): number {
  const top = pinnedTop ?? bar.getBoundingClientRect().top
  const groupCount = anchors.value.length
  const sepOffset = index >= groupCount ? SEP_BLOCK : 0
  return (
    top + PAD_Y + index * (ITEM_BASE + ITEM_GAP) + ITEM_BASE / 2 + sepOffset
  )
}

/** Tooltip target from live layout — accounts for dock-scaled item heights. */
function nearestVisualId(clientY: number): string | null {
  const list = dockItems.value
  if (!list.length) return null

  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < list.length; i++) {
    const el = itemEls[i]
    if (!el) continue
    const rect = el.getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    const d = Math.abs(clientY - mid)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  if (bestDist > DOCK_RANGE) return null
  return list[best]?.id ?? null
}

function applyDockScales(clientY: number | null) {
  const bar = barRef.value
  if (!bar) return

  for (let i = 0; i < itemEls.length; i++) {
    const el = itemEls[i]
    if (!el) continue

    let scale = 1
    if (!reduced.value && clientY != null) {
      scale = scaleAtDistance(Math.abs(clientY - restingCenterY(i, bar)))
    }
    el.style.setProperty('--dock-scale', String(scale))
    el.style.zIndex = scale > 1.02 ? String(Math.round(scale * 10)) : '0'
  }

  // Tooltip follows visual item under the pointer (not resting magnets)
  if (clientY != null && hot.value) {
    const id = nearestVisualId(clientY)
    if (hoveredId.value !== id) hoveredId.value = id
  }
}

function flushDockScales() {
  dockRaf = 0
  applyDockScales(pendingPointerY)
}

function scheduleDockScales(clientY: number) {
  pendingPointerY = clientY
  if (dockRaf) return
  dockRaf = requestAnimationFrame(flushDockScales)
}

function resetDockScales() {
  pendingPointerY = null
  if (dockRaf) {
    cancelAnimationFrame(dockRaf)
    dockRaf = 0
  }
  for (const el of itemEls) {
    if (!el) continue
    el.style.setProperty('--dock-scale', '1')
    el.style.zIndex = '0'
  }
}

function onBarPointerEnter(e: PointerEvent) {
  const bar = barRef.value
  if (bar) {
    // Pin top while hot so height growth expands downward only —
    // resting magnets stay stable (no translateY(-50%) drift).
    pinnedTop = bar.getBoundingClientRect().top
    bar.style.top = `${pinnedTop}px`
    bar.style.transform = 'none'
  }
  hot.value = true
  scheduleDockScales(e.clientY)
}

function onBarPointerLeave(e: PointerEvent) {
  const bar = barRef.value
  // Gaps between icons still belong to the bar — ignore internal hops.
  if (
    bar &&
    e.relatedTarget instanceof Node &&
    bar.contains(e.relatedTarget)
  ) {
    return
  }
  // Drop hot first so height/glyph transitions re-enable, then settle.
  hot.value = false
  hoveredId.value = null
  pinnedTop = null
  requestAnimationFrame(() => {
    resetDockScales()
    if (bar) {
      bar.style.top = ''
      bar.style.transform = ''
    }
  })
}

function onBarPointerMove(e: PointerEvent) {
  scheduleDockScales(e.clientY)
}

function onItemClick(item: (typeof dockItems.value)[number]) {
  if (item.kind === 'settings') {
    emit('settings')
    return
  }
  if (item.kind === 'add') {
    emit('add')
    return
  }
  emit('select', item.id)
}

</script>

<template>
  <nav
    ref="barRef"
    class="index-bar"
    :class="{ hot }"
    :aria-label="t('a11y.groupIndex')"
    @pointerenter="onBarPointerEnter"
    @pointerleave="onBarPointerLeave"
    @pointermove="onBarPointerMove"
  >
    <template v-for="(item, i) in dockItems" :key="item.id">
      <div
        v-if="i === anchors.length"
        class="separator"
        aria-hidden="true"
      />
      <button
        :ref="(el) => setItemRef(el, i)"
        type="button"
        class="item"
        :class="{
          active: item.kind === 'group' && props.selectedId === item.id,
        }"
        :aria-label="item.name"
        @click="onItemClick(item)"
      >
        <span class="glyph">
          <span class="icon">
            <AppIcon :name="item.icon" :size="18" :stroke-width="2" />
          </span>
        </span>
        <span v-if="hoveredId === item.id" class="name tooltip">
          {{ item.name }}
        </span>
      </button>
    </template>
  </nav>
</template>

<style scoped>
.index-bar {
  /* Icon column only — no glass capsule */
  --index-pad-y: 5px;
  --index-pad-x: 4px;
  --item-size: 18px;
  --item-gap: 8px;
  --sep-height: 1px;
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 15;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--item-gap);
  box-sizing: border-box;
  width: calc(var(--item-size) + var(--index-pad-x) * 2);
  height: auto;
  max-height: min(92vh, 640px);
  overflow: visible;
  padding: var(--index-pad-y) var(--index-pad-x);
  background: transparent;
  border: none;
  box-shadow: none;
  /* Whole column hit-tests so gaps don't flicker leave/enter */
  pointer-events: auto;
}

.index-bar.hot {
  max-height: none;
}

.separator {
  flex-shrink: 0;
  width: 100%;
  height: var(--sep-height);
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: color-mix(in srgb, var(--hairline) 85%, transparent);
  pointer-events: none;
}

.item {
  position: relative;
  z-index: 1;
  border: none;
  background: transparent;
  cursor: pointer;
  box-sizing: border-box;
  width: 100%;
  /* Slot grows with scale → keeps vertical gaps between neighbors */
  height: calc(var(--item-size) * var(--dock-scale, 1));
  flex-shrink: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  color: color-mix(in srgb, var(--text-secondary) 52%, transparent);
  border-radius: 0;
  --dock-scale: 1;
  overflow: visible;
  transition:
    height 220ms cubic-bezier(0.22, 1, 0.36, 1),
    color 160ms ease;
}

.index-bar.hot .item {
  color: var(--text-secondary);
  /* 1:1 with pointer while hot */
  transition: color 120ms ease;
}

.glyph {
  position: relative;
  z-index: 2;
  /* Grow via layout size — avoid transform:scale bitmap blur */
  width: calc(var(--item-size) * var(--dock-scale, 1));
  height: calc(var(--item-size) * var(--dock-scale, 1));
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  margin-right: auto;
  transition:
    width 220ms cubic-bezier(0.22, 1, 0.36, 1),
    height 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 120ms ease;
}

.index-bar.hot .glyph {
  transition: none;
}

.item:active .glyph {
  width: calc(var(--item-size) * var(--dock-scale, 1) * 0.96);
  height: calc(var(--item-size) * var(--dock-scale, 1) * 0.96);
  opacity: 0.88;
}

.item:hover,
.index-bar.hot .item:hover {
  color: var(--text-primary);
}

.item.active,
.item.active:hover,
.index-bar.hot .item.active:hover {
  color: var(--accent);
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  line-height: 1;
}

.icon :deep(svg) {
  width: 100% !important;
  height: 100% !important;
  display: block;
  shape-rendering: geometricPrecision;
  overflow: visible;
}

.name.tooltip {
  position: absolute;
  /* Sit past the live glyph width — follows --dock-scale, not the narrow hit box */
  left: calc(var(--item-size) * var(--dock-scale, 1) + 10px);
  top: 50%;
  transform: translateY(-50%);
  writing-mode: horizontal-tb;
  text-orientation: mixed;
  letter-spacing: -0.01em;
  white-space: nowrap;
  background: color-mix(in srgb, var(--elevated) 92%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--hairline) 80%, transparent);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  z-index: 4;
}

@media (prefers-reduced-motion: reduce) {
  .item {
    height: var(--item-size);
    transition: color 120ms ease;
  }

  .glyph,
  .item:active .glyph {
    width: var(--item-size);
    height: var(--item-size);
    opacity: 1;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .name.tooltip {
    background: var(--elevated);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

@media (prefers-contrast: more) {
  .item {
    color: var(--text-primary);
  }

  .name.tooltip {
    border-color: var(--hairline);
    background: var(--elevated);
  }

  .separator {
    background: var(--hairline);
  }
}
</style>
