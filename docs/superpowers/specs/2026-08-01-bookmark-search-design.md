# Bookmark search design (2026-08-01)

## Goals

Provide a fast way to find a saved bookmark and open its URL without changing the existing group-list interaction (IndexBar selection, list filter, scroll, drag/edit).

Search is a **side path**: Spotlight-style overlay, not an inline list filter.

## Scope

| In | Out |
|----|-----|
| Search all bookmarks | Query history / recent queries |
| Match `title` + `url` (incl. hostname) | Pinyin / tokenization / fuzzy rank |
| Max **5** results (silent cap) | Truncation hint, pagination |
| Open via existing `openBookmark` | Edit / delete / change group from results |
| IndexBar search control + `/` + `⌘/Ctrl+K` | Global `chrome.commands` (later optional) |

## Matching

Pure function (e.g. `filterBookmarks(query, bookmarks)` in shared):

1. Trim query; empty query → no result rows (prompt only; do not list all bookmarks).
2. Case-insensitive substring match on `title` and `url`.
3. Stable order: prefer title hits over url-only hits; within a tier keep existing bookmark order.
4. Return at most **5** items. No “narrow your query” footer.

No persistence of query text. Opening the overlay clears the previous query and focuses the input.

## Interaction

### Open

- IndexBar action (alongside settings / add), `search` icon.
- While the side panel document is focused and the active element is not editable (`input` / `textarea` / `contenteditable`): `/` and `⌘/Ctrl+K` open the overlay.
- When the overlay is already open, shortcuts that would re-open are no-ops (input already focused).

### Overlay

- Scrim + elevated panel; click scrim or `Esc` closes.
- Typing filters immediately.
- `↑` / `↓` move highlight; `Enter` opens highlighted row.
- Click row or `Enter` → `store.openBookmark(id)` (honors `openInNewTab`) → close overlay.
- Closing does not change `selectedGroupId` or list scroll position.

### Empty states

- Empty query: hint to type (no full list).
- Non-empty, zero matches: empty-results copy.

## Architecture

```
IndexBar / shortcuts → App (showSearch)
                         → SearchOverlay
                              → filterBookmarks(query, bookmarks) → ≤5 rows
                              → openBookmark(id) → close
```

| Unit | Responsibility |
|------|----------------|
| `filterBookmarks` | Match, order, cap at 5 |
| `SearchOverlay.vue` | UI, keyboard nav, empty states |
| `App.vue` | Overlay visibility, shortcut wiring |
| `IndexBar.vue` | Search action item |

Visual polish (spacing, motion) follows existing sheet/overlay patterns and Apple response/material guidance; not locked in this spec beyond scrim + elevated panel.

## i18n

Add keys under a `search` namespace in en / zh-CN / zh-TW / ja: a11y open label, placeholder, empty query hint, no results.

## Acceptance

1. IndexBar search, `/`, and `⌘/Ctrl+K` open the overlay and focus the field.
2. Matches title/url case-insensitively; at most 5 rows; no history; no truncation hint.
3. Activate result opens URL per `openInNewTab`, then closes overlay.
4. Esc / scrim close leaves group selection and list scroll unchanged.
5. Empty query does not list all bookmarks; no matches shows empty state.
6. Four locales updated.
