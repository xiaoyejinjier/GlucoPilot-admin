<template>
  <div class="page-wrap">
    <div class="head">
      <h2 class="page-title">导出任务</h2>
      <span class="text-muted">小程序用户发起的数据导出申请，后台可手动完成生成并供下载</span>
    </div>

    <div class="kt-card">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="用户" min-width="140">
          <template #default="{ row }">{{ row.userName }} (#{{ row.userId }})</template>
        </el-table-column>
        <el-table-column label="范围" width="220">
          <template #default="{ row }">{{ rangeLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'done' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'" effect="light">
              {{ row.status === 'done' ? '已完成' : row.status === 'failed' ? '失败' : '生成中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="申请时间" width="170" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button link type="primary" @click="finish(row)">模拟完成生成</el-button>
            </template>
            <template v-else-if="row.status === 'done'">
              <el-button link type="success" @click="download(row)">下载文件</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length === 0" description="暂无导出任务" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import type { ExportTask } from '@/types'

const loading = ref(false)
const list = ref<ExportTask[]>([])

async function load() {
  loading.value = true
  list.value = await api.listExports()
  loading.value = false
}
onMounted(load)

function rangeLabel(t: ExportTask): string {
  const map: Record<string, string> = { '7': '近 7 天', '30': '近 30 天', '90': '近 90 天', custom: '自定义' }
  return `${map[t.rangeType] || t.rangeType}（${t.startDate} ~ ${t.endDate}）`
}

async function finish(row: ExportTask) {
  await api.finishExport(row.id)
  ElMessage.success('已完成（模拟）')
  await load()
}

function download(row: ExportTask) {
  const blob = new Blob(['血糖记录与饮食记录导出文件（演示内容）'], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `export-${row.userId}-${row.id}.xlsx`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已开始下载（模拟文件）')
}
</script>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 18px; }
</style>
