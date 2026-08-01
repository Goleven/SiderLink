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
