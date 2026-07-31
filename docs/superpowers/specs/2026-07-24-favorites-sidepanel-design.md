# Favorites Side Panel Extension — Design

Date: 2026-07-24  
Status: Approved for planning  
Stack: Vite + TypeScript + Vue  
UI motion / materials: Apple Design principles (`apple-design` skill)

## Goal

Build a Chromium (Chrome / Edge) browser extension that lets users **manage favorite sites** and **open them quickly** from a **Side Panel**. Data stays on-device for v1; the codebase is structured so Firefox support can be added later without rewriting the domain model.

This is a greenfield product design. Prior visual-MVP scaffolding docs in this repo are historical only and are not part of this product’s acceptance criteria.

## Scope

### In (v1)

- Manifest V3 extension with Side Panel as the primary UI
- Custom groups with icons; one renameable, non-deletable default group
- Flat bookmark list organized under groups; manual drag-and-drop ordering
- IndexBar for group jump: icon mode or vertical text mode
- Add current tab and manual URL entry
- Edit / delete bookmarks; create / rename / re-icon / reorder / delete custom groups
- Settings: open in new tab vs current tab; IndexBar mode; theme (light / dark / system); solid background presets
- Local persistence via `chrome.storage.local`
- Vite + TypeScript + Vue build
- Unit tests for domain logic; manual verification in Chrome/Edge

### Out (v1)

- Firefox shipping build (structure reserved only)
- Cloud sync / `chrome.storage.sync`
- Search box / filter UI
- Alphabetical auto-sort (manual order only)
- Chrome native Bookmarks API two-way sync
- Arbitrary color picker (presets only)
- E2E browser automation
- Backend / accounts

## Approach

**Vite + TypeScript + Vue**, with a thin browser-API adapter layer under `shared/`, Side Panel as a Vue app, and Apple-inspired interaction: instant press feedback, interruptible springs for gesture-driven motion, translucent chrome, system typography, and `prefers-reduced-motion` / transparency fallbacks.

Rationale: IndexBar dual modes, sheets, and drag-sort need component structure; Vue + Vite keeps the UI maintainable without overbuilding for sync or multi-browser shipping in v1.

## Architecture

```
extension/
  manifest.json
  background/              # MV3 service worker: Side Panel on action click; tab helpers as needed
  sidepanel/               # Vue app (primary UI)
    components/
    composables/
    stores/                # bookmarks / groups / settings (Pinia)
  shared/                  # types, storage schema, browser API adapters (Chromium now; Firefox later)
```

**Data flow**

- UI ↔ storage composable/store ↔ `chrome.storage.local`
- Open URL via `chrome.tabs` according to settings
- “Save current page” reads the active tab (title, url, favIconUrl); special pages may fail gracefully

**Build**

- Vite produces a loadable unpacked extension directory
- No server component

## Data model

Single root object in `chrome.storage.local` for easy versioning.

### `BookmarkItem`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable id |
| `title` | string | |
| `url` | string | `http:` / `https:` only |
| `faviconUrl` | string \| optional | Placeholder if missing |
| `groupId` | string | Always a real group id |
| `order` | number | Manual order within group |
| `createdAt` / `updatedAt` | number | Epoch ms |

### `Group`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `name` | string | User-defined; default group is renameable |
| `icon` | string | Emoji or built-in icon key |
| `order` | number | Group order = IndexBar order |
| `isDefault` | boolean | Exactly one default group; cannot be deleted |

### `Settings`

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `openInNewTab` | boolean | `true` | Opening behavior |
| `indexBarMode` | `'icon' \| 'text'` | `'icon'` | IndexBar display |
| `themeMode` | `'light' \| 'dark' \| 'system'` | `'system'` | Follows `prefers-color-scheme` when `system` |
| `backgroundId` | string | neutral preset id | Solid preset, not free picker |

Sync-related fields are **not** stored in v1; schema comments / version bumps leave room for a future `syncEnabled`.

### `StorageRoot`

```ts
{
  version: number;      // start at 1
  groups: Group[];
  bookmarks: BookmarkItem[];
  settings: Settings;
}
```

### Invariants

