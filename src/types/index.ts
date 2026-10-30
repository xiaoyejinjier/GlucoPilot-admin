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

/* ------- 九时段记录看板 ------- */
export interface NineSlotRecord {
  nodeCode: string
  nodeName: string
  meal: boolean
  recorded: boolean
  glucoseValue: number | null
  sourceType: number | null
  remark: string | null
  foodsText: string | null
  carbsG: number | null
  predictNow: number | null
  predictSuggest: number | null
  recordedAt: string | null
}

export interface NineSlotDayRow {
  userId: string
  username: string
  nickname: string
  recordDate: string
  completedCount: number
  glucoseCount: number
  mealCount: number
  avgGlucose: number | null
  slots: Record<string, NineSlotRecord>
}

export interface NineSlotOverview {
  activeUsers: number
  recordDays: number
  glucoseRecords: number
  mealRecords: number
  totalRecords: number
  avgGlucose: number | null
  complianceRate: number
  abnormalRecords: number
  trend: Array<{ date: string; glucoseCount: number; mealCount: number; avgGlucose: number | null }>
  nodeStats: Array<{ nodeCode: string; nodeName: string; meal: boolean; recordCount: number; avgGlucose: number | null }>
}

export interface NineSlotResult {
  startDate: string
  endDate: string
  overview: NineSlotOverview
  page: {
    pageNum: number
    pageSize: number
    total: number
    pages: number
    records: NineSlotDayRow[]
  }
}

/* ------- 内容 CMS ------- */
export type NewsType = 'article' | 'video'
export type NewsStatus = 'draft' | 'published' | 'unpublished'

export interface NewsTag {
  code: string
  name: string
}

export interface News {
  id: number
  title: string
  summary: string
  /** 兼容接口回传；新建/编辑以 tagCodes / customTags 为准 */
  channel?: string
  tagCodes?: string[]
  customTags?: string[]
  tags?: NewsTag[]
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

export type MediaBizType = 'news' | 'banner' | 'news-video' | 'meal_photo' | 'avatar'
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
  image?: string
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
  nutritionSource?: 'MANUAL' | 'AI_ESTIMATE' | 'AI_REVIEWED'
  sourceModel?: string | null
  reviewImage?: string | null // 只读：识别来源实拍预览，审核/上下架后保留，需运营鉴权
}


/* ------- 设备档案 ------- */
export interface DeviceItem {
  id: number
  deviceSn: string
  deviceName: string
  provider: string
  userId: string
  userMasked: string
  deviceStatus: number
  lastSyncAt: string
}

/* ------- 反馈 ------- */
export type FeedbackType = '产品建议' | 'Bug问题' | '功能诉求' | '其他'
export type FeedbackStatus = 'received' | 'done'

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
  /** 模型能力集合（逗号分隔：text/vision/tool/stream）。历史行可能为空，按 text 处理 */
  capability?: string | null
  /** 后端下发的能力文案（如「文本 / 工具 / 流式」） */
  capabilityText?: string
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
  /** 模型能力集合（逗号分隔）；留空=新建按 text、编辑保持原能力；非法标记后端返回 400 */
  capability?: string | null
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

/* ------- AI 提示词管理（/admin/v1/ai-prompt-templates，字段命名与后端契约一致） ------- */

/** 场景（列表接口随 records 一起下发），activeSource 用来解释"线上到底在用哪份提示词" */
export interface AiPromptScene {
  sceneCode: string
  /** 与 yaml 配置项对齐的键名，如 chat */
  configKey: string
  sceneName: string
  /** 视觉场景（图片/识糖）标识 */
  requiresVision: boolean
  /** 代码内置兜底版本号，如 v1 */
  builtinVersion: string
  /** 当前生效版本标识，如 chat@v1 */
  activeVersion: string
  /** 生效来源：db#12=库里的第 12 行；classpath=库里没有启用版本，正在用代码内置 */
  activeSource: string
  /** 库内是否存在启用版本 */
  hasEnabledVersion: boolean
  variables: string[]
}

/** 一条提示词版本；records 是该场景的全部版本（含停用） */
export interface AiPromptTemplateRow {
  id: number
  sceneCode: string
  sceneName: string
  /** 可选展示名，如「对话（文本） v1」 */
  templateName: string
  version: string
  versionNo: number
  promptText: string
  variables: string[]
  /** 后端下发的原始 JSON 串，variables 为空时兜底解析 */
  variablesJson: string
  /** 1=启用 0=草稿或停用；是否真的在线上生效看 active */
  status: number
  /** true = 该场景当前线上生效的那一条（同场景唯一） */
  active: boolean
  changeNote: string
  /** 乐观锁版本号：编辑草稿时必须原样回传 */
  configVersion: number
  gmtModified: string
}

export interface AiPromptTemplateListData {
  records: AiPromptTemplateRow[] | null
  scenes: AiPromptScene[] | null
}

export interface AiPromptTemplateSavePayload {
  sceneCode: string
  templateName?: string | null
  /** 可空，如 v2；空则由后端生成 */
  version?: string | null
  promptText: string
  variables?: string[] | null
  /** 0=草稿 1=启用；可空（空 = 草稿） */
  status?: number | null
  changeNote?: string | null
  /** 编辑草稿时必填（乐观锁） */
  configVersion?: number
}

