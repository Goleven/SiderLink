<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
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
  search: []
  select: [id: string]
}>()

const { t } = useI18n()
const { reduced } = useReducedMotion()

const barRef = ref<HTMLElement | null>(null)
/** Non-reactive DOM refs — mutating these must not trigger Vue updates. */
let itemEls: (HTMLElement | null)[] = []

const hot = ref(false)
const hoveredId = ref<string | null>(null)

const SEARCH_ID = '__search'
const SETTINGS_ID = '__settings'
const ADD_ID = '__add'

/** Match CSS --item-size / --index-pad-x. */
const ITEM_BASE = 18
const INDEX_PAD_X = 4

/**
 * Dock.html sine falloff: pointer Y is the peak center; items within
 * DOCK_RANGE (diameter) scale by sin, outside stay at 1.
 */
const DOCK_RANGE = 360
const DOCK_MAX = 3.3

/** Hot hit strip = peak icon width + pad (not the resting narrow column). */
const HOT_HIT_WIDTH = ITEM_BASE * DOCK_MAX + INDEX_PAD_X * 2
/** Apple-design leave hysteresis — brief edge jitter must not end hot. */
const LEAVE_HYSTERESIS = 10

let pendingPointer: { x: number; y: number } | null = null
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
    id: SEARCH_ID,
    name: t('a11y.search'),
    icon: 'search' as const,
    kind: 'search' as const,
  },
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

function writeDockScale(el: HTMLElement, scale: number) {
  el.style.setProperty('--dock-scale', String(scale))
  el.style.zIndex = scale > 1.02 ? String(Math.round(scale * 10)) : '0'
}

function resetAllScales() {
  for (const el of itemEls) {
    if (!el) continue
    writeDockScale(el, 1)
  }
}

/** Half-period sine bump in [0, 1]; 0 outside (Dock.html baseCure). */
function baseCurve(x: number): number {
  if (x < 0 || x > 1) return 0
  return Math.sin(x * Math.PI)
}

/** Scale curve centered on topY with diameter totalYDis (Dock.html createCure). */
function createCurve(
  totalYDis: number,
  topY: number,
  minY: number,
  maxY: number,
): (y: number) => number {
  const beginY = topY - totalYDis / 2
  const endY = topY + totalYDis / 2
  const yDis = maxY - minY
  return (y: number) => {
    if (y < beginY || y > endY) return minY
    return baseCurve((y - beginY) / totalYDis) * yDis + minY
  }
}

/**
 * Dock.html layout: every item midY samples the sine curve at pointer Y.
 * Separator is not scaled. Tooltip follows the peak-scale item.
 */
function applyDockScales(clientY: number) {
  if (!barRef.value) return

  if (reduced.value) {
    resetAllScales()
    hoveredId.value = null
    return
  }

  const curve = createCurve(DOCK_RANGE, clientY, 1, DOCK_MAX)

  let bestEl: HTMLElement | null = null
  let bestScale = 1
  let bestDist = Infinity

  for (const el of itemEls) {
    if (!el) continue
    const rect = el.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const scale = curve(midY)
    writeDockScale(el, scale)

    const dist = Math.abs(clientY - midY)
    if (scale > bestScale + 1e-6 || (Math.abs(scale - bestScale) <= 1e-6 && dist < bestDist)) {
      bestScale = scale
      bestDist = dist
      bestEl = el
    }
  }

  const id =
    bestScale > 1.02 && bestEl ? (bestEl.dataset.dockId ?? null) : null
  if (hoveredId.value !== id) hoveredId.value = id
}

function flushDockScales() {
  dockRaf = 0
  if (!pendingPointer) return
  applyDockScales(pendingPointer.y)
}

function scheduleDockScales(clientX: number, clientY: number) {
  pendingPointer = { x: clientX, y: clientY }
  if (dockRaf) return
  dockRaf = requestAnimationFrame(flushDockScales)
}

function resetDockScales() {
  pendingPointer = null
  if (dockRaf) {
    cancelAnimationFrame(dockRaf)
    dockRaf = 0
  }
  resetAllScales()
}

function endHot() {
  if (!hot.value) return
  hot.value = false
  hoveredId.value = null
  document.removeEventListener('pointermove', onDocPointerMove)
  document.documentElement.removeEventListener(
    'mouseleave',
    onDocumentMouseLeave,
  )
  requestAnimationFrame(() => {
    resetDockScales()
  })
}

function onDocPointerMove(e: PointerEvent) {
  if (!hot.value) return
  if (!isPointerOverDock(e.clientX, e.clientY)) {
    endHot()
    return
  }
  scheduleDockScales(e.clientX, e.clientY)
}

function onDocumentMouseLeave() {
  endHot()
}

