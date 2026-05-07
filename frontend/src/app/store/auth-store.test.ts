import { describe, expect, it } from 'vitest'
import { clearAuth, getSessionUser, setAuth } from './auth-store'

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function makeJwt(expUnixSeconds: number): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({ exp: expUnixSeconds }))
  return `${header}.${payload}.signature`
}

describe('auth-store token expiry', () => {
  it('clears expired token and returns null user', () => {
    const expiredToken = makeJwt(Math.floor(Date.now() / 1000) - 60)
    setAuth(expiredToken, { id: 1, name: 'Admin', role: 'operator' })

    expect(getSessionUser()).toBeNull()
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('auth_user')).toBeNull()
  })

  it('keeps valid token and returns user', () => {
    clearAuth()
    const validToken = makeJwt(Math.floor(Date.now() / 1000) + 3600)
    setAuth(validToken, { id: 2, name: 'D', role: 'distributor', distributorId: 2 })

    const user = getSessionUser()
    expect(user?.id).toBe(2)
    expect(user?.role).toBe('distributor')
  })
})
