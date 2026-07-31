import type { StorageRoot } from '../types'

export type LwwWinner = 'local' | 'remote' | 'equal'

export function rootUpdatedAt(root: StorageRoot | null | undefined): number {
  const value = root?.meta?.updatedAt
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Last-write-wins: newer meta.updatedAt wins; equal keeps local. */
export function chooseLwwWinner(
  local: StorageRoot,
  remote: StorageRoot,
): LwwWinner {
  const localAt = rootUpdatedAt(local)
  const remoteAt = rootUpdatedAt(remote)
  if (remoteAt > localAt) return 'remote'
  if (localAt > remoteAt) return 'local'
  return 'equal'
}
