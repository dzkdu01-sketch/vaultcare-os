import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCatalogGridRows, type CatalogProductRow } from './catalogPng.js'

function p(sku: string, category: string | null): CatalogProductRow {
  return {
    sku,
    category,
    name: sku,
    sale_price: 0,
    regular_price: 0,
    images: [],
    supplier_codes: null,
  }
}

test('buildCatalogGridRows keeps products in one continuous grid without category section breaks', () => {
  const rows = buildCatalogGridRows(
    [
      p('A-001', 'Alpha'),
      p('A-002', 'Alpha'),
      p('B-001', 'Beta'),
      p('C-001', 'Gamma'),
      p('C-002', 'Gamma'),
    ],
    2,
  )

  assert.deepEqual(
    rows.map(row => row.map(item => item?.sku ?? null)),
    [
      ['A-001', 'A-002'],
      ['B-001', 'C-001'],
      ['C-002', null],
    ],
  )
})
