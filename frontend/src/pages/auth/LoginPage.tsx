import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../services/app-services'
import { setAuth } from '../../app/store/auth-store'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) { setError('请输入用户名和密码'); return }
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(username, password)
      setAuth(res.token, res.user)
      navigate('/orders')
    } catch (err: any) {
      const msg = err.message || '登录失败'
      try { setError(JSON.parse(msg)?.message || msg) } catch { setError(msg) }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-semibold text-center text-slate-800 mb-2">Vaultcare</h1>
        <p className="text-sm text-center text-slate-500 mb-6">订单管理系统</p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">账号</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="请输入账号"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-md bg-primary py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </main>
  )
}
