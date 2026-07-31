# AppSelect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a reusable `AppSelect` dropdown that matches Side Panel materials/motion and replace native `<select>` in Add / Edit bookmark sheets.

**Architecture:** One presentational Vue component (`AppSelect.vue`) with `v-model` + option list; listbox a11y via `aria-expanded` / `role="listbox"` / `aria-activedescendant`; open/close animated with Motion springs (or opacity-only when reduced motion). Sheets map groups to `{ value, label }` and pass field labels as `ariaLabel`.

**Tech Stack:** Vue 3 `<script setup>`, Motion `animate`, Lucide via `AppIcon`, existing CSS tokens in `tokens.css` / `.pressable` in `base.css`, Vitest + `@vue/test-utils` for behavior smoke tests.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-26-app-select-design.md` exactly for API and Out-of-scope.
- Do not change Settings segmented controls, storage, domain, or i18n message catalogs (unless a new a11y key is unavoidable — prefer `ariaLabel` prop).
- Match sheet input chrome: `border: 1px solid var(--hairline)`, `border-radius: 10px`, `padding: 10px 12px`, `background: var(--row-bg)`.
- Motion default: spring `bounce: 0`, `duration: 0.3`; reduced motion → opacity only.
- Do not commit unless the user explicitly asks (user rule overrides frequent-commit steps below — skip Step “Commit” or stage only).
- Keep TypeScript ~5.8; run `npm test` and `npm run build` before claiming done.

## File map

| File | Role |
| --- | --- |
| `src/sidepanel/components/AppSelect.vue` | Reusable dropdown (create) |
| `src/sidepanel/components/AppIcon.vue` | Register `chevron-down`, `check` UI icons |
| `src/sidepanel/components/AddSheet.vue` | Replace group `<select>` |
| `src/sidepanel/components/EditBookmarkSheet.vue` | Replace group `<select>` |
| `tests/sidepanel/AppSelect.test.ts` | Open / select / emit smoke tests |

---

### Task 1: AppIcon — chevron-down + check

**Files:**
- Modify: `src/sidepanel/components/AppIcon.vue`

**Interfaces:**
- Produces: `AppIcon` accepts `name="chevron-down"` and `name="check"`

- [ ] **Step 1: Add Lucide imports and UI_ICONS entries**

In `AppIcon.vue`, import `Check` and `ChevronDown` from `@lucide/vue` (alongside existing icons). Add to `UI_ICONS`:

```ts
const UI_ICONS: Record<string, LucideIcon> = {
  settings: Settings,
  plus: Plus,
  'more-horizontal': MoreHorizontal,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  check: Check,
  search: Search,
}
```

- [ ] **Step 2: Sanity-check TypeScript**

Run: `npx vue-tsc --noEmit`
Expected: exit 0 (or only pre-existing unrelated errors — fix if caused by this edit).

---

### Task 2: AppSelect component + smoke tests

**Files:**
- Create: `src/sidepanel/components/AppSelect.vue`
- Create: `tests/sidepanel/AppSelect.test.ts`

**Interfaces:**
- Consumes: `AppIcon`, `useReducedMotion`, Motion `animate`
- Produces:

```ts
export type AppSelectOption = { value: string; label: string }

// props
options: AppSelectOption[]
modelValue: string
placeholder?: string  // default ''
disabled?: boolean    // default false
ariaLabel?: string

// emits
'update:modelValue': [value: string]
```

- [ ] **Step 1: Write failing smoke tests**

Create `tests/sidepanel/AppSelect.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AppSelect from '@/sidepanel/components/AppSelect.vue'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

