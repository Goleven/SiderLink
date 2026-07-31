# Side Panel Visual MVP Design

Date: 2026-07-24  
Status: Approved for planning

## Goal

Build a minimal Chromium (Chrome / Edge) extension MVP whose only purpose is to demonstrate the **browser Side Panel** experience for a “favorite sites” product. This is a **visual shell** — not a working bookmark manager.

The repository is treated as a greenfield workspace (existing history is ignored; the working tree is already empty aside from git metadata).

## Scope

### In

- Manifest V3 extension loadable via “Load unpacked”
- Side Panel opens when the toolbar action icon is clicked
- Single UI file (`sidepanel.html`) with inline CSS and static fake data
- Dark list UI matching layout option **B**: title “收藏”, circular “+” in the header, rows with icon placeholder + site name + domain subtitle
- Minimal `manifest.json`
- Tiny `background.js` service worker that enables “open Side Panel on action click”
- Simple toolbar icon asset

### Out

- Real add / edit / delete / persist / sync
- Chrome Bookmarks API or `chrome.storage`
- New Tab page, popup UI, categories, search
- Build tooling, frameworks, multi-file UI architecture
- Firefox support
- Automated tests
- Migration from any prior TabExtension implementation

Formal product architecture is deferred; this MVP is disposable scaffolding to evaluate Side Panel UX.

## Approach

**Single-file UI shell** plus the minimum extension packaging files.

Rationale: fastest path to a real Side Panel in Chrome/Edge. Multi-file structure, Vite, and frameworks are reserved for a later formal project if the Side Panel direction is kept.

## File structure

```
TabExtension/
  manifest.json
  sidepanel.html      # only UI file (inline CSS + fake rows)
  background.js       # MV3 service worker: open panel on toolbar icon click
  icons/icon128.png   # toolbar / extension icon (simple placeholder OK)
```

`sidepanel.html` remains the only UI file. No `package.json`, no `src/`, no build step.

## UI specification (layout B)

- **Theme:** dark panel background; light text; subtle elevated row surfaces
- **Header:** left title `收藏`; right circular `+` control
- **List:** ~4 static items, each row:
  - square icon placeholder
  - primary label (site name)
  - secondary label (domain)
- **Sample data (adjustable):** GitHub / github.com, Notion / notion.so, MDN / developer.mozilla.org, ChatGPT / chatgpt.com

### Interaction boundaries

- Rows and `+` may show hover / pressed styles
- Clicks do **not** navigate, save, or open dialogs
- Optional: `console.log` or brief highlight on click for click-target feedback only
- No persistence of any kind

## Extension behavior

1. User loads the unpacked extension root in Chrome or Edge
2. User clicks the extension action icon
3. Browser Side Panel opens on the right showing `sidepanel.html`
4. Editing `sidepanel.html` and reloading the extension updates the panel

Configure `side_panel.default_path` to `sidepanel.html` in the manifest. In `background.js`, call `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` so the toolbar icon opens the panel.

## Acceptance criteria

1. Working tree contains only this MVP’s files (plus `.git` / ignored companion artifacts)
2. Extension loads without errors in Chrome or Edge developer mode
3. Action click opens the Side Panel
4. Panel shows the dark list shell described above
5. No real bookmark functionality is required for acceptance

Verification is **manual** only.

## Non-goals for follow-up

After this MVP, a separate brainstorm / spec should decide whether Side Panel remains the primary surface and which formal stack to use. This document does not commit to that path.
