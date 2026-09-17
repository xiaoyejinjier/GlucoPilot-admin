import type {
  AdminAccount, Banner, FoodCategory, FoodItem, News, Role
} from '@/types'
import { api as mockApi } from '@/mock'
import { adminConfig } from '@/config'
import { del, get, post, put, setAccessToken } from '@/utils/request'

function numId<T extends { id?: number | string }>(row: T): T & { id: number } {
  return { ...row, id: Number(row.id) }
}

/** 真实后端 API（登录 + CMS + 营养库 + 运营账号）；其余仍走 Mock */
const remote = {
  async login(username: string, password: string) {
    const data = await post<{
      accessToken: string
      expiresIn: number | string
      username: string
      nickname: string
      role: Role
      opsId: number | string
    }>('/admin/v1/auth/sessions', { username, password }, false)
    setAccessToken(data.accessToken)
    const acc: Omit<AdminAccount, 'password'> = {
      id: Number(data.opsId),
      username: data.username,
      nickname: data.nickname,
      role: data.role === 'admin' ? 'admin' : 'editor',
      status: 1,
      createdAt: '',
      lastLoginAt: new Date().toLocaleString('zh-CN', { hour12: false })
    }
    return acc
  },

  async listNews() {
    const list = await get<News[]>('/admin/v1/news')
    return list.map((n) => numId(n))
  },
  async saveNews(n: News) {
    const body = {
      title: n.title,
      summary: n.summary,
      channel: n.channel,
      type: n.type,
      coverUrl: n.coverUrl,
      coverText: n.coverText,
      videoUrl: n.videoUrl,
      content: n.content,
      status: n.status,
      publishAt: n.publishAt
    }
    const saved = n.id && Number(n.id) > 0
      ? await put<News>(`/admin/v1/news/${n.id}`, body)
      : await post<News>('/admin/v1/news', body)
    return numId(saved)
  },
  async removeNews(id: number) {
    await del(`/admin/v1/news/${id}`)
  },
  async setNewsStatus(id: number, status: News['status']) {
    await put(`/admin/v1/news/${id}/status`, { status })
  },

  async listBanners() {
    const list = await get<Banner[]>('/admin/v1/banners')
    return list.map((b) => numId(b))
  },
  async saveBanner(b: Banner) {
    const body = {
      title: b.title,
      image: b.image,
      linkType: b.linkType,
      linkValue: b.linkValue,
      sort: b.sort,
      enabled: b.enabled,
      remark: b.remark
    }
    const saved = b.id && Number(b.id) > 0
      ? await put<Banner>(`/admin/v1/banners/${b.id}`, body)
      : await post<Banner>('/admin/v1/banners', body)
    return numId(saved)
  },
  async removeBanner(id: number) {
    await del(`/admin/v1/banners/${id}`)
  },

  async listCategories() {
    const list = await get<FoodCategory[]>('/admin/v1/food-categories')
    return list.map((c) => numId(c))
  },
  async saveCategory(c: FoodCategory) {
    const body = { name: c.name, sort: c.sort }
    const saved = c.id && Number(c.id) > 0
      ? await put<FoodCategory>(`/admin/v1/food-categories/${c.id}`, body)
      : await post<FoodCategory>('/admin/v1/food-categories', body)
    return numId(saved)
  },
  async removeCategory(id: number) {
    await del(`/admin/v1/food-categories/${id}`)
  },

  async listFoods() {
    const list = await get<FoodItem[]>('/admin/v1/foods')
    return list.map((f) => ({
      ...numId(f),
      categoryId: Number(f.categoryId),
      carbs: Number(f.carbs),
      cal: Number(f.cal),
      gi: f.gi == null || f.gi === undefined ? null : Number(f.gi),
      description: f.description || '',
      image: f.image || '',
      enabled: !!f.enabled,
      updatedAt: f.updatedAt || ''
    }) as FoodItem)
  },
  async saveFood(f: FoodItem) {
    const body = {
      name: f.name,
      categoryId: f.categoryId,
      carbs: f.carbs,
      cal: f.cal,
      gi: f.gi,
      image: f.image,
      description: f.description,
      enabled: f.enabled
    }
    const saved = f.id && Number(f.id) > 0
      ? await put<FoodItem>(`/admin/v1/foods/${f.id}`, body)
      : await post<FoodItem>('/admin/v1/foods', body)
    return {
      ...numId(saved),
      categoryId: Number(saved.categoryId),
      carbs: Number(saved.carbs),
      cal: Number(saved.cal),
      gi: saved.gi == null || saved.gi === undefined ? null : Number(saved.gi),
      description: saved.description || '',
      image: saved.image || '',
      enabled: !!saved.enabled,
      updatedAt: saved.updatedAt || ''
    } as FoodItem
  },
  async removeFood(id: number) {
    await del(`/admin/v1/foods/${id}`)
  },

  async listAccounts() {
    const list = await get<AdminAccount[]>('/admin/v1/ops-accounts')
    return list.map((a) => ({
      ...numId(a),
      password: '',
      nickname: a.nickname || a.username,
      role: a.role === 'admin' ? 'admin' : 'editor',
      status: (Number(a.status) === 1 ? 1 : 0) as 1 | 0,
      createdAt: a.createdAt || '',
      lastLoginAt: a.lastLoginAt || ''
    }) as AdminAccount)
  },
  async saveAccount(a: AdminAccount) {
    if (a.id && Number(a.id) > 0) {
      const body: { nickname: string; role: Role; status: number; password?: string } = {
        nickname: a.nickname,
        role: a.role === 'admin' ? 'admin' : 'editor',
        status: a.status
      }
      if (a.password) body.password = a.password
      const saved = await put<AdminAccount>(`/admin/v1/ops-accounts/${a.id}`, body)
      return {
        ...numId(saved),
        password: '',
        role: saved.role === 'admin' ? 'admin' : 'editor',
        status: (Number(saved.status) === 1 ? 1 : 0) as 1 | 0
      } as AdminAccount
    }
    const saved = await post<AdminAccount>('/admin/v1/ops-accounts', {
      username: a.username,
      password: a.password,
      nickname: a.nickname,
      role: a.role === 'admin' ? 'admin' : 'editor',
      status: a.status
    })
    return {
      ...numId(saved),
      password: '',
      role: saved.role === 'admin' ? 'admin' : 'editor',
      status: (Number(saved.status) === 1 ? 1 : 0) as 1 | 0
    } as AdminAccount
  }
}

export const api = adminConfig.useMock
  ? mockApi
  : ({
      ...mockApi,
      ...remote
    } as typeof mockApi)

export { resetDb } from '@/mock'
