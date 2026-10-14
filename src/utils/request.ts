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

/** 默认超时：多数后台接口都是毫秒级，15s 足够暴露"后端没起来"。 */
const DEFAULT_TIMEOUT_MS = 15000

export interface RequestOptions extends RequestInit {
  auth?: boolean
  /**
   * 单次请求超时（毫秒）。默认 15000。
   * 后台"测试连通性"要真的打一次上游模型（后端上限 30s），必须显式放宽，
   * 否则前端会先超时并给出"请求超时，请确认后端已启动"这种误导性提示。
   */
  timeout?: number
}

function clearSessionOnAuthFail() {
  setAccessToken(null)
  localStorage.removeItem(AUTH_KEY)
}

export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true, headers, timeout = DEFAULT_TIMEOUT_MS, ...rest } = options
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
  const timer = window.setTimeout(() => ctrl.abort(), timeout)
  let res: Response
  try {
    res = await fetch(url, { ...rest, headers: h, signal: ctrl.signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error(`请求超时(${Math.round(timeout / 1000)}s)，请确认后端已启动（8080）且 Vite 代理正常`)
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

/** 第三个参数兼容两种写法：`true/false`（是否带 token）或 `{ auth, timeout }`。 */
type AuthOrOptions = boolean | RequestOptions

function asOptions(opts: AuthOrOptions | undefined): RequestOptions {
  if (opts === undefined) return {}
  return typeof opts === 'boolean' ? { auth: opts } : opts
}

export function get<T>(path: string, opts: AuthOrOptions = true) {
  return request<T>(path, { ...asOptions(opts), method: 'GET' })
}

export function post<T>(path: string, data?: unknown, opts: AuthOrOptions = true) {
  return request<T>(path, {
    ...asOptions(opts),
    method: 'POST',
    body: data === undefined ? undefined : JSON.stringify(data)
  })
}

export function put<T>(path: string, data?: unknown, opts: AuthOrOptions = true) {
  return request<T>(path, {
    ...asOptions(opts),
    method: 'PUT',
    body: data === undefined ? undefined : JSON.stringify(data)
  })
}

export function del<T>(path: string, opts: AuthOrOptions = true) {
  return request<T>(path, { ...asOptions(opts), method: 'DELETE' })
}
