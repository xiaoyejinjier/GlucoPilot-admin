<template>
  <div class="page-wrap">
    <div class="head mb16">
      <el-button :icon="ArrowLeft" @click="$router.push('/content/news')">返回列表</el-button>
      <h2 class="page-title">{{ isEdit ? '编辑资讯' : '新建资讯' }}</h2>
      <el-button type="primary" :loading="saving" @click="save('draft')">{{ isEdit ? '保存' : '存为草稿' }}</el-button>
      <el-button type="success" :loading="saving" @click="save('published')">保存并发布</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="16">
        <div class="kt-card">
          <el-form :model="form" label-width="90px" label-position="right">
            <el-form-item label="标题" required>
              <el-input v-model="form.title" maxlength="60" show-word-limit placeholder="请输入资讯标题" />
            </el-form-item>
            <el-form-item label="摘要">
              <el-input v-model="form.summary" type="textarea" :rows="2" maxlength="140" show-word-limit placeholder="列表页展示的摘要" />
            </el-form-item>
            <el-form-item label="频道" required>
              <el-radio-group v-model="form.channel">
                <el-radio-button v-for="c in channels" :key="c" :value="c">{{ c }}</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="内容类型">
              <el-radio-group v-model="form.type">
                <el-radio value="article">图文</el-radio>
                <el-radio value="video">视频</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="form.type === 'video'" label="视频地址">
              <el-input v-model="form.videoUrl" placeholder="/video/xxx.mp4 或 https://..." />
            </el-form-item>
            <el-form-item label="正文内容">
              <el-input v-model="form.content" type="textarea" :rows="14" placeholder="支持多段落文本；富文本编辑器接入后替换为富文本组件" />
            </el-form-item>
          </el-form>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="kt-card mb16">
          <div class="block-title">封面</div>
          <div class="cover-box">
            <img v-if="form.coverUrl" :src="form.coverUrl" class="cover-img" />
            <div v-else class="cover-empty">未设置封面</div>
          </div>
          <div class="cover-ops">
            <el-select v-model="form.coverUrl" placeholder="选择封面样式" clearable size="small" style="width: 100%">
              <el-option v-for="i in 6" :key="i" :label="`封面样式 ${i}`" :value="`/img/news-${i}.svg`" />
            </el-select>
            <el-input v-model="form.coverText" size="small" placeholder="封面角标文字（如 科普）" style="margin-top: 8px" />
          </div>
        </div>
        <div class="kt-card">
          <div class="block-title mb12">发布信息</div>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="当前状态">{{ isEdit ? statusText : '新建草稿' }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ form.updatedAt || '—' }}</el-descriptions-item>
          </el-descriptions>
          <p class="tip text-muted">发布后立即在小程序首页对应频道可见。</p>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { News, NewsChannel, NewsStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const channels: NewsChannel[] = ['企业动态', '行业快讯', '设备新知', '控糖科普']

const saving = ref(false)
const id = Number(route.params.id || 0)
const isEdit = computed(() => !!id && id > 0)

const form = reactive<News>({
  id: 0,
  title: '',
  summary: '',
  channel: '控糖科普',
  type: 'article',
  coverUrl: '',
  coverText: '',
  videoUrl: '',
  content: '',
  status: 'draft',
  publishAt: '',
  views: 0,
  likes: 0,
  collects: 0,
  createdAt: '',
  updatedAt: ''
})

async function load() {
  if (!isEdit.value) return
  try {
    const list = await api.listNews()
    const target = list.find((n) => n.id === id)
    if (target) Object.assign(form, target)
  } catch (e) {
    ElMessage.error((e as Error).message || '加载资讯失败')
  }
}
onMounted(load)

const statusText = computed(() => (form.status === 'published' ? '已发布' : form.status === 'draft' ? '草稿' : '已下架'))

async function save(status: NewsStatus) {
  if (!form.title.trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  saving.value = true
  try {
    form.status = status
    if (status === 'published' && !form.publishAt) {
      form.publishAt = new Date().toLocaleString('zh-CN', { hour12: false })
    }
    const saved = await api.saveNews({ ...form })
    if (auth.account) api.writeLog(auth.account.username, auth.account.role, '资讯', status === 'published' ? '发布文章' : '保存文章', `《${saved.title}》`)
    ElMessage.success(status === 'published' ? '已保存并发布' : '已保存')
    router.push('/content/news')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.head { display: flex; align-items: center; gap: 14px; }
.page-title { margin: 0; font-size: 18px; flex: 1; }
.block-title { font-weight: 600; margin-bottom: 10px; }
.cover-box { width: 100%; height: 150px; border: 1px dashed var(--kt-line); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #fafafa; margin-bottom: 10px; }
.cover-img { width: 100%; height: 100%; object-fit: cover; }
.cover-empty { color: var(--kt-muted); font-size: 13px; }
.tip { font-size: 12px; margin-top: 10px; }
</style>
