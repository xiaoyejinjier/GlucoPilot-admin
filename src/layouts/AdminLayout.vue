<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <aside class="layout-side" :class="{ collapsed: app.sidebarCollapsed }">
      <div class="brand" @click="$router.push('/dashboard')">
        <span class="brand-dot"></span>
        <div v-show="!app.sidebarCollapsed" class="brand-text">
          <div class="brand-name">控糖健康管理系统</div>
          <div class="brand-sub">AI控糖助手 · 管理后台</div>
        </div>
      </div>
      <el-scrollbar class="menu-scroll">
        <el-menu
          :default-active="activePath"
          :collapse="app.sidebarCollapsed"
          :collapse-transition="false"
          router
          class="kt-menu"
        >
          <template v-for="group in visibleGroups" :key="group.title">
            <el-sub-menu v-if="group.children.length > 1" :index="group.title">
              <template #title>
                <el-icon><component :is="group.icon" /></el-icon>
                <span>{{ group.title }}</span>
              </template>
              <el-menu-item v-for="c in group.children" :key="c.path" :index="c.path">
                <el-icon><component :is="c.icon || group.icon" /></el-icon>
                <span>{{ c.title }}</span>
              </el-menu-item>
            </el-sub-menu>
            <el-menu-item v-else :index="group.children[0].path">
              <el-icon><component :is="group.children[0].icon || group.icon" /></el-icon>
              <span>{{ group.children[0].title }}</span>
            </el-menu-item>
          </template>
        </el-menu>
      </el-scrollbar>
    </aside>

    <!-- 右侧主体 -->
    <div class="layout-main">
      <header class="layout-header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="app.toggleSidebar()">
            <Expand v-if="app.sidebarCollapsed" />
            <Fold v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-for="m in breadcrumbs" :key="m.path || m.title">{{ m.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <!-- 主题切换：与小程序 display-settings 的三主题对齐 -->
          <el-dropdown trigger="click" @command="changeTheme">
            <span class="header-action">
              <el-icon><Brush /></el-icon>
              <span class="theme-label">{{ themeName }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="t in themes" :key="t.id" :command="t.id">
                  <span class="theme-opt"><i class="dot" :style="{ background: t.color }"></i>{{ t.label }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown trigger="click" @command="onUserCommand">
            <span class="header-user">
              <el-avatar :size="28" class="user-avatar">{{ (auth.account?.nickname || '管').slice(0, 1) }}</el-avatar>
              <span class="user-name">{{ auth.account?.nickname || auth.account?.username }}</span>
              <el-tag size="small" :type="auth.role === 'admin' ? 'warning' : 'success'" effect="light">
                {{ auth.role === 'admin' ? '管理员' : '运营' }}
              </el-tag>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="layout-content">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { menuGroups, type MenuGroup } from '@/router'
import type { ThemeId } from '@/types'

const app = useAppStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const themes = [
  { id: 'green' as ThemeId, label: '健康绿', color: '#07c160' },
  { id: 'teal' as ThemeId, label: '清新青', color: '#0d9488' },
  { id: 'simple' as ThemeId, label: '极简灰', color: '#374151' }
]
const themeName = computed(() => themes.find((t) => t.id === app.theme)?.label || '主题')
function changeTheme(id: ThemeId) {
  app.theme = id
  app.applyTheme()
}

const activePath = computed(() => route.path)

function filterChildren(g: MenuGroup): MenuGroup {
  const role = auth.account?.role
  const children = g.children.filter((c) => !('roles' in c) || !c.roles || !role || (c.roles as string[]).includes(role))
  return { ...g, children }
}
const visibleGroups = computed(() =>
  menuGroups
    .map(filterChildren)
    .filter((g) => !auth.account || g.roles.includes(auth.account.role))
    .filter((g) => g.children.length > 0)
)

const breadcrumbs = computed(() => {
  return route.matched
    .filter((m) => m.meta?.title && !m.meta.hidden && m.path !== '/')
    .map((m) => ({ title: m.meta.title as string, path: m.path }))
})

function onUserCommand(cmd: string) {
  if (cmd === 'logout') {
    auth.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  }
}
</script>

<style scoped>
.admin-layout { display: flex; height: 100%; }
.layout-side { width: var(--kt-sidebar-w); background: var(--kt-surface); border-right: 1px solid var(--kt-line); display: flex; flex-direction: column; transition: width 0.2s; }
.layout-side.collapsed { width: var(--kt-sidebar-w-collapsed); }
.brand { display: flex; align-items: center; gap: 10px; height: 56px; padding: 0 16px; cursor: pointer; border-bottom: 1px solid var(--kt-line); overflow: hidden; white-space: nowrap; }
.brand-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--kt-brand); flex: none; box-shadow: 0 0 0 4px var(--kt-brand-soft); }
.brand-name { font-weight: 700; font-size: 15px; color: var(--kt-ink); }
.brand-sub { font-size: 11px; color: var(--kt-muted); }
.menu-scroll { flex: 1; }
.kt-menu { border-right: none; }
.layout-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.layout-header { height: 56px; background: var(--kt-surface); border-bottom: 1px solid var(--kt-line); display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
.header-left { display: flex; align-items: center; gap: 12px; }
.collapse-btn { font-size: 20px; cursor: pointer; color: var(--kt-muted); }
.header-right { display: flex; align-items: center; gap: 18px; }
.header-action, .header-user { display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--kt-ink); outline: none; }
.theme-label { font-size: 13px; color: var(--kt-muted); }
.user-avatar { background: var(--kt-brand); color: #fff; font-weight: 600; }
.theme-opt { display: flex; align-items: center; gap: 6px; }
.theme-opt .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.layout-content { flex: 1; overflow: auto; }
</style>
