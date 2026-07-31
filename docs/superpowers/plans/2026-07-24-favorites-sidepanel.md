# Favorites Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Chromium MV3 Side Panel extension (Vite + TypeScript + Vue) for managing grouped favorites, opening them quickly, with local persistence, IndexBar, theme/background settings, and Apple-inspired interaction.

**Architecture:** Domain logic and storage live in `src/shared` (pure TS, unit-tested). Chromium APIs are wrapped behind thin adapters. The Side Panel is a Vue 3 + Pinia app; the background service worker only enables Side Panel on action click and exposes tab helpers. Vite + `@crxjs/vite-plugin` builds an unpacked `dist/` loadable in Chrome/Edge.

**Tech Stack:** Vite 6, Vue 3, TypeScript, Pinia, Vitest, `@crxjs/vite-plugin`, `@types/chrome`, Motion (`motion` package) for springs, native Pointer Events for drag.

**Spec:** `docs/superpowers/specs/2026-07-24-favorites-sidepanel-design.md`

## Global Constraints

- Manifest V3; Side Panel is the only primary UI
- Persist only via `chrome.storage.local` (no sync in v1)
- Exactly one renameable, non-deletable default group (`isDefault: true`)
- Bookmarks always have a real `groupId`; delete custom group → move bookmarks to default
- Manual order only (`group.order`, `bookmark.order`); no search box
- URL scheme: `http:` / `https:` only
- Theme: `light` | `dark` | `system`; solid background presets only (no free color picker)
- IndexBar: `icon` | `text` (vertical text); icon mode shows name on hover/selected
- Open default: new tab; user-configurable
- UI/motion: Apple Design skill — press feedback on pointer-down, interruptible springs, translucent chrome, `prefers-reduced-motion` / `prefers-reduced-transparency`
- Minimize host permissions; prefer tab-provided favicon URLs
- Firefox adapter structure reserved; do not ship Firefox in v1
- Ignore prior visual-MVP docs for acceptance; greenfield product code

---

## File structure

```
package.json
tsconfig.json
tsconfig.node.json
vite.config.ts
vitest.config.ts
manifest.config.ts
index.html                    # CRX entry redirect / unused if sidepanel has own html
icons/icon128.png             # existing placeholder OK
src/
  background/index.ts
  sidepanel/
    index.html
    main.ts
    App.vue
    styles/
      tokens.css
      base.css
    components/
      AppHeader.vue
      BookmarkList.vue
      BookmarkRow.vue
      GroupSection.vue
      IndexBar.vue
      AddSheet.vue
      EditBookmarkSheet.vue
      GroupEditorSheet.vue
      SettingsView.vue
      ToastHost.vue
      StorageBanner.vue
    composables/
      useTheme.ts
      useReducedMotion.ts
      useDragReorder.ts
      useToast.ts
    stores/
      favorites.ts
  shared/
    types.ts
    defaults.ts
    ids.ts
    validation.ts
    order.ts
    indexBar.ts
    theme.ts
    backgrounds.ts
    storage/
      keys.ts
      migrate.ts
      repository.ts
    browser/
      types.ts
      chromium.ts
      index.ts
tests/
  shared/
    validation.test.ts
    defaults.test.ts
    migrate.test.ts
    order.test.ts
    domain.test.ts
    theme.test.ts
    indexBar.test.ts
docs/superpowers/specs/2026-07-24-favorites-sidepanel-design.md
```

Build output: `dist/` (load unpacked).

---

### Task 1: Scaffold Vite + Vue + CRX + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `manifest.config.ts`, `src/sidepanel/index.html`, `src/sidepanel/main.ts`, `src/sidepanel/App.vue`, `src/background/index.ts`, `.gitignore` (extend if needed)
- Keep: `icons/icon128.png`

**Interfaces:**
- Consumes: none
- Produces: `npm run build` → loadable `dist/`; `npm test` runs Vitest; `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` in background

- [ ] **Step 1: Initialize package.json and install deps**

```bash
cd D:/TabExtension
npm init -y
npm install vue pinia motion
npm install -D vite typescript vue-tsc @vitejs/plugin-vue @crxjs/vite-plugin vitest @vue/test-utils jsdom @types/chrome @types/node
```

Ensure `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "type": "module"
}
```

- [ ] **Step 2: Add TypeScript + Vite + Vitest + manifest config**

