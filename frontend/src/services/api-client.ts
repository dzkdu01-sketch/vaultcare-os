/** 须含 /api/v1，与后端 Express 挂载一致；开发环境推荐 /api/v1 走 Vite 代理 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}

  const token = localStorage.getItem('auth_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const isRawBody = body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams
  if (body !== undefined && !isRawBody) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined
      ? undefined
      : isRawBody
        ? body as BodyInit
        : JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text || res.statusText)
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T
  }

  const json = await res.json()
  // Unwrap standard { code, data } response envelope
  if (json && typeof json === 'object' && 'code' in json && 'data' in json) {
    return json.data as T
  }
  return json as T
}

async function getBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {}
  const token = localStorage.getItem('auth_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text || res.statusText)
  }
  return res.blob()
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  /** 下载二进制（如 PNG），不解析 JSON */
  getBlob: (path: string) => getBlob(path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
