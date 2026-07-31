import { describe, it, expect } from 'vitest'
import { resolveTheme } from '@/shared/theme'
import { buildIndexBarAnchors } from '@/shared/indexBar'
import { getBackgroundColor, BACKGROUND_PRESETS } from '@/shared/backgrounds'

describe('resolveTheme', () => {
  it('maps system to OS', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
    expect(resolveTheme('light', 'dark')).toBe('light')
  })
})

describe('backgrounds', () => {
  it('has at least 4 presets and resolves colors', () => {
    expect(BACKGROUND_PRESETS.length).toBeGreaterThanOrEqual(4)
    expect(getBackgroundColor('neutral', 'light')).toMatch(/^#/)
  })
})

describe('buildIndexBarAnchors', () => {
  it('orders by group.order', () => {
    const anchors = buildIndexBarAnchors([
      { id: 'b', name: 'B', icon: '🅱️', order: 1, isDefault: false },
      { id: 'a', name: 'A', icon: '🅰️', order: 0, isDefault: true },
    ])
    expect(anchors.map((a) => a.id)).toEqual(['a', 'b'])
  })
})
