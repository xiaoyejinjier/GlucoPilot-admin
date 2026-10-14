/* 后台管理系统公共类型定义（后续接后端时作为 DTO 对齐参考） */

export type Role = 'admin' | 'editor'
export type ThemeId = 'green' | 'teal' | 'simple'

export interface AdminAccount {
  id: number
  username: string
  password: string
  nickname: string
  role: Role
  status: 1 | 0
  createdAt: string
  lastLoginAt: string
  /** RuoYi 后端下发的角色与权限，仅用于前端可见性控制。 */
  roles?: string[]
  permissions?: string[]
  menuPaths?: string[]
}

/* ------- C 端用户（后台被管对象） ------- */
export interface AppUser {
  id: number
  username: string
  nickname: string
  avatarText: string
  phone: string
  age: number
  diabetesType: string
  status: 'enabled' | 'disabled'
  registeredAt: string
  lastActiveAt: string
  recordCount: number
  mealCount: number
  compliance: number // 血糖达标率 %
}

export interface ArchiveNodeStat {
  node: string
  nodeName: string
  avg: number
  samples: number
}

export interface HealthArchive {
  userId: number
  owner: { nickname: string; phone: string; age: number; diabetesType: string; registeredAt: string }
  /** height / weight 后端暂无可取列，返回 null（待补） */
  profile: {
    height: number | null
    weight: number | null
    medication: string
    exercise: string
    diagnosedAt: string
  }
  trend: Array<{ date: string; avg: number; okRate: number }>
  nodeStats: ArchiveNodeStat[]
  mealSummary: { recordDays: number; avgCarbsG: number; avgCal: number; topFoods: string[] }
  summary: string
}

/* ------- 内容 CMS ------- */
export type NewsChannel = '企业动态' | '行业快讯' | '设备新知' | '控糖科普'
export type NewsType = 'article' | 'video'
export type NewsStatus = 'draft' | 'published' | 'unpublished'

export interface News {
  id: number
  title: string
  summary: string
  channel: NewsChannel
  type: NewsType
  coverUrl: string
  coverText: string
  videoUrl?: string
  content: string
  status: NewsStatus
  publishAt: string
  views: number
  likes: number
  collects: number
  createdAt: string
  updatedAt: string
}

export interface Banner {
  id: number
  title: string
  image: string
  linkType: 'article' | 'url'
  linkValue: string
  sort: number
  enabled: boolean
  remark: string
}

export type MediaBizType = 'news' | 'banner' | 'meal_photo' | 'avatar'
export interface MediaFile {
  id: number
  name: string
  bizType: MediaBizType
  url: string
  size: number
  mime: string
  uploader: string
  createdAt: string
}

/* ------- 营养库 ------- */
export interface FoodCategory {
  id: number
  name: string
  sort: number
}

export interface FoodItem {
  id: number
  name: string
  categoryId: number
  categoryName: string
  carbs: number // 每 100g 碳水 g
  cal: number // 每 100g 热量 kcal
  gi: number | null
  image: string
  description: string
  enabled: boolean
  updatedAt: string
}

/* ------- 反馈 ------- */
export type FeedbackType = '产品建议' | 'Bug问题' | '功能诉求' | '其他'
export type FeedbackStatus = 'received' | 'processing' | 'done'

export interface Feedback {
  id: number
  userId: number
  userName: string
  type: FeedbackType
  content: string
  contact: string
  status: FeedbackStatus
  reply: string
  createdAt: string
  processedAt: string
}

/* ------- 导出任务 ------- */
export type ExportStatus = 'pending' | 'done' | 'failed'
export interface ExportTask {
  id: number
  userId: number
  userName: string
  rangeType: '7' | '30' | '90' | 'custom'
  startDate: string
  endDate: string
  status: ExportStatus
  fileUrl: string
  createdAt: string
}

/* ------- 系统配置 ------- */
export interface SysConfig {
  glucose: { lowDanger: number; warnStart: number; dangerStart: number }
  text: { disclaimer: string; agreement: string; about: string; announcement: string }
  defaults: {
    theme: ThemeId
    fontSize: '较大' | '标准' | '较小'
    notifyGlucose: boolean
    notifyMeal: boolean
    notifyNews: boolean
  }
}

/* ------- 操作日志 ------- */
export interface OperationLog {
  id: number
  operator: string
  role: Role
  module: string
  action: string
  detail: string
  ip: string
  createdAt: string
}

/* ------- AI 模型配置（/admin/v1/ai/models，字段命名与后端冻结契约一致，除 id 外均可能为 null） ------- */

