import type { Group } from './types'
import { sortByOrder } from './order'

export interface IndexBarAnchor {
  id: string
  name: string
  icon: string
}

export function buildIndexBarAnchors(groups: Group[]): IndexBarAnchor[] {
  return sortByOrder(groups).map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
  }))
}
