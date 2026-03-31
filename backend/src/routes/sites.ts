import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'
import { testConnection } from '../services/woo-client.js'

export const siteRouter = Router()

function now() { return new Date().toISOString() }
function respond(res: Response, data: unknown, code = 200) { res.status(code).json({ code, message: 'ok', data }) }
function respondError(res: Response, message: string, code = 400) { res.status(code).json({ code, message, data: null }) }

// GET /sites
siteRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb()
  const sites = db.all('SELECT id, name, url, status, created_at, updated_at FROM sites ORDER BY created_at ASC')
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
  const { name, url, consumer_key, consumer_secret } = req.body
  if (!name || !url || !consumer_key || !consumer_secret) {
    return respondError(res, '缺少必填字段：name, url, consumer_key, consumer_secret')
  }

  const db = getDb()
  const id = `site-${uuidv4().slice(0, 8)}`
  const ts = now()

  db.run(
    'INSERT INTO sites (id, name, url, consumer_key, consumer_secret, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, url.replace(/\/$/, ''), consumer_key, consumer_secret, 'active', ts, ts]
  )

  const site = db.get('SELECT * FROM sites WHERE id = ?', [id])
  respond(res, site, 201)
})

// PUT /sites/:id
siteRouter.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const site = db.get('SELECT * FROM sites WHERE id = ?', [req.params.id])
  if (!site) return respondError(res, '站点不存在', 404)

  const updatable = ['name', 'url', 'consumer_key', 'consumer_secret', 'status']
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

  db.run('DELETE FROM sites WHERE id = ?', [req.params.id])
  respond(res, { deleted: true })
})

// POST /sites/:id/test - 测试连接
siteRouter.post('/:id/test', async (req: Request, res: Response) => {
  const db = getDb()
  const site = db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]) as any
  if (!site) return respondError(res, '站点不存在', 404)

  try {
    const ok = await testConnection({
      url: site.url,
      consumer_key: site.consumer_key,
      consumer_secret: site.consumer_secret,
    })
    respond(res, { connected: ok })
  } catch (err: any) {
    respond(res, { connected: false, error: err.message })
  }
})
