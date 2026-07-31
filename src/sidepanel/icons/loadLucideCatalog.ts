import type { LucideCatalog } from './lucideCatalog'

let pending: Promise<LucideCatalog> | null = null

/** Lazily load the full Lucide icon catalog (large chunk; call only when searching/rendering non-curated icons). */
export function loadLucideCatalog(): Promise<LucideCatalog> {
  pending ??= import('./lucideCatalog').then((m) => m.createCatalog())
  return pending
}