/**
 * 厂商编码：1=DeepSeek 自研；2=OpenAI 兼容；3=通义千问；4=文心一言；5=其他。
 * 契约文档写的是"2/3/4=OpenAI 兼容"，后端实际 PROVIDER_TEXT 为上面这套，
 * 因此展示一律优先用后端下发的 providerText，本映射只用于编辑弹窗的下拉选项。
 */
export type AiProviderCode = 1 | 2 | 3 | 4 | 5

/** 密钥来源：db=后台已单独配置；yaml=沿用环境变量/yaml；none=两边都没有 */
export type AiKeySource = 'db' | 'yaml' | 'none'

/** 这条配置当前是否真的在生效：db=数据库生效；yaml=仅是回落值 */
export type AiConfigSource = 'db' | 'yaml'

/**
 * 事实上的角色（与 isDefault/isEnabled 的"意愿"区分开）：
 * text-default=当前文本对话实际在用；vision=当前视觉实际在用；null=启用了但没在供能
 */
export type AiEffectiveRole = 'text-default' | 'vision'

/** 文本默认值是"怎么选出来的"，与后端 AiRuntimeConfigService 的判据常量对齐 */
export type AiDefaultReason = '默认标记' | '唯一启用的文本模型' | '最近修改的文本模型' | 'yaml 兜底'

/** 连通性测试分类，与后端 AiModelTestResult.category 对齐 */
export type AiTestCategory =
  | 'OK'
  | 'AUTH'
  | 'MODEL_NOT_FOUND'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'UNKNOWN'

export interface AiModelRow {
  /** Long 序列化为字符串，务必按 string 处理，不要再 Number() 转换 */
  id: string
  /** 引用键，新增必填，修改时不可变更 */
  modelCode: string
  modelName: string
  providerCode: AiProviderCode | number
  /** 后端下发的展示文案，优先用它渲染 */
  providerText: string
  apiBaseUrl?: string | null
  /** 真正发给 provider 的模型名 */
  modelEndpoint: string
  temperature?: number | null
  topP?: number | null
  maxTokens?: number | null
  /** 仅 DeepSeek 自研模型有意义 */
  thinking?: boolean | null
  timeoutMs?: number | null
  isDefault: number
  isEnabled: number
  /** 形如 sk-****klmn，可能为空字符串；禁止回填到输入框 */
  apiKeyMasked: string
  apiKeySource: AiKeySource
  /** 修改时必须原样回传，后端做乐观锁校验 */
  configVersion: number
  source: AiConfigSource
  /** 当前真的在给哪个通道供能；null/undefined 表示启用了但没被选中 */
  effectiveRole?: AiEffectiveRole | null
  lastTestAt?: string | null
  lastTestOk?: boolean | null
  lastTestMessage?: string | null
  remark?: string | null
  updatedAt?: string | null
}

/** 列表接口附带的"当前生效情况"，用来解释"为什么用的是这个模型" */
export interface AiModelListMeta {
  /** 当前文本对话实际使用的模型编码 */
  textDefaultCode: string
  textDefaultSource: AiConfigSource
  textDefaultReason: AiDefaultReason | string
}

export interface AiModelSavePayload {
  /** 新增必填；修改时后端忽略 */
  modelCode?: string
  modelName: string
  providerCode: number
  apiBaseUrl?: string | null
  modelEndpoint: string
  temperature?: number | null
  topP?: number | null
  maxTokens?: number | null
  thinking?: boolean | null
  timeoutMs?: number | null
  /** 明文密钥；留空 = 不修改已有密钥（后端语义） */
  apiKey?: string | null
  /** true = 显式清空密钥（回到沿用 yaml） */
  clearApiKey?: boolean
  isEnabled: number
  isDefault: number
  remark?: string | null
  /** 修改时必填 */
  configVersion?: number
}

export interface AiModelTestResult {
  ok: boolean
  category: AiTestCategory
  /** 后端给的一句话建议，直接展示 */
  advice: string
  elapsedMs: number
  /** 上游回显的模型名 */
  modelEcho?: string | null
  /** 原始错误摘要 */
  message: string
}

/* 看板统计 */
export interface DashboardStats {
  users: { total: number; today: number; active: number }
  records: { todayGlucose: number; todayMeal: number; monthTotal: number }
  content: { newsViews: number; newsCount: number; feedbackPending: number }
  trend: Array<{ date: string; glucose: number; meal: number; users: number }>
  complianceDist: Array<{ level: string; value: number }>
  channelDist: Array<{ channel: string; value: number }>
  nodeHeat: Array<{ node: string; value: number }>
}
