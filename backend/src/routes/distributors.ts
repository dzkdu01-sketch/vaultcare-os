import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { testConnection } from '../services/woo-client.js'

export const distributorRouter = Router()

function now() { return new Date().toISOString() }
function respond(res: Response, data: unknown, code = 200) { res.status(code).json({ code, message: 'ok', data }) }
function respondError(res: Response, message: string, code = 400) { res.status(code).json({ code, message, data: null }) }

function requireDistributorUser(req: Request, res: Response) {
  const user = (req as any).user
  if (user.role !== 'distributor') {
    res.status(403).json({ code: 403, message: 'Distributor only' })
    return null
  }
  return user
}

// Distributor can view their own organization profile
distributorRouter.get('/my-organization', requireAuth, async (req, res) => {
  try {
    const db = getDb()
    const user = requireDistributorUser(req, res)
    if (!user) return
    const organization = db.get(
      'SELECT id, name, code, username, status, site_display_name, created_at, updated_at FROM distributors WHERE id = ?',
      [user.distributorId],
    )
    if (!organization) {
      return res.status(404).json({ code: 404, message: '分销商不存在' })
    }
    res.json({ code: 200, data: organization })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

// Distributor updates their own display terminology
distributorRouter.put('/my-organization', requireAuth, async (req, res) => {
  try {
    const db = getDb()
    const user = requireDistributorUser(req, res)
    if (!user) return
    const { site_display_name } = req.body
    db.run(
      'UPDATE distributors SET site_display_name = ?, updated_at = ? WHERE id = ?',
      [site_display_name ? String(site_display_name).trim() : null, now(), user.distributorId],
    )
    const organization = db.get(
      'SELECT id, name, code, username, status, site_display_name, created_at, updated_at FROM distributors WHERE id = ?',
      [user.distributorId],
    )
    res.json({ code: 200, data: organization })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

// Distributor can view their own sites (before operator-only middleware)
distributorRouter.get('/my-sites', requireAuth, async (req, res) => {
  try {
    const db = getDb()
    const user = requireDistributorUser(req, res)
    if (!user) return
    const sites = db.all(
      `SELECT id, name, url, consumer_key, consumer_secret, status, distributor_id, webhook_secret, created_at, updated_at
       FROM sites
       WHERE distributor_id = ?`,
      [user.distributorId]
    )
    res.json({ code: 200, data: sites })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

// Distributor creates their own site
distributorRouter.post('/my-sites', requireAuth, async (req, res) => {
  try {
    const db = getDb()
    const user = requireDistributorUser(req, res)
    if (!user) return
    const { name, url, consumer_key, consumer_secret, status } = req.body
    if (!name || !url || !consumer_key || !consumer_secret) {
      return res.status(400).json({ code: 400, message: '请填写站点名称、URL、Consumer Key 和 Consumer Secret' })
    }
    const { v4: uuidv4 } = await import('uuid')
    const id = `site-${uuidv4().slice(0, 8)}`
    const ts = new Date().toISOString()
    db.run(
      'INSERT INTO sites (id, name, url, consumer_key, consumer_secret, status, distributor_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, url.replace(/\/$/, ''), consumer_key, consumer_secret, status === 'inactive' ? 'inactive' : 'active', user.distributorId, ts, ts]
    )
    const site = db.get('SELECT id, name, url, consumer_key, consumer_secret, status, distributor_id, webhook_secret, created_at, updated_at FROM sites WHERE id = ?', [id])
    res.status(201).json({ code: 200, data: site })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

// Distributor updates their own site
distributorRouter.put('/my-sites/:siteId', requireAuth, async (req, res) => {
  try {
    const db = getDb()
    const user = requireDistributorUser(req, res)
    if (!user) return
    const site = db.get('SELECT * FROM sites WHERE id = ? AND distributor_id = ?', [req.params.siteId, user.distributorId]) as any
    if (!site) {
      return res.status(404).json({ code: 404, message: '站点不存在或不属于您' })
    }

    const updatable = ['name', 'url', 'consumer_key', 'consumer_secret', 'status']
    const sets: string[] = []
    const params: unknown[] = []

    for (const field of updatable) {
      if (req.body[field] !== undefined) {
        sets.push(`${field} = ?`)
        params.push(field === 'url' ? String(req.body[field]).replace(/\/$/, '') : req.body[field])
      }
    }
    if (sets.length === 0) {
      return res.status(400).json({ code: 400, message: '没有可更新的字段' })
    }

    sets.push('updated_at = ?')
    params.push(now(), req.params.siteId)
    db.run(`UPDATE sites SET ${sets.join(', ')} WHERE id = ?`, params)

    const updated = db.get(
      'SELECT id, name, url, consumer_key, consumer_secret, status, distributor_id, webhook_secret, created_at, updated_at FROM sites WHERE id = ?',
      [req.params.siteId],
    )
    res.json({ code: 200, data: updated })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

// Distributor tests their own site connection
distributorRouter.post('/my-sites/:siteId/test', requireAuth, async (req, res) => {
  try {
    const db = getDb()
    const user = requireDistributorUser(req, res)
    if (!user) return
    const site = db.get('SELECT * FROM sites WHERE id = ? AND distributor_id = ?', [req.params.siteId, user.distributorId]) as any
    if (!site) {
      return res.status(404).json({ code: 404, message: '站点不存在或不属于您' })
    }
    const result = await testConnection({
      url: site.url,
      consumer_key: site.consumer_key,
      consumer_secret: site.consumer_secret,
    })
    res.json({ code: 200, data: { connected: result.ok, error: result.error } })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

// Distributor deletes their own site
distributorRouter.delete('/my-sites/:siteId', requireAuth, async (req, res) => {
  try {
    const db = getDb()
    const user = requireDistributorUser(req, res)
    if (!user) return
    const site = db.get('SELECT * FROM sites WHERE id = ? AND distributor_id = ?', [req.params.siteId, user.distributorId]) as any
    if (!site) {
      return res.status(404).json({ code: 404, message: '站点不存在或不属于您' })
    }
    // 与操作员删站点一致：依赖 FK CASCADE，不因订单/同步记录阻塞删除
    db.run('DELETE FROM sites WHERE id = ?', [req.params.siteId])
    res.json({ code: 200, data: { deleted: true } })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

// All routes below require operator role
distributorRouter.use(requireAuth, requireRole('operator'))

// GET /distributors
distributorRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb()
  const distributors = db.all(
    'SELECT id, name, code, username, status, site_display_name, created_at, updated_at FROM distributors ORDER BY created_at ASC'
  )
  respond(res, distributors)
})

// GET /distributors/:id
distributorRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const dist = db.get(
    'SELECT id, name, code, username, status, site_display_name, created_at, updated_at FROM distributors WHERE id = ?',
    [req.params.id]
  )
  if (!dist) return respondError(res, '分销商不存在', 404)

  // Include sites owned by this distributor
  const sites = db.all('SELECT id, name, url, status FROM sites WHERE distributor_id = ?', [req.params.id])
  respond(res, { ...(dist as any), sites })
})

// POST /distributors
distributorRouter.post('/', (req: Request, res: Response) => {
  const { name, code, username, password, site_display_name } = req.body
  if (!name || !code || !username || !password) {
    return respondError(res, '请提供 name, code, username, password')
  }

  const db = getDb()

  // Check unique constraints
  const existingCode = db.get('SELECT id FROM distributors WHERE code = ?', [code])
  if (existingCode) return respondError(res, `成员代码 "${code}" 已存在`)

  const existingUser = db.get('SELECT id FROM distributors WHERE username = ?', [username])
  if (existingUser) return respondError(res, `用户名 "${username}" 已存在`)

  // Also check operators table for username collision
  const existingOp = db.get('SELECT id FROM operators WHERE username = ?', [username])
  if (existingOp) return respondError(res, `用户名 "${username}" 已被占用`)

  const hash = bcrypt.hashSync(password, 10)
  const ts = now()
  db.run(
    'INSERT INTO distributors (name, code, username, password_hash, status, site_display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, code, username, hash, 'active', site_display_name ? String(site_display_name).trim() : null, ts, ts]
  )

  const created = db.get(
    'SELECT id, name, code, username, status, site_display_name, created_at, updated_at FROM distributors WHERE username = ?',
    [username]
  )
  respond(res, created, 201)
})

// PUT /distributors/:id
distributorRouter.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const dist = db.get('SELECT * FROM distributors WHERE id = ?', [req.params.id])
  if (!dist) return respondError(res, '分销商不存在', 404)

  const { name, code, username, password, status, site_display_name } = req.body
  const sets: string[] = []
  const params: unknown[] = []

  if (name !== undefined) { sets.push('name = ?'); params.push(name) }
  if (code !== undefined) {
    const existing = db.get('SELECT id FROM distributors WHERE code = ? AND id != ?', [code, req.params.id])
    if (existing) return respondError(res, `成员代码 "${code}" 已存在`)
    sets.push('code = ?'); params.push(code)
  }
  if (username !== undefined) {
    const existing = db.get('SELECT id FROM distributors WHERE username = ? AND id != ?', [username, req.params.id])
    if (existing) return respondError(res, `用户名 "${username}" 已存在`)
    const existingOp = db.get('SELECT id FROM operators WHERE username = ?', [username])
    if (existingOp) return respondError(res, `用户名 "${username}" 已被占用`)
    sets.push('username = ?'); params.push(username)
  }
  if (password) {
    sets.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10))
  }
  if (status !== undefined) { sets.push('status = ?'); params.push(status) }
  if (site_display_name !== undefined) { sets.push('site_display_name = ?'); params.push(site_display_name ? String(site_display_name).trim() : null) }

  if (sets.length === 0) return respondError(res, '没有可更新的字段')

  sets.push('updated_at = ?'); params.push(now()); params.push(req.params.id)
  db.run(`UPDATE distributors SET ${sets.join(', ')} WHERE id = ?`, params)

  const updated = db.get(
    'SELECT id, name, code, username, status, site_display_name, created_at, updated_at FROM distributors WHERE id = ?',
    [req.params.id]
  )
  respond(res, updated)
})

// DELETE /distributors/:id
distributorRouter.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const dist = db.get('SELECT * FROM distributors WHERE id = ?', [req.params.id])
  if (!dist) return respondError(res, '分销商不存在', 404)

  const siteCount = db.get('SELECT COUNT(*) as count FROM sites WHERE distributor_id = ?', [req.params.id]) as any
  if (siteCount?.count > 0) {
    return respondError(res, `该分销商下仍有 ${siteCount.count} 个站点，请先处理站点后再删除`)
  }

  // Check if distributor has orders
  const orderCount = db.get('SELECT COUNT(*) as count FROM orders WHERE distributor_id = ?', [req.params.id]) as any
  if (orderCount?.count > 0) {
    return respondError(res, `该分销商下有 ${orderCount.count} 个订单，无法删除`)
  }

  db.run('DELETE FROM distributors WHERE id = ?', [req.params.id])
  respond(res, { deleted: true })
})

// PUT /distributors/:id/sites - Bind sites to distributor
distributorRouter.put('/:id/sites', (req: Request, res: Response) => {
  const db = getDb()
  const dist = db.get('SELECT * FROM distributors WHERE id = ?', [req.params.id])
  if (!dist) return respondError(res, '分销商不存在', 404)

  const { site_ids } = req.body
  if (!Array.isArray(site_ids)) return respondError(res, 'site_ids 必须是数组')

  // Unbind all sites from this distributor first
  db.run('UPDATE sites SET distributor_id = NULL WHERE distributor_id = ?', [req.params.id])

  // Bind specified sites
  for (const siteId of site_ids) {
    db.run('UPDATE sites SET distributor_id = ? WHERE id = ?', [req.params.id, siteId])
  }

  const sites = db.all('SELECT id, name, url, status FROM sites WHERE distributor_id = ?', [req.params.id])
  respond(res, { sites })
})
