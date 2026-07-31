import { describe, it, expect } from 'vitest'
import {
  normalizeUrl,
  normalizeTitle,
  normalizeGroupName,
} from '@/shared/validation'

describe('normalizeUrl', () => {
  it('accepts https urls', () => {
    expect(normalizeUrl('https://example.com/a')).toEqual({
      ok: true,
      url: 'https://example.com/a',
    })
  })

  it('rejects chrome: and empty', () => {
    expect(normalizeUrl('chrome://extensions').ok).toBe(false)
    expect(normalizeUrl('').ok).toBe(false)
  })

  it('prepends https for bare domains', () => {
    const r = normalizeUrl('example.com')
    expect(r).toEqual({ ok: true, url: 'https://example.com/' })
  })
})

describe('normalizeTitle', () => {
  it('trims or uses fallback', () => {
    expect(normalizeTitle('  Hi  ', 'x')).toBe('Hi')
    expect(normalizeTitle('   ', 'fallback')).toBe('fallback')
  })
})

describe('normalizeGroupName', () => {
  it('rejects empty and duplicates', () => {
    expect(normalizeGroupName('  ', ['收藏']).ok).toBe(false)
    expect(normalizeGroupName('工作', ['工作']).ok).toBe(false)
  })

  it('allows name when not in otherNames', () => {
    expect(normalizeGroupName('工作', [])).toEqual({ ok: true, name: '工作' })
  })
})
