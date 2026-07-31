# Side Panel Visual MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a loadable Chrome/Edge MV3 extension that opens a dark Side Panel visual shell (fake favorite-site rows) so we can evaluate the Side Panel UX.

**Architecture:** Unpacked extension with four artifacts only: `manifest.json` wires MV3 + `side_panel`; `background.js` enables open-on-action-click; `sidepanel.html` is the entire UI (inline CSS + static markup); `icons/icon128.png` is a placeholder toolbar icon. No build step, no framework, no persistence.

**Tech Stack:** Chrome Extension Manifest V3, vanilla HTML/CSS/JS, Chromium `sidePanel` API

**Spec:** `docs/superpowers/specs/2026-07-24-sidepanel-visual-mvp-design.md`

## Global Constraints

- Target: Chrome / Edge (Chromium) only — no Firefox
- Manifest V3; permission `sidePanel` only
- UI must live in a single file: `sidepanel.html` (inline CSS; optional tiny inline script for click feedback only)
- Visual shell only — no storage, bookmarks API, navigation, or real add/edit/delete
- Layout B: dark theme; header title `收藏` + circular `+`; rows with icon placeholder, name, domain
- Sample rows: GitHub / github.com, Notion / notion.so, MDN / developer.mozilla.org, ChatGPT / chatgpt.com
- No automated tests — verification is manual load-unpacked in Chrome/Edge
- No `package.json`, Vite, Vue/React, or multi-page UI
- Working tree should contain only MVP files plus existing docs/gitignore (do not resurrect deleted app code)

## File map

| File | Responsibility |
|------|----------------|
| `manifest.json` | MV3 metadata, `side_panel.default_path`, action icon, `sidePanel` permission, service worker entry |
| `background.js` | Call `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` |
| `sidepanel.html` | Entire Side Panel UI shell (markup + CSS + optional click-feedback script) |
| `icons/icon128.png` | Placeholder extension / toolbar icon |

---

### Task 1: Placeholder icon

**Files:**
- Create: `icons/icon128.png`

**Interfaces:**
- Consumes: nothing
- Produces: `icons/icon128.png` (128×128 PNG) referenced later as `icons/icon128.png`

- [ ] **Step 1: Create the icons directory**

```powershell
New-Item -ItemType Directory -Force -Path "D:\TabExtension\icons" | Out-Null
```

Expected: directory `D:\TabExtension\icons` exists.

- [ ] **Step 2: Generate a solid dark 128×128 PNG**

Run from repo root (`D:\TabExtension`):

```powershell
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 128, 128
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(255, 34, 34, 34))
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 240, 240, 240))
$font = New-Object System.Drawing.Font "Segoe UI", 48, ([System.Drawing.FontStyle]::Bold)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("+", $font, $brush, (New-Object System.Drawing.RectangleF 0, 0, 128, 128), $format)
$bmp.Save("$PWD\icons\icon128.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $brush.Dispose(); $font.Dispose()
```

Expected: `icons/icon128.png` exists and is a non-empty PNG.

- [ ] **Step 3: Commit**

```bash
git add icons/icon128.png
git commit -m "chore: add placeholder extension icon for Side Panel MVP"
```

---

### Task 2: Extension skeleton that opens Side Panel

**Files:**
- Create: `manifest.json`
- Create: `background.js`
- Create: `sidepanel.html` (temporary stub — replaced in Task 3)

**Interfaces:**
- Consumes: `icons/icon128.png`
- Produces:
  - Manifest keys: `side_panel.default_path = "sidepanel.html"`, `background.service_worker = "background.js"`, `permissions: ["sidePanel"]`
  - `background.js` behavior: `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`

- [ ] **Step 1: Create `manifest.json`**

Write exactly:

```json
{
  "manifest_version": 3,
  "name": "常用收藏 Side Panel MVP",
  "version": "0.1.0",
  "description": "Visual shell for evaluating the Chrome/Edge Side Panel favorite-sites UX.",
  "permissions": ["sidePanel"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_title": "打开收藏",
    "default_icon": {
      "128": "icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "icons": {
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Create `background.js`**

Write exactly:

```js
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
```

- [ ] **Step 3: Create a stub `sidepanel.html`**

Write exactly (will be replaced in Task 3):

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>收藏</title>
    <style>
      body {
        margin: 0;
        font-family: system-ui, sans-serif;
        background: #111;
        color: #f2f2f2;
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <h1>收藏</h1>
    <p>Side Panel stub — UI comes next.</p>
  </body>
</html>
```

- [ ] **Step 4: Manual verify — load and open panel**

1. Open Chrome or Edge → `chrome://extensions` (or `edge://extensions`)
2. Enable Developer mode
3. Click **Load unpacked** → select `D:\TabExtension`
4. Confirm the extension appears with no errors
5. Pin the extension if needed, then click the toolbar action icon
6. Confirm the browser Side Panel opens on the right showing the stub title `收藏`

Expected: panel opens; stub content visible; no extension error badge.

If the panel does not open: confirm `sidePanel` permission is present, service worker is active on the extension details page, and reload the extension after fixing files.

- [ ] **Step 5: Commit**

```bash
git add manifest.json background.js sidepanel.html
git commit -m "feat: add MV3 Side Panel skeleton that opens on action click"
```

---

### Task 3: Layout B dark list visual shell

**Files:**
- Modify: `sidepanel.html` (replace entire file)

**Interfaces:**
- Consumes: extension already loads `sidepanel.html` as the Side Panel document
- Produces: static DOM structure with:
  - header title text `收藏`
  - circular `+` button (no real add behavior)
  - four `.row` items for GitHub, Notion, MDN, ChatGPT
  - optional click handlers that only `console.log` / brief highlight

