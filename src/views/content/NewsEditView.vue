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
            <img v-if="coverPreview" :src="coverPreview" class="cover-img" />
            <div v-else class="cover-empty">未设置封面</div>
          </div>
          <div class="cover-ops">
            <el-select
              v-model="form.coverUrl"
              placeholder="选择已上传封面或内置样式"
              clearable
              filterable
              size="small"
              style="width: 100%"
            >
              <el-option-group label="已上传素材">
                <el-option v-for="opt in uploadedOptions" :key="opt.value" :label="opt.label" :value="opt.value">
                  <div class="option-row">
                    <img :src="opt.displayUrl" class="option-thumb" />
                    <span>{{ opt.label }}</span>
                  </div>
                </el-option>
              </el-option-group>
              <el-option-group label="内置样式">
                <el-option v-for="i in 6" :key="i" :label="`封面样式 ${i}`" :value="`/img/news-${i}.svg`" />
              </el-option-group>
            </el-select>
            <el-upload
              class="upload-btn"
              :show-file-list="false"
              :http-request="uploadCover"
              accept="image/jpeg,image/png"
            >
              <el-button size="small" :loading="uploading" style="width: 100%; margin-top: 8px">
                上传封面（JPG/PNG，≤5MB）
              </el-button>
            </el-upload>
            <el-input v-model="form.coverText" size="small" placeholder="封面角标文字（如 科普）" style="margin-top: 8px" />
            <p class="tip text-muted">上传走对象存储（local/MinIO/OSS），保存的是稳定路径 /api/v1/cms/images/{id}。</p>
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
import { cmsMediaApi, displayMediaUrl, type CmsMediaOption } from '@/api/cms-media'
import { useAuthStore } from '@/stores/auth'
import type { News, NewsChannel, NewsStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const channels: NewsChannel[] = ['企业动态', '行业快讯', '设备新知', '控糖科普']

const saving = ref(false)
const uploading = ref(false)
const uploadedOptions = ref<CmsMediaOption[]>([])
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

const coverPreview = computed(() => displayMediaUrl(form.coverUrl))

async function loadUploaded() {
  try {
    uploadedOptions.value = await cmsMediaApi.listOptions('news')
  } catch {
    uploadedOptions.value = []
  }
}

async function load() {
  await loadUploaded()
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

async function uploadCover(options: { file: File; onSuccess: (body: unknown) => void; onError: (e: Error) => void }) {
  uploading.value = true
  try {
    const uploaded = await cmsMediaApi.upload(options.file, 'news')
    form.coverUrl = uploaded.value
    if (!uploadedOptions.value.some((o) => o.value === uploaded.value)) {
      uploadedOptions.value = [uploaded, ...uploadedOptions.value]
    }
    ElMessage.success('封面已上传')
    options.onSuccess(uploaded)
  } catch (e) {
    const err = e as Error
    ElMessage.error(err.message || '上传失败')
    options.onError(err)
  } finally {
    uploading.value = false
  }
}

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
.cover-upload { margin-top: 8px; }
.tip { font-size: 12px; margin-top: 10px; }
.option-row { display: flex; align-items: center; gap: 8px; }
.option-thumb { width: 36px; height: 24px; object-fit: cover; border-radius: 4px; border: 1px solid var(--kt-line); }
.upload-btn { width: 100%; display: block; }
</style>
