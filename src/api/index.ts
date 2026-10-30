import type {
  AdminAccount, AiMemoryListData, AiMemoryPageResult, AiMemoryRawRow, AiMemoryRow,
  AiModelListMeta, AiModelRow, AiModelSavePayload, AiModelTestResult,
  AiPromptSaveResult, AiPromptScene, AiPromptTemplateListData, AiPromptTemplateRow,
  AiPromptTemplateSavePayload, AiSceneListData, AiSceneListResult, AiSceneModelOption, AiSceneRow,
  AiSceneSavePayload,
  AppUser, Banner, DeviceItem, Feedback, FeedbackStatus, FeedbackType, FoodCategory, FoodItem,
  HealthArchive, MediaBizType, News, NineSlotResult, OpsAuditLogListData, OpsAuditLogPageResult,
  OpsAuditLogQuery, OpsAuditLogRawRow, OpsAuditLogRow, Role
} from '@/types'
import { api as mockApi } from '@/mock'
import { adminConfig } from '@/config'
import { cmsMediaApi } from '@/api/cms-media'
import { del, get, patch, post, put, setAccessToken } from '@/utils/request'
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
  pageNum: number
  pageSize: number
  total: number
  pages: number
  records: T[]
}

function queryString(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, String(value))
  })
  return query.toString()
}

interface AdminUserRow {
  id: string
  username: string
  nickname: string
  avatarText?: string | null
  phoneMasked?: string | null
  phone?: string | null
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

function feedbackStatus(reply: string | null | undefined): FeedbackStatus {
  return reply?.trim() ? 'done' : 'received'
}

function mapFood(f: FoodItem): FoodItem {
  return {
    ...numId(f),
    categoryId: Number(f.categoryId),
    carbs: Number(f.carbs),
    cal: Number(f.cal),
    gi: f.gi == null || f.gi === undefined ? null : Number(f.gi),
    description: f.description || '',
    image: f.image || '',
    enabled: !!f.enabled,
    updatedAt: f.updatedAt || ''
  } as FoodItem
}

function mapUser(row: AdminUserRow): AppUser {
  return {
    id: Number(row.id),
    username: row.username || `user_${row.id}`,
    nickname: row.nickname || `用户#${row.id}`,
    avatarText: row.avatarText || (row.nickname ? row.nickname.slice(0, 1) : '用'),
    phone: row.phone || row.phoneMasked || '未绑定',
    age: Number(row.age) || 0,
    diabetesType: row.diabetesTypeText || '未填写',
    status: Number(row.accountStatus) === 1 ? 'enabled' : 'disabled',
    registeredAt: row.registeredAt ? fmtTime(row.registeredAt) : '',
    lastActiveAt: row.lastActiveAt ? fmtTime(row.lastActiveAt) : '',
    recordCount: Number(row.recordCount) || 0,
    mealCount: Number(row.mealCount) || 0,
    compliance: Number(row.complianceRate) || 0
  }
}

function mapFeedback(row: AdminFeedbackRow): Feedback {
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    userName: row.userName || `用户#${row.userId}`,
    type: feedbackTypes[row.feedbackType] || '其他',
    content: row.contentText || '',
    contact: row.contact || '',
    status: feedbackStatus(row.officialReply),
    reply: row.officialReply || '',
    createdAt: fmtTime(row.createdAt),
    processedAt: row.repliedAt ? fmtTime(row.repliedAt) : ''
  }
}

