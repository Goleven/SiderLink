<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookmarkItem } from '@/shared/types'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ item: BookmarkItem }>()
const emit = defineEmits<{
  open: []
  edit: []
  requestDelete: []
  rowPointerDown: [event: PointerEvent]
}>()

const { t } = useI18n()

const faviconBroken = ref(false)

watch(
  () => props.item.faviconUrl,
  () => {
    faviconBroken.value = false
  },
)
const MENU_GAP = 4
const VIEWPORT_PAD = 8
/** Approximate closed-menu height for flip decision before measure. */
const MENU_ESTIMATE_H = 76

const menuOpen = ref(false)
const pinnedOpen = ref(false)
const placement = ref<'below' | 'above'>('below')
const menuStyle = ref<Record<string, string>>({})
const moreBtnRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

let closeTimer: ReturnType<typeof setTimeout> | null = null

function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function clearCloseTimer() {
  if (closeTimer != null) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function updateMenuPosition() {
  const btn = moreBtnRef.value
  if (!btn) return

  const rect = btn.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_PAD
  const spaceAbove = rect.top - MENU_GAP - VIEWPORT_PAD
  const menuH = menuRef.value?.offsetHeight || MENU_ESTIMATE_H
  const openAbove = spaceBelow < menuH && spaceAbove > spaceBelow
  placement.value = openAbove ? 'above' : 'below'

  const menuW = menuRef.value?.offsetWidth || 112
  let left = rect.right - menuW
  left = Math.min(
    Math.max(VIEWPORT_PAD, left),
    window.innerWidth - menuW - VIEWPORT_PAD,
  )

  const top = openAbove
    ? Math.max(VIEWPORT_PAD, rect.top - MENU_GAP - menuH)
    : Math.min(
        rect.bottom + MENU_GAP,
        window.innerHeight - menuH - VIEWPORT_PAD,
      )

  menuStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    zIndex: '25',
    transformOrigin: openAbove ? 'bottom right' : 'top right',
  }
}

async function openMenu() {
  clearCloseTimer()
  menuOpen.value = true
  await nextTick()
  updateMenuPosition()
  await nextTick()
  updateMenuPosition()
}

function scheduleClose() {
  if (pinnedOpen.value) return
  clearCloseTimer()
  closeTimer = setTimeout(() => {
    menuOpen.value = false
    closeTimer = null
  }, 160)
}

function closeMenu() {
  clearCloseTimer()
  pinnedOpen.value = false
  menuOpen.value = false
}

async function togglePinned(e: MouseEvent) {
  e.stopPropagation()
  if (pinnedOpen.value) {
    closeMenu()
    return
  }
  pinnedOpen.value = true
  await openMenu()
}

function onEdit() {
  closeMenu()
  emit('edit')
}

function onDelete() {
  closeMenu()
  emit('requestDelete')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && menuOpen.value) {
    e.stopPropagation()
    closeMenu()
  }
}

function onViewportChange() {
  if (!menuOpen.value) return
  updateMenuPosition()
}

function onDocPointerDown(e: PointerEvent) {
  if (!menuOpen.value) return
  const t = e.target
  if (!(t instanceof Node)) return
  if (moreBtnRef.value?.contains(t) || menuRef.value?.contains(t)) return
  closeMenu()
}

watch(menuOpen, (open) => {
  if (open) {
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    document.addEventListener('pointerdown', onDocPointerDown, true)
  } else {
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('scroll', onViewportChange, true)
    document.removeEventListener('pointerdown', onDocPointerDown, true)
  }
})

onUnmounted(() => {
  clearCloseTimer()
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
  document.removeEventListener('pointerdown', onDocPointerDown, true)
})
</script>

