import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  // Django getlist() 需 param=val 重复键；显式序列化数组为重复键（Bug-07）
  paramsSerializer: {
    serialize: (params: Record<string, unknown>) => {
      const sp = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue
        if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)))
        else sp.append(k, String(v))
      }
      return sp.toString()
    },
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // Keep local debug ingest only in development to avoid production noise.
    if (import.meta.env.DEV) {
      fetch('http://127.0.0.1:7245/ingest/54fcb604-8024-4e9b-b085-1b417978616e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: 'api-error-debug',
          hypothesisId: 'H2',
          location: 'client.ts:responseInterceptor:error',
          message: 'api error intercepted',
          data: {
            url: error?.config?.url || '',
            method: error?.config?.method || '',
            status: error?.response?.status || null,
            data: error?.response?.data || null,
            baseURL: error?.config?.baseURL || '',
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    }

    const original = error?.config
    if (!original) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const res = await axios.post(`${API_BASE}/token/refresh/`, { refresh })
          localStorage.setItem('access_token', res.data.access)
          original.headers = original.headers ?? {}
          original.headers.Authorization = `Bearer ${res.data.access}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      } else {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
