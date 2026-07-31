import type { StorageAreaLike } from '../browser/types'
import type { StorageRoot } from '../types'
import { BACKUP_KEY, STORAGE_KEY } from './keys'
import { migrate } from './migrate'

export interface FavoritesRepository {
  load(): Promise<StorageRoot>
  save(root: StorageRoot): Promise<void>
}

export function createRepository(area: StorageAreaLike): FavoritesRepository {
  return {
    async load() {
      const data = await area.get([STORAGE_KEY])
      const raw = data[STORAGE_KEY]
      const { root, backedUp, repaired } = migrate(raw)

      if (backedUp) {
        await area.set({
          [BACKUP_KEY]: raw ?? null,
          [STORAGE_KEY]: root,
        })
      } else if (raw == null || repaired) {
        await area.set({ [STORAGE_KEY]: root })
      }

      return root
    },

    async save(root: StorageRoot) {
      await area.set({ [STORAGE_KEY]: root })
    },
  }
}
