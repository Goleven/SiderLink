import { describe, it, expect } from 'vitest'
import type { BookmarkItem, Group } from '@/shared/types'
import {
  filterBookmarks,
  filterBookmarksOrdered,
  listBookmarksSideOrder,
  SEARCH_RESULT_LIMIT,
} from '@/shared/searchBookmarks'

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

function group(
  partial: Pick<Group, 'id' | 'name' | 'order'> & Partial<Group>,
): Group {
  return {
    icon: 'star',
    isDefault: false,
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

describe('listBookmarksSideOrder', () => {
  it('flattens by group order then bookmark order', () => {
    const groups = [
      group({ id: 'g2', name: 'B', order: 1 }),
      group({ id: 'g1', name: 'A', order: 0, isDefault: true }),
    ]
    const bookmarks = [
      bm({ id: 'b2', title: 'B2', url: 'https://b2.test', groupId: 'g2', order: 1 }),
      bm({ id: 'a1', title: 'A1', url: 'https://a1.test', groupId: 'g1', order: 0 }),
      bm({ id: 'b1', title: 'B1', url: 'https://b1.test', groupId: 'g2', order: 0 }),
      bm({ id: 'a2', title: 'A2', url: 'https://a2.test', groupId: 'g1', order: 1 }),
    ]
    expect(listBookmarksSideOrder(groups, bookmarks).map((b) => b.id)).toEqual([
      'a1',
      'a2',
      'b1',
      'b2',
    ])
  })
})

describe('filterBookmarksOrdered', () => {
  const ordered = [
    bm({ id: '1', title: 'GitHub', url: 'https://github.com' }),
    bm({ id: '2', title: 'Docs', url: 'https://example.com/github-guide' }),
    bm({ id: '3', title: 'Other', url: 'https://other.test' }),
  ]

  it('returns full ordered list for blank query', () => {
    expect(filterBookmarksOrdered('  ', ordered).map((b) => b.id)).toEqual([
      '1',
      '2',
      '3',
    ])
  })

  it('filters title/url without reordering or capping', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      bm({
        id: String(i),
        title: i % 2 === 0 ? `Hit ${i}` : `Miss ${i}`,
        url: `https://x.test/${i}`,
      }),
    )
    expect(filterBookmarksOrdered('hit', many).map((b) => b.id)).toEqual([
      '0',
      '2',
      '4',
      '6',
    ])
  })

  it('keeps url-only matches in side order (no title-tier promotion)', () => {
    expect(filterBookmarksOrdered('github', ordered).map((b) => b.id)).toEqual([
      '1',
      '2',
    ])
  })
})
