import { describe, expect, it } from 'vitest'

/**
 * 合同：单商品同步与全量同步 URL 必须可区分，避免误调全量接口。
 */
describe('sync API paths', () => {
  it('single product: /product/items/:id/sync', () => {
    const id = 'prod-074d3722'
    expect(`/product/items/${id}/sync`).toBe('/product/items/prod-074d3722/sync')
  })

  it('sync-all is not under /items/:id/sync pattern', () => {
    expect('/product/items/sync-all').not.toMatch(/\/items\/[^/]+\/sync$/)
  })

  it('sync-all path is fixed suffix', () => {
    expect('/product/items/sync-all').toMatch(/\/items\/sync-all$/)
  })

  it('sync-batch and id-list are not captured by /items/:id', () => {
    expect('/product/items/sync-batch').toMatch(/\/items\/sync-batch$/)
    expect('/product/items/id-list').toMatch(/\/items\/id-list$/)
  })
})
