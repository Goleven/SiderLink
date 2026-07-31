export function reindexOrders<T extends { order: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, order: index }))
}

export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order)
}
