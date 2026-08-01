# Bookmark Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Spotlight-style search overlay so users can find any bookmark by title/URL and open it without changing group-list interaction.

**Architecture:** Pure `filterBookmarks` in shared (match + stable order + cap 5). `SearchOverlay.vue` owns query UI, keyboard nav, and empty states. `App.vue` owns visibility + global shortcuts. `IndexBar` gains a search action beside settings/add. Visuals follow Apple Design (scrim + elevated panel, pressable, reduced-motion cross-fade) using existing tokens.

**Tech Stack:** Vue 3 SFC, Pinia favorites store, vue-i18n, Vitest, existing `AppIcon` / sheet overlay patterns, Motion only if already used for similar sheets (prefer CSS/opacity for reduced-motion).

**Spec:** [`docs/superpowers/specs/2026-08-01-bookmark-search-design.md`](../specs/2026-08-01-bookmark-search-design.md)

## Global Constraints

- Search all bookmarks; match `title` + `url` only (case-insensitive substring)
- Max **5** results; silent cap; no truncation hint; no query history
- Empty query → no result rows (hint only); do not list all bookmarks
- Open via `store.openBookmark(id)`; then close overlay; honor `openInNewTab`
- Closing must not change `selectedGroupId` or list scroll
- Entry: IndexBar search icon + `/` + `⌘/Ctrl+K` when focus is not in an editable field
- UI owned by Apple Design principles (response, materials, spatial consistency, familiarity, simplicity)
- No pinyin/fuzzy, no edit/delete from results, no `chrome.commands`

## File map

| File | Role |
|------|------|
| Create `src/shared/searchBookmarks.ts` | `SEARCH_RESULT_LIMIT`, `filterBookmarks` |
| Create `tests/shared/searchBookmarks.test.ts` | Unit tests for matching/order/cap |
| Create `src/sidepanel/components/SearchOverlay.vue` | Overlay UI + keyboard |
| Modify `src/sidepanel/components/IndexBar.vue` | Search action emit |
| Modify `src/sidepanel/App.vue` | `showSearch`, shortcuts, mount overlay |
| Modify `src/shared/i18n/messages/{en,zh-CN,zh-TW,ja}.ts` | `search.*` + `a11y.search` |

---

### Task 1: `filterBookmarks` (TDD)

**Files:**
- Create: `src/shared/searchBookmarks.ts`
- Test: `tests/shared/searchBookmarks.test.ts`

**Interfaces:**
- Consumes: `BookmarkItem` from `src/shared/types.ts`
- Produces:
  - `export const SEARCH_RESULT_LIMIT = 5`
  - `export function filterBookmarks(query: string, bookmarks: BookmarkItem[]): BookmarkItem[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import type { BookmarkItem } from '@/shared/types'
import { filterBookmarks, SEARCH_RESULT_LIMIT } from '@/shared/searchBookmarks'

function bm(
  partial: Pick<BookmarkItem, 'id' | 'title' | 'url'> &
    Partial<BookmarkItem>,
): BookmarkItem {
  return {
    groupId: 'g1',
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

describe('filterBookmarks', () => {
  const list = [
    bm({ id: '1', title: 'GitHub', url: 'https://github.com' }),
    bm({ id: '2', title: 'Docs', url: 'https://example.com/github-guide' }),
    bm({ id: '3', title: 'Other', url: 'https://other.test' }),
    bm({ id: '4', title: 'Alpha', url: 'https://a.test' }),
    bm({ id: '5', title: 'Beta', url: 'https://b.test' }),
    bm({ id: '6', title: 'Gamma Git', url: 'https://c.test' }),
  ]

  it('returns empty for blank query', () => {
    expect(filterBookmarks('  ', list)).toEqual([])
  })

  it('matches title and url case-insensitively', () => {
    expect(filterBookmarks('github', list).map((b) => b.id)).toEqual(['1', '2'])
  })

  it('prefers title hits before url-only hits; preserves input order within tier', () => {
    // title: '1' GitHub, '6' Gamma Git; url-only: '2' …/github-guide
    expect(filterBookmarks('git', list).map((b) => b.id)).toEqual(['1', '6', '2'])
  })

  it(`caps at ${SEARCH_RESULT_LIMIT}`, () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      bm({ id: String(i), title: `Item ${i}`, url: `https://x.test/${i}` }),
    )
    expect(filterBookmarks('item', many)).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/shared/searchBookmarks.test.ts`

Expected: FAIL (module not found / export missing)

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/searchBookmarks.ts
import type { BookmarkItem } from './types'

export const SEARCH_RESULT_LIMIT = 5

export function filterBookmarks(
  query: string,
  bookmarks: BookmarkItem[],
): BookmarkItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const titleHits: BookmarkItem[] = []
  const urlOnlyHits: BookmarkItem[] = []

  for (const item of bookmarks) {
    const titleMatch = item.title.toLowerCase().includes(q)
    const urlMatch = item.url.toLowerCase().includes(q)
    if (titleMatch) titleHits.push(item)
    else if (urlMatch) urlOnlyHits.push(item)
  }

  return [...titleHits, ...urlOnlyHits].slice(0, SEARCH_RESULT_LIMIT)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/shared/searchBookmarks.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/searchBookmarks.ts tests/shared/searchBookmarks.test.ts
git commit -m "$(cat <<'EOF'
Add filterBookmarks helper with silent 5-result cap.

EOF
)"
```

