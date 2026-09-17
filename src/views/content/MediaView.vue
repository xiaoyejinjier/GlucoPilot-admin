<template>
  <div class="page-wrap">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-select v-model="biz" style="width: 170px" @change="load">
          <el-option v-for="b in bizTypes" :key="b.value" :label="b.label" :value="b.value" />
        </el-select>
        <el-upload :show-file-list="false" :http-request="doUpload" accept="image/*">
          <el-button type="primary" :icon="Upload">上传素材</el-button>
        </el-upload>
        <span class="text-muted tip">演示环境：选择文件后仅登记一条模拟素材记录</span>
      </div>
    </div>

    <div class="kt-card">
      <el-table :data="filtered" v-loading="loading">
        <el-table-column label="缩略图" width="110">
          <template #default="{ row }"><img :src="row.url" class="thumb" /></template>
        </el-table-column>
        <el-table-column prop="name" label="文件名称" min-width="220" />
        <el-table-column label="用途" width="120">
          <template #default="{ row }">{{ bizLabel(row.bizType) }}</template>
        </el-table-column>
        <el-table-column label="大小" width="110">
          <template #default="{ row }">{{ humanSize(row.size) }}</template>
        </el-table-column>
        <el-table-column prop="uploader" label="上传人" width="120" />
        <el-table-column prop="createdAt" label="上传时间" width="170" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-popconfirm title="确认删除该素材？" @confirm="remove(row)">
              <template #reference><el-button link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { humanSize } from '@/utils/format'
import type { MediaBizType, MediaFile } from '@/types'

const auth = useAuthStore()
const bizTypes = [
  { value: 'all' as const, label: '全部用途' },
  { value: 'news' as const, label: '资讯配图' },
  { value: 'banner' as const, label: '轮播图' },
  { value: 'meal_photo' as const, label: '饮食照片' },
  { value: 'avatar' as const, label: '头像' }
]
const biz = ref<'all' | MediaBizType>('all')
const list = ref<MediaFile[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  list.value = await api.listMedia()
  loading.value = false
}
onMounted(load)

const filtered = computed(() => (biz.value === 'all' ? list.value : list.value.filter((m) => m.bizType === biz.value)))

function bizLabel(t: MediaBizType) {
  return bizTypes.find((b) => b.value === t)?.label || t
}

async function doUpload(options: { file: File; onSuccess: (body: unknown) => void }) {
  const uploader = auth.account?.username || 'unknown'
  const b = biz.value === 'all' ? ('news' as MediaBizType) : biz.value
  const m = await api.mockUpload(options.file.name, b, uploader)
  if (auth.account) api.writeLog(auth.account.username, auth.account.role, '媒体', '上传素材', m.name)
  ElMessage.success('上传成功（模拟）')
  options.onSuccess(m)
  await load()
}

async function remove(row: MediaFile) {
  await api.removeMedia(row.id)
  ElMessage.success('已删除')
  await load()
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; margin-bottom: 16px; }
.toolbar-left { display: flex; align-items: center; gap: 10px; }
.thumb { width: 72px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid var(--kt-line); background: #fff; }
.tip { font-size: 12px; }
</style>
