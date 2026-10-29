<template>
  <div class="page-wrap">
    <div class="head mb16">
      <el-button :icon="ArrowLeft" @click="$router.push('/content/community')">返回列表</el-button>
      <h2 class="page-title">{{ isEdit ? '编辑官方文章' : '新建官方文章' }}</h2>
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
            <el-form-item label="标签" required>
              <div class="tag-compose" v-loading="tagsLoading">
                <div class="compose-tags">
                  <button
                    v-for="t in officialTags"
                    :key="t.code"
                    type="button"
                    class="compose-tag"
                    :class="{ on: tagCodes.includes(t.code) }"
                    @click="toggleOfficial(t.code)"
                  ># {{ t.name }}</button>
                  <button
                    v-for="name in customTags"
                    :key="`c-${name}`"
                    type="button"
                    class="compose-tag on custom"
                    @click="removeCustom(name)"
                  ># {{ name }} <span>×</span></button>
                  <button type="button" class="compose-tag plus" @click="openTagPicker">＋</button>
                </div>
                <p class="tip text-muted">已选 {{ tagCount }} / 3 · 点固定标签选用，点＋搜索更多或自建标签</p>
              </div>
            </el-form-item>
            <el-form-item label="内容类型">
              <el-radio-group v-model="form.type">
                <el-radio value="article">图文</el-radio>
                <el-radio value="video">视频</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="form.type === 'video'" label="视频">
              <el-input v-model="form.videoUrl" placeholder="上传后自动填入 /api/v1/cms/videos/{id}，也可手填外链" />
              <el-upload
                class="upload-btn"
                :show-file-list="false"
                :http-request="uploadVideo"
                accept="video/mp4"
              >
                <el-button size="small" :loading="videoUploading" style="width: 100%; margin-top: 8px">
                  上传 MP4（≤100MB）
                </el-button>
              </el-upload>
              <el-progress
                v-if="videoUploading"
                :percentage="videoUploadPercent"
                :stroke-width="6"
                class="upload-progress"
              />
              <p class="tip text-muted">稳定路径 /api/v1/cms/videos/{id}，走对象存储（local/MinIO）。</p>
            </el-form-item>
            <el-form-item label="正文内容">
              <div class="rich-wrap">
                <Toolbar class="rich-toolbar" :editor="editorRef" :defaultConfig="toolbarConfig" mode="default" />
                <Editor
                  class="rich-editor"
                  v-model="form.content"
                  :defaultConfig="editorConfig"
                  mode="default"
                  @onCreated="onEditorCreated"
                />
              </div>
              <p class="tip text-muted">正文存 HTML；插图走 CMS 上传，入库为 /api/v1/cms/images/{id}。</p>
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
            <p class="tip text-muted">上传走对象存储（local/MinIO），保存稳定路径 /api/v1/cms/images/{id}。</p>
          </div>
        </div>
        <div class="kt-card">
          <div class="block-title mb12">发布信息</div>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="当前状态">{{ isEdit ? statusText : '新建草稿' }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ form.updatedAt || '—' }}</el-descriptions-item>
          </el-descriptions>
          <p class="tip text-muted">发布后按所选标签在社区侧可见。</p>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="tagPickerOpen" title="选择标签" width="480px" destroy-on-close append-to-body>
      <p class="picker-hint">已选 {{ tagCount }} / 3 · 可搜索标签库，也可在下方添加新标签</p>
      <el-input v-model="tagSearch" clearable placeholder="搜索标签名称" class="mb12" />
      <div class="picker-list">
        <button
          v-for="t in filteredPickerTags"
          :key="t.code"
          type="button"
          class="picker-row"
          :class="{ on: tagCodes.includes(t.code) }"
          @click="toggleOfficial(t.code)"
        >
          <span># {{ t.name }}</span>
          <span class="picker-mark">{{ tagCodes.includes(t.code) ? '✓' : '' }}</span>
        </button>
        <el-empty v-if="!filteredPickerTags.length" description="没有匹配的标签" :image-size="56" />
      </div>
      <div class="picker-create">
        <el-input
          v-model="customInput"
          maxlength="16"
          show-word-limit
          placeholder="自定义标签，最多 16 字"
          @keyup.enter="addCustomFromPicker"
        />
        <el-button type="primary" :disabled="!customInput.trim()" @click="addCustomFromPicker">添加</el-button>
      </div>
      <template #footer>
        <el-button type="primary" @click="tagPickerOpen = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'