---

### Task 2: i18n strings

**Files:**
- Modify: `src/shared/i18n/messages/en.ts`
- Modify: `src/shared/i18n/messages/zh-CN.ts`
- Modify: `src/shared/i18n/messages/zh-TW.ts`
- Modify: `src/shared/i18n/messages/ja.ts`

**Interfaces:**
- Consumes: existing `MessageSchema` from `en.ts`
- Produces keys used by later tasks:
  - `a11y.search`
  - `search.placeholder`
  - `search.emptyHint`
  - `search.noResults`

- [ ] **Step 1: Add English keys**

In `a11y`, after `add`:

```ts
search: 'Search',
```

Add new top-level namespace (near `add` / `common`):

```ts
search: {
  placeholder: 'Search bookmarks',
  emptyHint: 'Type to search',
  noResults: 'No matches',
},
```

- [ ] **Step 2: Mirror in zh-CN / zh-TW / ja**

| Key | zh-CN | zh-TW | ja |
|-----|-------|-------|-----|
| `a11y.search` | 搜索 | 搜尋 | 検索 |
| `search.placeholder` | 搜索收藏 | 搜尋收藏 | ブックマークを検索 |
| `search.emptyHint` | 输入关键词搜索 | 輸入關鍵字搜尋 | キーワードを入力 |
| `search.noResults` | 无匹配结果 | 無符合結果 | 一致する結果はありません |

- [ ] **Step 3: Typecheck messages**

Run: `pnpm exec vue-tsc --noEmit`

Expected: exit 0 (locale objects must match `MessageSchema`)

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/messages/en.ts src/shared/i18n/messages/zh-CN.ts src/shared/i18n/messages/zh-TW.ts src/shared/i18n/messages/ja.ts
git commit -m "$(cat <<'EOF'
Add i18n strings for bookmark search overlay.

EOF
)"
```

---

### Task 3: `SearchOverlay.vue`

**Files:**
- Create: `src/sidepanel/components/SearchOverlay.vue`

**Interfaces:**
- Consumes: `filterBookmarks` from `@/shared/searchBookmarks`; `BookmarkItem[]` via props; `useReducedMotion`; `AppIcon`; vue-i18n `search.*` / `a11y.search`
- Produces emits: `close`, `open: [id: string]`
- Props: `open: boolean`, `bookmarks: BookmarkItem[]`

- [ ] **Step 1: Create component scaffold**

Behavior requirements (implement fully in this task):

1. `v-if="open"` root overlay; `@click.self` → `emit('close')`
2. On `open` becoming true: `query = ''`, `highlightIndex = 0`, `nextTick` focus the input
3. `results = computed(() => filterBookmarks(query, bookmarks))`
4. Watch `results`: clamp `highlightIndex` to `0 .. results.length - 1` (or 0 if empty)
5. Keyboard on panel/input:
   - `Escape` → close
   - `ArrowDown` / `ArrowUp` → move highlight (wrap or clamp; prefer clamp)
   - `Enter` → if highlighted row exists, `emit('open', id)` (parent closes)
6. Row click → `emit('open', id)`
7. Empty query → show `t('search.emptyHint')`, no rows
8. Non-empty + zero results → `t('search.noResults')`
9. Row UI: favicon or earth fallback (same idea as `BookmarkRow` / `FaviconUrlField`), title + hostname secondary line
10. Apple Design: scrim `rgba(0,0,0,0.28)`; panel `background: var(--elevated); backdrop-filter: blur(20px)`; `.pressable` on rows; highlight row with subtle fill; `prefers-reduced-motion` / `useReducedMotion`: opacity cross-fade only (no large slide). Align panel near top of sidepanel (familiar Spotlight-ish), reuse AddSheet-like radius/padding tokens.

Hostname helper (local function, same as BookmarkRow):

```ts
function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
```

Props/emits skeleton:

```ts
const props = defineProps<{
  open: boolean
  bookmarks: BookmarkItem[]
}>()

const emit = defineEmits<{
  close: []
  open: [id: string]
}>()
```

Use `role="dialog"` and `:aria-label="t('a11y.search')"`. Input: `type="search"`, `:placeholder="t('search.placeholder')"`, `autocomplete="off"`.

- [ ] **Step 2: Manual smoke (dev)**

Run: `pnpm dev`, load extension side panel, temporarily mount overlay from App if needed — or complete Task 5 first for full wiring. If testing in isolation, skip to Task 4/5 then verify.

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/components/SearchOverlay.vue
git commit -m "$(cat <<'EOF'
Add SearchOverlay for bookmark quick-open.

EOF
)"
```

