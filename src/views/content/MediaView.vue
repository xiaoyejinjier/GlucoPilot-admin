<template>
  <div class="page-wrap">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-select v-model="biz" style="width: 170px" @change="load">
          <el-option v-for="b in bizTypes" :key="b.value" :label="b.label" :value="b.value" />
        </el-select>
        <el-upload :show-file-list="false" :http-request="doUpload" accept="image/jpeg,image/png">
          <el-button type="primary" :icon="Upload" :loading="uploading" :disabled="biz === 'all'">上传素材</el-button>
        </el-upload>
        <span class="text-muted tip">{{ tip }}</span>
      </div>
    </div>

    <div class="kt-card">
      <el-table :data="list" v-loading="loading">
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
/**
 * 内容媒体素材页：对接 /admin/v1/cms-media，对象存储可为 local / MinIO / OSS。
 * 上传前须选定资讯配图或轮播图用途；列表缩略图走稳定地址 /api/v1/cms/images/{id}。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { cmsMediaApi, type CmsMediaPurpose } from '@/api/cms-media'
import { adminConfig } from '@/config'
import { humanSize } from '@/utils/format'
import type { MediaBizType, MediaFile } from '@/types'

const bizTypes = [
  { value: 'all' as const, label: '全部用途' },
  { value: 'news' as const, label: '资讯配图' },
  { value: 'banner' as const, label: '轮播图' }
]
const biz = ref<'all' | CmsMediaPurpose>('all')
const list = ref<MediaFile[]>([])
const loading = ref(false)
const uploading = ref(false)

const tip = computed(() => {
  if (adminConfig.useMock) return '演示模式未接通对象存储，请关闭 Mock 后使用'
  if (biz.value === 'all') return '请先选择「资讯配图」或「轮播图」再上传；存储走后端 local/MinIO/OSS'
  return 'JPG/PNG，最大 5MB；凭证直传对象存储后登记，稳定地址 /api/v1/cms/images/{id}'
})

async function load() {
  loading.value = true
  try {
    list.value = await cmsMediaApi.list(biz.value)
  } catch (e) {
    ElMessage.error((e as Error).message || '加载素材失败')
    list.value = []
  } finally {
    loading.value = false
  }
}
onMounted(load)

function bizLabel(t: MediaBizType) {
  return bizTypes.find((b) => b.value === t)?.label || t
}

async function doUpload(options: { file: File; onSuccess: (body: unknown) => void; onError: (e: Error) => void }) {
  if (biz.value === 'all') {
    ElMessage.warning('请先选择资讯配图或轮播图')
    options.onError(new Error('未选择用途'))
    return
  }
  uploading.value = true
  try {
    const m = await cmsMediaApi.upload(options.file, biz.value)
    ElMessage.success('上传成功')
    options.onSuccess(m)
    await load()
  } catch (e) {
    const err = e as Error
    ElMessage.error(err.message || '上传失败')
    options.onError(err)
  } finally {
    uploading.value = false
  }
}

async function remove(row: MediaFile) {
  try {
    await cmsMediaApi.remove(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败')
  }
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; margin-bottom: 16px; }
.toolbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.thumb { width: 72px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid var(--kt-line); background: #fff; }
.tip { font-size: 12px; }
</style>