`tsconfig.json` — strict, `paths`: `@/*` → `src/*`.

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: { outDir: 'dist', emptyOutDir: true },
})
```

`manifest.config.ts`:

```ts
import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '收藏',
  description: 'Side Panel favorites manager',
  version: '0.1.0',
  action: { default_title: '收藏', default_icon: 'icons/icon128.png' },
  icons: { '128': 'icons/icon128.png' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  permissions: ['sidePanel', 'storage', 'tabs'],
})
```

`vitest.config.ts`: environment `jsdom`, alias `@` same as Vite, `include: ['tests/**/*.test.ts']`.

- [ ] **Step 3: Minimal Side Panel + background**

`src/background/index.ts`:

```ts
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error(err))
```

`src/sidepanel/index.html` — mounts `#app`.  
`src/sidepanel/main.ts` — `createApp(App).use(createPinia()).mount('#app')`.  
`src/sidepanel/App.vue` — temporary `<h1>收藏</h1>` only.

- [ ] **Step 4: Build and smoke-load**

```bash
npm run build
```

Expected: `dist/` contains manifest + sidepanel + background; no TS errors.

Manual: Chrome → Extensions → Load unpacked → `dist` → click action → Side Panel shows「收藏」.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts manifest.config.ts src/background/index.ts src/sidepanel/index.html src/sidepanel/main.ts src/sidepanel/App.vue .gitignore
git commit -m "chore: scaffold Vite Vue CRX extension"
```

---

### Task 2: Shared types, defaults, ids, validation

**Files:**
- Create: `src/shared/types.ts`, `src/shared/defaults.ts`, `src/shared/ids.ts`, `src/shared/validation.ts`
- Test: `tests/shared/validation.test.ts`, `tests/shared/defaults.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - Types: `BookmarkItem`, `Group`, `Settings`, `StorageRoot`, `ThemeMode`, `IndexBarMode`
  - `STORAGE_VERSION = 1`
  - `createDefaultRoot(): StorageRoot`
  - `createId(): string`
  - `normalizeUrl(input: string): { ok: true; url: string } | { ok: false; error: string }`
  - `normalizeTitle(title: string, fallback: string): string`
  - `normalizeGroupName(name: string, existing: string[], selfId?: string): { ok: true; name: string } | { ok: false; error: string }`

- [ ] **Step 1: Write failing tests**

`tests/shared/defaults.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createDefaultRoot, STORAGE_VERSION } from '@/shared/defaults'

describe('createDefaultRoot', () => {
  it('has version 1, one default group named 收藏, empty bookmarks, default settings', () => {
    const root = createDefaultRoot()
    expect(root.version).toBe(STORAGE_VERSION)
    expect(root.groups).toHaveLength(1)
    expect(root.groups[0].isDefault).toBe(true)
    expect(root.groups[0].name).toBe('收藏')
    expect(root.bookmarks).toEqual([])
    expect(root.settings).toEqual({
      openInNewTab: true,
      indexBarMode: 'icon',
      themeMode: 'system',
      backgroundId: 'neutral',
    })
  })
})
```

`tests/shared/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeUrl, normalizeTitle, normalizeGroupName } from '@/shared/validation'

describe('normalizeUrl', () => {
  it('accepts https urls', () => {
    expect(normalizeUrl('https://example.com/a')).toEqual({
      ok: true,
      url: 'https://example.com/a',
    })
  })
  it('rejects chrome: and empty', () => {
    expect(normalizeUrl('chrome://extensions').ok).toBe(false)
    expect(normalizeUrl('').ok).toBe(false)
  })
  it('prepends https for bare domains', () => {
    const r = normalizeUrl('example.com')
    expect(r).toEqual({ ok: true, url: 'https://example.com/' })
  })
})

describe('normalizeTitle', () => {
  it('trims or uses fallback', () => {
    expect(normalizeTitle('  Hi  ', 'x')).toBe('Hi')
    expect(normalizeTitle('   ', 'fallback')).toBe('fallback')
  })
})

describe('normalizeGroupName', () => {
  it('rejects empty and duplicates', () => {
    expect(normalizeGroupName('  ', ['收藏']).ok).toBe(false)
    expect(normalizeGroupName('工作', ['工作']).ok).toBe(false)
  })
  it('allows rename of self', () => {
    expect(normalizeGroupName('工作', ['工作'], 'g1')).toEqual({ ok: true, name: '工作' })
  })
})
```

