import { describe, expect, it } from 'vitest'
import { createDefaultRoot, STORAGE_VERSION } from '@/shared/defaults'
import {
  parseRootJson,
  serializeRoot,
} from '@/shared/sync/exportImport'

describe('exportImport', () => {
  it('round-trips a valid root', () => {
    const root = createDefaultRoot()
    const again = parseRootJson(serializeRoot(root))
    expect(again.version).toBe(STORAGE_VERSION)
    expect(again.bookmarks).toEqual(root.bookmarks)
    expect(again.settings.locale).toBe(root.settings.locale)
    expect(again.meta.updatedAt).toBe(root.meta.updatedAt)
  })

  it('rejects invalid JSON', () => {
    expect(() => parseRootJson('{')).toThrow(/invalidJson/)
  })

  it('rejects irreparable payload', () => {
    expect(() => parseRootJson(JSON.stringify({ version: 999 }))).toThrow(
      /invalidPayload/,
    )
  })
})
