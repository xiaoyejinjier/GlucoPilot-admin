import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import type { Role } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { adminConfig } from '@/config'
import { getAccessToken } from '@/utils/request'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    icon?: string
    roles?: Role[]
    permission?: string
    hidden?: boolean
    placeholder?: string
    ruoyiResource?: string
    ruoyiMonitor?: string
  }
}

const AdminLayout = () => import('@/layouts/AdminLayout.vue')

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/dashboard/DashboardView.vue'), meta: { title: '数据看板', icon: 'DataBoard', roles: ['admin', 'editor'], permission: 'dashboard:view' } },
      { path: 'content/news', name: 'news', component: () => import('@/views/content/NewsListView.vue'), meta: { title: '资讯管理', icon: 'Document', roles: ['admin', 'editor'], permission: 'content:news:list' } },
      { path: 'content/news/new', name: 'news-new', component: () => import('@/views/content/NewsEditView.vue'), meta: { title: '新建资讯', roles: ['admin', 'editor'], hidden: true, permission: 'content:news:edit' } },
      { path: 'content/news/:id/edit', name: 'news-edit', component: () => import('@/views/content/NewsEditView.vue'), meta: { title: '编辑资讯', roles: ['admin', 'editor'], hidden: true, permission: 'content:news:edit' } },
      { path: 'content/banners', name: 'banners', component: () => import('@/views/content/BannerView.vue'), meta: { title: '轮播图管理', icon: 'Picture', roles: ['admin', 'editor'], permission: 'content:banner:manage' } },
      { path: 'content/media', name: 'media', component: () => import('@/views/content/MediaView.vue'), meta: { title: '媒体素材', icon: 'FolderOpened', roles: ['admin', 'editor'], permission: 'content:media:manage' } },
      { path: 'nutrition/foods', name: 'foods', component: () => import('@/views/nutrition/FoodView.vue'), meta: { title: '营养库管理', icon: 'Apple', roles: ['admin', 'editor'], permission: 'food:library:manage' } },
      { path: 'users', name: 'users', component: () => import('@/views/users/UserListView.vue'), meta: { title: '用户管理', icon: 'User', roles: ['admin'], permission: 'user:manage' } },
      { path: 'user-service/archives', name: 'archives', component: () => import('@/views/users/ArchiveView.vue'), meta: { title: '健康档案', icon: 'Files', roles: ['admin'], permission: 'health:archive:view' } },
      { path: 'user-service/records', name: 'health-records', component: () => import('@/views/users/HealthRecordsView.vue'), meta: { title: '九时段记录', icon: 'TrendCharts', roles: ['admin'], permission: 'health:archive:view' } },
      { path: 'user-service/glucose-alerts', name: 'glucose-alerts', component: () => import('@/views/users/GlucoseAlertsView.vue'), meta: { title: '异常血糖事件', icon: 'Warning', roles: ['admin'], permission: 'health:alert:view' } },
      { path: 'feedback', name: 'feedback', component: () => import('@/views/users/FeedbackView.vue'), meta: { title: '反馈管理', icon: 'ChatLineSquare', roles: ['admin', 'editor'], permission: 'feedback:manage' } },
      { path: 'exports', name: 'exports', component: () => import('@/views/users/ExportView.vue'), meta: { title: '导出任务', icon: 'Download', roles: ['admin', 'editor'], permission: 'export:task:manage' } },
      { path: 'system/users', name: 'system-users', component: () => import('@/views/system/RuoYiResourceView.vue'), meta: { title: '用户管理', icon: 'User', roles: ['admin'], permission: 'system:user:manage', ruoyiResource: 'users' } },
      { path: 'system/roles', name: 'roles', component: () => import('@/views/system/RuoYiResourceView.vue'), meta: { title: '角色管理', icon: 'UserFilled', roles: ['admin'], permission: 'system:role:manage', ruoyiResource: 'roles' } },
      { path: 'system/menus', name: 'system-menus', component: () => import('@/views/system/RuoYiResourceView.vue'), meta: { title: '菜单管理', icon: 'Menu', roles: ['admin'], permission: 'system:menu:manage', ruoyiResource: 'menus' } },
      { path: 'system/depts', name: 'system-depts', component: () => import('@/views/system/RuoYiResourceView.vue'), meta: { title: '部门管理', icon: 'OfficeBuilding', roles: ['admin'], permission: 'system:dept:manage', ruoyiResource: 'depts' } },
      { path: 'system/posts', name: 'system-posts', component: () => import('@/views/system/RuoYiResourceView.vue'), meta: { title: '岗位管理', icon: 'Postcard', roles: ['admin'], permission: 'system:post:manage', ruoyiResource: 'posts' } },
      { path: 'system/dict-types', name: 'system-dict-types', component: () => import('@/views/system/RuoYiResourceView.vue'), meta: { title: '字典类型', icon: 'Collection', roles: ['admin'], permission: 'system:dict:manage', ruoyiResource: 'dict-types' } },
      { path: 'system/dict-data', name: 'system-dict-data', component: () => import('@/views/system/RuoYiResourceView.vue'), meta: { title: '字典数据', icon: 'CollectionTag', roles: ['admin'], permission: 'system:dict:manage', ruoyiResource: 'dict-data' } },
      { path: 'system/config', name: 'config', component: () => import('@/views/system/RuoYiResourceView.vue'), meta: { title: '系统参数', icon: 'Setting', roles: ['admin'], permission: 'system:config:manage', ruoyiResource: 'configs' } },
      { path: 'system/notices', name: 'system-notices', component: () => import('@/views/system/RuoYiResourceView.vue'), meta: { title: '通知公告', icon: 'Bell', roles: ['admin'], permission: 'system:notice:manage', ruoyiResource: 'notices' } },
      { path: 'monitor/online', name: 'monitor-online', component: () => import('@/views/system/RuoYiMonitorView.vue'), meta: { title: '在线用户', icon: 'User', roles: ['admin'], permission: 'monitor:online:list', ruoyiMonitor: 'online' } },
      { path: 'monitor/login-logs', name: 'monitor-login-logs', component: () => import('@/views/system/RuoYiMonitorView.vue'), meta: { title: '登录日志', icon: 'Tickets', roles: ['admin'], permission: 'monitor:logininfor:list', ruoyiMonitor: 'login-logs' } },
      { path: 'monitor/oper-logs', name: 'monitor-oper-logs', component: () => import('@/views/system/RuoYiMonitorView.vue'), meta: { title: '操作日志', icon: 'Document', roles: ['admin'], permission: 'monitor:operlog:list', ruoyiMonitor: 'oper-logs' } },
      { path: 'monitor/server', name: 'monitor-server', component: () => import('@/views/system/RuoYiMonitorView.vue'), meta: { title: '服务监控', icon: 'Cpu', roles: ['admin'], permission: 'monitor:server:list', ruoyiMonitor: 'server' } },
      { path: 'monitor/cache', name: 'monitor-cache', component: () => import('@/views/system/RuoYiMonitorView.vue'), meta: { title: '缓存监控', icon: 'Coin', roles: ['admin'], permission: 'monitor:cache:manage', ruoyiMonitor: 'cache' } },
      { path: 'monitor/jobs', name: 'monitor-jobs', component: () => import('@/views/system/RuoYiResourceView.vue'), meta: { title: '定时任务', icon: 'Clock', roles: ['admin'], permission: 'monitor:job:manage', ruoyiResource: 'jobs' } },
      { path: 'monitor/job-logs', name: 'monitor-job-logs', component: () => import('@/views/system/RuoYiMonitorView.vue'), meta: { title: '任务日志', icon: 'List', roles: ['admin'], permission: 'monitor:job:manage', ruoyiMonitor: 'job-logs' } },
      { path: 'tool/generator', name: 'tool-generator', component: () => import('@/views/system/RuoYiGeneratorView.vue'), meta: { title: '代码生成', icon: 'DocumentAdd', roles: ['admin'], permission: 'tool:gen:manage' } },
      { path: 'ai/model', name: 'ai-model', component: () => import('@/views/ai/ModelConfigView.vue'), meta: { title: '模型配置', icon: 'MagicStick', roles: ['admin'], permission: 'ai:model:query' } },
      { path: 'ai/prompt', name: 'ai-prompt', component: () => import('@/views/ai/PromptConfigView.vue'), meta: { title: '提示词管理', icon: 'EditPen', roles: ['admin'], permission: 'ai:prompt:list' } },
      { path: 'ai/scene', name: 'ai-scene', component: () => import('@/views/ai/SceneBindingView.vue'), meta: { title: '场景模型绑定', icon: 'Connection', roles: ['admin'], permission: 'ai:scene:list' } },
      { path: 'message/push', name: 'push', component: () => import('@/views/placeholder/PlaceholderView.vue'), meta: { title: '消息推送', icon: 'Bell', roles: ['admin'], placeholder: '消息推送（二期）', permission: 'message:push:manage' } },
      { path: 'ai/config', name: 'ai-config', component: () => import('@/views/placeholder/PlaceholderView.vue'), meta: { title: 'AI 服务配置', icon: 'MagicStick', roles: ['admin'], placeholder: 'AI 服务配置（二期）', permission: 'ai:config:manage' } }
    ]
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/error/NotFoundView.vue'), meta: { title: '404', hidden: true } }
]

