import { Router } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'

export const favoriteRouter = Router()

favoriteRouter.use(requireAuth)

favoriteRouter.get('/', async (req, res) => {
  try {
    const db = getDb()
    const user = (req as any).user
    const distributorId = user.role === 'distributor' ? user.distributorId : req.query.distributor_id

    if (!distributorId) {
      return res.json({ code: 200, data: [] })
    }

    const rows = db.all(
      `SELECT pf.id, pf.product_id, pf.created_at,
              p.sku, p.name, p.images, p.sale_price, p.status
       FROM product_favorites pf
       JOIN products p ON pf.product_id = p.id
       WHERE pf.distributor_id = ?
       ORDER BY pf.created_at DESC`,
      [distributorId]
    )

    const items = rows.map((r: any) => ({
      ...r,
      images: (() => { try { return JSON.parse(r.images || '[]') } catch { return [] } })(),
    }))

    res.json({ code: 200, data: items })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

favoriteRouter.post('/', async (req, res) => {
  try {
    const db = getDb()
    const user = (req as any).user
    const distributorId = user.role === 'distributor' ? user.distributorId : req.body.distributor_id
    const { product_id } = req.body

    if (!distributorId || !product_id) {
      return res.status(400).json({ code: 400, message: 'distributor_id and product_id required' })
    }

    db.run(
      `INSERT OR IGNORE INTO product_favorites (distributor_id, product_id) VALUES (?, ?)`,
      [distributorId, product_id]
    )

    res.json({ code: 200, message: 'ok' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

favoriteRouter.delete('/:productId', async (req, res) => {
  try {
    const db = getDb()
    const user = (req as any).user
    const distributorId = user.role === 'distributor' ? user.distributorId : req.query.distributor_id

    if (!distributorId) {
      return res.status(400).json({ code: 400, message: 'distributor_id required' })
    }

    db.run(
      `DELETE FROM product_favorites WHERE distributor_id = ? AND product_id = ?`,
      [distributorId, req.params.productId]
    )

    res.json({ code: 200, message: 'ok' })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message })
  }
})