import { api } from '@/api'
import { communityTagsApi, type ManagedTag } from '@/api/community-tags'
import { cmsMediaApi, displayMediaUrl, type CmsMediaOption } from '@/api/cms-media'
import { useAuthStore } from '@/stores/auth'
import type { News, NewsStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const saving = ref(false)
const uploading = ref(false)
const videoUploading = ref(false)
const videoUploadPercent = ref(0)
const tagsLoading = ref(false)
const tagOptions = ref<ManagedTag[]>([])
const tagCodes = ref<string[]>([])
const customTags = ref<string[]>([])
const tagPickerOpen = ref(false)
const tagSearch = ref('')
const customInput = ref('')
const uploadedOptions = ref<CmsMediaOption[]>([])
const editorRef = shallowRef<IDomEditor>()
const id = Number(route.params.id || 0)
const isEdit = computed(() => !!id && id > 0)
const tagCount = computed(() => tagCodes.value.length + customTags.value.length)
/** 首页同款固定官方话题（排除 other / 自定义） */
const officialTags = computed(() =>
  tagOptions.value.filter((t) => t.type !== 'USER' && !String(t.code).startsWith('custom_') && t.code !== 'other')
)
const filteredPickerTags = computed(() => {
  const q = tagSearch.value.trim().toLowerCase()
  const rows = tagOptions.value.filter((t) => t.code !== 'other')
  if (!q) return rows
  return rows.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q))
})