export interface AiPromptSaveResult {
  id: number
  version: string
  status: number
  /** true = 后端追加了新版本（被编辑的版本已启用，不原地改） */
  appended: boolean
}

/* ------- AI 场景 → 模型绑定（/admin/v1/ai-scenes） ------- */

/** 可绑定的模型（列表接口附带下发） */
export interface AiSceneModelOption {
  code: string
  name: string
  providerCode: number
  isDefault: boolean
  providerName: string
}

export interface AiSceneRow {
  sceneCode: string
  configKey: string
  sceneName: string
  requiresVision: boolean
  /** 库内覆盖值；null = 继承 */
  modelCode: string | null
  temperature: number | null
  maxTokens: number | null
  thinking: boolean | null
  /** 0=停用 1=启用 */
  status: number
  /** 乐观锁版本号：该场景已有配置行时保存必填 */
  configVersion: number
  remark: string | null
  /** 库里是否已有该场景的覆盖配置行 */
  configured: boolean
  /** 实际生效的模型编码（含兜底） */
  effectiveModelCode: string | null
  /** 实际生效模型的来源：db=库内绑定；其它=可见值原样展示（yaml 等兜底） */
  effectiveModelSource: string
  /** yaml/环境变量里的兜底值，用于解释"留空会继承成什么" */
  yamlModelCode: string | null
  yamlTemperature: number | null
  yamlMaxTokens: number | null
  yamlThinking: boolean | null
  /** false = 视觉场景：模型编码由视觉通道统一解析，逐场景绑定不生效 */
  modelCodeApplies: boolean
  /** 后端下发的说明文案，直接展示 */
  hint: string
}

export interface AiSceneListData {
  records: AiSceneRow[] | null
  models: AiSceneModelOption[] | null
}

/** 归一化后的列表结果：页面层拿到的 records/models 一定不是 null */
export interface AiSceneListResult {
  records: AiSceneRow[]
  models: AiSceneModelOption[]
}

export interface AiSceneSavePayload {
  /** 留空 = 继承（PUT 是整体覆盖语义） */
  modelCode?: string | null
  temperature?: number | null
  maxTokens?: number | null
  thinking?: boolean | null
  /** 0/1，必填 */
  status: number
  remark?: string | null
  /** true = 清空该场景全部覆盖，改回继承 */
  clear?: boolean
  /** 该场景已有配置行时必填（乐观锁） */
  configVersion?: number
}

/* ------- 用户 AI 长期记忆（/admin/v1/users/{id}/chat-memories，契约 4.14 查询 / 4.15 全删） ------- */

/**
 * 后端原始行。注意 id / sourceSessionId 是后端 Long 序列化出来的**字符串**（防精度丢失），
 * total 同理，一律按字符串处理，禁止参与数值运算。
 */
export interface AiMemoryRawRow {
  id: string | number | null
  memoryKey?: string | null
  memoryText?: string | null
  /** 0-100，页面按 >=80 绿 / 60-79 黄 / <60 灰 分档 */
  confidence?: number | null
  sourceSessionId?: string | number | null
  updatedAt?: string | null
  /** true = 模型自动抽取；false = 人工/用户主动告知 */
  isAuto?: boolean | null
}

/** 归一化后的展示行：字段一定存在，页面层不必再判空 */
export interface AiMemoryRow {
  id: string
  memoryKey: string
  memoryText: string
  confidence: number
  sourceSessionId: string
  updatedAt: string
  isAuto: boolean
}

export interface AiMemoryListData {
  records: AiMemoryRawRow[] | null
  total: string | number | null
}

export interface AiMemoryPageResult {
  records: AiMemoryRow[]
  /** 已转成 number（分页组件要求整数） */
  total: number
}

/* ------- AI 审计日志（/admin/v1/ops-audit-logs，只读查询） ------- */

/** 后端原始行：除 costMs / resultCode 外均为字符串，可空字段很多 */
export interface OpsAuditLogRawRow {
  id: string | number | null
  opsId?: string | number | null
  operatorName?: string | null
  roleCode?: string | null
  moduleCode?: string | null
  actionCode?: string | null
  actionName?: string | null
  targetType?: string | null
  targetId?: string | number | null
  /** 原始 JSON 字符串：页面层负责美化展示，不要当对象用 */
  detailJson?: string | null
  requestUri?: string | null
  requestMethod?: string | null
  clientIp?: string | null
  costMs?: number | null
  /** 0 = 成功；其它为失败码 */
  resultCode?: number | null
  gmtCreate?: string | null
}

export interface OpsAuditLogRow {
  id: string
  opsId: string
  operatorName: string
  roleCode: string
  moduleCode: string
  actionCode: string
  actionName: string
  targetType: string
  targetId: string
  detailJson: string
  requestUri: string
  requestMethod: string
  clientIp: string
  costMs: number | null
  resultCode: number
  gmtCreate: string
}

export interface OpsAuditLogListData {
  records: OpsAuditLogRawRow[] | null
  total: string | number | null
}

export interface OpsAuditLogPageResult {
  records: OpsAuditLogRow[]
  total: number
}

/** 审计日志查询条件：全部可空，空值不参与查询串 */
export interface OpsAuditLogQuery {
  moduleCode?: string
  actionCode?: string
  targetType?: string
  targetId?: string
  pageNum?: number
  pageSize?: number
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
