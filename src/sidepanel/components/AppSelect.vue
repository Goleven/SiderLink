<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { animate } from 'motion'
import { useReducedMotion } from '../composables/useReducedMotion'
import AppIcon from './AppIcon.vue'

export type AppSelectOption = { value: string; label: string }

const props = withDefaults(
  defineProps<{
    options: AppSelectOption[]
    modelValue: string
    placeholder?: string
    disabled?: boolean
    ariaLabel?: string
  }>(),
  { placeholder: '', disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const MENU_GAP = 6
const VIEWPORT_PAD = 8
const MENU_MAX = 240
const MENU_MIN = 96

const { reduced } = useReducedMotion()
const open = ref(false)
const menuMounted = ref(false)
const closing = ref(false)
const placement = ref<'below' | 'above'>('below')
const menuMaxHeight = ref(MENU_MAX)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const activeIndex = ref(-1)
const listId = `app-select-${Math.random().toString(36).slice(2, 9)}`

type MenuAnimation = { stop: () => void; finished: Promise<unknown> }
let menuAnimation: MenuAnimation | null = null

const selected = computed(
  () => props.options.find((o) => o.value === props.modelValue) ?? null,
)
const displayLabel = computed(
  () => selected.value?.label || props.placeholder || '',
)
const activeOptionId = computed(() =>
  activeIndex.value >= 0 ? `${listId}-opt-${activeIndex.value}` : undefined,
)

function indexOfValue(value: string) {
  return props.options.findIndex((o) => o.value === value)
}

function stopMenuAnimation() {
  menuAnimation?.stop()
  menuAnimation = null
}

function updatePlacement() {
  const triggerEl = triggerRef.value
  if (!triggerEl) return

  const trigger = triggerEl.getBoundingClientRect()
  const spaceBelow = window.innerHeight - trigger.bottom - MENU_GAP - VIEWPORT_PAD
  const spaceAbove = trigger.top - MENU_GAP - VIEWPORT_PAD

  // Prefer below when it can show a usable list; otherwise flip above.
  const openAbove =
    spaceBelow < MENU_MIN && spaceAbove > spaceBelow

  placement.value = openAbove ? 'above' : 'below'
  const available = openAbove ? spaceAbove : spaceBelow
  menuMaxHeight.value = Math.max(
    MENU_MIN,
    Math.min(MENU_MAX, Math.floor(available)),
  )
}

function exitOffsetY() {
  return placement.value === 'above' ? '4px' : '-4px'
}

async function playOpenAnimation() {
  const el = menuRef.value
  if (!el) return
  stopMenuAnimation()
  if (reduced.value) {
    el.style.opacity = '1'
    el.style.transform = 'none'
    return
  }
  el.style.opacity = '0'
  el.style.transform = `scale(0.96) translateY(${exitOffsetY()})`
  const controls = animate(
    el,
    { opacity: 1, transform: 'scale(1) translateY(0px)' },
    { type: 'spring', bounce: 0, duration: 0.3 },
  )
  menuAnimation = controls
  await controls.finished
}

async function playCloseAnimation() {
  const el = menuRef.value
  if (!el) return
  stopMenuAnimation()
  if (reduced.value) {
    el.style.opacity = '0'
    return
  }
  // Continue from the live presentation value — same path as open, mirrored.
  const controls = animate(
    el,
    {
      opacity: 0,
      transform: `scale(0.96) translateY(${exitOffsetY()})`,
    },
    { type: 'spring', bounce: 0, duration: 0.24 },
  )
  menuAnimation = controls
  try {
    await controls.finished
  } catch {
    /* interrupted */
  }
}

function scrollActiveIntoView() {
  const menu = menuRef.value
  if (!menu || activeIndex.value < 0) return
  const option = menu.children[activeIndex.value] as HTMLElement | undefined
  if (typeof option?.scrollIntoView === 'function') {
    option.scrollIntoView({ block: 'nearest' })
  }
}

async function openMenu() {
  if (props.disabled || open.value) return
  stopMenuAnimation()
  closing.value = false
  open.value = true
  menuMounted.value = true
  activeIndex.value = Math.max(0, indexOfValue(props.modelValue))
  await nextTick()
  updatePlacement()
  await nextTick()
  scrollActiveIntoView()
  await playOpenAnimation()
}

async function closeMenu() {
  if (!menuMounted.value || closing.value) return
  open.value = false
  activeIndex.value = -1
  closing.value = true
  await playCloseAnimation()
  if (open.value) {
    closing.value = false
    return
  }
  menuMounted.value = false
  closing.value = false
  placement.value = 'below'
  menuMaxHeight.value = MENU_MAX
}

function toggle() {
  if (open.value) void closeMenu()
  else void openMenu()
}

function selectAt(index: number, event?: Event) {
  event?.preventDefault()
  event?.stopPropagation()
  if (closing.value || !open.value) return
  const opt = props.options[index]
  if (!opt) return
  emit('update:modelValue', opt.value)
  void closeMenu()
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  if (e.key === 'Escape') {
    if (open.value || menuMounted.value) {
      e.preventDefault()
      void closeMenu()
    }
    return
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (!open.value) {
      void openMenu()
      return
    }
    if (activeIndex.value >= 0) selectAt(activeIndex.value)
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) {
      void openMenu()
      return
    }
    activeIndex.value = Math.min(
      props.options.length - 1,
      activeIndex.value + 1,
    )
    void nextTick(scrollActiveIntoView)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) {
      void openMenu()
      return
    }
    activeIndex.value = Math.max(0, activeIndex.value - 1)
    void nextTick(scrollActiveIntoView)
  }
}

