import { describe, expect, it } from 'vitest'
import { replaceSiteTerm, resolveSiteTerm } from './distributorTerminology'

describe('distributor terminology helpers', () => {
  it('falls back to the default site term', () => {
    expect(resolveSiteTerm()).toBe('站点')
    expect(resolveSiteTerm('')).toBe('站点')
    expect(resolveSiteTerm('   ')).toBe('站点')
  })

  it('uses the distributor specific site term when provided', () => {
    expect(resolveSiteTerm('门店')).toBe('门店')
  })

  it('replaces default site labels with the distributor term', () => {
    expect(replaceSiteTerm('添加站点', '门店')).toBe('添加门店')
    expect(replaceSiteTerm('暂无站点', '店铺')).toBe('暂无店铺')
  })
})
