<template>
  <div class="page-wrap">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input v-model="q.title" placeholder="标题关键词" clearable style="width: 220px" :prefix-icon="Search" @input="applyFilter" />
        <el-select v-model="q.channel" placeholder="频道" clearable style="width: 150px" @change="applyFilter">
          <el-option v-for="c in channels" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="q.status" placeholder="状态" clearable style="width: 130px" @change="applyFilter">
          <el-option label="草稿" value="draft" />
          <el-option label="已发布" value="published" />
          <el-option label="已下架" value="unpublished" />
        </el-select>
      </div>
      <el-button type="primary" :icon="Plus" @click="$router.push('/content/news/new')">新建资讯</el-button>
    </div>

    <div class="kt-card">
      <el-table :data="filtered" v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" min-width="240" show-overflow-tooltip />
        <el-table-column label="频道" width="110">
          <template #default="{ row }"><el-tag size="small" effect="light">{{ row.channel }}</el-tag></template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'video' ? 'warning' : 'info'" effect="plain">{{ row.type === 'video' ? '视频' : '图文' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.status)" effect="light">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="views" label="阅读" width="80" />
        <el-table-column label="互动" width="100">
          <template #default="{ row }">赞 {{ row.likes }} · 藏 {{ row.collects }}</template>
        </el-table-column>
        <el-table-column prop="publishAt" label="发布时间" width="150" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/content/news/${row.id}/edit`)">编辑</el-button>
            <el-button v-if="row.status !== 'published'" link type="success" @click="setStatus(row, 'published')">发布</el-button>
            <el-button v-if="row.status === 'published'" link type="warning" @click="setStatus(row, 'unpublished')">下架</el-button>
            <el-popconfirm title="确认删除该资讯？" @confirm="remove(row)">
              <template #reference><el-button link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { News, NewsChannel, NewsStatus } from '@/types'

const auth = useAuthStore()
const channels: NewsChannel[] = ['企业动态', '行业快讯', '设备新知', '控糖科普']
const loading = ref(false)
const list = ref<News[]>([])
const q = reactive({ title: '', channel: '' as NewsChannel | '', status: '' as NewsStatus | '' })

async function load() {
  loading.value = true
  try {
    list.value = await api.listNews()
  } catch (e) {
    ElMessage.error((e as Error).message || '加载资讯失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const filtered = computed(() =>
  list.value.filter(
    (n) =>
      (!q.title || n.title.includes(q.title)) &&
      (!q.channel || n.channel === q.channel) &&
      (!q.status || n.status === q.status)
  )
)
function applyFilter() {
  /* 由 computed 自动过滤 */
}

function statusType(s: NewsStatus): 'success' | 'info' | 'warning' {
  return s === 'published' ? 'success' : s === 'draft' ? 'info' : 'warning'
}
function statusText(s: NewsStatus): string {
  return s === 'published' ? '已发布' : s === 'draft' ? '草稿' : '已下架'
}

async function setStatus(row: News, status: NewsStatus) {
  await api.setNewsStatus(row.id, status)
  await load()
  if (auth.account) api.writeLog(auth.account.username, auth.account.role, '资讯', status === 'published' ? '发布文章' : '下架文章', `《${row.title}》`)
  ElMessage.success(status === 'published' ? '已发布' : '已下架')
}

async function remove(row: News) {
  await api.removeNews(row.id)
  if (auth.account) api.writeLog(auth.account.username, auth.account.role, '资讯', '删除文章', `《${row.title}》`)
  ElMessage.success('已删除')
  await load()
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar-left { display: flex; gap: 10px; }
</style>