- [ ] **Step 1: Replace `sidepanel.html` with the full visual shell**

Overwrite `sidepanel.html` with exactly:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>收藏</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #111111;
        --surface: #1c1c1c;
        --surface-hover: #252525;
        --text: #f2f2f2;
        --muted: rgba(242, 242, 242, 0.55);
        --icon: #3a3a3a;
        --plus-bg: #2a2a2a;
        --focus: #5b8cff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }

      .app {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        padding: 14px 10px 16px;
        gap: 10px;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 4px 4px;
      }

      .title {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .plus {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 50%;
        background: var(--plus-bg);
        color: var(--text);
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .plus:hover {
        filter: brightness(1.15);
      }

      .plus:active {
        transform: scale(0.96);
      }

      .plus:focus-visible,
      .row:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        margin: 0;
        padding: 10px;
        border: 0;
        border-radius: 10px;
        background: var(--surface);
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .row:hover {
        background: var(--surface-hover);
      }

      .row:active {
        transform: scale(0.995);
      }

      .row.is-flash {
        outline: 2px solid var(--focus);
      }

      .favicon {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: var(--icon);
        flex-shrink: 0;
      }

      .meta {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .name {
        font-size: 13px;
        font-weight: 600;
      }

      .domain {
        font-size: 11px;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <div class="app">
      <header class="header">
        <h1 class="title">收藏</h1>
        <button class="plus" type="button" aria-label="添加（示意）" data-action="add">+</button>
      </header>

      <div class="list" role="list">
        <button class="row" type="button" role="listitem" data-name="GitHub">
          <span class="favicon" aria-hidden="true"></span>
          <span class="meta">
            <span class="name">GitHub</span>
            <span class="domain">github.com</span>
          </span>
        </button>
        <button class="row" type="button" role="listitem" data-name="Notion">
          <span class="favicon" aria-hidden="true"></span>
          <span class="meta">
            <span class="name">Notion</span>
            <span class="domain">notion.so</span>
          </span>
        </button>
        <button class="row" type="button" role="listitem" data-name="MDN">
          <span class="favicon" aria-hidden="true"></span>
          <span class="meta">
            <span class="name">MDN</span>
            <span class="domain">developer.mozilla.org</span>
          </span>
        </button>
        <button class="row" type="button" role="listitem" data-name="ChatGPT">
          <span class="favicon" aria-hidden="true"></span>
          <span class="meta">
            <span class="name">ChatGPT</span>
            <span class="domain">chatgpt.com</span>
          </span>
        </button>
      </div>
    </div>

    <script>
      function flash(el) {
        el.classList.add("is-flash");
        setTimeout(() => el.classList.remove("is-flash"), 250);
      }

      document.querySelector(".plus").addEventListener("click", (event) => {
        console.log("add: visual only");
        flash(event.currentTarget);
      });

      document.querySelectorAll(".row").forEach((row) => {
        row.addEventListener("click", (event) => {
          console.log("open: visual only", event.currentTarget.dataset.name);
          flash(event.currentTarget);
        });
      });
    </script>
  </body>
</html>
```

- [ ] **Step 2: Manual verify — layout B shell**

1. On `chrome://extensions` (or Edge equivalent), click **Reload** on this extension
2. Open the Side Panel via the toolbar icon
3. Confirm:
   - Dark background
   - Header shows `收藏` and a circular `+`
   - Four rows: GitHub, Notion, MDN, ChatGPT with domains as specified
   - Hover styles work
   - Clicking a row or `+` does **not** navigate away; DevTools console (inspect the Side Panel page) shows the `console.log` messages
4. Confirm no real persistence or bookmark writes occur (none are implemented)

Expected: matches layout B visual shell acceptance criteria from the spec.

- [ ] **Step 3: Commit**

```bash
git add sidepanel.html
git commit -m "feat: implement dark Side Panel visual shell with fake favorites"
```

---

### Task 4: Final acceptance sweep

**Files:**
- Modify: none expected (fix only if Step 1 finds gaps)

**Interfaces:**
- Consumes: all Task 1–3 artifacts
- Produces: confirmation that acceptance criteria are met

- [ ] **Step 1: Check working tree matches MVP file set**

```powershell
Get-ChildItem -Force D:\TabExtension | Select-Object Name
```

Expected (names may also include `.git`, `.gitignore`, `docs`, `.superpowers` ignored):  
`background.js`, `docs`, `icons`, `manifest.json`, `sidepanel.html`, `.gitignore` — and **not** a resurrected `src/` app tree.

- [ ] **Step 2: Re-run full manual acceptance checklist**

From the spec:

1. Extension loads without errors
2. Action click opens Side Panel
3. Panel shows dark list shell (title, `+`, four fake rows)
4. No real bookmark functionality required or present

- [ ] **Step 3: Commit only if fixes were needed**

If Step 1–2 required code changes, commit them with a message describing the fix. If nothing changed, skip commit.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Clear old app / greenfield workspace | Already empty; Task 4 verifies no `src/` resurrection |
| Chrome/Edge Side Panel | Tasks 2–3 |
| Single UI file `sidepanel.html` | Tasks 2–3 |
| Layout B dark list + sample data | Task 3 |
| `manifest.json` + `background.js` open-on-click | Task 2 |
| Icon asset | Task 1 |
| No real CRUD / storage / build tooling / automated tests | Enforced by Global Constraints + manual verify steps |
| Manual acceptance | Tasks 2, 3, 4 |

No placeholders left in steps. Types/names are consistent (`sidepanel.html`, `setPanelBehavior`, sample site labels).
