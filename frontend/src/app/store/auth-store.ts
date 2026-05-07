import type { AuthUser } from '../../services/types'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4 || 4)) % 4, '=')
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  const exp = Number(payload?.exp)
  if (!Number.isFinite(exp) || exp <= 0) return false
  const nowSec = Math.floor(Date.now() / 1000)
  return exp <= nowSec
}

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  if (isTokenExpired(token)) {
    clearAuth()
    return null
  }
  return token
}

export function getSessionUser(): AuthUser | null {
  const token = getToken()
  if (!token) return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isOperator(): boolean {
  const user = getSessionUser()
  return user?.role === 'operator'
}

export function isDistributor(): boolean {
  const user = getSessionUser()
  return user?.role === 'distributor'
}