For duplicate-self: `normalizeGroupName` signature must exclude `selfId` from the duplicate check by filtering `existing` in the caller **or** accept `existingNamesExcludingSelf`. Implement as:

```ts
normalizeGroupName(name: string, otherNames: string[]): ...
```

and tests pass `otherNames` without self. Adjust test "allows rename of self" to:

```ts
expect(normalizeGroupName('工作', [])).toEqual({ ok: true, name: '工作' })
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test
```

Expected: FAIL module not found / export missing.

- [ ] **Step 3: Implement types + defaults + ids + validation**

`src/shared/types.ts` — exact fields from spec (`BookmarkItem`, `Group` with `isDefault`, `Settings`, `StorageRoot`).

`src/shared/ids.ts`:

```ts
export function createId(): string {
  return crypto.randomUUID()
}
```

`src/shared/defaults.ts` — `STORAGE_VERSION = 1`, `createDefaultRoot()` using `createId()`, default group icon e.g. `'⭐'`, `backgroundId: 'neutral'`.

`src/shared/validation.ts` — implement `normalizeUrl` (try `new URL`, if no protocol try `https://`, allow only http/https), `normalizeTitle`, `normalizeGroupName(name, otherNames)`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/shared/defaults.ts src/shared/ids.ts src/shared/validation.ts tests/shared/validation.test.ts tests/shared/defaults.test.ts
git commit -m "feat: add shared types defaults and validation"
```

---

### Task 3: Storage migrate + repository

**Files:**
- Create: `src/shared/storage/keys.ts`, `src/shared/storage/migrate.ts`, `src/shared/storage/repository.ts`, `src/shared/browser/types.ts`
- Test: `tests/shared/migrate.test.ts`

**Interfaces:**
- Consumes: `StorageRoot`, `createDefaultRoot`, `STORAGE_VERSION`
- Produces:
  - `STORAGE_KEY = 'favorites.root'`
  - `BACKUP_KEY = 'favorites.root._backup'`
  - `migrate(raw: unknown): { root: StorageRoot; repaired: boolean; backedUp: boolean }`
  - `createRepository(getStorageArea: () => StorageAreaLike): FavoritesRepository`
  - `FavoritesRepository`: `load(): Promise<StorageRoot>`, `save(root: StorageRoot): Promise<void>`
  - `StorageAreaLike`: `{ get(keys): Promise<Record<string, unknown>>, set(items): Promise<void> }`

- [ ] **Step 1: Write failing migrate tests**

```ts
import { describe, it, expect } from 'vitest'
import { migrate } from '@/shared/storage/migrate'
import { STORAGE_VERSION } from '@/shared/defaults'

