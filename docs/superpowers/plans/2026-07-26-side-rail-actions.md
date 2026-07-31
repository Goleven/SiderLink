# Side Rail Actions Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Remove list AppHeader; put Settings and Add under IndexBar after a non-scaling separator; open AddSheet from the left.

**Architecture:** Extend `IndexBar` so group icons, separator, and two actions share one fixed left rail and one Dock magnet list. `App.vue` wires emits; `AddSheet` only changes overlay alignment.

**Tech Stack:** Vue 3 SFC, existing IndexBar Dock math, vue-i18n, Vitest for shared helpers.

## Global Constraints

- Separator must not receive `--dock-scale`
- Settings then Add order below separator
- No Settings/Add store logic changes
- Title removed; do not relocate it

---

### Task 1: App.vue wire-up

- [ ] Remove `AppHeader` import and template
- [ ] `<IndexBar @settings="showSettings = true" @add="showAdd = true" />`

### Task 2: IndexBar actions + Dock

- [ ] Emit `settings` / `add`
- [ ] Template: separator + two action buttons (same `.item` styles)
- [ ] `itemEls` length = anchors + 2; `restingCenterY` offsets by separator block for action indices
- [ ] Tooltip ids for actions; clicks emit (no scroll)

### Task 3: AddSheet position

- [ ] Overlay top-left; `transform-origin: top left`

### Task 4: Cleanup + verify

- [ ] Delete `AppHeader.vue`; remove `header` i18n if unused
- [ ] Run `npm test` / build as available
