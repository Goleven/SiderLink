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
    expect(() => deleteGroup(root, root.groups[0].id)).toThrow(
      /cannotDeleteDefault|default/i,
    )
  })

  it('moves bookmarks to default when deleting custom group', () => {
    let root = createDefaultRoot()
    root = addGroup(root, { name: '工作', icon: 'briefcase' })
    const work = root.groups.find((g) => g.name === '工作')!
    root = addBookmark(root, {
      title: 'A',
      url: 'https://a.com',
      groupId: work.id,
    })
    root = deleteGroup(root, work.id)
    expect(root.groups.every((g) => g.name !== '工作')).toBe(true)
    expect(root.bookmarks[0].groupId).toBe(
      root.groups.find((g) => g.isDefault)!.id,
    )
  })

  it('reorders groups and moves bookmark across groups', () => {
    let root = createDefaultRoot()
    root = addGroup(root, { name: '学习', icon: 'book-open' })
    const def = root.groups.find((g) => g.isDefault)!
    const learn = root.groups.find((g) => g.name === '学习')!
    root = addBookmark(root, {
      title: 'MDN',
      url: 'https://developer.mozilla.org',
      groupId: def.id,
    })
    const id = root.bookmarks[0].id
    root = reorderGroups(root, [learn.id, def.id])
    expect(root.groups.map((g) => g.id)).toEqual([learn.id, def.id])
    root = moveBookmark(root, id, learn.id, 0)
    expect(root.bookmarks.find((b) => b.id === id)!.groupId).toBe(learn.id)
  })

  it('renames default group', () => {
    let root = createDefaultRoot()
    root = updateGroup(root, root.groups[0].id, { name: '常用' })
    expect(root.groups[0].name).toBe('常用')
    expect(root.groups[0].isDefault).toBe(true)
  })
})
