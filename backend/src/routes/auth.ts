import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/index.js'
import { signToken, requireAuth, requireRole } from '../middleware/auth.js'

export const authRouter = Router()

function respond(res: Response, data: unknown, code = 200) {
  res.status(code).json({ code, message: 'ok', data })
}
function respondError(res: Response, message: string, code = 400) {
  res.status(code).json({ code, message, data: null })
}

// POST /auth/login
authRouter.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body
  if (!username || !password) return respondError(res, '请输入用户名和密码')

  const db = getDb()

  // Check operators first
  const operator = db.get(
    "SELECT * FROM operators WHERE username = ? AND status = 'active'",
    [username]
  ) as any
  if (operator) {
    if (!bcrypt.compareSync(password, operator.password_hash)) {
      return respondError(res, '密码错误', 401)
    }
    const token = signToken({
      userId: operator.id,
      role: 'operator',
      name: operator.name,
    })
    return respond(res, {
      token,
      user: { id: operator.id, name: operator.name, role: 'operator' },
    })
  }

  // Check distributors
  const distributor = db.get(
    "SELECT * FROM distributors WHERE username = ? AND status = 'active'",
    [username]
  ) as any
  if (distributor) {
    if (!bcrypt.compareSync(password, distributor.password_hash)) {
      return respondError(res, '密码错误', 401)
    }
    const token = signToken({
      userId: distributor.id,
      role: 'distributor',
      distributorId: distributor.id,
      name: distributor.name,
    })
    return respond(res, {
      token,
      user: {
        id: distributor.id,
        name: distributor.name,
        role: 'distributor',
        distributorId: distributor.id,
        code: distributor.code,
      },
    })
  }

  return respondError(res, '用户不存在', 401)
})

// GET /auth/me
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const user = req.user!

  if (user.role === 'operator') {
    const op = db.get('SELECT id, name, username, status FROM operators WHERE id = ?', [user.userId]) as any
    if (!op) return respondError(res, '用户不存在', 404)
    return respond(res, { ...op, role: 'operator' })
  } else {
    const dist = db.get('SELECT id, name, code, username, status FROM distributors WHERE id = ?', [user.userId]) as any
    if (!dist) return respondError(res, '用户不存在', 404)
    return respond(res, { ...dist, role: 'distributor', distributorId: dist.id })
  }
})

// POST /auth/init-admin - Create initial admin operator (only works if no operators exist)
authRouter.post('/init-admin', (req: Request, res: Response) => {
  const db = getDb()
  const existing = db.get('SELECT COUNT(*) as count FROM operators')
  if ((existing as any)?.count > 0) {
    return respondError(res, '已存在操作员账号，无法初始化', 403)
  }

  const { username, password, name } = req.body
  if (!username || !password || !name) {
    return respondError(res, '请提供 username, password, name')
  }

  const hash = bcrypt.hashSync(password, 10)
  const ts = new Date().toISOString()
  db.run(
    'INSERT INTO operators (name, username, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [name, username, hash, 'active', ts, ts]
  )

  const op = db.get('SELECT id, name, username FROM operators WHERE username = ?', [username]) as any
  const token = signToken({ userId: op.id, role: 'operator', name: op.name })
  respond(res, { token, user: { id: op.id, name: op.name, role: 'operator' } }, 201)
})
