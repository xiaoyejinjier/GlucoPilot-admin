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
    hidden?: boolean
    placeholder?: string
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
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/dashboard/DashboardView.vue'), meta: { title: '数据看板', icon: 'DataBoard', roles: ['admin', 'editor'] } },
      { path: 'content/news', name: 'news', component: () => import('@/views/content/NewsListView.vue'), meta: { title: '资讯管理', icon: 'Document', roles: ['admin', 'editor'] } },
      { path: 'content/news/new', name: 'news-new', component: () => import('@/views/content/NewsEditView.vue'), meta: { title: '新建资讯', roles: ['admin', 'editor'], hidden: true } },
      { path: 'content/news/:id/edit', name: 'news-edit', component: () => import('@/views/content/NewsEditView.vue'), meta: { title: '编辑资讯', roles: ['admin', 'editor'], hidden: true } },
      { path: 'content/banners', name: 'banners', component: () => import('@/views/content/BannerView.vue'), meta: { title: '轮播图管理', icon: 'Picture', roles: ['admin', 'editor'] } },
      { path: 'content/media', name: 'media', component: () => import('@/views/content/MediaView.vue'), meta: { title: '媒体素材', icon: 'FolderOpened', roles: ['admin', 'editor'] } },
      { path: 'nutrition/foods', name: 'foods', component: () => import('@/views/nutrition/FoodView.vue'), meta: { title: '营养库管理', icon: 'Apple', roles: ['admin', 'editor'] } },
      { path: 'users', name: 'users', component: () => import('@/views/users/UserListView.vue'), meta: { title: '用户管理', icon: 'User', roles: ['admin'] } },
      { path: 'user-service/archives', name: 'archives', component: () => import('@/views/users/ArchiveView.vue'), meta: { title: '健康档案', icon: 'Files', roles: ['admin'] } },
      { path: 'feedback', name: 'feedback', component: () => import('@/views/users/FeedbackView.vue'), meta: { title: '反馈管理', icon: 'ChatLineSquare', roles: ['admin', 'editor'] } },
      { path: 'exports', name: 'exports', component: () => import('@/views/users/ExportView.vue'), meta: { title: '导出任务', icon: 'Download', roles: ['admin', 'editor'] } },
      { path: 'system/roles', name: 'roles', component: () => import('@/views/system/RoleView.vue'), meta: { title: '角色权限', icon: 'Lock', roles: ['admin'] } },
      { path: 'system/config', name: 'config', component: () => import('@/views/system/ConfigView.vue'), meta: { title: '系统参数', icon: 'Setting', roles: ['admin'] } },
      { path: 'system/logs', name: 'logs', component: () => import('@/views/system/LogView.vue'), meta: { title: '操作日志', icon: 'Tickets', roles: ['admin'] } },
      { path: 'message/push', name: 'push', component: () => import('@/views/placeholder/PlaceholderView.vue'), meta: { title: '消息推送', icon: 'Bell', roles: ['admin'], placeholder: '消息推送（二期）' } },
      { path: 'ai/config', name: 'ai-config', component: () => import('@/views/placeholder/PlaceholderView.vue'), meta: { title: 'AI 服务配置', icon: 'MagicStick', roles: ['admin'], placeholder: 'AI 服务配置（二期）' } }
    ]
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/error/NotFoundView.vue'), meta: { title: '404', hidden: true } }
]

export interface MenuChild {
  path: string
  title: string
  icon?: string
  roles?: Role[]
}
export interface MenuGroup {
  title: string
  icon: string
  roles: Role[]
  children: MenuChild[]
}

export const menuGroups: MenuGroup[] = [
  { title: '概览', icon: 'DataBoard', roles: ['admin', 'editor'], children: [{ path: '/dashboard', title: '数据看板', icon: 'DataBoard' }] },
  {
    title: '内容管理', icon: 'Document', roles: ['admin', 'editor'],
    children: [
      { path: '/content/news', title: '资讯管理', icon: 'Document' },
      { path: '/content/banners', title: '轮播图管理', icon: 'Picture' },
      { path: '/content/media', title: '媒体素材', icon: 'FolderOpened' }
    ]
  },
  { title: '营养库', icon: 'Apple', roles: ['admin', 'editor'], children: [{ path: '/nutrition/foods', title: '食物条目与分类', icon: 'Apple' }] },
  {
    title: '用户与服务', icon: 'Service', roles: ['admin', 'editor'],
    children: [
      { path: '/feedback', title: '反馈管理', icon: 'ChatLineSquare', roles: ['admin', 'editor'] },
      { path: '/exports', title: '导出任务', icon: 'Download', roles: ['admin', 'editor'] },
      { path: '/users', title: '用户管理', icon: 'User', roles: ['admin'] },
      { path: '/user-service/archives', title: '健康档案', icon: 'Files', roles: ['admin'] }
    ]
  },
  {
    title: '系统管理', icon: 'Setting', roles: ['admin'],
    children: [
      { path: '/system/roles', title: '角色权限', icon: 'Lock' },
      { path: '/system/config', title: '系统参数', icon: 'Setting' },
      { path: '/system/logs', title: '操作日志', icon: 'Tickets' }
    ]
  },
  { title: '二期占位', icon: 'Coin', roles: ['admin'], children: [
    { path: '/message/push', title: '消息推送', icon: 'Bell' },
    { path: '/ai/config', title: 'AI 服务配置', icon: 'MagicStick' }
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
  if (roles && auth.account && !roles.includes(auth.account.role)) {
    return { path: '/dashboard' }
  }
  return true
})

router.afterEach((to) => {
  const base = '控糖健康管理系统 · 管理后台'
  document.title = to.meta.title ? `${to.meta.title} - ${base}` : base
})

export default router
