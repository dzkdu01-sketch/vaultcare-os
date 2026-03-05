import { useState, useEffect, useCallback } from 'react'
import { authAPI } from '@/api/endpoints'
import api from '@/api/client'

export interface User {
  id: number
  username: string
  is_staff: boolean
  is_superuser: boolean
}

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
const DEMO_USER: User = {
  id: 0,
  username: 'test_admin',
  is_staff: true,
  is_superuser: true,
}
const DEMO_ACCESS_TOKEN = 'demo-mode-access-token'
const DEMO_REFRESH_TOKEN = 'demo-mode-refresh-token'

export function useAuth() {
  const hasDemoSession = localStorage.getItem('access_token') === DEMO_ACCESS_TOKEN
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    !!localStorage.getItem('access_token') || hasDemoSession
  )
  const [user, setUser] = useState<User | null>(hasDemoSession ? DEMO_USER : null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshUser = useCallback(async () => {
    if (localStorage.getItem('access_token') === DEMO_ACCESS_TOKEN) {
      setUser(DEMO_USER)
      return
    }
    try {
      const res = await api.get('/auth/me/')
      setUser(res.data)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token')
    const hasToken = !!accessToken
    const isDemoToken = accessToken === DEMO_ACCESS_TOKEN
    setIsAuthenticated(hasToken)
    if (isDemoToken) {
      setUser(DEMO_USER)
      return
    }
    if (hasToken) {
      refreshUser()
    }
  }, [refreshUser])

  const login = async (username: string, password: string) => {
    setLoading(true)
    setError(null)
    if (DEMO_MODE && username === DEMO_USER.username && password === '123456') {
      localStorage.setItem('access_token', DEMO_ACCESS_TOKEN)
      localStorage.setItem('refresh_token', DEMO_REFRESH_TOKEN)
      setUser(DEMO_USER)
      setIsAuthenticated(true)
      setLoading(false)
      return true
    }
    try {
      const res = await authAPI.login(username, password)
      localStorage.setItem('access_token', res.data.access)
      localStorage.setItem('refresh_token', res.data.refresh)
      setIsAuthenticated(true)
      await refreshUser()
      return true
    } catch {
      setError(DEMO_MODE ? '用户名或密码错误（演示模式可用 test_admin / 123456）' : '用户名或密码错误')
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.clear()
    setIsAuthenticated(false)
    setUser(null)
  }

  return {
    isAuthenticated,
    user,
    loading,
    error,
    login,
    logout,
    isStaff: user?.is_staff ?? false,
    isSuperuser: user?.is_superuser ?? false,
  }
}
