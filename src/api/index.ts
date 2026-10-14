import type {
  AdminAccount, AiModelListMeta, AiModelRow, AiModelSavePayload, AiModelTestResult,
  AppUser, Banner, Feedback, FeedbackStatus, FeedbackType, FoodCategory, FoodItem, HealthArchive, News, Role
} from '@/types'
import { api as mockApi } from '@/mock'
import { adminConfig } from '@/config'
import { del, get, post, put, setAccessToken } from '@/utils/request'
import { fmtTime } from '@/utils/format'

function numId<T extends { id?: number | string }>(row: T): T & { id: number } {
  return { ...row, id: Number(row.id) }
}

interface AdminFeedbackRow {
  id: string
  userId: string
  userName: string
  contact?: string | null
  feedbackType: number
  contentText: string
  replyStatus: number
  officialReply?: string | null
  createdAt: string
  repliedAt?: string | null
}

interface PageData<T> {
  records: T[]
}

interface AdminUserRow {
  id: string
  username: string
  nickname: string
  avatarText?: string | null
  phoneMasked?: string | null
  age?: number | null
  diabetesTypeText?: string | null
  accountStatus: number
  registeredAt?: string | null
  lastActiveAt?: string | null
  recordCount: number
  mealCount: number
  complianceRate: number
}

const feedbackTypes: Record<number, FeedbackType> = {
  1: '产品建议',
  2: 'Bug问题',
  3: '功能诉求',
  4: '其他'
}

function feedbackStatus(code: number): FeedbackStatus {
  if (code === 1) return 'processing'
  if (code === 2 || code === 3) return 'done'
  return 'received'
}

function feedbackStatusCode(status: FeedbackStatus): number {
  if (status === 'processing') return 1
  if (status === 'done') return 2
  return 0
}