- Exactly one group with `isDefault: true`; initial name e.g.「收藏」; user may rename and change icon; cannot delete
- Every bookmark has a valid `groupId`
- Deleting a custom group moves its bookmarks into the default group, preserving relative order
- Display order: `group.order`, then `bookmark.order` within each group
- Background presets (about 4–6 solid colors) map to light/dark token pairs so text contrast remains acceptable; invalid/low-contrast presets are not shipped

## UI and interaction

Guided by Apple Design: response on pointer-down, direct manipulation for drags, interruptible springs, translucent materials, spatial consistency for sheets, rubber-banding at edges, reduced-motion cross-fades.

### Side Panel layout

- **Top chrome** (translucent): context title + `+` add control (instant press scale)
- **Main list**: sections per group (icon + name header); rows with favicon, title, domain subtitle
- **IndexBar** (trailing edge): mirrors group order
  - **Text mode**: group names, vertical lettering; tap jumps to section
  - **Icon mode**: group icons only; selected or hovered shows group name (tooltip / adjacent label)
- IndexBar remains visible even with a single group (consistent chrome)
- Bookmark click opens per `openInNewTab`; press feedback is immediate

### Add flow

`+` opens a sheet/panel anchored to the trigger:

1. **Save current page** — prefill title / url / favicon; choose group
2. **Manual add** — title, URL, group

Invalid URL shows inline error and keeps the form open.

### Management

- Bookmarks: edit, delete (prefer undo toast over heavy confirm dialogs; confirm only if irreversible with no undo)
- Groups: create, rename, change icon, reorder; default group cannot be deleted (explain if attempted)
- Manual sort: drag bookmarks within a group and across groups (drop onto another section updates `groupId` + `order`); drag groups via section headers — 1:1 tracking, velocity handoff on release. IndexBar is for jump (and icon/text display), not the primary drag handle in v1

### Settings (in-panel secondary view)

- Open: current tab vs new tab
- IndexBar: icon vs text
- Theme: light / dark / system
- Background: solid preset grid

## Error handling and edge cases

- Empty title: current tab uses tab title; manual add may default to hostname
- Group name: trim; reject empty; reject duplicate names with inline message (no silent merge)
- Storage read/write failure: non-blocking banner + retry; keep in-memory form draft
- Schema mismatch: migrate by version; if impossible, stash old payload under a `_backup` key, init empty store, notify user
- Current tab unavailable (`chrome://`, permission, etc.): disable “save current page” with reason; manual add still works
- Open tab failure: brief error toast
- Drag past bounds: rubber-band; illegal drop snaps back
- `themeMode: system` updates live with OS scheme changes
- Privacy: local-only data; minimize host permissions; prefer existing favicon URLs over broad host access

## Testing

### Automated

- Schema migration and defaults
- URL / title / group name validation
- Delete group → bookmarks move to default; order recompute
- `system` theme resolution to light/dark
- IndexBar anchor list derived from group order

### Manual (Chrome / Edge unpacked)

- Side Panel open; add current / manual; edit; delete
- Default group rename; cannot delete; custom groups CRUD + icons
- Drag-reorder groups and bookmarks
- IndexBar icon/text modes, jump, hover/selected name in icon mode
- Theme triad + background presets; reduced-motion degradation
- Open in new tab vs current tab
- Special-page messaging when current tab cannot be saved

### Not in v1

E2E automation, Firefox runtime QA, sync, native bookmark bridge.

## Acceptance criteria

1. Unpacked extension loads in Chrome or Edge without errors
2. Action click opens Side Panel Vue UI
3. User can add (current + manual), edit, delete bookmarks and open them per settings
4. Default group is renameable and not deletable; custom groups support icon + IndexBar
5. Manual ordering works for groups and bookmarks
6. Theme (light / dark / system) and solid background presets apply correctly
7. Data persists across panel close / browser restart via `chrome.storage.local`
8. No sync, search box, or Firefox ship requirement for v1 acceptance

## Non-goals / follow-ups

- Firefox adapter implementation
- Optional sync
- Search / filter
- Import/export and Chrome Bookmarks integration
- Rich icon pack beyond v1 emoji / small built-in set
