import { describe, it, expect } from 'vitest'
import type { BookmarkItem } from '@/shared/types'
import { filterBookmarks, SEARCH_RESULT_LIMIT } from '@/shared/searchBookmarks'

function bm(
  partial: Pick<BookmarkItem, 'id' | 'title' | 'url'> & Partial<BookmarkItem>,
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
    expect(filterBookmarks('github', list).map((b) => b.id)).toEqual([
      '1',
      '2',
    ])
  })

  it('prefers title hits before url-only hits; preserves input order within tier', () => {
    expect(filterBookmarks('git', list).map((b) => b.id)).toEqual([
      '1',
      '6',
      '2',
    ])
  })

  it(`caps at ${SEARCH_RESULT_LIMIT}`, () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      bm({ id: String(i), title: `Item ${i}`, url: `https://x.test/${i}` }),
    )
    expect(filterBookmarks('item', many)).toHaveLength(5)
  })
})
