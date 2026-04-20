import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'vaultcare-secret-key-change-in-production'

export interface AuthUser {
  userId: number
  role: 'operator' | 'distributor'
  distributorId?: number
  name: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录', data: null })
  }
  try {
    const token = header.slice(7)
    req.user = verifyToken(token)
    next()
  } catch {
    return res.status(401).json({ code: 401, message: 'Token 无效或已过期', data: null })
  }
}

export function requireRole(...roles: Array<'operator' | 'distributor'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未登录', data: null })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '权限不足', data: null })
    }
    next()
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7))
    } catch { /* ignore invalid token */ }
  }
  next()
}
