# Side Rail Actions Design

Date: 2026-07-26  
Status: Approved

## Goal

Remove the list-mode top header and relocate Settings / Add into the left IndexBar, below a fixed (non-scaling) separator, while keeping a continuous Dock magnification across group icons and the two actions.

## Problem

The sticky `AppHeader` (settings · title · add) consumes vertical chrome and duplicates affordances that can live on the existing left rail. Users want a cleaner list surface: no header title, actions under the group index.

## Decisions

| Topic | Choice |
|-------|--------|
| Title「收藏」 | Removed entirely |
| Placement | Extend `IndexBar` (same rail) |
| Order | Group icons → hairline separator → Settings → Add |
| Separator Dock | Fixed height; not a magnet; no scale |
| Settings / Add Dock | Participate in the same Dock curve as groups |
| Visual style | Same `.item` / `.glyph` as group icons |
| AddSheet | Open near the left Add control (top-left alignment) |

## Scope

### In

- Remove list-mode `AppHeader` from `App.vue`; delete `AppHeader.vue` if unused
- Extend `IndexBar.vue` with separator + settings + add; emit `settings` / `add`
- Wire emits in `App.vue` to existing `showSettings` / `showAdd`
- Reposition `AddSheet` overlay to top-left near the rail
- Remove unused `header.title` i18n keys when unreferenced

### Out

- Settings / Add business logic and store changes
- IndexBar icon/text mode toggle (unused settings keys)
- Unrelated visual refresh

## Layout

List mode:

```
.app
└── .content-shell
    └── .content (scroll)
        ├── BookmarkList
        └── IndexBar (fixed left, vertically centered)
            ├── [group icons…]
            ├── separator (hairline, no scale)
            ├── settings
            └── add
```

Settings view still replaces the whole list UI (rail included).

## Interaction

- Group icons: unchanged — Dock scale, name tooltip, `scrollIntoView` to `[data-group-id]`
- Separator: spacer only; no tooltip; does not set `--dock-scale`
- Settings / Add: Dock magnets; tooltips / `aria-label` via `a11y.settings` and `a11y.add`; emit only (no scroll)
- Dock geometry: `restingCenterY` adds separator block height for magnets below the separator so the falloff curve stays continuous
- AddSheet: overlay `flex-start` + left padding near the rail; `transform-origin: top left`

## Components

| Unit | Responsibility |
|------|----------------|
| `IndexBar` | Group jump + separator + settings/add chrome; Dock |
| `App.vue` | Orchestration; no header |
| `AddSheet` | Presentation position only for this change |

## Testing

- Manual: no header; order; separator does not scale; settings/add open; AddSheet from top-left
- Existing `indexBar` unit tests remain for `buildIndexBarAnchors`; no mandatory new suite
