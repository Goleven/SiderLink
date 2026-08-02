# Global bookmark search (Action Popup) — 2026-08-02

## Goals

- Chrome **in-browser** global shortcut opens bookmark search.
- **Does not depend** on whether the side panel is open.
- Surface is an **extension Action Popup** (toolbar-anchored floating UI), not a separate OS/Chrome window.
- Clicking outside the popup dismisses it (native Chrome behavior).
- Side-panel search (IndexBar / `/` / `⌘/Ctrl+K` + existing `SearchOverlay`) **unchanged**.
- Toolbar icon continues to open the side panel (`openPanelOnActionClick`).

## Out of scope

- OS-level Global shortcut (user may enable in `chrome://extensions/shortcuts`).
- Injected content-script overlays on web pages.
- Pinyin / fuzzy / query history.
- Edit / delete from search results.
- Changing side-panel `SearchOverlay` behavior (empty → no rows, cap 5).

## Architecture

```
chrome.commands open-bookmark-search
  → background SW
      → action.setPopup(search.html)
      → action.openPopup()
  → src/search Action Popup
      → runtime.connect(name: search-popup)
      → chrome.storage.local
      → tabs create/update (host browser window)
  → popup closes (outside click / Esc / open link)
      → port disconnect
      → action.setPopup('')  // restore icon → side panel
```

- Manifest does **not** set `action.default_popup`.
- SW clears leftover popup on startup with `setPopup('')`.
- Port disconnect clears popup; do not rely on `setTimeout` (MV3 SW persistence asymmetry).
- If `openPopup` fails: clear popup and show a notification; do not fall back to `windows.create`.

## UI (Apple Design)

- Reuse side-panel tokens and theme (`themeMode` / system / background).
- Popup content size ~360×480 (Chrome content-sized, max ~800×600).
- Sticky translucent search chrome; scrollable list; scroll-edge fade preferred over hard dividers.
- Row: favicon + title + hostname; **group Lucide icon badge at top-right** of the row.
- Instant filter (no debounce); highlight on pointer-down; keyboard ↑/↓/Enter/Esc.
- `prefers-reduced-motion`: short opacity cross-fade; `prefers-reduced-transparency`: solid surfaces.

## Matching / list

- Empty query: flatten bookmarks in side-panel order (`sortGroups` → `sortBookmarksInGroup` per group).
- Non-empty: case-insensitive substring on `title` or `url`; **preserve that order**; no result cap.
- Side panel keeps `filterBookmarks` (empty → `[]`, title-tier preference, cap 5).

## Open URL

- Honor `settings.openInNewTab`.
- When not new-tab: update the active tab of the **last-focused normal browser window**, never the action popup itself.
- Close the popup after open.

## Manifest / settings / i18n

- Command `open-bookmark-search`, suggested key `Alt+Shift+K`.
- Settings shows toggle-side-panel and open-bookmark-search shortcuts.
- Locales: en / zh-CN / zh-TW / ja (including `search.openFailed`).

## Acceptance

1. With the extension enabled, the global shortcut opens the Action Popup whether or not the side panel is open.
2. Clicking outside the popup (page, tab strip, etc.) closes it.
3. After close, toolbar icon still opens the side panel (popup path cleared).
4. Empty query lists all bookmarks in side-panel order with group icon badges.
5. Keyword filters by title/url (case-insensitive), order preserved, no cap; empty-state copy when none match.
6. ↑/↓/Enter/Esc work; open respects `openInNewTab` against the host browser window; popup closes after open.
7. Side-panel search behavior unchanged.
8. Settings lists both shortcuts; four locales updated.
9. Reduced-motion / reduced-transparency degrade appropriately.
