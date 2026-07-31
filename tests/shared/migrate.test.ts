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

  it('passes through valid current root', () => {
    const raw = migrate(null).root
    const again = migrate(raw)
    expect(again.root).toEqual(raw)
    expect(again.backedUp).toBe(false)
  })

  it('upgrades v1 root without meta to v2', () => {
    const base = migrate(null).root
    const v1 = {
      version: 1,
      groups: base.groups,
      bookmarks: base.bookmarks,
      settings: base.settings,
    }
    const { root, repaired, backedUp } = migrate(v1)
    expect(backedUp).toBe(false)
    expect(repaired).toBe(true)
    expect(root.version).toBe(STORAGE_VERSION)
    expect(typeof root.meta.updatedAt).toBe('number')
  })

  it('backs up and resets on irreparable payload', () => {
    const { root, backedUp, repaired } = migrate({ version: 999, nonsense: true })
    expect(backedUp).toBe(true)
    expect(repaired).toBe(true)
    expect(root.groups[0].isDefault).toBe(true)
  })

  it('repairs missing default group by creating one', () => {
    const base = migrate(null).root
    base.groups = [
      { id: 'g1', name: '工作', icon: 'briefcase', order: 0, isDefault: false },
    ]
    const { root, repaired } = migrate(base)
    expect(repaired).toBe(true)
    expect(root.groups.filter((g) => g.isDefault)).toHaveLength(1)
  })
})
