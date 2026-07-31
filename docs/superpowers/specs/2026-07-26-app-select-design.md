# AppSelect Design

Date: 2026-07-26  
Status: Approved for planning

## Goal

Replace native `<select>` in Add / Edit bookmark sheets with a reusable custom dropdown that matches the Side Panel’s Apple-inspired materials, typography, and motion — without changing selection semantics.

## Problem

Native OS dropdown menus ignore extension CSS tokens (`--elevated`, `--hairline`, `--row-bg`, springs). In AddSheet / EditBookmarkSheet the closed control can be styled, but the open list looks like a system widget and breaks visual continuity.

## Scope

### In

- New reusable component: `src/sidepanel/components/AppSelect.vue`
- Wire into group fields in `AddSheet.vue` and `EditBookmarkSheet.vue`
- Add any missing Lucide icons to `AppIcon` (e.g. chevron-down, check)
- Keyboard / a11y for listbox pattern
- Reduced-motion and reduced-transparency friendly behavior

### Out

- Multi-select, search/filter, async loading
- Changing Settings segmented controls
- Portaling menu outside the sheet (keep layout simple; clip/overflow handled in-sheet)
- Unit tests for the component (manual verify + existing build/test suite)

## API

```ts
export type AppSelectOption = {
  value: string
  label: string
}

// Props
options: AppSelectOption[]
modelValue: string
placeholder?: string
disabled?: boolean
ariaLabel?: string

// Emits
'update:modelValue': [value: string]
```

Usage:

```vue
<AppSelect
  v-model="groupId"
  :options="groups.map((g) => ({ value: g.id, label: g.name }))"
  :aria-label="t('editBookmark.groupLabel')"
/>
```

Component stays presentation-only: no store, no i18n keys for option labels.

## Visual

| Piece | Spec |
| --- | --- |
| Trigger | Match sheet `input`: border `var(--hairline)`, radius 10px, padding ~10×12, bg `var(--row-bg)`, full width |
| Chevron | Lucide chevron-down on the right; rotates ~180° when open |
| Menu | Panel under trigger: `var(--elevated)`, `backdrop-filter: blur(20px) saturate(180%)`, radius 12–14px, `var(--shadow-float)`, hairline edge |
| Option row | Comfortable tap height (~36–40px), hover `var(--row-bg-hover)` or soft fill |
| Selected | Accent check on the right; optional soft `var(--accent-soft)` background |
| Press | Trigger uses `.pressable` / `:active` scale on pointer-down |

Avoid stacking a light translucent menu on another light translucent surface without enough opacity — menu background should stay readable (`--elevated` weight).

## Interaction

1. Click / Enter / Space on trigger toggles open.
2. Open: spring from trigger (`transform-origin: top center`), bounce `0`, duration ~0.3s (Motion), opacity + slight scale.
3. Close: same path reverse; interruptible if user toggles again mid-animation.
4. Select option → commit `modelValue` → close.
5. Outside click or Escape → close without change (unless already selected via Enter on focused option).
6. Arrow Up/Down move highlight within listbox; Enter commits; Home/End optional nicety.
7. `prefers-reduced-motion: reduce` → opacity cross-fade only, no scale spring.

## Accessibility

- Trigger: `role="combobox"` (or button + `aria-haspopup="listbox"`), `aria-expanded`, `aria-controls`.
- Menu: `role="listbox"`; options `role="option"` + `aria-selected`.
- Focus: keep focus management predictable — focus trigger when closed; when open, either focus list or keep trigger and use `aria-activedescendant` (prefer activedescendant to avoid scroll jumps in short side panel).

## File changes

```
src/sidepanel/components/AppSelect.vue     # new
src/sidepanel/components/AppIcon.vue       # register chevron-down + check if missing
src/sidepanel/components/AddSheet.vue      # replace <select>
src/sidepanel/components/EditBookmarkSheet.vue
```

No storage / domain / i18n message key changes required unless a dedicated a11y string is needed (prefer reusing field labels via `ariaLabel` prop).

## Verification

- Open Add + Edit sheets: group control matches inputs visually when closed.
- Open menu: glass panel + check, not OS native list.
- Keyboard: open, move, select, Escape.
- Dark / light theme + reduced motion still usable.
- `npm test` && `npm run build` pass.
