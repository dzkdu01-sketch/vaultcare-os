import { useState, useEffect, useCallback } from 'react'
import { authAPI } from '@/api/endpoints'
import api from '@/api/client'

export interface User {
  id: number
  username: string
  is_staff: boolean
  is_superuser: boolean
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    !!localStorage.getItem('access_token')
  )
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me/')
      setUser(res.data)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const hasToken = !!localStorage.getItem('access_token')
    setIsAuthenticated(hasToken)
    if (hasToken) {
      refreshUser()
    }
  }, [refreshUser])

  const login = async (username: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await authAPI.login(username, password)
      localStorage.setItem('access_token', res.data.access)
      localStorage.setItem('refresh_token', res.data.refresh)
      setIsAuthenticated(true)
      await refreshUser()
      return true
    } catch {
      setError('用户名或密码错误')
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