export interface MenuChild {
  path: string
  title: string
  icon?: string
  roles?: Role[]
  permission?: string
}
export interface MenuGroup {
  title: string
  icon: string
  roles: Role[]
  children: MenuChild[]
}

export const menuGroups: MenuGroup[] = [
  { title: '概览', icon: 'DataBoard', roles: ['admin', 'editor'], children: [{ path: '/dashboard', title: '数据看板', icon: 'DataBoard', permission: 'dashboard:view' }] },
  {
    title: '内容管理', icon: 'Document', roles: ['admin', 'editor'],
    children: [
      { path: '/content/news', title: '资讯管理', icon: 'Document', permission: 'content:news:list' },
      { path: '/content/banners', title: '轮播图管理', icon: 'Picture', permission: 'content:banner:manage' },
      { path: '/content/media', title: '媒体素材', icon: 'FolderOpened', permission: 'content:media:manage' }
    ]
  },
  { title: '营养库', icon: 'Apple', roles: ['admin', 'editor'], children: [{ path: '/nutrition/foods', title: '食物条目与分类', icon: 'Apple', permission: 'food:library:manage' }] },
  {
    title: '用户与服务', icon: 'Service', roles: ['admin', 'editor'],
    children: [
      { path: '/feedback', title: '反馈管理', icon: 'ChatLineSquare', roles: ['admin', 'editor'], permission: 'feedback:manage' },
      { path: '/exports', title: '导出任务', icon: 'Download', roles: ['admin', 'editor'], permission: 'export:task:manage' },
      { path: '/users', title: '用户管理', icon: 'User', roles: ['admin'], permission: 'user:manage' },
      { path: '/user-service/archives', title: '健康档案', icon: 'Files', roles: ['admin'], permission: 'health:archive:view' },
      { path: '/user-service/records', title: '九时段记录', icon: 'TrendCharts', roles: ['admin'], permission: 'health:archive:view' },
      { path: '/user-service/glucose-alerts', title: '异常血糖事件', icon: 'Warning', roles: ['admin'], permission: 'health:alert:view' }
    ]
  },
  {
    title: '系统管理', icon: 'Setting', roles: ['admin'],
    children: [
      { path: '/system/users', title: '用户管理', icon: 'User', permission: 'system:user:manage' },
      { path: '/system/roles', title: '角色管理', icon: 'UserFilled', permission: 'system:role:manage' },
      { path: '/system/menus', title: '菜单管理', icon: 'Menu', permission: 'system:menu:manage' },
      { path: '/system/depts', title: '部门管理', icon: 'OfficeBuilding', permission: 'system:dept:manage' },
      { path: '/system/posts', title: '岗位管理', icon: 'Postcard', permission: 'system:post:manage' },
      { path: '/system/dict-types', title: '字典类型', icon: 'Collection', permission: 'system:dict:manage' },
      { path: '/system/dict-data', title: '字典数据', icon: 'CollectionTag', permission: 'system:dict:manage' },
      { path: '/system/config', title: '系统参数', icon: 'Setting', permission: 'system:config:manage' },
      { path: '/system/notices', title: '通知公告', icon: 'Bell', permission: 'system:notice:manage' }
    ]
  },
  {
    title: '系统监控', icon: 'Monitor', roles: ['admin'],
    children: [
      { path: '/monitor/online', title: '在线用户', icon: 'User', permission: 'monitor:online:list' },
      { path: '/monitor/login-logs', title: '登录日志', icon: 'Tickets', permission: 'monitor:logininfor:list' },
      { path: '/monitor/oper-logs', title: '操作日志', icon: 'Document', permission: 'monitor:operlog:list' },
      { path: '/monitor/server', title: '服务监控', icon: 'Cpu', permission: 'monitor:server:list' },
      { path: '/monitor/cache', title: '缓存监控', icon: 'Coin', permission: 'monitor:cache:manage' },
      { path: '/monitor/jobs', title: '定时任务', icon: 'Clock', permission: 'monitor:job:manage' },
      { path: '/monitor/job-logs', title: '任务日志', icon: 'List', permission: 'monitor:job:manage' }
    ]
  },
  { title: '系统工具', icon: 'Tools', roles: ['admin'], children: [{ path: '/tool/generator', title: '代码生成', icon: 'DocumentAdd', permission: 'tool:gen:manage' }] },
  {
    title: 'AI 配置', icon: 'MagicStick', roles: ['admin'],
    children: [
      { path: '/ai/model', title: '模型配置', icon: 'MagicStick', permission: 'ai:model:query' },
      { path: '/ai/prompt', title: '提示词管理', icon: 'EditPen', permission: 'ai:prompt:list' },
      { path: '/ai/scene', title: '场景模型绑定', icon: 'Connection', permission: 'ai:scene:list' },
      { path: '/ai/config', title: 'AI 服务配置', icon: 'Setting', permission: 'ai:config:manage' }
    ]
  },
  { title: '二期占位', icon: 'Coin', roles: ['admin'], children: [
    { path: '/message/push', title: '消息推送', icon: 'Bell', permission: 'message:push:manage' }
  ] }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  // 真实联调：本地会话存在但无 Token → 强制重新登录
  if (!adminConfig.useMock && auth.account && !getAccessToken()) {
    auth.logout()
  }
  if (to.path !== '/login' && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && auth.isLoggedIn) {
    return { path: '/dashboard' }
  }
  const roles = to.meta.roles
  if (adminConfig.useMock && roles && auth.account && !roles.includes(auth.account.role)) {
    return { path: '/dashboard' }
  }
  if (!adminConfig.useMock && to.meta.permission && !auth.hasPermission(to.meta.permission)) {
    return { path: '/dashboard' }
  }
  return true
})

router.afterEach((to) => {
  const base = '控糖健康管理系统 · 管理后台'
  document.title = to.meta.title ? `${to.meta.title} - ${base}` : base
})

export default router
