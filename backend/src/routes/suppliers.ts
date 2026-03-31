import { Router, Request, Response } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'

type ImportedSupplierProductRow = {
  id: number
  supplier_id: string
  supplier_name: string
  supplier_code: string
  product_name: string
  cost_price_aed: number | null
  mapped_product_id: string | null
  mapped_product_sku?: string | null
  mapped_product_name?: string | null
  created_at: string
  updated_at: string
}

type ProductSupplierRow = {
  id: number
  product_id: string
  supplier_id: string
  supplier_code: string
  cost_price: number | null
  note: string | null
}

export const supplierRouter = Router()
const upload = multer({ storage: multer.memoryStorage() })

function now() { return new Date().toISOString() }
function respond(res: Response, data: unknown, code = 200) { res.status(code).json({ code, message: 'ok', data }) }
function respondError(res: Response, message: string, code = 400) { res.status(code).json({ code, message, data: null }) }

function normalizeHeader(value: unknown) {
  return String(value ?? '').trim()
}

function parseAed(value: unknown) {
  if (value == null || value === '') return null
  const num = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(num) ? num : NaN
}

// GET /suppliers
supplierRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb()
  const suppliers = db.all('SELECT * FROM suppliers ORDER BY created_at ASC')
  respond(res, suppliers)
})

// POST /suppliers
supplierRouter.post('/', (req: Request, res: Response) => {
  const { name, code_prefix, contact, note } = req.body
  if (!name) return respondError(res, '缺少必填字段：name')

  const db = getDb()
  const id = `sup-${uuidv4().slice(0, 8)}`
  const ts = now()

  db.run(
    'INSERT INTO suppliers (id, name, code_prefix, contact, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, code_prefix || '', contact || '', note || '', ts, ts]
  )

  const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [id])
  respond(res, supplier, 201)
})