const form = reactive<News>({
  id: 0,
  title: '',
  summary: '',
  tagCodes: [],
  customTags: [],
  tags: [],
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

const toolbarConfig: Partial<IToolbarConfig> = {
  excludeKeys: ['uploadVideo', 'insertVideo', 'fullScreen']
}

const editorConfig: Partial<IEditorConfig> = {
  placeholder: '请输入正文，可排版、插入链接与图片…',
  MENU_CONF: {
    uploadImage: {
      customUpload: async (file: File, insertFn: (url: string, alt?: string, href?: string) => void) => {
        try {
          const uploaded = await cmsMediaApi.upload(file, 'news')
          // 编辑器预览用可访问 URL；入库仍用相对路径（保存时从 HTML 还原）
          insertFn(uploaded.displayUrl, file.name, uploaded.value)
          if (!uploadedOptions.value.some((o) => o.value === uploaded.value)) {
            uploadedOptions.value = [uploaded, ...uploadedOptions.value]
          }
        } catch (e) {
          ElMessage.error((e as Error).message || '正文插图上传失败')
        }
      }
    }
  }
}

function onEditorCreated(editor: IDomEditor) {
  editorRef.value = editor
}

/** 保存前：把预览用的绝对 CMS 图地址还原为稳定相对路径。 */
function contentForSave(html: string): string {
  if (!html) return ''
  return html.replace(
    /(src|href)=["']([^"']*\/api\/v1\/cms\/images\/\d+)["']/gi,
    (_m, attr, path) => {
      const idx = path.indexOf('/api/v1/cms/images/')
      const relative = idx >= 0 ? path.slice(idx) : path
      return `${attr}="${relative}"`
    }
  )
}

/** 加载后：相对路径补成可预览地址。 */
function contentForEditor(html: string): string {
  if (!html) return ''
  return html.replace(
    /(src|href)=["'](\/api\/v1\/cms\/images\/\d+)["']/gi,
    (_m, attr, path) => `${attr}="${displayMediaUrl(path)}"`
  )
}

async function loadTags() {
  tagsLoading.value = true
  try {
    const all = await communityTagsApi.list({ keyword: '', type: '', enabled: '1', pageNum: 1, pageSize: 50 })
    tagOptions.value = all.records
  } catch (e) {
    tagOptions.value = []
    ElMessage.error((e as Error).message || '加载标签失败')
  } finally {
    tagsLoading.value = false
  }
}

function openTagPicker() {
  tagSearch.value = ''
  customInput.value = ''
  tagPickerOpen.value = true
}

function toggleOfficial(code: string) {
  const i = tagCodes.value.indexOf(code)
  if (i >= 0) {
    tagCodes.value = tagCodes.value.filter((c) => c !== code)
    return
  }
  if (tagCount.value >= 3) {
    ElMessage.warning('最多选择 3 个标签')
    return
  }
  // 若同名自定义已选，去掉自定义改用官方 code
  const hit = tagOptions.value.find((t) => t.code === code)
  if (hit) {
    customTags.value = customTags.value.filter((n) => n.toLowerCase() !== hit.name.toLowerCase())
  }
  tagCodes.value = [...tagCodes.value, code]
}

function removeCustom(name: string) {
  customTags.value = customTags.value.filter((n) => n !== name)
}

function addCustomFromPicker() {
  const name = customInput.value.replace(/^#+/, '').trim().replace(/\s+/g, ' ')
  if (!name) return
  if (!/^[\p{L}\p{N} _-]{1,16}$/u.test(name)) {
    ElMessage.warning('标签限 1～16 字，可用中文、字母和数字')
    return
  }
  const builtin = tagOptions.value.find((t) => t.name.toLowerCase() === name.toLowerCase())
  if (builtin) {
    if (!tagCodes.value.includes(builtin.code) && tagCount.value >= 3) {
      ElMessage.warning('最多选择 3 个标签')
      return
    }
    if (!tagCodes.value.includes(builtin.code)) tagCodes.value = [...tagCodes.value, builtin.code]
    customInput.value = ''
    return
  }
  if (customTags.value.some((n) => n.toLowerCase() === name.toLowerCase())) {
    customInput.value = ''
    return
  }
  if (tagCount.value >= 3) {
    ElMessage.warning('最多选择 3 个标签')
    return
  }
  customTags.value = [...customTags.value, name]
  customInput.value = ''
}

async function loadUploaded() {
  try {
    uploadedOptions.value = await cmsMediaApi.listOptions('news')
  } catch {
    uploadedOptions.value = []
  }
}

async function load() {
  await Promise.all([loadTags(), loadUploaded()])
  if (!isEdit.value) return
  try {
    const list = await api.listNews()
    const target = list.find((n) => n.id === id)
    if (target) {
      const tags = target.tags || []
      for (const t of tags) {
        if (!tagOptions.value.some((o) => o.code === t.code)) {
          tagOptions.value = [...tagOptions.value, {
            id: t.code,
            code: t.code,
            name: t.name,
            type: t.code.startsWith('custom_') ? 'USER' : 'OFFICIAL',
            sortNo: 0,
            enabled: 1,
            articleCount: 0
          }]
        }
      }
      const codes: string[] = []
      const customs: string[] = []
      for (const t of tags) {
        if (t.code && !String(t.code).startsWith('custom_') && t.code !== 'other') {
          if (!codes.includes(t.code)) codes.push(t.code)
        } else if (t.name && !customs.includes(t.name)) {
          customs.push(t.name)
        }
      }
      Object.assign(form, target, {
        coverText: '',
        tagCodes: codes,
        customTags: customs,
        content: contentForEditor(target.content || '')
      })
      tagCodes.value = codes
      customTags.value = customs
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '加载资讯失败')
  }
}
onMounted(load)

onBeforeUnmount(() => {
  const editor = editorRef.value
  if (editor) {
    editor.destroy()
    editorRef.value = undefined
  }
})

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

async function uploadVideo(options: { file: File; onSuccess: (body: unknown) => void; onError: (e: Error) => void }) {
  videoUploading.value = true
  videoUploadPercent.value = 0
  try {
    const uploaded = await cmsMediaApi.upload(options.file, 'news-video', (percent) => {
      videoUploadPercent.value = percent
    })
    form.videoUrl = uploaded.value
    ElMessage.success('视频已上传')
    options.onSuccess(uploaded)
  } catch (e) {
    const err = e as Error
    ElMessage.error(err.message || '视频上传失败')
    options.onError(err)
  } finally {
    videoUploading.value = false
    videoUploadPercent.value = 0
  }
}

async function save(status: NewsStatus) {
  if (!form.title.trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  if (tagCount.value < 1 || tagCount.value > 3) {
    ElMessage.warning('请选择或添加 1～3 个标签')
    return
  }
  for (const name of customTags.value) {
    if (!/^[\p{L}\p{N} _-]{1,16}$/u.test(name)) {
      ElMessage.warning(`标签「${name}」不合法：限 1～16 字，可用中文、字母和数字`)
      return
    }
  }
  saving.value = true
  try {
    form.status = status
    if (status === 'published' && !form.publishAt) {
      form.publishAt = new Date().toLocaleString('zh-CN', { hour12: false })
    }
    const payload = {
      ...form,
      tagCodes: [...tagCodes.value],
      customTags: [...customTags.value],
      coverText: '',
      content: contentForSave(form.content)
    }
    const saved = await api.saveNews(payload)
    if (auth.account) {
      api.writeLog(
        auth.account.username,
        auth.account.role,
        '资讯',
        status === 'published' ? '发布文章' : '保存文章',
        `《${saved.title}》`
      )
    }
    ElMessage.success(status === 'published' ? '已保存并发布' : '已保存')
    router.push('/content/community')
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
.option-row { display: flex; align-items: center; gap: 8px; }
.option-thumb { width: 36px; height: 24px; object-fit: cover; border-radius: 4px; border: 1px solid var(--kt-line); }
.upload-btn { width: 100%; display: block; }
.upload-progress { width: 100%; margin-top: 8px; }
.rich-wrap {
  border: 1px solid var(--kt-line);
  border-radius: 8px;
  overflow: hidden;
  width: 100%;
  background: #fff;
}
.rich-toolbar { border-bottom: 1px solid var(--kt-line); }
.rich-editor { min-height: 320px; }
.rich-editor :deep(.w-e-text-container) { min-height: 320px !important; }
.tag-compose { width: 100%; min-height: 40px; }
.compose-tags { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.compose-tag {
  border: 1px solid var(--kt-line);
  background: #f7faf8;
  color: var(--kt-ink);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
}
.compose-tag.on { background: #e8f6ef; border-color: #b7dfc8; color: #18845a; font-weight: 600; }
.compose-tag.custom span { margin-left: 6px; color: var(--kt-muted); }
.compose-tag.plus {
  min-width: 36px;
  padding-left: 10px;
  padding-right: 10px;
  border-style: dashed;
  color: #18845a;
  background: #f2faf6;
  border-color: #b7dfc8;
  font-size: 18px;
  font-weight: 600;
}
.picker-hint { margin: 0 0 12px; font-size: 13px; color: var(--kt-muted); }
.mb12 { margin-bottom: 12px; }
.picker-list { max-height: 280px; overflow: auto; border: 1px solid var(--kt-line); border-radius: 8px; padding: 6px; }
.picker-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--kt-ink);
}
.picker-row:hover { background: #f5f7f6; }
.picker-row.on { background: #e8f6ef; color: #18845a; font-weight: 600; }
.picker-mark { width: 18px; text-align: center; }
.picker-create { display: flex; gap: 10px; margin-top: 14px; }
</style>
