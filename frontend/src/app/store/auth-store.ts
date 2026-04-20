import type { AuthUser } from '../../services/types'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getSessionUser(): AuthUser | null {
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
