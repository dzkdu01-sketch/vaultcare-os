import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const operatorRouter = Router()

function now() { return new Date().toISOString() }
function respond(res: Response, data: unknown, code = 200) { res.status(code).json({ code, message: 'ok', data }) }
function respondError(res: Response, message: string, code = 400) { res.status(code).json({ code, message, data: null }) }

operatorRouter.use(requireAuth, requireRole('operator'))

// GET /operators
operatorRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb()
  const operators = db.all('SELECT id, name, username, status, created_at, updated_at FROM operators ORDER BY created_at ASC')
  respond(res, operators)
})

// POST /operators
operatorRouter.post('/', (req: Request, res: Response) => {
  const { name, username, password } = req.body
  if (!name || !username || !password) return respondError(res, '请提供 name, username, password')

  const db = getDb()
  const existing = db.get('SELECT id FROM operators WHERE username = ?', [username])
  if (existing) return respondError(res, `用户名 "${username}" 已存在`)
  const existingDist = db.get('SELECT id FROM distributors WHERE username = ?', [username])
  if (existingDist) return respondError(res, `用户名 "${username}" 已被占用`)

  const hash = bcrypt.hashSync(password, 10)
  const ts = now()
  db.run(
    'INSERT INTO operators (name, username, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [name, username, hash, 'active', ts, ts]
  )
  const created = db.get('SELECT id, name, username, status, created_at FROM operators WHERE username = ?', [username])
  respond(res, created, 201)
})

// PUT /operators/:id
operatorRouter.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const op = db.get('SELECT * FROM operators WHERE id = ?', [req.params.id])
  if (!op) return respondError(res, '操作员不存在', 404)

  const { name, username, password, status } = req.body
  const sets: string[] = []
  const params: unknown[] = []

  if (name !== undefined) { sets.push('name = ?'); params.push(name) }
  if (username !== undefined) {
    const existing = db.get('SELECT id FROM operators WHERE username = ? AND id != ?', [username, req.params.id])
    if (existing) return respondError(res, `用户名已存在`)
    sets.push('username = ?'); params.push(username)
  }
  if (password) { sets.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10)) }
  if (status !== undefined) { sets.push('status = ?'); params.push(status) }

  if (sets.length === 0) return respondError(res, '没有可更新的字段')
  sets.push('updated_at = ?'); params.push(now()); params.push(req.params.id)
  db.run(`UPDATE operators SET ${sets.join(', ')} WHERE id = ?`, params)

  const updated = db.get('SELECT id, name, username, status, created_at, updated_at FROM operators WHERE id = ?', [req.params.id])
  respond(res, updated)
})

// DELETE /operators/:id
operatorRouter.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const op = db.get('SELECT * FROM operators WHERE id = ?', [req.params.id])
  if (!op) return respondError(res, '操作员不存在', 404)

  const count = db.get('SELECT COUNT(*) as count FROM operators') as any
  if (count?.count <= 1) return respondError(res, '至少保留一个操作员')

  db.run('DELETE FROM operators WHERE id = ?', [req.params.id])
  respond(res, { deleted: true })
})