describe('AppSelect', () => {
  it('shows selected label on the trigger', () => {
    const wrapper = mount(AppSelect, {
      props: { options, modelValue: 'b' },
    })
    expect(wrapper.find('.trigger').text()).toContain('Beta')
  })

  it('opens listbox and emits update on option click', async () => {
    const wrapper = mount(AppSelect, {
      props: { options, modelValue: 'a' },
    })
    await wrapper.find('.trigger').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
    await wrapper.findAll('[role="option"]')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })

  it('closes on Escape without emitting', async () => {
    const wrapper = mount(AppSelect, {
      props: { options, modelValue: 'a' },
      attachTo: document.body,
    })
    await wrapper.find('.trigger').trigger('click')
    await nextTick()
    await wrapper.find('.trigger').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npx vitest run tests/sidepanel/AppSelect.test.ts`
Expected: FAIL (module / component missing).

- [ ] **Step 3: Implement `AppSelect.vue`**

Create `src/sidepanel/components/AppSelect.vue` with this behavior:

```vue
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

const { reduced } = useReducedMotion()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const activeIndex = ref(-1)
const listId = `app-select-${Math.random().toString(36).slice(2, 9)}`

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

async function playOpenAnimation() {
  const el = menuRef.value
  if (!el) return
  if (reduced.value) {
    el.style.opacity = '1'
    el.style.transform = 'none'
    return
  }
  el.style.opacity = '0'
  el.style.transform = 'scale(0.96) translateY(-4px)'
  await animate(
    el,
    { opacity: 1, transform: 'scale(1) translateY(0px)' },
    { type: 'spring', bounce: 0, duration: 0.3 },
  )
}

async function openMenu() {
  if (props.disabled || open.value) return
  open.value = true
  activeIndex.value = Math.max(0, indexOfValue(props.modelValue))
  await nextTick()
  await playOpenAnimation()
}

function closeMenu() {
  if (!open.value) return
  open.value = false
  activeIndex.value = -1
}

function toggle() {
  if (open.value) closeMenu()
  else void openMenu()
}

function selectAt(index: number) {
  const opt = props.options[index]
  if (!opt) return
  emit('update:modelValue', opt.value)
  closeMenu()
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  if (e.key === 'Escape') {
    if (open.value) {
      e.preventDefault()
      closeMenu()
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
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) {
      void openMenu()
      return
    }
    activeIndex.value = Math.max(0, activeIndex.value - 1)
  }
}

function onDocPointerDown(e: PointerEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
})

watch(
  () => props.disabled,
  (d) => {
    if (d) closeMenu()
  },
)
</script>

<template>
  <div ref="rootRef" class="app-select" :class="{ open, disabled }">
    <button
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
      v-if="open"
      :id="listId"
      ref="menuRef"
      class="menu"
      role="listbox"
      :aria-label="ariaLabel"
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
        @click="selectAt(i)"
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

.open .chevron {
  transform: rotate(180deg);
}

.menu {
  position: absolute;
  z-index: 5;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: 12px;
  border: 1px solid var(--hairline);
  background: var(--elevated);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow: var(--shadow-float);
  transform-origin: top center;
  max-height: min(240px, 50vh);
  overflow: auto;
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
}

.option.active {
  background: var(--row-bg-hover);
}

.option.selected {
  background: var(--accent-soft);
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
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .menu {
    backdrop-filter: none;
  }
}
</style>
```

- [ ] **Step 4: Run smoke tests — expect pass**

Run: `npx vitest run tests/sidepanel/AppSelect.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit (only if user asked)**

Skip unless explicitly requested.

---

### Task 3: Wire AddSheet + EditBookmarkSheet

**Files:**
- Modify: `src/sidepanel/components/AddSheet.vue`
- Modify: `src/sidepanel/components/EditBookmarkSheet.vue`

**Interfaces:**
- Consumes: `AppSelect` from Task 2

- [ ] **Step 1: Update AddSheet**

Import `AppSelect`. Replace the group `<select>` block with:

```vue
<label>
  {{ t('add.groupLabel') }}
  <AppSelect
    v-model="groupId"
    :options="groups.map((g) => ({ value: g.id, label: g.name }))"
    :aria-label="t('add.groupLabel')"
  />
</label>
```

Remove `select` from the scoped `input, select { ... }` rule so it is only `input { ... }`.

- [ ] **Step 2: Update EditBookmarkSheet**

Same pattern:

```vue
<label>
  {{ t('editBookmark.groupLabel') }}
  <AppSelect
    v-model="groupId"
    :options="groups.map((g) => ({ value: g.id, label: g.name }))"
    :aria-label="t('editBookmark.groupLabel')"
  />
</label>
```

Remove unused `select` from the shared input/select style rule.

- [ ] **Step 3: Full verify**

Run: `npm test && npm run build`
Expected: all tests pass; `vue-tsc` + Vite build succeed.

- [ ] **Step 4: Manual checklist (agent or user)**

- Closed trigger matches text inputs in Add / Edit sheets.
- Open menu is glass panel with check, not OS native list.
- Outside click and Escape close; Arrow keys move highlight; Enter selects.
- Light / dark theme readable.

- [ ] **Step 5: Commit (only if user asked)**

Skip unless explicitly requested.

---

## Spec coverage (self-review)

| Spec item | Task |
| --- | --- |
| `AppSelect.vue` API | Task 2 |
| Icons chevron-down / check | Task 1 |
| AddSheet / EditBookmarkSheet | Task 3 |
| Materials + spring + reduced motion | Task 2 styles + animation |
| Keyboard / listbox a11y | Task 2 |
| Out: multi-select, settings seg, portal | Not in plan |
| Verify build/test | Task 2 + Task 3 |

No placeholders; types consistent (`AppSelectOption`, `modelValue`, `update:modelValue`).