---

### Task 4: IndexBar search action

**Files:**
- Modify: `src/sidepanel/components/IndexBar.vue`

**Interfaces:**
- Consumes: `t('a11y.search')`, `AppIcon` name `search` (already in catalog)
- Produces: emit `search: []`

- [ ] **Step 1: Extend emits and dock items**

Add `SEARCH_ID = '__search'`.

Update emits:

```ts
const emit = defineEmits<{
  settings: []
  add: []
  search: []
  select: [id: string]
}>()
```

Insert search action **first** after the separator (before settings):

```ts
const dockItems = computed(() => [
  ...anchors.value.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    kind: 'group' as const,
  })),
  {
    id: SEARCH_ID,
    name: t('a11y.search'),
    icon: 'search' as const,
    kind: 'search' as const,
  },
  {
    id: SETTINGS_ID,
    name: t('a11y.settings'),
    icon: 'settings' as const,
    kind: 'settings' as const,
  },
  {
    id: ADD_ID,
    name: t('a11y.add'),
    icon: 'plus' as const,
    kind: 'add' as const,
  },
])
```

- [ ] **Step 2: Handle click**

In `onItemClick`:

```ts
if (item.kind === 'search') {
  emit('search')
  return
}
```

Ensure separator still inserts at `i === anchors.length` (first non-group item). No Dock math changes beyond one extra item in `itemEls`.

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/components/IndexBar.vue
git commit -m "$(cat <<'EOF'
Add IndexBar search action for bookmark overlay.

EOF
)"
```

---

### Task 5: Wire App + shortcuts

**Files:**
- Modify: `src/sidepanel/App.vue`

**Interfaces:**
- Consumes: `SearchOverlay`; IndexBar `@search`; `store.bookmarks`; `store.openBookmark`
- Produces: `showSearch` state; document keydown opener

- [ ] **Step 1: State + overlay mount**

```ts
import SearchOverlay from './components/SearchOverlay.vue'

const showSearch = ref(false)
```

Template (near other sheets):

```vue
<SearchOverlay
  :open="showSearch"
  :bookmarks="store.bookmarks"
  @close="showSearch = false"
  @open="onSearchOpen"
/>
```

```ts
async function onSearchOpen(id: string) {
  showSearch.value = false
  await store.openBookmark(id)
}
```

IndexBar:

```vue
<IndexBar
  ...
  @search="showSearch = true"
  @settings="showSettings = true"
  @add="showAdd = true"
/>
```

- [ ] **Step 2: Global shortcuts**

```ts
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function onSearchHotkey(e: KeyboardEvent) {
  if (showSearch.value) return
  if (showSettings.value) return
  if (isEditableTarget(e.target)) return

  const isSlash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey
  const isModK =
    (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey

  if (!isSlash && !isModK) return
  e.preventDefault()
  showSearch.value = true
}

onMounted(() => {
  // existing mount body…
  document.addEventListener('keydown', onSearchHotkey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onSearchHotkey)
})
```

Import `onUnmounted` from vue if not already imported.

When overlay is open, `/` and mod-K are no-ops (early return); Esc is handled inside `SearchOverlay`.

- [ ] **Step 3: Verify acceptance manually**

1. IndexBar search opens overlay, input focused, query cleared  
2. `/` and `⌘/Ctrl+K` open when focus is on the list (not in an input)  
3. Typing filters; at most 5 rows; empty / no-match copy  
4. Enter / click opens URL then closes; group selection unchanged  
5. Esc / scrim closes without scrolling jump  

- [ ] **Step 4: Typecheck + unit tests**

Run:

```bash
pnpm exec vitest run tests/shared/searchBookmarks.test.ts
pnpm exec vue-tsc --noEmit
```

Expected: all pass / exit 0

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/App.vue
git commit -m "$(cat <<'EOF'
Wire bookmark search overlay and keyboard shortcuts.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Match title + url, all bookmarks | Task 1 |
| Cap 5, silent | Task 1 |
| No history; clear on open | Task 3 |
| Empty query hint; no full list | Task 3 |
| Overlay open/close; keyboard nav | Task 3 |
| openBookmark then close | Task 5 |
| IndexBar search | Task 4 |
| `/` + ⌘/Ctrl+K, skip editable | Task 5 |
| Group/scroll unchanged | Task 5 (no selectedGroupId writes) |
| i18n four locales | Task 2 |
| Apple Design UI | Task 3 |

## Out of scope (do not implement)

- Query history, truncation footer, pagination  
- Pinyin / fuzzy ranking  
- Edit/delete/change group from results  
- `chrome.commands` global shortcut  
- Inline list filtering  