function onDocPointerDown(e: PointerEvent) {
  if (!menuMounted.value || !rootRef.value || closing.value) return
  if (!rootRef.value.contains(e.target as Node)) void closeMenu()
}

function onViewportChange() {
  if (!open.value) return
  updatePlacement()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})
onUnmounted(() => {
  stopMenuAnimation()
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})

watch(
  () => props.disabled,
  (d) => {
    if (d) void closeMenu()
  },
)

watch(
  () => props.options.length,
  () => {
    if (open.value) updatePlacement()
  },
)
</script>

<template>
  <div
    ref="rootRef"
    class="app-select"
    :class="{
      open,
      disabled,
      closing,
      [`place-${placement}`]: menuMounted,
    }"
  >
    <button
      ref="triggerRef"
      type="button"
      class="trigger pressable"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open ? activeOptionId : undefined"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="label" :class="{ placeholder: !selected }">{{
        displayLabel
      }}</span>
      <AppIcon name="chevron-down" :size="16" class="chevron" />
    </button>

    <ul
      v-if="menuMounted"
      :id="listId"
      ref="menuRef"
      class="menu"
      :class="[placement, { closing }]"
      role="listbox"
      :aria-label="ariaLabel"
      :style="{ maxHeight: `${menuMaxHeight}px` }"
    >
      <li
        v-for="(opt, i) in options"
        :id="`${listId}-opt-${i}`"
        :key="opt.value"
        role="option"
        class="option pressable"
        :class="{
          active: i === activeIndex,
          selected: opt.value === modelValue,
        }"
        :aria-selected="opt.value === modelValue"
        @pointerdown="selectAt(i, $event)"
        @click="selectAt(i, $event)"
        @pointerenter="activeIndex = i"
      >
        <span class="option-label">{{ opt.label }}</span>
        <AppIcon
          v-if="opt.value === modelValue"
          name="check"
          :size="16"
          class="check"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.app-select {
  position: relative;
  width: 100%;
}

.trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--hairline);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--row-bg);
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
}

.trigger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.label.placeholder {
  color: var(--text-tertiary);
}

.chevron {
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: transform 200ms ease;
}

.open.place-below .chevron {
  transform: rotate(180deg);
}

.open.place-above .chevron {
  transform: rotate(0deg);
}

.menu {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  margin: 0;
  padding: 6px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-radius: 12px;
  border: 1px solid var(--hairline);
  background: var(--elevated);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow: var(--shadow-float);
  overflow: auto;
  overscroll-behavior: contain;
}

.menu.closing {
  pointer-events: none;
}

.menu.below {
  top: calc(100% + 6px);
  bottom: auto;
  transform-origin: top center;
}

.menu.above {
  bottom: calc(100% + 6px);
  top: auto;
  transform-origin: bottom center;
}

.option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-primary);
  background: transparent;
  /* Instant highlight — Apple: respond on pointer path, not only on commit */
  transition:
    background-color 100ms ease-out,
    transform 100ms ease-out,
    color 100ms ease-out;
}

/* Hover / keyboard highlight: secondary fill reads on elevated glass */
.option.active {
  background: var(--seg-track);
}

.option.selected {
  background: var(--accent-soft);
  color: var(--text-primary);
}

/* Keep hover lift when the selected row is under the pointer */
.option.selected.active {
  background: color-mix(in srgb, var(--accent) 22%, var(--seg-track));
}

.option:active {
  background: var(--row-bg-pressed);
}

.option.selected:active {
  background: color-mix(in srgb, var(--accent) 18%, var(--row-bg-pressed));
}

.option-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.check {
  flex-shrink: 0;
  color: var(--accent);
  opacity: 0.92;
  transition: opacity 100ms ease-out;
}

.option.active .check {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }

  .option {
    transition: background-color 120ms ease, color 120ms ease;
  }

  .check {
    transition: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .menu {
    backdrop-filter: none;
  }
}
</style>
