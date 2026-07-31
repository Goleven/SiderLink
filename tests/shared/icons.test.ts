import { describe, it, expect } from 'vitest'
import {
  DEFAULT_GROUP_ICON,
  GROUP_ICON_IDS,
  filterGroupIconIds,
  mergeIconSearchResults,
  resolveGroupIconId,
  isGroupIconId,
  isLucideIconId,
} from '@/shared/icons'

describe('resolveGroupIconId', () => {
  it('passes through known lucide ids', () => {
    expect(resolveGroupIconId('star')).toBe('star')
    expect(isGroupIconId('globe')).toBe(true)
  })

  it('passes through non-curated kebab lucide ids', () => {
    expect(isLucideIconId('accessibility')).toBe(true)
    expect(resolveGroupIconId('accessibility')).toBe('accessibility')
    expect(isGroupIconId('accessibility')).toBe(false)
  })

  it('maps legacy emoji to lucide ids', () => {
    expect(resolveGroupIconId('⭐')).toBe('star')
    expect(resolveGroupIconId('📁')).toBe('folder')
  })

  it('falls back for unknown values', () => {
    expect(resolveGroupIconId('???')).toBe('star')
    expect(resolveGroupIconId(DEFAULT_GROUP_ICON)).toBe('star')
  })
})

describe('filterGroupIconIds', () => {
  it('returns full curated set when query empty', () => {
    expect(filterGroupIconIds('').length).toBe(GROUP_ICON_IDS.length)
    expect(GROUP_ICON_IDS.length).toBeGreaterThanOrEqual(60)
  })

  it('filters by english id fragment', () => {
    expect(filterGroupIconIds('book')).toContain('book-open')
    expect(filterGroupIconIds('book')).toContain('bookmark')
  })

  it('filters by chinese keyword', () => {
    expect(filterGroupIconIds('工作')).toContain('briefcase')
    expect(filterGroupIconIds('音乐')).toContain('music')
  })
})

describe('mergeIconSearchResults', () => {
  it('dedupes and keeps curated hits first', () => {
    expect(mergeIconSearchResults(['star', 'gift'], ['gift', 'accessibility'])).toEqual([
      'star',
      'gift',
      'accessibility',
    ])
  })
})