/** 真实后端 API（登录 + CMS + 营养库 + 运营账号 + 反馈闭环）；其余仍走 Mock */
const remote = {
  async login(username: string, password: string) {
    const data = await post<{
      accessToken: string
      expiresIn: number | string
      username: string
      nickname: string
      role: Role
      opsId: number | string
      roles?: string[]
      permissions?: string[]
      menus?: Array<{ path?: string | null }>
    }>('/admin/v1/auth/sessions', { username, password }, false)
    setAccessToken(data.accessToken)
    const acc: Omit<AdminAccount, 'password'> = {
      id: Number(data.opsId),
      username: data.username,
      nickname: data.nickname,
      role: data.role === 'admin' ? 'admin' : 'editor',
      status: 1,
      createdAt: '',
      lastLoginAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      roles: data.roles || [],
      permissions: data.permissions || [],
      menuPaths: (data.menus || []).map((menu) => menu.path).filter((path): path is string => Boolean(path))
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
      categoryId: Number(f.categoryId),
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

  async listUsers() {
    const page = await get<PageData<AdminUserRow>>('/admin/v1/users?pageNum=1&pageSize=100')
    return (page.records || []).map((row) => ({
      id: Number(row.id),
      username: row.username || `user_${row.id}`,
      nickname: row.nickname || `用户#${row.id}`,
      avatarText: row.avatarText || (row.nickname ? row.nickname.slice(0, 1) : '用'),
      phone: row.phoneMasked || '未绑定',
      age: Number(row.age) || 0,
      diabetesType: row.diabetesTypeText || '未填写',
      status: Number(row.accountStatus) === 1 ? 'enabled' : 'disabled',
      registeredAt: row.registeredAt ? fmtTime(row.registeredAt) : '',
      lastActiveAt: row.lastActiveAt ? fmtTime(row.lastActiveAt) : '',
      recordCount: Number(row.recordCount) || 0,
      mealCount: Number(row.mealCount) || 0,
      compliance: Number(row.complianceRate) || 0
    }) as AppUser)
  },
  async toggleUserStatus(id: number, enabled: boolean) {
    await put(`/admin/v1/users/${id}/status`, { accountStatus: enabled ? 1 : 0 })
  },
  async archiveOf(userId: number) {
    const a = await get<{
      userId: string
      owner: {
        nickname: string
        phoneMasked?: string | null
        age?: number | null
        diabetesTypeText?: string | null
        registeredAt?: string | null
      }
      profile: {
        height?: number | null
        weight?: number | null
        medication?: string | null
        exerciseHabit?: string | null
        diagnosedYm?: string | null
      }
      trend: Array<{ date: string; avg: number | null; okRate: number | null }>
      nodeStats: Array<{ node: string; nodeName: string; avg: number | null; samples: number | null }>
      mealSummary?: {
        recordDays?: number | null
        avgCarbsG?: number | null
        avgCal?: number | null
        topFoods?: string[] | null
      } | null
      summary?: string | null
    }>(`/admin/v1/users/${userId}/archive`)
    return {
      userId: Number(a.userId),
      owner: {
        nickname: a.owner.nickname,
        phone: a.owner.phoneMasked || '',
        age: a.owner.age ?? 0,
        diabetesType: a.owner.diabetesTypeText || '未填写',
        registeredAt: a.owner.registeredAt ? fmtTime(a.owner.registeredAt) : ''
      },
      profile: {
        height: a.profile.height ?? null,
        weight: a.profile.weight ?? null,
        medication: a.profile.medication || '未填写',
        exercise: a.profile.exerciseHabit || '未填写',
        diagnosedAt: a.profile.diagnosedYm || '未填写'
      },
      trend: (a.trend || []).map((t) => ({
        date: t.date,
        avg: Number(t.avg) || 0,
        okRate: Number(t.okRate) || 0
      })),
      nodeStats: (a.nodeStats || []).map((n) => ({
        node: n.node,
        nodeName: n.nodeName,
        avg: Number(n.avg) || 0,
        samples: Number(n.samples) || 0
      })),
      mealSummary: {
        recordDays: Number(a.mealSummary?.recordDays) || 0,
        avgCarbsG: Number(a.mealSummary?.avgCarbsG) || 0,
        avgCal: Number(a.mealSummary?.avgCal) || 0,
        topFoods: a.mealSummary?.topFoods || []
      },
      // 后端暂无 AI 小结数据源（TODO）；此处仅占位提示，避免展示 Mock 文案
      summary: a.summary || '暂未生成 AI 档案小结，后续接入后自动展示。'
    } as HealthArchive
  },

  async listFeedback() {
    const page = await get<PageData<AdminFeedbackRow>>('/admin/v1/feedbacks?pageNum=1&pageSize=100')
    return (page.records || []).map((row) => ({
      id: Number(row.id),
      userId: Number(row.userId),
      userName: row.userName || `用户#${row.userId}`,
      type: feedbackTypes[row.feedbackType] || '其他',
      content: row.contentText || '',
      contact: row.contact || '',
      status: feedbackStatus(Number(row.replyStatus)),
      reply: row.officialReply || '',
      createdAt: fmtTime(row.createdAt),
      processedAt: row.repliedAt ? fmtTime(row.repliedAt) : ''
    }) as Feedback)
  },
  async replyFeedback(id: number, reply: string, status: FeedbackStatus) {
    await put(`/admin/v1/feedbacks/${id}/reply`, {
      replyStatus: feedbackStatusCode(status),
      officialReply: reply.trim()
    })
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

/** 完整若依管理模块只使用真实后端；Mock 模式会明确提示，避免演示数据被误当成权限配置。 */
export type RuoYiRow = Record<string, unknown> & { id: number | string }

function requireRemote() {
  if (adminConfig.useMock) throw new Error('若依系统管理需要连接后端，请将 VITE_USE_MOCK 关闭后重试')
}

export const ruoyiApi = {
  async list<T = RuoYiRow>(resource: string): Promise<T[]> {
    requireRemote()
    return get<T[]>(`/admin/v1/ruoyi/${resource}`)
  },
  async create<T = RuoYiRow>(resource: string, data: unknown): Promise<T> {
    requireRemote()
    return post<T>(`/admin/v1/ruoyi/${resource}`, data)
  },
  async getOne<T = Record<string, unknown>>(resource: string): Promise<T> {
    requireRemote()
    return get<T>(`/admin/v1/ruoyi/${resource}`)
  },
  async update<T = RuoYiRow>(resource: string, id: number | string, data: unknown): Promise<T> {
    requireRemote()
    return put<T>(`/admin/v1/ruoyi/${resource}/${id}`, data)
  },
  async remove(resource: string, id: number | string): Promise<void> {
    requireRemote()
    await del(`/admin/v1/ruoyi/${resource}/${id}`)
  },
  async runJob(id: number | string): Promise<void> {
    requireRemote()
    await post(`/admin/v1/ruoyi/jobs/${id}/run`)
  },
  async generatorTables() {
    requireRemote()
    return get<RuoYiRow[]>('/admin/v1/ruoyi/generator/tables')
  },
  async syncGeneratorTable(name: string) {
    requireRemote()
    return post<Record<string, unknown>>(`/admin/v1/ruoyi/generator/tables/${encodeURIComponent(name)}/sync`)
  },
  async previewGeneratorTable(id: number | string) {
    requireRemote()
    return get<Record<string, unknown>>(`/admin/v1/ruoyi/generator/tables/${id}/preview`)
  }
}

/** 后端列表返回 { records, textDefaultCode, textDefaultReason, ... }（AdminAiModelDtos.ModelList）；同时兼容裸数组，避免契约微调时前端直接崩。 */
type AiModelListData =
  | AiModelRow[]
  | {
      records?: AiModelRow[] | null
      list?: AiModelRow[] | null
      textDefaultCode?: string | null
      textDefaultSource?: string | null
      textDefaultReason?: string | null
    }
  | null

/** 列表 + "当前生效情况"：页面要能说清"现在真正在用哪个模型、为什么是它"。 */
export interface AiModelListResult {
  rows: AiModelRow[]
  meta: AiModelListMeta
}

/** 后端字段几乎都可空，这里统一补齐默认值，页面层只需处理业务展示。 */
function normalizeAiModelRow(row: AiModelRow): AiModelRow {
  return {
    ...row,
    id: String(row.id ?? ''),
    modelCode: row.modelCode || '',
    modelName: row.modelName || '',
    providerCode: Number(row.providerCode) || 0,
    providerText: row.providerText || '',
    modelEndpoint: row.modelEndpoint || '',
    isDefault: Number(row.isDefault) === 1 ? 1 : 0,
    isEnabled: Number(row.isEnabled) === 1 ? 1 : 0,
    apiKeyMasked: row.apiKeyMasked || '',
    apiKeySource: row.apiKeySource || 'none',
    configVersion: Number(row.configVersion) || 0,
    source: row.source === 'db' ? 'db' : 'yaml'
  }
}

/** AI 模型配置：只走真实后端（不参与 Mock 分支），密钥不回传明文，仅给出掩码与来源。 */
export const aiModelApi = {
  /** 列表 + 当前生效情况（textDefault* 三个字段由后端按"默认标记→唯一启用→最近修改→yaml"选出）。 */
  async list(): Promise<AiModelListResult> {
    requireRemote()
    const data = await get<AiModelListData>('/admin/v1/ai/models')
    const rows = Array.isArray(data) ? data : data?.records || data?.list || []
    const meta: AiModelListMeta = {
      textDefaultCode: (Array.isArray(data) ? '' : data?.textDefaultCode) || '',
      textDefaultSource: (Array.isArray(data) ? 'yaml' : data?.textDefaultSource) === 'db' ? 'db' : 'yaml',
      textDefaultReason: (Array.isArray(data) ? '' : data?.textDefaultReason) || ''
    }
    return { rows: rows.filter(Boolean).map(normalizeAiModelRow), meta }
  },
  async getOne(id: string): Promise<AiModelRow> {
    requireRemote()
    return normalizeAiModelRow(await get<AiModelRow>(`/admin/v1/ai/models/${id}`))
  },
  async create(payload: AiModelSavePayload): Promise<AiModelRow> {
    requireRemote()
    return normalizeAiModelRow(await post<AiModelRow>('/admin/v1/ai/models', payload))
  },
  /** 修改必须带 configVersion，后端据此做乐观锁校验。 */
  async update(id: string, payload: AiModelSavePayload): Promise<AiModelRow> {
    requireRemote()
    return normalizeAiModelRow(await put<AiModelRow>(`/admin/v1/ai/models/${id}`, payload))
  },
  async setEnabled(id: string, enabled: number): Promise<AiModelRow> {
    requireRemote()
    return normalizeAiModelRow(await post<AiModelRow>(`/admin/v1/ai/models/${id}/enabled`, { enabled: enabled ? 1 : 0 }))
  },
  /** 后端会顺便把其它行的默认标记清掉，调用方需要重新拉列表。 */
  async setDefault(id: string): Promise<AiModelRow> {
    requireRemote()
    return normalizeAiModelRow(await post<AiModelRow>(`/admin/v1/ai/models/${id}/default`))
  },
  /** 后端会真的发一次最小请求，可能比较慢（见 request.ts 的 15s 前端超时）。 */
  async test(id: string): Promise<AiModelTestResult> {
    requireRemote()
    return post<AiModelTestResult>(`/admin/v1/ai/models/${id}/test`)
  }
}

export { resetDb } from '@/mock'
