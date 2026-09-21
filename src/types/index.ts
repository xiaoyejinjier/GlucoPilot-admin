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
  profile: { height: number; weight: number; medication: string; exercise: string; diagnosedAt: string }
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
export type FeedbackType = '产品建议' | '功能异常' | '内容问题' | '其他'
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
