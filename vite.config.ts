import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.DEV_API_TARGET || 'http://127.0.0.1:8080'
  return {
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5180,
    open: false,
    proxy: {
      '/admin/v1': {
        target: apiTarget,
        changeOrigin: true
      },
      '/api/v1': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          'element-plus': ['element-plus', '@element-plus/icons-vue'],
          echarts: ['echarts']
        }
      }
    }
  }
}
})
