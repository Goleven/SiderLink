import { describe, expect, it } from 'vitest'
import { createDefaultRoot } from '@/shared/defaults'
import { chooseLwwWinner, rootUpdatedAt } from '@/shared/sync/lww'
import type { StorageRoot } from '@/shared/types'

function withUpdatedAt(root: StorageRoot, updatedAt: number): StorageRoot {
  return { ...root, meta: { updatedAt } }
}

describe('lww', () => {
  it('treats missing meta as 0', () => {
    const root = createDefaultRoot()
    expect(rootUpdatedAt({ ...root, meta: undefined as never })).toBe(0)
  })

  it('picks remote when remote is newer', () => {
    const local = withUpdatedAt(createDefaultRoot(), 100)
    const remote = withUpdatedAt(createDefaultRoot(), 200)
    expect(chooseLwwWinner(local, remote)).toBe('remote')
  })

  it('picks local when local is newer', () => {
    const local = withUpdatedAt(createDefaultRoot(), 300)
    const remote = withUpdatedAt(createDefaultRoot(), 200)
    expect(chooseLwwWinner(local, remote)).toBe('local')
  })

  it('returns equal when timestamps match', () => {
    const local = withUpdatedAt(createDefaultRoot(), 150)
    const remote = withUpdatedAt(createDefaultRoot(), 150)
    expect(chooseLwwWinner(local, remote)).toBe('equal')
  })
})