/**
 * Stay hot over the peak-width vertical strip (covers right-edge + flex gaps).
 * Cap at HOT_HIT_WIDTH so we don't trap the pointer over the bookmark list.
 */
function isPointerOverDock(clientX: number, clientY: number): boolean {
  const bar = barRef.value
  if (!bar) return false
  const br = bar.getBoundingClientRect()
  const pad = LEAVE_HYSTERESIS
  if (
    clientX >= br.left - pad &&
    clientX <= br.left + HOT_HIT_WIDTH + pad &&
    clientY >= br.top - pad &&
    clientY <= br.bottom + pad
  ) {
    return true
  }
  // Glyph overflow / subpixel fallback
  for (const el of itemEls) {
    if (!el) continue
    const glyph = el.querySelector('.glyph') as HTMLElement | null
    if (!glyph) continue
    const g = glyph.getBoundingClientRect()
    if (
      clientX >= g.left - pad &&
      clientX <= g.right + pad &&
      clientY >= g.top - pad &&
      clientY <= g.bottom + pad
    ) {
      return true
    }
  }
  return false
}

function onBarPointerEnter(e: PointerEvent) {
  hot.value = true
  document.addEventListener('pointermove', onDocPointerMove)
  document.documentElement.addEventListener('mouseleave', onDocumentMouseLeave)
  scheduleDockScales(e.clientX, e.clientY)
}

function onBarPointerLeave(e: PointerEvent) {
  const bar = barRef.value
  if (
    bar &&
    e.relatedTarget instanceof Node &&
    bar.contains(e.relatedTarget)
  ) {
    return
  }
  if (isPointerOverDock(e.clientX, e.clientY)) {
    return
  }
  endHot()
}

function onBarPointerMove(e: PointerEvent) {
  scheduleDockScales(e.clientX, e.clientY)
}

function onItemClick(item: (typeof dockItems.value)[number]) {
  if (item.kind === 'search') {
    emit('search')
    return
  }
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

onUnmounted(() => {
  document.removeEventListener('pointermove', onDocPointerMove)
  document.documentElement.removeEventListener(
    'mouseleave',
    onDocumentMouseLeave,
  )
})

</script>

<template>
  <nav
    ref="barRef"
    class="index-bar"
    :class="{ hot }"
    :style="{ '--hot-hit-width': `${HOT_HIT_WIDTH}px` }"
    :aria-label="t('a11y.groupIndex')"
    @pointerenter="onBarPointerEnter"
    @pointerleave="onBarPointerLeave"
    @pointermove="onBarPointerMove"
  >
    <Teleport to="body">
      <div v-show="hot" class="hot-veil" aria-hidden="true" />
    </Teleport>
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
        :data-dock-id="item.id"
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
  --item-gap: 16px;
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
  /* Match peak magnified width so pointerleave tracks the live dock */
  width: var(--hot-hit-width);
}

/* Dim bookmark list while Dock is hot (teleported — escapes bar transform) */
.hot-veil {
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  background: color-mix(in srgb, var(--app-bg) 72%, transparent);
}

.separator {
  flex-shrink: 0;
  width: 18px;
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
  z-index: 2;
  border: none;
  background: transparent;
  cursor: pointer;
  box-sizing: border-box;
  /* Grow with --dock-scale so hit area matches glyph (CodePen li) */
  width: calc(var(--item-size) * var(--dock-scale, 1));
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
    width 220ms cubic-bezier(0.22, 1, 0.36, 1),
    height 220ms cubic-bezier(0.22, 1, 0.36, 1),
    color 160ms ease;
}

.index-bar.hot .item {
  color: var(--text-secondary);
  /* 1:1 with pointer while hot — no size lag */
  transition: color 120ms ease;
}

.glyph {
  position: relative;
  z-index: 2;
  width: calc(var(--item-size) * var(--dock-scale, 1));
  height: calc(var(--item-size) * var(--dock-scale, 1));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: auto;
  border-radius: 16%;
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
  position: relative;
  z-index: 1;
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
  left: calc(var(--item-size) * var(--dock-scale, 1) + 10px);
  top: 50%;
  transform: translateY(-50%);
  writing-mode: horizontal-tb;
  text-orientation: mixed;
  letter-spacing: -0.01em;
  white-space: nowrap;
  background: var(--elevated);
  box-shadow: var(--shadow-float);
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--hairline) 80%, transparent);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  z-index: 4;
}

@media (prefers-reduced-motion: reduce) {
  .item {
    width: var(--item-size);
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
  .hot-veil {
    background: color-mix(in srgb, var(--app-bg) 88%, transparent);
  }

  .name.tooltip {
    background: var(--elevated);
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