describe('migrate', () => {
  it('returns default when raw is null', () => {
    const { root, repaired, backedUp } = migrate(null)
    expect(root.version).toBe(STORAGE_VERSION)
    expect(root.groups[0].isDefault).toBe(true)
    expect(repaired).toBe(false)
    expect(backedUp).toBe(false)
  })

  it('passes through valid v1 root', () => {
    const raw = migrate(null).root
    const again = migrate(raw)
    expect(again.root).toEqual(raw)
    expect(again.backedUp).toBe(false)
  })

  it('backs up and resets on irreparable payload', () => {
    const { root, backedUp, repaired } = migrate({ version: 999, nonsense: true })
    expect(backedUp).toBe(true)
    expect(repaired).toBe(true)
    expect(root.groups[0].isDefault).toBe(true)
  })

  it('repairs missing default group by creating one', () => {
    const base = migrate(null).root
    base.groups = [{ id: 'g1', name: '工作', icon: '📁', order: 0, isDefault: false }]
    const { root, repaired } = migrate(base)
    expect(repaired).toBe(true)
    expect(root.groups.filter((g) => g.isDefault)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- tests/shared/migrate.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement migrate + repository**

`migrate.ts`:
- If `raw == null` → `createDefaultRoot()`
- If object with `version === 1` and structurally valid (array groups/bookmarks, settings object, exactly one default after repair) → return normalized root
- If groups have zero defaults → insert default group, set `repaired: true`
- If multiple defaults → keep first as default, clear others’ `isDefault`, `repaired: true`
- Reassign bookmarks with missing `groupId` to default group
- If `version` unknown / not object → `{ root: createDefaultRoot(), repaired: true, backedUp: true }`

`repository.ts`:

```ts
export function createRepository(area: StorageAreaLike) {
  return {
    async load() {
      const data = await area.get([STORAGE_KEY])
      const { root, backedUp } = migrate(data[STORAGE_KEY])
      if (backedUp) {
        await area.set({
          [BACKUP_KEY]: data[STORAGE_KEY] ?? null,
          [STORAGE_KEY]: root,
        })
      } else if (data[STORAGE_KEY] == null) {
        await area.set({ [STORAGE_KEY]: root })
      }
      return root
    },
    async save(root: StorageRoot) {
      await area.set({ [STORAGE_KEY]: root })
    },
  }
}
```

Also persist when `repaired` without backup if you choose — at minimum always `save` after repair in `load`.

- [ ] **Step 4: Run tests — PASS**

```bash
npm test -- tests/shared/migrate.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/shared/storage tests/shared/migrate.test.ts src/shared/browser/types.ts
git commit -m "feat: add storage migrate and repository"
```

---

### Task 4: Domain operations (groups, bookmarks, order)

**Files:**
- Create: `src/shared/order.ts`, `src/shared/domain.ts`
- Test: `tests/shared/order.test.ts`, `tests/shared/domain.test.ts`

**Interfaces:**
- Consumes: `StorageRoot`, `createId`, validators
- Produces pure functions (no chrome):
  - `sortGroups(groups: Group[]): Group[]`
  - `sortBookmarksInGroup(bookmarks: BookmarkItem[], groupId: string): BookmarkItem[]`
  - `reindexOrders<T extends { order: number }>(items: T[]): T[]`
  - `addBookmark(root, input: { title; url; faviconUrl?; groupId }): StorageRoot`
  - `updateBookmark(root, id, patch): StorageRoot`
  - `deleteBookmark(root, id): StorageRoot`
  - `addGroup(root, input: { name; icon }): StorageRoot`
  - `updateGroup(root, id, patch: { name?; icon? }): StorageRoot`
  - `deleteGroup(root, id): StorageRoot` — throws or returns `{ ok:false }` if default
  - `reorderGroups(root, orderedIds: string[]): StorageRoot`
  - `moveBookmark(root, bookmarkId, toGroupId, toIndex: number): StorageRoot`

- [ ] **Step 1: Write failing domain tests**

```ts
import { describe, it, expect } from 'vitest'
import { createDefaultRoot } from '@/shared/defaults'
import {
  addBookmark,
  addGroup,
  deleteGroup,
  moveBookmark,
  reorderGroups,
  updateGroup,
} from '@/shared/domain'

describe('domain', () => {
  it('adds bookmark into default group', () => {
    let root = createDefaultRoot()
    const gid = root.groups[0].id
    root = addBookmark(root, {
      title: 'GitHub',
      url: 'https://github.com',
      groupId: gid,
    })
    expect(root.bookmarks).toHaveLength(1)
    expect(root.bookmarks[0].groupId).toBe(gid)
  })

  it('refuses deleting default group', () => {
    const root = createDefaultRoot()
    expect(() => deleteGroup(root, root.groups[0].id)).toThrow(/default/i)
  })

  it('moves bookmarks to default when deleting custom group', () => {
    let root = createDefaultRoot()
    root = addGroup(root, { name: '工作', icon: '💼' })
    const work = root.groups.find((g) => g.name === '工作')!
    root = addBookmark(root, {
      title: 'A',
      url: 'https://a.com',
      groupId: work.id,
    })
    root = deleteGroup(root, work.id)
    expect(root.groups.every((g) => g.name !== '工作')).toBe(true)
    expect(root.bookmarks[0].groupId).toBe(root.groups.find((g) => g.isDefault)!.id)
  })

  it('reorders groups and moves bookmark across groups', () => {
    let root = createDefaultRoot()
    root = addGroup(root, { name: '学习', icon: '📚' })
    const def = root.groups.find((g) => g.isDefault)!
    const learn = root.groups.find((g) => g.name === '学习')!
    root = addBookmark(root, { title: 'MDN', url: 'https://developer.mozilla.org', groupId: def.id })
    const id = root.bookmarks[0].id
    root = reorderGroups(root, [learn.id, def.id])
    expect(root.groups.map((g) => g.id)).toEqual([learn.id, def.id])
    root = moveBookmark(root, id, learn.id, 0)
    expect(root.bookmarks[0].groupId).toBe(learn.id)
  })

  it('renames default group', () => {
    let root = createDefaultRoot()
    root = updateGroup(root, root.groups[0].id, { name: '常用' })
    expect(root.groups[0].name).toBe('常用')
    expect(root.groups[0].isDefault).toBe(true)
  })
})
```

Add `order.test.ts` for `reindexOrders` producing `0..n-1`.

- [ ] **Step 2: Run — FAIL**

```bash
npm test -- tests/shared/domain.test.ts tests/shared/order.test.ts
```

- [ ] **Step 3: Implement `order.ts` + `domain.ts`**

All functions return a **new** `StorageRoot` (immutable updates).  
`addBookmark` / `addGroup` validate via `normalizeUrl` / `normalizeGroupName` and throw `Error` with message on failure (store will map to UI errors).  
`deleteGroup`: if `isDefault` throw; else move bookmarks to default, append after existing default-group bookmarks with reindexed `order`, remove group, reindex group orders.

- [ ] **Step 4: Run — PASS**

```bash
npm test -- tests/shared/domain.test.ts tests/shared/order.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/shared/order.ts src/shared/domain.ts tests/shared/order.test.ts tests/shared/domain.test.ts
git commit -m "feat: add favorites domain operations"
```

---

### Task 5: Theme resolution, backgrounds, IndexBar helpers

**Files:**
- Create: `src/shared/theme.ts`, `src/shared/backgrounds.ts`, `src/shared/indexBar.ts`
- Test: `tests/shared/theme.test.ts`, `tests/shared/indexBar.test.ts`

**Interfaces:**
- Consumes: `Group`, `ThemeMode`, `Settings`
- Produces:
  - `resolveTheme(mode: ThemeMode, system: 'light' | 'dark'): 'light' | 'dark'`
  - `BACKGROUND_PRESETS: { id: string; label: string; light: string; dark: string }[]` — ids include `neutral`, `warm`, `cool`, `blue`, `green` (5 presets)
  - `getBackgroundColor(backgroundId: string, resolved: 'light' | 'dark'): string`
  - `buildIndexBarAnchors(groups: Group[]): { id: string; name: string; icon: string }[]` — sorted by `order`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { resolveTheme } from '@/shared/theme'
import { buildIndexBarAnchors } from '@/shared/indexBar'
import { getBackgroundColor, BACKGROUND_PRESETS } from '@/shared/backgrounds'

describe('resolveTheme', () => {
  it('maps system to OS', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
    expect(resolveTheme('light', 'dark')).toBe('light')
  })
})

describe('backgrounds', () => {
  it('has at least 4 presets and resolves colors', () => {
    expect(BACKGROUND_PRESETS.length).toBeGreaterThanOrEqual(4)
    expect(getBackgroundColor('neutral', 'light')).toMatch(/^#/)
  })
})

describe('buildIndexBarAnchors', () => {
  it('orders by group.order', () => {
    const anchors = buildIndexBarAnchors([
      { id: 'b', name: 'B', icon: '🅱️', order: 1, isDefault: false },
      { id: 'a', name: 'A', icon: '🅰️', order: 0, isDefault: true },
    ])
    expect(anchors.map((a) => a.id)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run — FAIL; Step 3: implement; Step 4: PASS**

Choose solid hex pairs with readable contrast (e.g. neutral light `#F2F2F7`, dark `#1C1C1E`).

- [ ] **Step 5: Commit**

```bash
git add src/shared/theme.ts src/shared/backgrounds.ts src/shared/indexBar.ts tests/shared/theme.test.ts tests/shared/indexBar.test.ts
git commit -m "feat: add theme backgrounds and index bar helpers"
```

---

### Task 6: Chromium browser adapter

**Files:**
- Create: `src/shared/browser/chromium.ts`, `src/shared/browser/index.ts`
- Modify: `src/shared/browser/types.ts` (if needed)

**Interfaces:**
- Consumes: `StorageAreaLike`
- Produces:
  - `getBrowser(): BrowserAdapter`
  - `BrowserAdapter`:
    - `storage: StorageAreaLike` (wraps `chrome.storage.local` promise API)
    - `getActiveTab(): Promise<{ title: string; url: string; favIconUrl?: string } | null>`
    - `openUrl(url: string, opts: { newTab: boolean }): Promise<void>`
  - Special pages (`chrome:`, `edge:`, `about:`, `devtools:`) → `getActiveTab` returns `null`

- [ ] **Step 1: Implement adapter (no unit test for chrome APIs; keep pure URL check testable)**

Extract:

```ts
export function isRestrictedTabUrl(url: string | undefined): boolean {
  if (!url) return true
  return /^(chrome|edge|about|devtools|chrome-extension):/i.test(url)
}
```

Add a tiny test in `tests/shared/validation.test.ts` or `tests/shared/browser.test.ts` for `isRestrictedTabUrl`.

`chromium.ts` implements promises around `chrome.storage.local`, `chrome.tabs.query({ active: true, currentWindow: true })`, `chrome.tabs.create` / `chrome.tabs.update`.

`index.ts`:

```ts
export function getBrowser() {
  return createChromiumAdapter()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/browser tests/shared/browser.test.ts
git commit -m "feat: add chromium browser adapter"
```

---

### Task 7: Pinia favorites store + wire load/save

**Files:**
- Create: `src/sidepanel/stores/favorites.ts`, `src/sidepanel/composables/useToast.ts`
- Modify: `src/sidepanel/main.ts`, `src/sidepanel/App.vue`

**Interfaces:**
- Consumes: repository, domain functions, `getBrowser`
- Produces store API:
  - `load()`, `root` state, `storageError: string | null`, `retryLoad()`
  - wrappers: `addBookmark`, `updateBookmark`, `deleteBookmark`, `addGroup`, `updateGroup`, `deleteGroup`, `reorderGroups`, `moveBookmark`, `patchSettings`
  - each mutation: apply domain → `save` → on failure set `storageError` and keep last good in-memory root
  - `openBookmark(id)`, `fetchActiveTab()`

- [ ] **Step 1: Implement store**

```ts
// favorites.ts — sketch
export const useFavoritesStore = defineStore('favorites', () => {
  const root = ref<StorageRoot | null>(null)
  const storageError = ref<string | null>(null)
  const repo = createRepository(getBrowser().storage)

  async function load() { /* repo.load, assign root, clear/set error */ }
  async function persist(next: StorageRoot) {
    const prev = root.value
    root.value = next
    try {
      await repo.save(next)
      storageError.value = null
    } catch {
      root.value = prev
      storageError.value = '保存失败'
      throw new Error('save failed')
    }
  }
  // domain wrappers call persist(...)
  return { root, storageError, load, /* ... */ }
})
```

- [ ] **Step 2: App.vue onMounted `store.load()`; show StorageBanner when `storageError`**

Minimal banner component with Retry calling `retryLoad` / last failed save retry.

- [ ] **Step 3: Manual** — build, add a temporary button that `addBookmark`s one item, reload panel, confirm persistence.

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/stores/favorites.ts src/sidepanel/composables/useToast.ts src/sidepanel/App.vue src/sidepanel/components/StorageBanner.vue
git commit -m "feat: add pinia favorites store with persistence"
```

---

### Task 8: Side Panel shell — header, list, open bookmark, tokens

**Files:**
- Create: `src/sidepanel/styles/tokens.css`, `src/sidepanel/styles/base.css`, `src/sidepanel/components/AppHeader.vue`, `BookmarkList.vue`, `BookmarkRow.vue`, `GroupSection.vue`, `ToastHost.vue`
- Modify: `App.vue`, `main.ts` (import CSS)

**Interfaces:**
- Consumes: store `root`, `openBookmark`
- Produces: list UI grouped by `sortGroups` / per-group bookmarks; row click opens; `:active` scale `0.97` / 100ms on pressable controls

- [ ] **Step 1: tokens.css**

CSS variables for light/dark text, translucent header (`backdrop-filter: blur(20px) saturate(180%)`), spacing, system font stack:

```css
:root {
  font: 100%/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
  --header-bg: rgba(255, 255, 255, 0.6);
  /* dark overrides via [data-theme='dark'] */
}
```

Wire later to theme in Task 11; for now hardcode light tokens + `data-theme` hooks.

- [ ] **Step 2: Build list components**

`GroupSection` — sticky/translucent group header with icon + name.  
`BookmarkRow` — favicon (img or placeholder), title, hostname via `new URL(url).hostname`, `@pointerdown` press class, click → `openBookmark`.  
Empty state: short copy「还没有收藏」.

- [ ] **Step 3: AppHeader** — title「收藏」, `+` button (disabled until Task 9 wires sheet — emit `add`).

- [ ] **Step 4: Manual verify list after seeding via store in console or temporary seed.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/styles src/sidepanel/components/AppHeader.vue src/sidepanel/components/BookmarkList.vue src/sidepanel/components/BookmarkRow.vue src/sidepanel/components/GroupSection.vue src/sidepanel/components/ToastHost.vue src/sidepanel/App.vue
git commit -m "feat: add side panel list shell and tokens"
```

---

### Task 9: Add sheet — current tab + manual

**Files:**
- Create: `src/sidepanel/components/AddSheet.vue`
- Modify: `AppHeader.vue`, `App.vue`, store if needed

**Interfaces:**
- Consumes: `fetchActiveTab()`, `addBookmark`, groups list
- Produces: sheet UI with two modes; inline URL errors; disable current-tab when `null` with reason text「当前页面无法收藏」

- [ ] **Step 1: Implement AddSheet**

- Overlay + panel anchored visually under `+` (`transform-origin` top-right)
- Enter/exit: spring via `motion` (`bounce: 0`, duration ~0.35); if `prefers-reduced-motion`, opacity cross-fade only (`useReducedMotion` stub OK — full in Task 12)
- Fields: title, url, group `<select>`
- Actions: 「收藏当前页」fills fields from `fetchActiveTab`; 「添加」submits
- On success: close sheet, toast「已添加」

- [ ] **Step 2: Manual QA** — normal https page; `chrome://extensions` disables current; bad URL keeps sheet open.

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/components/AddSheet.vue src/sidepanel/App.vue src/sidepanel/composables/useReducedMotion.ts
git commit -m "feat: add bookmark create sheet"
```

---

### Task 10: Edit / delete bookmarks + group editor

**Files:**
- Create: `EditBookmarkSheet.vue`, `GroupEditorSheet.vue`
- Modify: `BookmarkRow.vue`, `GroupSection.vue`, `App.vue`, toast composable

**Interfaces:**
- Consumes: `updateBookmark`, `deleteBookmark`, `addGroup`, `updateGroup`, `deleteGroup`
- Produces: row long-press or trailing 「⋯」 opens edit; delete → remove + toast with Undo (re-`addBookmark` snapshot) for ~5s; group header ⋯ → rename/icon/delete (delete hidden/disabled for default with explanation)

- [ ] **Step 1: Edit bookmark sheet** — title, url, group; save/delete.

- [ ] **Step 2: Group editor** — name, emoji icon input (text field for v1); create group entry from header menu 「新建分组」.

- [ ] **Step 3: Undo toast** for bookmark delete only.

- [ ] **Step 4: Manual QA** — rename default; cannot delete default; delete custom moves bookmarks.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/components/EditBookmarkSheet.vue src/sidepanel/components/GroupEditorSheet.vue src/sidepanel/components/BookmarkRow.vue src/sidepanel/components/GroupSection.vue src/sidepanel/App.vue
git commit -m "feat: edit delete bookmarks and manage groups"
```

---

### Task 11: IndexBar + settings (theme, background, open mode, index mode)

**Files:**
- Create: `IndexBar.vue`, `SettingsView.vue`, `composables/useTheme.ts`
- Modify: `App.vue`, `tokens.css`, store `patchSettings`

**Interfaces:**
- Consumes: `buildIndexBarAnchors`, `resolveTheme`, `BACKGROUND_PRESETS`, `settings`
- Produces:
  - IndexBar jump scrolls to `[data-group-id=...]`
  - text mode: `writing-mode: vertical-rl` (or vertical upright letters)
  - icon mode: icon only; hover/selected shows name tooltip beside bar
  - Settings view toggles all settings; `useTheme` sets `data-theme` and `--app-bg` from preset

- [ ] **Step 1: useTheme** — watch `themeMode` + `matchMedia('(prefers-color-scheme: dark)')`; apply `document.documentElement.dataset.theme`; set background from `getBackgroundColor`.

- [ ] **Step 2: IndexBar.vue** — always visible; modes from settings.

- [ ] **Step 3: SettingsView.vue** — navigated from header gear; controls:
  - openInNewTab
  - indexBarMode
  - themeMode segmented: 浅色 / 暗色 / 跟随系统
  - background preset grid (swatches)

- [ ] **Step 4: Manual QA** — system theme flip; both IndexBar modes; backgrounds; open new vs current tab.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/components/IndexBar.vue src/sidepanel/components/SettingsView.vue src/sidepanel/composables/useTheme.ts src/sidepanel/styles/tokens.css src/sidepanel/App.vue
git commit -m "feat: add IndexBar and settings theme backgrounds"
```

---

### Task 12: Drag reorder + motion polish

**Files:**
- Create: `composables/useDragReorder.ts`
- Modify: `BookmarkList.vue`, `GroupSection.vue`, `BookmarkRow.vue`, sheets for motion consistency

**Interfaces:**
- Consumes: `reorderGroups`, `moveBookmark`
- Produces: pointer-capture drag for bookmark rows (within/across sections) and group headers; 1:1 tracking; rubber-band at list edges; on release call store with target index; springs interruptible; reduced-motion skips travel animation

- [ ] **Step 1: useDragReorder**

Implement pointerdown → setPointerCapture → track Y with grab offset → hysteresis ~10px → emit preview index → pointerup → commit. Do not use CSS transitions for the dragged element position.

- [ ] **Step 2: Integrate** — dropping on another `GroupSection` calls `moveBookmark(id, groupId, index)`; dragging group header calls `reorderGroups(newOrder)`.

- [ ] **Step 3: Polish** — header blur scroll-edge fade; press states; reduced transparency media query solidifies header.

- [ ] **Step 4: Manual QA** — reorder bookmarks across groups; reorder groups; flick feel; reduced-motion OS setting.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/composables/useDragReorder.ts src/sidepanel/components/BookmarkList.vue src/sidepanel/components/GroupSection.vue src/sidepanel/components/BookmarkRow.vue src/sidepanel/styles
git commit -m "feat: drag reorder with apple-style motion polish"
```

---

### Task 13: Final verification + README

**Files:**
- Create: `README.md`
- Modify: none unless bugfixes

**Interfaces:**
- Consumes: all prior tasks
- Produces: documented load steps; checklist matching spec acceptance

- [ ] **Step 1: Run full unit suite**

```bash
npm test
npm run build
```

Expected: all tests PASS; build succeeds.

- [ ] **Step 2: Manual acceptance checklist** (tick in PR/commit message or README)

1. Load unpacked `dist` in Chrome/Edge — no errors  
2. Action opens Side Panel  
3. Add current + manual; edit; delete (+ undo); open per settings  
4. Default group renameable, not deletable; custom groups + icons  
5. Drag order groups + bookmarks  
6. IndexBar icon/text + jump + hover name  
7. Theme light/dark/system + solid backgrounds  
8. Persist across reload  
9. `chrome://` cannot save current page  

- [ ] **Step 3: Write README** — install, `npm run dev` / `build`, load `dist`, permissions note.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add extension README and verify v1"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| MV3 Side Panel + action open | 1 |
| Vite + TS + Vue + Pinia | 1, 7 |
| Types + default group + settings | 2 |
| `chrome.storage.local` + migrate/backup | 3 |
| CRUD bookmarks/groups + move on delete | 4, 10 |
| Manual order / cross-group move | 4, 12 |
| Validation http(s), titles, group names | 2, 9 |
| Theme + backgrounds | 5, 11 |
| IndexBar icon/text | 5, 11 |
| Add current + manual | 6, 9 |
| Open new/current tab | 6, 11 |
| Restricted tab handling | 6, 9 |
| Storage error banner | 7 |
| Apple motion / reduced-motion | 9, 12 |
| Unit tests listed in spec | 2–5 |
| Manual QA | 13 |
| No sync / search / Firefox ship | Global constraints / omitted |

**Ambiguity fixed in plan:** IndexBar not used as drag handle; group drag via section headers; 5 named background presets; undo toast for bookmark delete; emoji text field for icons in v1.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-07-24-favorites-sidepanel.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
