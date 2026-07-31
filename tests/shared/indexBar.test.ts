import { describe, it, expect } from 'vitest'
import { buildIndexBarAnchors } from '@/shared/indexBar'

describe('buildIndexBarAnchors file', () => {
  it('returns empty for empty groups', () => {
    expect(buildIndexBarAnchors([])).toEqual([])
  })
})
