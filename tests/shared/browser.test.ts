import { describe, it, expect } from 'vitest'
import { isRestrictedTabUrl } from '@/shared/browser'

describe('isRestrictedTabUrl', () => {
  it('flags chrome and empty urls', () => {
    expect(isRestrictedTabUrl(undefined)).toBe(true)
    expect(isRestrictedTabUrl('chrome://extensions')).toBe(true)
    expect(isRestrictedTabUrl('https://example.com')).toBe(false)
  })
})
