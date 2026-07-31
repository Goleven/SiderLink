import type { LucideIcon } from '@lucide/vue'

const modules = import.meta.glob(
  [
    '../../../node_modules/@lucide/vue/dist/esm/icons/*.mjs',
    '!../../../node_modules/@lucide/vue/dist/esm/icons/index.mjs',
  ],
  { eager: true, import: 'default' },
) as Record<string, LucideIcon>

function idFromPath(path: string): string | null {
  const file = path.slice(path.lastIndexOf('/') + 1)
  if (!file.endsWith('.mjs')) return null
  const id = file.slice(0, -'.mjs'.length)
  if (!id || id === 'index') return null
  return id
}

const byId = new Map<string, LucideIcon>()
for (const [path, component] of Object.entries(modules)) {
  const id = idFromPath(path)
  if (id) byId.set(id, component)
}

export const ALL_LUCIDE_ICON_IDS = [...byId.keys()].sort()

export type LucideCatalog = {
  ids: readonly string[]
  getIcon: (id: string) => LucideIcon | undefined
  search: (query: string, limit?: number) => string[]
}

export function createCatalog(): LucideCatalog {
  return {
    ids: ALL_LUCIDE_ICON_IDS,
    getIcon(id: string) {
      return byId.get(id)
    },
    search(query: string, limit = 120) {
      const q = query.trim().toLowerCase()
      if (!q) return []
      const spaced = q.replace(/-/g, ' ')
      const hits: string[] = []
      for (const id of ALL_LUCIDE_ICON_IDS) {
        if (id.includes(q) || id.replace(/-/g, ' ').includes(spaced)) {
          hits.push(id)
          if (hits.length >= limit) break
        }
      }
      return hits
    },
  }
}
