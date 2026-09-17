<template>
  <div class="page-wrap">
    <div class="kt-card">
      <div class="filter mb12">
        <el-select v-model="module" placeholder="模块" clearable style="width: 160px" @change="load">
          <el-option v-for="m in modules" :key="m" :label="m" :value="m" />
        </el-select>
        <el-input v-model="keyword" placeholder="关键词（操作人/详情）" clearable :prefix-icon="Search" style="width: 240px" />
        <el-button :icon="Refresh" @click="load">刷新</el-button>
        <span class="text-muted" style="font-size: 12px">保存最近 200 条，写操作均自动记录</span>
      </div>

      <el-table :data="filtered" v-loading="loading">
        <el-table-column prop="createdAt" label="时间" width="170" />
        <el-table-column label="操作人" width="130">
          <template #default="{ row }">
            <span>{{ row.operator }}</span>
            <el-tag size="small" style="margin-left: 4px" :type="row.role === 'admin' ? 'warning' : 'success'" effect="plain">{{ row.role === 'admin' ? '管' : '运' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="模块" width="110">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.module }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="action" label="动作" width="130" />
        <el-table-column prop="detail" label="详情" min-width="260" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP" width="130" />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import { api } from '@/api'
import type { OperationLog } from '@/types'

const loading = ref(false)
const module = ref('')
const keyword = ref('')
const list = ref<OperationLog[]>([])
const modules = ['登录', '资讯', '内容', '媒体', '营养库', '用户', '档案', '反馈', '系统', '导出']

async function load() {
  loading.value = true
  list.value = await api.listLogs()
  loading.value = false
}
onMounted(load)

const filtered = computed(() =>
  list.value.filter(
    (l) =>
      (!module.value || l.module === module.value) &&
      (!keyword.value || l.operator.includes(keyword.value) || l.detail.includes(keyword.value) || l.action.includes(keyword.value))
  )
)
</script>

<style scoped>
.filter { display: flex; gap: 10px; align-items: center; }
</style>
