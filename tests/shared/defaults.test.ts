import { describe, it, expect } from 'vitest'
import { createDefaultRoot, STORAGE_VERSION } from '@/shared/defaults'

describe('createDefaultRoot', () => {
  it('has current version, default group, empty bookmarks, settings and meta', () => {
    const root = createDefaultRoot()
    expect(root.version).toBe(STORAGE_VERSION)
    expect(root.groups).toHaveLength(1)
    expect(root.groups[0].isDefault).toBe(true)
    expect(root.groups[0].name).toBe('Link')
    expect(root.groups[0].icon).toBe('star')
    expect(root.bookmarks).toEqual([])
    expect(root.settings).toEqual({
      openInNewTab: true,
      indexBarMode: 'icon',
      themeMode: 'system',
      backgroundId: 'neutral',
      locale: 'zh-CN',
    })
    expect(typeof root.meta.updatedAt).toBe('number')
  })
})