/** 真实后端 API（登录 + CMS + 营养库 + 运营账号 + 反馈闭环）；其余仍走 Mock */
const remote = {
  async listMedia() {
    return cmsMediaApi.list('all')
  },
  async mockUpload(_name: string, _bizType: MediaBizType, _uploader: string) {
    throw new Error('请在媒体素材页选择资讯/轮播用途后上传真实文件，不再支持模拟登记')
  },
  async removeMedia(id: number) {
    await cmsMediaApi.remove(id)
  },

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
      tagCodes: n.tagCodes || [],
      customTags: n.customTags || [],
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
    const body = { name: c.name, sort: c.sort, image: c.image }
    const saved = c.id && Number(c.id) > 0
      ? await put<FoodCategory>(`/admin/v1/food-categories/${c.id}`, body)
      : await post<FoodCategory>('/admin/v1/food-categories', body)
    if (c.image !== undefined && (typeof saved.image !== 'string' || saved.image.trim() !== c.image.trim())) {
      throw new Error('分类图片未保存：当前后端未应用图片字段，请重启后端后重试')
    }
    return numId(saved)
  },
  async removeCategory(id: number) {
    await del(`/admin/v1/food-categories/${id}`)
  },

  async listFoods() {
    const data = await get<PageData<FoodItem> | FoodItem[]>('/admin/v1/foods?pageNum=1&pageSize=100')
    return (Array.isArray(data) ? data : (data.records || [])).map(mapFood)
  },
  async pageFoods(params: { pageNum: number; pageSize: number; keyword?: string; categoryId?: number; enabled?: boolean; pendingReview?: boolean }) {
    const page = await get<PageData<FoodItem>>(`/admin/v1/foods?${queryString(params)}`)
    if (!page || Array.isArray(page) || !Array.isArray(page.records) || !Number.isFinite(Number(page.total))) {
      throw new Error('食品接口未返回分页数据，请确认后端已更新并重启')
    }
    return { ...page, total: Number(page.total), records: page.records.map(mapFood) }
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
    return (page.records || []).map(mapUser)
  },
  async pageUsers(params: { pageNum: number; pageSize: number; keyword?: string; accountStatus?: number }) {
    const page = await get<PageData<AdminUserRow>>(`/admin/v1/users?${queryString(params)}`)
    return { ...page, records: (page.records || []).map(mapUser) }
  },
  async pageNineSlotRecords(params: { pageNum: number; pageSize: number; startDate: string; endDate: string; keyword?: string }) {
    return get<NineSlotResult>(`/admin/v1/health-records/nine-slot?${queryString(params)}`)
  },
  async toggleUserStatus(id: number, enabled: boolean) {
    await put(`/admin/v1/users/${id}/status`, { accountStatus: enabled ? 1 : 0 })
  },

  async listDevices(params?: { keyword?: string; deviceStatus?: number }) {
    const q = new URLSearchParams({ pageNum: '1', pageSize: '100' })
    if (params?.keyword) q.set('keyword', params.keyword)
    if (params?.deviceStatus !== undefined && params.deviceStatus !== null) {
      q.set('deviceStatus', String(params.deviceStatus))
    }
    const page = await get<PageData<{
      id: string
      deviceSn: string
      deviceName: string
      provider: string
      userId?: string | null
      userMasked?: string | null
      deviceStatus: number
      lastSyncAt?: string | null
    }>>(`/admin/v1/devices?${q.toString()}`)
    return (page.records || []).map((row) => ({
      id: Number(row.id),
      deviceSn: row.deviceSn || '',
      deviceName: row.deviceName || '',
      provider: row.provider || 'MOCK',
      userId: row.userId ? String(row.userId) : '',
      userMasked: row.userMasked || '未绑定',
      deviceStatus: Number(row.deviceStatus) === 1 ? 1 : 0,
      lastSyncAt: row.lastSyncAt ? fmtTime(row.lastSyncAt) : ''
    }) as DeviceItem)
  },
  async saveDevice(d: DeviceItem) {
    const userId = d.userId && String(d.userId).trim() ? Number(d.userId) : null
    if (d.id && Number(d.id) > 0) {
      await put(`/admin/v1/devices/${d.id}`, {
        deviceName: d.deviceName.trim(),
        provider: (d.provider || 'MOCK').trim(),
        userId
      })
      return d
    }
    const saved = await post<{ id: string }>(`/admin/v1/devices`, {
      deviceSn: d.deviceSn.trim(),
      deviceName: d.deviceName.trim(),
      provider: (d.provider || 'MOCK').trim(),
      userId
    })
    return { ...d, id: Number(saved.id) } as DeviceItem
  },
  async toggleDeviceStatus(id: number, deviceStatus: number) {
    await put(`/admin/v1/devices/${id}/status`, { deviceStatus })
  },
  async removeDevice(id: number) {
    await del(`/admin/v1/devices/${id}`)
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
    return (page.records || []).map(mapFeedback)
  },
  async pageFeedback(params: { pageNum: number; pageSize: number; keyword?: string; feedbackType?: number; replyStatus?: number }) {
    const page = await get<PageData<AdminFeedbackRow>>(`/admin/v1/feedbacks?${queryString(params)}`)
    return { ...page, records: (page.records || []).map(mapFeedback) }
  },
  async replyFeedback(id: number, reply: string) {
    await put(`/admin/v1/feedbacks/${id}/reply`, {
      replyStatus: 2,
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
    // 能力：历史行 capability 为空 → 按「只有文本」展示（与后端"NULL 视为 text"对齐）
    capability: (row.capability || '').trim() || 'text',
    capabilityText: row.capabilityText || '文本',
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
  /** 后端会真的发一次最小请求（上限 30s），所以把前端超时放宽到 35s——否则前端先超时会给出误导性提示。 */
  async test(id: string): Promise<AiModelTestResult> {
    requireRemote()
    return post<AiModelTestResult>(`/admin/v1/ai/models/${id}/test`, undefined, { timeout: 35000 })
  }
}

/* ---------------- AI 提示词管理（/admin/v1/ai-prompt-templates） ---------------- */

/** 列表返回 records（该场景的全部版本，含停用）+ scenes（场景与生效来源），字段可能为 null。 */
export interface AiPromptListResult {
  rows: AiPromptTemplateRow[]
  scenes: AiPromptScene[]
}

function normalizePromptScene(scene: AiPromptScene): AiPromptScene {
  return {
    ...scene,
    sceneCode: scene.sceneCode || '',
    configKey: scene.configKey || '',
    sceneName: scene.sceneName || scene.sceneCode || '未命名场景',
    requiresVision: scene.requiresVision === true,
    builtinVersion: scene.builtinVersion || '',
    activeVersion: scene.activeVersion || '',
    activeSource: scene.activeSource || '',
    hasEnabledVersion: scene.hasEnabledVersion === true,
    variables: Array.isArray(scene.variables) ? scene.variables : []
  }
}

/** 后端字段几乎都可空，统一补齐默认值；variablesJson 留到页面层兜底解析。 */
function normalizePromptRow(row: AiPromptTemplateRow): AiPromptTemplateRow {
  return {
    ...row,
    id: Number(row.id) || 0,
    sceneCode: row.sceneCode || '',
    sceneName: row.sceneName || '',
    templateName: row.templateName || '',
    version: row.version || '',
    versionNo: Number(row.versionNo) || 0,
    promptText: row.promptText || '',
    variables: Array.isArray(row.variables) ? row.variables : [],
    variablesJson: row.variablesJson || '',
    status: Number(row.status) === 1 ? 1 : 0,
    active: row.active === true,
    changeNote: row.changeNote || '',
    configVersion: Number(row.configVersion) || 0,
    gmtModified: row.gmtModified || ''
  }
}

/** 提示词模板：只走真实后端（不参与 Mock 分支）。写操作要 ai:prompt:manage。 */
export const aiPromptApi = {
  /** sceneCode / status 都可空；不改动 filters 时后端返回全部场景与全部版本。 */
  async list(params: { sceneCode?: string; status?: number | null } = {}): Promise<AiPromptListResult> {
    requireRemote()
    const qs = queryString({ sceneCode: params.sceneCode, status: params.status ?? undefined })
    const data = await get<AiPromptTemplateListData | null>(`/admin/v1/ai-prompt-templates${qs ? `?${qs}` : ''}`)
    return {
      rows: (data?.records || []).filter(Boolean).map(normalizePromptRow),
      scenes: (data?.scenes || []).filter(Boolean).map(normalizePromptScene)
    }
  },
  /** 新增版本；status 空 = 草稿。 */
  async create(payload: AiPromptTemplateSavePayload): Promise<AiPromptSaveResult> {
    requireRemote()
    return post<AiPromptSaveResult>('/admin/v1/ai-prompt-templates', payload)
  },
  /**
   * 编辑：草稿原地更新；已启用版本不会被原地改，后端自动追加一个新版本（appended=true），
   * 旧版本保留用于回滚。编辑草稿必须带 configVersion。
   */
  async update(id: number, payload: AiPromptTemplateSavePayload): Promise<AiPromptSaveResult> {
    requireRemote()
    return patch<AiPromptSaveResult>(`/admin/v1/ai-prompt-templates/${id}`, payload)
  },
  /** 启用某个版本；后端会把同场景其它版本自动停用。 */
  async activate(id: number): Promise<void> {
    requireRemote()
    await patch<null>(`/admin/v1/ai-prompt-templates/${id}/activate`)
  },
  /**
   * 删除草稿版本（逻辑删除）。**只能删草稿**：生效中的那一版删掉会让该场景静默回落到代码内置提示词，
   * 后端会用 40001 拒绝；想换掉线上版本请用 activate(其它版本)。
   * 带上 configVersion 可防并发覆盖（后端可选校验）。
   */
  async remove(id: number, configVersion?: number): Promise<void> {
    requireRemote()
    const qs = queryString({ configVersion })
    await del<null>(`/admin/v1/ai-prompt-templates/${id}${qs ? `?${qs}` : ''}`)
  }
}

/* ---------------- AI 场景 → 模型绑定（/admin/v1/ai-scenes） ---------------- */

function normalizeSceneModel(model: AiSceneModelOption): AiSceneModelOption {
  return {
    ...model,
    code: model.code || '',
    name: model.name || model.code || '',
    providerCode: Number(model.providerCode) || 0,
    isDefault: model.isDefault === true,
    providerName: model.providerName || '',
    // 历史行后端会按 text 兜底，这里同样兜底，避免老数据让下拉全空
    capability: (model.capability || '').trim() || 'text',
    capabilityText: model.capabilityText || '文本'
  }
}

/** 覆盖值全部保留 null 语义：null = 继承（不是 0/false）。 */
function normalizeSceneRow(row: AiSceneRow): AiSceneRow {
  return {
    ...row,
    sceneCode: row.sceneCode || '',
    configKey: row.configKey || '',
    sceneName: row.sceneName || row.sceneCode || '未命名场景',
    requiresVision: row.requiresVision === true,
    modelCode: row.modelCode ?? null,
    temperature: row.temperature ?? null,
    maxTokens: row.maxTokens ?? null,
    thinking: row.thinking ?? null,
    status: Number(row.status) === 0 ? 0 : 1,
    configVersion: Number(row.configVersion) || 0,
    remark: row.remark ?? null,
    configured: row.configured === true,
    effectiveModelCode: row.effectiveModelCode ?? null,
    effectiveModelSource: row.effectiveModelSource || '',
    yamlModelCode: row.yamlModelCode ?? null,
    yamlTemperature: row.yamlTemperature ?? null,
    yamlMaxTokens: row.yamlMaxTokens ?? null,
    yamlThinking: row.yamlThinking ?? null,
    modelCodeApplies: row.modelCodeApplies !== false,
    hint: row.hint || ''
  }
}

/** 场景绑定：只走真实后端。PUT 是整体覆盖语义，留空即继承。 */
export const aiSceneApi = {
  async list(): Promise<AiSceneListResult> {
    requireRemote()
    const data = await get<AiSceneListData | null>('/admin/v1/ai-scenes')
    return {
      records: (data?.records || []).filter(Boolean).map(normalizeSceneRow),
      models: (data?.models || []).filter(Boolean).map(normalizeSceneModel)
    }
  },
  /** 保存绑定；成功后返回保存后的那一行（configVersion 已 +1，必须用它覆盖本地）。 */
  async save(sceneCode: string, payload: AiSceneSavePayload): Promise<AiSceneRow> {
    requireRemote()
    return normalizeSceneRow(await put<AiSceneRow>(`/admin/v1/ai-scenes/${encodeURIComponent(sceneCode)}`, payload))
  },
  /**
   * 清空覆盖：改回继承（clear:true 时其余覆盖字段由后端一并清掉）。
   * status 必须带上：PUT 是整体覆盖语义，省略会被后端当成"未提交"；
   * 这里沿用该场景当前的启停状态，避免"清空覆盖"顺带把停用场景重新启用。
   */
  async clear(sceneCode: string, params: { configVersion?: number; status?: number } = {}): Promise<AiSceneRow> {
    requireRemote()
    const body: AiSceneSavePayload = {
      clear: true,
      status: Number(params.status) === 0 ? 0 : 1,
      configVersion: params.configVersion
    }
    return normalizeSceneRow(await put<AiSceneRow>(`/admin/v1/ai-scenes/${encodeURIComponent(sceneCode)}`, body))
  }
}


/* ---------------- 用户 AI 长期记忆（/admin/v1/users/{id}/chat-memories，契约 4.14 / 4.15） ---------------- */

/** 后端 Long → 字符串（防精度丢失）：只做字符串化，绝不 Number() 成数值参与运算。 */
function longText(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

/** 分页 total 是后端 Long 的字符串形式，转成非负整数喂给分页组件；非法值一律按 0 处理。 */
function pageTotal(value: string | number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
}

function normalizeMemoryRow(row: AiMemoryRawRow): AiMemoryRow {
  return {
    ...row,
    id: longText(row.id),
    memoryKey: row.memoryKey || '',
    memoryText: row.memoryText || '',
    confidence: Number(row.confidence) || 0,
    sourceSessionId: longText(row.sourceSessionId),
    updatedAt: row.updatedAt || '',
    isAuto: row.isAuto === true
  }
}

/** 用户 AI 长期记忆：只走真实后端（不参与 Mock 分支）。删除是**逻辑删除全部**，成功后必须重拉列表。 */
export const aiMemoryApi = {
  /** 分页查询某用户的长期记忆；id / sourceSessionId / total 都是字符串，页面层只做展示。 */
  async list(userId: number | string, params: { pageNum: number; pageSize: number }): Promise<AiMemoryPageResult> {
    requireRemote()
    const qs = queryString(params)
    const data = await get<AiMemoryListData | null>(
      `/admin/v1/users/${encodeURIComponent(String(userId))}/chat-memories${qs ? `?${qs}` : ''}`
    )
    return {
      records: (data?.records || []).filter(Boolean).map(normalizeMemoryRow),
      total: pageTotal(data?.total)
    }
  },
  /**
   * 契约 4.15：逻辑删除该用户的**全部**长期记忆（对话记录/对话记忆不受影响）。
   * 后端会写审计日志，前端删除成功后需要刷新列表。
   */
  async removeAll(userId: number | string): Promise<void> {
    requireRemote()
    await del<null>(`/admin/v1/users/${encodeURIComponent(String(userId))}/chat-memories`)
  }
}

/* ---------------- AI 审计日志（/admin/v1/ops-audit-logs，只读） ---------------- */

function normalizeAuditRow(row: OpsAuditLogRawRow): OpsAuditLogRow {
  const costMs = Number(row.costMs)
  const resultCode = Number(row.resultCode)
  return {
    ...row,
    id: longText(row.id),
    opsId: longText(row.opsId),
    operatorName: row.operatorName || '',
    roleCode: row.roleCode || '',
    moduleCode: row.moduleCode || '',
    actionCode: row.actionCode || '',
    actionName: row.actionName || '',
    targetType: row.targetType || '',
    targetId: longText(row.targetId),
    detailJson: row.detailJson || '',
    requestUri: row.requestUri || '',
    requestMethod: row.requestMethod || '',
    clientIp: row.clientIp || '',
    costMs: row.costMs === null || row.costMs === undefined || !Number.isFinite(costMs) ? null : costMs,
    resultCode: Number.isFinite(resultCode) ? resultCode : 0,
    gmtCreate: row.gmtCreate || ''
  }
}

/** 审计日志：只读接口，后端未提供修改/删除，页面也不做任何写操作。 */
export const opsAuditApi = {
  /** 筛选参数（moduleCode / actionCode / targetType / targetId）全部可空，空值不拼进查询串。 */
  async list(params: OpsAuditLogQuery = {}): Promise<OpsAuditLogPageResult> {
    requireRemote()
    const qs = queryString({
      moduleCode: params.moduleCode,
      actionCode: params.actionCode,
      targetType: params.targetType,
      targetId: params.targetId,
      pageNum: params.pageNum,
      pageSize: params.pageSize
    })
    const data = await get<OpsAuditLogListData | null>(`/admin/v1/ops-audit-logs${qs ? `?${qs}` : ''}`)
    return {
      records: (data?.records || []).filter(Boolean).map(normalizeAuditRow),
      total: pageTotal(data?.total)
    }
  }
}

export { resetDb } from '@/mock'