// POST /suppliers/import-products
supplierRouter.post('/import-products', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return respondError(res, '请上传 Excel 或 CSV 文件')

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return respondError(res, 'Excel 中没有工作表')

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (rows.length === 0) return respondError(res, 'Excel 没有可导入的数据')

  const requiredHeaders = ['供应商名称', '供应商编码', '商品名称', '供货价']
  const rowHeaders = Object.keys(rows[0]).map(normalizeHeader)
  for (const header of requiredHeaders) {
    if (!rowHeaders.includes(header)) return respondError(res, `缺少必填列：${header}`)
  }

  const db = getDb()
  const batchId = `batch-${uuidv4().slice(0, 8)}`
  let created = 0
  let updated = 0
  let failed = 0
  let currentSupplierName = ''
  let currentSupplierId = ''
  const rowErrors: Array<{ row: number; message: string }> = []

  rows.forEach((row, index) => {
    const rowNum = index + 2
    const rawSupplierName = String(row['供应商名称'] ?? '').trim()
    const supplierCode = String(row['供应商编码'] ?? '').trim()
    const productName = String(row['商品名称'] ?? '').trim()
    const costPriceParsed = parseAed(row['供货价'])

    let supplierName = rawSupplierName
    let supplierId = ''

    if (supplierName) {
      const matchedSupplier = db.get('SELECT id, name FROM suppliers WHERE LOWER(name) = LOWER(?)', [supplierName]) as { id?: string; name?: string } | undefined
      if (matchedSupplier?.id) {
        supplierId = matchedSupplier.id
        currentSupplierId = matchedSupplier.id
        currentSupplierName = matchedSupplier.name || supplierName
      } else if (currentSupplierId) {
        supplierName = currentSupplierName
        supplierId = currentSupplierId
      }
    } else if (currentSupplierId) {
      supplierName = currentSupplierName
      supplierId = currentSupplierId
    }

    if (!supplierName || !supplierCode || !productName) {
      failed++
      rowErrors.push({ row: rowNum, message: '供应商名称、供应商编码、商品名称不能为空' })
      return
    }
    if (Number.isNaN(costPriceParsed)) {
      failed++
      rowErrors.push({ row: rowNum, message: '供货价格式不正确' })
      return
    }

    if (!supplierId) {
      const supplier = db.get('SELECT id, name FROM suppliers WHERE LOWER(name) = LOWER(?)', [supplierName]) as { id?: string; name?: string } | undefined
      if (!supplier?.id) {
        failed++
        rowErrors.push({ row: rowNum, message: `供应商不存在：${supplierName}` })
        return
      }
      supplierId = supplier.id
      currentSupplierId = supplier.id
      currentSupplierName = supplier.name || supplierName
    }

    const existing = db.get(
      'SELECT id FROM supplier_products WHERE supplier_id = ? AND supplier_code = ?',
      [supplierId, supplierCode]
    ) as { id?: number } | undefined

    const ts = now()
    if (existing?.id) {
      db.run(
        `UPDATE supplier_products
         SET product_name = ?, cost_price_aed = ?, import_batch_id = ?, updated_at = ?
         WHERE id = ?`,
        [productName, costPriceParsed, batchId, ts, existing.id]
      )
      updated++
    } else {
      db.run(
        `INSERT INTO supplier_products (supplier_id, supplier_code, product_name, cost_price_aed, mapped_product_id, import_batch_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
        [supplierId, supplierCode, productName, costPriceParsed, batchId, ts, ts]
      )
      created++
    }
  })

  respond(res, { total: rows.length, created, updated, failed, rowErrors, import_batch_id: batchId }, 201)
})

// GET /suppliers/imported-products
supplierRouter.get('/imported-products', (req: Request, res: Response) => {
  const db = getDb()
  const { supplier_id, mapped = 'all', keyword = '' } = req.query as Record<string, string>
  const conditions: string[] = []
  const params: unknown[] = []

  if (supplier_id) {
    conditions.push('sp.supplier_id = ?')
    params.push(supplier_id)
  }
  if (mapped === 'yes') conditions.push('sp.mapped_product_id IS NOT NULL')
  else if (mapped === 'no') conditions.push('sp.mapped_product_id IS NULL')
  if (keyword) {
    conditions.push('(sp.supplier_code LIKE ? OR sp.product_name LIKE ?)')
    const kw = `%${keyword}%`
    params.push(kw, kw)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.all(
    `SELECT sp.*, s.name as supplier_name, p.sku as mapped_product_sku, p.name as mapped_product_name
     FROM supplier_products sp
     JOIN suppliers s ON sp.supplier_id = s.id
     LEFT JOIN products p ON sp.mapped_product_id = p.id
     ${where}
     ORDER BY sp.updated_at DESC, sp.id DESC`,
    params
  ) as ImportedSupplierProductRow[]

  respond(res, rows)
})

// POST /suppliers/imported-products/bind
supplierRouter.post('/imported-products/bind', (req: Request, res: Response) => {
  const { supplier_product_ids, product_id } = req.body as { supplier_product_ids?: number[]; product_id?: string }
  if (!Array.isArray(supplier_product_ids) || supplier_product_ids.length === 0 || !product_id) {
    return respondError(res, '缺少必填字段：supplier_product_ids, product_id')
  }

  const db = getDb()
  const product = db.get('SELECT id FROM products WHERE id = ?', [product_id])
  if (!product) return respondError(res, '内部商品不存在', 404)

  try {
    const ts = now()
    let updated = 0

    for (const id of supplier_product_ids) {
      const imported = db.get(
        'SELECT supplier_id, supplier_code, cost_price_aed FROM supplier_products WHERE id = ?',
        [id]
      ) as { supplier_id?: string; supplier_code?: string; cost_price_aed?: number | null } | undefined

      if (!imported?.supplier_id || !imported.supplier_code) {
        return respondError(res, `供应商导入商品不存在：${id}`, 404)
      }

      db.run('UPDATE supplier_products SET mapped_product_id = ?, updated_at = ? WHERE id = ?', [product_id, ts, id])

      const existingMapping = db.get(
        'SELECT * FROM product_supplier WHERE product_id = ? AND supplier_id = ?',
        [product_id, imported.supplier_id]
      ) as ProductSupplierRow | undefined

      if (existingMapping) {
        db.run(
          'UPDATE product_supplier SET supplier_code = ?, cost_price = ?, note = ? WHERE id = ?',
          [imported.supplier_code, imported.cost_price_aed ?? null, '', existingMapping.id]
        )
      } else {
        db.run(
          'INSERT INTO product_supplier (product_id, supplier_id, supplier_code, cost_price, note) VALUES (?, ?, ?, ?, ?)',
          [product_id, imported.supplier_id, imported.supplier_code, imported.cost_price_aed ?? null, '']
        )
      }

      const persisted = db.get(
        'SELECT id, product_id, supplier_id, supplier_code, cost_price, note FROM product_supplier WHERE product_id = ? AND supplier_id = ?',
        [product_id, imported.supplier_id]
      ) as ProductSupplierRow | undefined

      if (!persisted?.id) {
        throw new Error(`product_supplier 未写入成功: supplier_product_id=${id}`)
      }

      updated++
    }

    respond(res, { updated })
  } catch (err: any) {
    respondError(res, err.message || '绑定失败', 500)
  }
})

// POST /suppliers/imported-products/unbind
supplierRouter.post('/imported-products/unbind', (req: Request, res: Response) => {
  const { supplier_product_ids } = req.body as { supplier_product_ids?: number[] }
  if (!Array.isArray(supplier_product_ids) || supplier_product_ids.length === 0) {
    return respondError(res, '缺少必填字段：supplier_product_ids')
  }

  const db = getDb()

  try {
    const ts = now()
    let updated = 0

    for (const id of supplier_product_ids) {
      const imported = db.get(
        'SELECT supplier_id, mapped_product_id FROM supplier_products WHERE id = ?',
        [id]
      ) as { supplier_id?: string; mapped_product_id?: string | null } | undefined

      if (!imported) {
        return respondError(res, `供应商导入商品不存在：${id}`, 404)
      }

      if (imported.supplier_id && imported.mapped_product_id) {
        db.run(
          'DELETE FROM product_supplier WHERE product_id = ? AND supplier_id = ?',
          [imported.mapped_product_id, imported.supplier_id]
        )

        const persisted = db.get(
          'SELECT id FROM product_supplier WHERE product_id = ? AND supplier_id = ?',
          [imported.mapped_product_id, imported.supplier_id]
        ) as { id?: number } | undefined

        if (persisted?.id) {
          throw new Error(`product_supplier 未删除成功: supplier_product_id=${id}`)
        }
      }

      db.run('UPDATE supplier_products SET mapped_product_id = NULL, updated_at = ? WHERE id = ?', [ts, id])
      updated++
    }

    respond(res, { updated })
  } catch (err: any) {
    respondError(res, err.message || '解绑失败', 500)
  }
})

// === 产品-供应商映射（保留现有能力） ===

// GET /suppliers/mapping/all
supplierRouter.get('/mapping/all', (req: Request, res: Response) => {
  const db = getDb()
  const { supplier_id } = req.query as Record<string, string>

  let where = ''
  const params: unknown[] = []
  if (supplier_id) {
    where = 'WHERE ps.supplier_id = ?'
    params.push(supplier_id)
  }

  const mappings = db.all(
    `SELECT ps.*, s.name as supplier_name, s.code_prefix, p.name as product_name, p.sku as product_sku, p.sale_price
     FROM product_supplier ps
     JOIN suppliers s ON ps.supplier_id = s.id
     JOIN products p ON ps.product_id = p.id
     ${where}
     ORDER BY s.name, p.sku`,
    params
  )
  respond(res, mappings)
})

// PUT /suppliers/mapping/:id
supplierRouter.put('/mapping/:id', (req: Request, res: Response) => {
  const db = getDb()
  const mapping = db.get('SELECT * FROM product_supplier WHERE id = ?', [req.params.id])
  if (!mapping) return respondError(res, '映射不存在', 404)

  const { supplier_code, cost_price, note } = req.body
  const sets: string[] = []
  const params: unknown[] = []

  if (supplier_code !== undefined) { sets.push('supplier_code = ?'); params.push(supplier_code) }
  if (cost_price !== undefined) { sets.push('cost_price = ?'); params.push(cost_price) }
  if (note !== undefined) { sets.push('note = ?'); params.push(note) }
  if (sets.length === 0) return respondError(res, '没有可更新的字段')

  params.push(req.params.id)
  db.run(`UPDATE product_supplier SET ${sets.join(', ')} WHERE id = ?`, params)
  respond(res, { updated: true })
})

// GET /suppliers/mapping/by-product/:productId
supplierRouter.get('/mapping/by-product/:productId', (req: Request, res: Response) => {
  const db = getDb()
  const mappings = db.all(
    `SELECT ps.*, s.name as supplier_name, s.code_prefix
     FROM product_supplier ps
     JOIN suppliers s ON ps.supplier_id = s.id
     WHERE ps.product_id = ?`,
    [req.params.productId]
  )
  respond(res, mappings)
})

// POST /suppliers/mapping
supplierRouter.post('/mapping', (req: Request, res: Response) => {
  const { product_id, supplier_id, supplier_code, cost_price, note } = req.body
  if (!product_id || !supplier_id || !supplier_code) {
    return respondError(res, '缺少必填字段：product_id, supplier_id, supplier_code')
  }

  const db = getDb()
  const product = db.get('SELECT id FROM products WHERE id = ?', [product_id])
  if (!product) return respondError(res, '产品不存在', 404)

  const supplier = db.get('SELECT id FROM suppliers WHERE id = ?', [supplier_id])
  if (!supplier) return respondError(res, '供应商不存在', 404)

  try {
    db.run(
      'INSERT INTO product_supplier (product_id, supplier_id, supplier_code, cost_price, note) VALUES (?, ?, ?, ?, ?)',
      [product_id, supplier_id, supplier_code, cost_price || null, note || '']
    )
    respond(res, { created: true }, 201)
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return respondError(res, '该产品已关联此供应商')
    }
    throw err
  }
})

// DELETE /suppliers/mapping/:id
supplierRouter.delete('/mapping/:id', (req: Request, res: Response) => {
  const db = getDb()
  const row = db.get('SELECT * FROM product_supplier WHERE id = ?', [req.params.id]) as ProductSupplierRow | undefined
  if (!row) return respondError(res, '映射不存在', 404)

  const ts = now()
  db.run(
    `UPDATE supplier_products SET mapped_product_id = NULL, updated_at = ?
     WHERE mapped_product_id = ? AND supplier_id = ? AND supplier_code = ?`,
    [ts, row.product_id, row.supplier_id, row.supplier_code]
  )
  db.run('DELETE FROM product_supplier WHERE id = ?', [req.params.id])
  respond(res, { deleted: true })
})

// GET /suppliers/:id
supplierRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [req.params.id])
  if (!supplier) return respondError(res, '供应商不存在', 404)
  respond(res, supplier)
})

// PUT /suppliers/:id
supplierRouter.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [req.params.id])
  if (!supplier) return respondError(res, '供应商不存在', 404)

  const updatable = ['name', 'code_prefix', 'contact', 'note']
  const sets: string[] = []
  const params: unknown[] = []

  for (const field of updatable) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`)
      params.push(req.body[field])
    }
  }
  if (sets.length === 0) return respondError(res, '没有可更新的字段')

  sets.push('updated_at = ?')
  params.push(now())
  params.push(req.params.id)

  db.run(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`, params)
  const updated = db.get('SELECT * FROM suppliers WHERE id = ?', [req.params.id])
  respond(res, updated)
})

// DELETE /suppliers/:id
supplierRouter.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [req.params.id])
  if (!supplier) return respondError(res, '供应商不存在', 404)

  db.run('DELETE FROM suppliers WHERE id = ?', [req.params.id])
  respond(res, { deleted: true })
})
