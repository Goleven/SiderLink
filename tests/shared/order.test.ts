import { describe, it, expect } from 'vitest'
import { reindexOrders } from '@/shared/order'

describe('reindexOrders', () => {
  it('assigns 0..n-1 in current array order', () => {
    const result = reindexOrders([
      { id: 'a', order: 5 },
      { id: 'b', order: 1 },
    ])
    expect(result.map((x) => x.order)).toEqual([0, 1])
  })
})
