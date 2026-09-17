import { defineStore } from 'pinia'
import type { ThemeId } from '@/types'

const THEME_KEY = 'kt_admin_theme'
const THEME_CLASS: Record<ThemeId, string> = { green: '', teal: 'theme-teal', simple: 'theme-simple' }

export const useAppStore = defineStore('app', {
  state: () => ({
    theme: (localStorage.getItem(THEME_KEY) as ThemeId) || 'green',
    sidebarCollapsed: false
  }),
  actions: {
    applyTheme() {
      const root = document.documentElement
      root.classList.remove('theme-teal', 'theme-simple')
      if (THEME_CLASS[this.theme]) root.classList.add(THEME_CLASS[this.theme])
      localStorage.setItem(THEME_KEY, this.theme)
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    }
  }
})
