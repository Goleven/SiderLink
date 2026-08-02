import { sortBookmarksInGroup, sortGroups } from './domain'
import type { BookmarkItem, Group } from './types'

export const SEARCH_RESULT_LIMIT = 5

/** Side-panel Spotlight: empty → []; title hits before url-only; cap 5. */
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

/** Flatten bookmarks in side-panel group/bookmark order. */
export function listBookmarksSideOrder(
  groups: Group[],
  bookmarks: BookmarkItem[],
): BookmarkItem[] {
  const result: BookmarkItem[] = []
  for (const g of sortGroups(groups)) {
    result.push(...sortBookmarksInGroup(bookmarks, g.id))
  }
  return result
}

/**
 * Global search popup: empty query returns `ordered` as-is;
 * otherwise title/url contains match, preserving input order, no cap.
 */
export function filterBookmarksOrdered(
  query: string,
  ordered: BookmarkItem[],
): BookmarkItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return ordered

  return ordered.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q),
  )
}
