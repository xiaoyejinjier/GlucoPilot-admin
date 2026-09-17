import { adminConfig } from '@/config'

const TOKEN_KEY = 'kt_admin_token'
const AUTH_KEY = 'kt_admin_auth'

export function getAccessToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

interface ApiBody<T> {
  code: number
  message: string
  data: T
  requestId?: string
}

function clearSessionOnAuthFail() {
  setAccessToken(null)
  localStorage.removeItem(AUTH_KEY)
}

export async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options
  const h = new Headers(headers)
  if (!h.has('Content-Type') && rest.body) {
    h.set('Content-Type', 'application/json')
  }
  if (auth) {
    const token = getAccessToken()
    if (token) h.set('Authorization', `Bearer ${token}`)
  }

  const url = path.startsWith('http') ? path : `${adminConfig.baseUrl}${path}`
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 15000)
  let res: Response
  try {
    res = await fetch(url, { ...rest, headers: h, signal: ctrl.signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('请求超时，请确认后端已启动（8080）且 Vite 代理正常')
    }
    throw new Error((e as Error).message || '网络异常')
  } finally {
    window.clearTimeout(timer)
  }

  let body: ApiBody<T> | null = null
  try {
    body = (await res.json()) as ApiBody<T>
  } catch {
    throw new Error(`请求失败(${res.status})`)
  }
  if (res.status === 401 || body.code === 40100) {
    clearSessionOnAuthFail()
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
    }
    throw Object.assign(new Error(body.message || '未登录或 Token 失效'), { code: 40100 })
  }
  if (!(res.status >= 200 && res.status < 300 && body.code === 0)) {
    throw Object.assign(new Error(body.message || `请求失败(${res.status})`), {
      code: body.code,
      status: res.status
    })
  }
  return body.data
}

export function get<T>(path: string, auth = true) {
  return request<T>(path, { method: 'GET', auth })
}

export function post<T>(path: string, data?: unknown, auth = true) {
  return request<T>(path, {
    method: 'POST',
    auth,
    body: data === undefined ? undefined : JSON.stringify(data)
  })
}

export function put<T>(path: string, data?: unknown, auth = true) {
  return request<T>(path, {
    method: 'PUT',
    auth,
    body: data === undefined ? undefined : JSON.stringify(data)
  })
}

export function del<T>(path: string, auth = true) {
  return request<T>(path, { method: 'DELETE', auth })
}