<template>
  <div
    class="row pressable"
    :class="{ 'menu-open': menuOpen }"
    :data-bookmark-id="item.id"
    @pointerdown="emit('rowPointerDown', $event)"
    @click="emit('open')"
  >
    <button type="button" class="main">
      <span class="icon" aria-hidden="true">
        <img
          v-if="item.faviconUrl && !faviconBroken"
          :src="item.faviconUrl"
          alt=""
          @error="faviconBroken = true"
        />
        <AppIcon v-else name="earth" :size="36" :stroke-width="1.5" />
      </span>
      <span class="text">
        <span class="name">{{ item.title }}</span>
        <span class="domain">{{ hostname(item.url) }}</span>
      </span>
    </button>

    <div class="more-wrap" @click.stop @keydown="onKeydown">
      <button
        ref="moreBtnRef"
        type="button"
        class="more pressable"
        :aria-label="t('a11y.more')"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        @pointerdown.stop
        @pointerenter="openMenu"
        @pointerleave="scheduleClose"
        @click="togglePinned"
      >
        <AppIcon name="more-horizontal" :size="16" :stroke-width="1.75" />
      </button>

      <Teleport to="body">
        <div
          v-if="menuOpen"
          ref="menuRef"
          class="menu"
          role="menu"
          :aria-label="t('a11y.more')"
          :class="placement"
          :style="menuStyle"
          @pointerdown.stop
          @pointerenter="openMenu"
          @pointerleave="scheduleClose"
        >
          <button
            type="button"
            class="menu-item"
            role="menuitem"
            @click.stop="onEdit"
          >
            {{ t('a11y.edit') }}
          </button>
          <button
            type="button"
            class="menu-item danger"
            role="menuitem"
            @click.stop="onDelete"
          >
            {{ t('editBookmark.delete') }}
          </button>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px 2px 6px;
  border-radius: var(--radius-row);
  background: var(--row-bg);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  box-shadow:
    inset 0 1px 0 var(--hairline-bright),
    var(--shadow-soft);
  border: 1px solid color-mix(in srgb, var(--hairline) 70%, transparent);
  transition:
    transform 100ms ease-out,
    background-color 120ms ease-out,
    box-shadow 120ms ease-out;
}

.row.menu-open {
  z-index: 5;
}

.row.dragging {
  z-index: 20;
  transition: none;
  box-shadow: var(--shadow-float);
  cursor: grabbing;
  touch-action: none;
}

.row.dragging:active,
.row.dragging.pressable:active {
  transform: none;
  background: var(--row-bg-hover);
}

.row:hover {
  background: var(--row-bg-hover);
}

.row:active,
.row.pressable:active {
  background: var(--row-bg-pressed);
  transform: scale(0.985);
}

.row.menu-open:active,
.row.menu-open.pressable:active {
  transform: none;
}

.main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 10px 6px 10px 4px;
}

.icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: var(--text-tertiary);
}

.icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 3px;
}

.name {
  font-size: 15px;
  font-weight: 590;
  letter-spacing: -0.016em;
  line-height: 1.2;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.domain {
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.01em;
  line-height: 1.25;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-wrap {
  position: relative;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.more {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  color: var(--text-tertiary);
  display: grid;
  place-items: center;
  opacity: 0.72;
}

.more:hover,
.more[aria-expanded='true'] {
  opacity: 1;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.menu {
  min-width: 112px;
  padding: 4px;
  border-radius: 12px;
  /* Opaque enough that row text never bleeds through (Apple: no stacked light glass) */
  background: color-mix(in srgb, var(--elevated) 92%, var(--app-bg));
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid color-mix(in srgb, var(--hairline) 80%, transparent);
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:global([data-theme='light']) .menu {
  background: rgba(255, 255, 255, 0.96);
}

:global([data-theme='dark']) .menu {
  background: rgba(58, 58, 60, 0.96);
}

.menu-item {
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  font-weight: 560;
  color: var(--text-primary);
}

.menu-item:hover {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.menu-item.danger {
  color: #ff3b30;
}

.menu-item.danger:hover {
  background: color-mix(in srgb, #ff3b30 12%, transparent);
}

@media (prefers-reduced-transparency: reduce) {
  .row {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .menu {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: #ffffff;
  }

  :global([data-theme='dark']) .menu {
    background: #2c2c2e;
  }
}

@media (prefers-reduced-motion: reduce) {
  .row:active,
  .row.pressable:active {
    transform: none;
  }
}
</style>
