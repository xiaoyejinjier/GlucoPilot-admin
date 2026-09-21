import { defineStore } from 'pinia'
import { api } from '@/api'
import { adminConfig } from '@/config'
import { getAccessToken, setAccessToken } from '@/utils/request'
import type { Role } from '@/types'

interface AccountSession {
  id: number
  username: string
  nickname: string
  role: Role
  roles?: string[]
  permissions?: string[]
  menuPaths?: string[]
}

const AUTH_KEY = 'kt_admin_auth'

function readSession(): AccountSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const account = JSON.parse(raw) as AccountSession
    // 真实联调：有会话无 Token 时清掉假登录态（常见于从 Mock 切到 API）
    if (!adminConfig.useMock && (!getAccessToken() || !Array.isArray(account.permissions))) {
      localStorage.removeItem(AUTH_KEY)
      return null
    }
    return account
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    account: readSession() as AccountSession | null
  }),
  getters: {
    isLoggedIn: (s) => {
      if (!s.account) return false
      if (!adminConfig.useMock && !getAccessToken()) return false
      return true
    },
    role: (s) => (s.account ? s.account.role : 'editor'),
    hasPermission: (s) => (permission: string) => {
      const permissions = s.account?.permissions || []
      // Mock 保持原有角色体验；真实环境由服务端下发权限作为唯一菜单依据。
      if (adminConfig.useMock) return true
      return permissions.includes('*:*:*') || permissions.includes(permission)
    }
  },
  actions: {
    async login(username: string, password: string) {
      const acc = await api.login(username, password)
      this.account = {
        id: acc.id,
        username: acc.username,
        nickname: acc.nickname,
        role: acc.role,
        roles: acc.roles || [],
        permissions: acc.permissions || [],
        menuPaths: acc.menuPaths || []
      }
      localStorage.setItem(AUTH_KEY, JSON.stringify(this.account))
      return this.account
    },
    logout() {
      this.account = null
      localStorage.removeItem(AUTH_KEY)
      setAccessToken(null)
    }
  }
})
