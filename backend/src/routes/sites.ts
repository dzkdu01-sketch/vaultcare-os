import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { testConnection } from '../services/woo-client.js'

export const siteRouter = Router()

function now() { return new Date().toISOString() }
function respond(res: Response, data: unknown, code = 200) { res.status(code).json({ code, message: 'ok', data }) }
function respondError(res: Response, message: string, code = 400) { res.status(code).json({ code, message, data: null }) }

siteRouter.use(requireAuth, requireRole('operator'))

// GET /sites
siteRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb()
  const sites = db.all(
    `SELECT s.id, s.name, s.url, s.consumer_key, s.consumer_secret, s.status, s.distributor_id, s.webhook_secret,
            COALESCE(NULLIF(TRIM(d.name), ''), d.code) as distributor_name, d.code as distributor_code,
            s.created_at, s.updated_at
     FROM sites s LEFT JOIN distributors d ON s.distributor_id = d.id
     ORDER BY s.created_at ASC`
  )
  respond(res, sites)
})

// GET /sites/:id
siteRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const site = db.get('SELECT * FROM sites WHERE id = ?', [req.params.id])
  if (!site) return respondError(res, '站点不存在', 404)
  respond(res, site)
})

// POST /sites
siteRouter.post('/', (req: Request, res: Response) => {
  const { name, url, consumer_key, consumer_secret, distributor_id, webhook_secret, status } = req.body
  if (!name || !url || !consumer_key || !consumer_secret) {
    return respondError(res, '缺少必填字段：name, url, consumer_key, consumer_secret')
  }

  const db = getDb()
  const id = `site-${uuidv4().slice(0, 8)}`
  const ts = now()

  db.run(
    'INSERT INTO sites (id, name, url, consumer_key, consumer_secret, status, distributor_id, webhook_secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      name,
      url.replace(/\/$/, ''),
      consumer_key,
      consumer_secret,
      status === 'inactive' ? 'inactive' : 'active',
      distributor_id || null,
      webhook_secret || null,
      ts,
      ts,
    ]
  )

  const site = db.get('SELECT * FROM sites WHERE id = ?', [id])
  respond(res, site, 201)
})

// PUT /sites/:id
siteRouter.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const site = db.get('SELECT * FROM sites WHERE id = ?', [req.params.id])
  if (!site) return respondError(res, '站点不存在', 404)

  const updatable = ['name', 'url', 'consumer_key', 'consumer_secret', 'status', 'distributor_id', 'webhook_secret']
  const sets: string[] = []
  const params: unknown[] = []

  for (const field of updatable) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`)
      params.push(field === 'url' ? req.body[field].replace(/\/$/, '') : req.body[field])
    }
  }
  if (sets.length === 0) return respondError(res, '没有可更新的字段')

  sets.push('updated_at = ?')
  params.push(now())
  params.push(req.params.id)

  db.run(`UPDATE sites SET ${sets.join(', ')} WHERE id = ?`, params)
  const updated = db.get('SELECT * FROM sites WHERE id = ?', [req.params.id])
  respond(res, updated)
})

// DELETE /sites/:id
siteRouter.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const site = db.get('SELECT * FROM sites WHERE id = ?', [req.params.id])
  if (!site) return respondError(res, '站点不存在', 404)

  const orderCount = db.get('SELECT COUNT(*) as count FROM orders WHERE site_id = ?', [req.params.id]) as any
  if (orderCount?.count > 0) {
    return respondError(res, `该站点下有 ${orderCount.count} 个订单，无法删除。请先处理关联订单。`)
  }

  const syncCount = db.get('SELECT COUNT(*) as count FROM product_sync WHERE site_id = ?', [req.params.id]) as any
  if (syncCount?.count > 0) {
    return respondError(res, `该站点有 ${syncCount.count} 个产品同步记录，无法删除。请先清除同步记录。`)
  }

  db.run('DELETE FROM sites WHERE id = ?', [req.params.id])
  respond(res, { deleted: true })
})

// POST /sites/:id/test - 测试连接
siteRouter.post('/:id/test', async (req: Request, res: Response) => {
  const db = getDb()
  const site = db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]) as any
  if (!site) return respondError(res, '站点不存在', 404)

  try {
    const result = await testConnection({
      url: site.url,
      consumer_key: site.consumer_key,
      consumer_secret: site.consumer_secret,
    })
    respond(res, { connected: result.ok, error: result.error })
  } catch (err: any) {
    respond(res, { connected: false, error: err.message })
  }
})
