<template>
  <div class="page-wrap">
    <div class="toolbar">
      <span class="title">首页轮播图（小程序首页顶部 4 张循环播放）</span>
      <el-button type="primary" :icon="Plus" @click="openDialog()">新增轮播图</el-button>
    </div>

    <div class="kt-card">
      <el-table :data="list" v-loading="loading">
        <el-table-column label="预览" width="120">
          <template #default="{ row }"><img :src="preview(row.image)" class="banner-thumb" /></template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="150" />
        <el-table-column label="跳转" min-width="200">
          <template #default="{ row }">
            {{ row.linkType === 'article' ? `文章 ID ${row.linkValue}` : row.linkValue }}
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="70" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(v: string | number | boolean) => toggle(row, Boolean(v))" />
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确认删除该轮播图？" @confirm="remove(row)">
              <template #reference><el-button link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialog.visible" :title="dialog.form.id ? '编辑轮播图' : '新增轮播图'" width="520px">
      <el-form :model="dialog.form" label-width="90px">
        <el-form-item label="标题" required>
          <el-input v-model="dialog.form.title" placeholder="轮播标题/说明" />
        </el-form-item>
        <el-form-item label="图片">
          <div class="img-row">
            <img :src="preview(dialog.form.image)" class="banner-thumb" />
            <div class="img-ops">
              <el-select v-model="dialog.form.image" style="width: 240px">
                <el-option v-for="item in images" :key="item.value" :label="item.label" :value="item.value" />
                <el-option v-for="i in 4" :key="`preset-${i}`" :label="`内置样式 ${i}`" :value="`/img/banner-${i}.svg`" />
              </el-select>
              <el-upload :show-file-list="false" :http-request="uploadImage" accept="image/jpeg,image/png">
                <el-button size="small" :loading="uploading">上传 JPG/PNG</el-button>
              </el-upload>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="跳转类型">
          <el-radio-group v-model="dialog.form.linkType">
            <el-radio value="article">关联资讯</el-radio>
            <el-radio value="url">外部链接</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="dialog.form.linkType === 'article' ? '文章 ID' : '链接地址'" required>
          <el-input v-model="dialog.form.linkValue" :placeholder="dialog.form.linkType === 'article' ? '请输入资讯 ID' : 'https://...'" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="dialog.form.sort" :min="1" :max="20" />
          <span class="text-muted" style="margin-left: 8px; font-size: 12px">数字越小越靠前</span>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="dialog.form.enabled" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="dialog.form.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { api } from '@/api'
import { cmsMediaApi, displayMediaUrl, type CmsMediaOption } from '@/api/cms-media'
import { useAuthStore } from '@/stores/auth'
import type { Banner } from '@/types'

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const list = ref<Banner[]>([])
const images = ref<CmsMediaOption[]>([])
const dialog = reactive<{ visible: boolean; form: Banner }>({
  visible: false,
  form: { id: 0, title: '', image: '/img/banner-1.svg', linkType: 'article', linkValue: '', sort: 1, enabled: true, remark: '' }
})

function preview(url: string) {
  return displayMediaUrl(url)
}

async function loadImages() {
  try {
    images.value = await cmsMediaApi.listOptions('banner')
  } catch (e) {
    ElMessage.error((e as Error).message || '加载轮播素材失败')
  }
}

async function uploadImage(options: { file: File }) {
  uploading.value = true
  try {
    const saved = await cmsMediaApi.upload(options.file, 'banner')
    images.value = [saved, ...images.value.filter((item) => item.value !== saved.value)]
    dialog.form.image = saved.value
    ElMessage.success('图片已上传')
  } catch (e) {
    ElMessage.error((e as Error).message || '图片上传失败')
  } finally {
    uploading.value = false
  }
}

async function load() {
  loading.value = true
  try {
    await loadImages()
    list.value = await api.listBanners()
  } catch (e) {
    ElMessage.error((e as Error).message || '加载轮播失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openDialog(row?: Banner) {
  dialog.form = row ? { ...row } : { id: 0, title: '', image: '/img/banner-1.svg', linkType: 'article', linkValue: '', sort: (list.value.length || 0) + 1, enabled: true, remark: '' }
  dialog.visible = true
}

async function toggle(row: Banner, enabled: boolean) {
  row.enabled = enabled
  await api.saveBanner(row)
  if (auth.account) api.writeLog(auth.account.username, auth.account.role, '内容', enabled ? '启用轮播' : '停用轮播', row.title)
  ElMessage.success('已更新')
}

async function save() {
  saving.value = true
  const saved = await api.saveBanner({ ...dialog.form })
  if (auth.account) api.writeLog(auth.account.username, auth.account.role, '内容', dialog.form.id ? '编辑轮播' : '新增轮播', saved.title)
  dialog.visible = false
  saving.value = false
  ElMessage.success('已保存')
  await load()
}

async function remove(row: Banner) {
  await api.removeBanner(row.id)
  ElMessage.success('已删除')
  await load()
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.title { font-size: 16px; font-weight: 600; }
.banner-thumb { width: 96px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid var(--kt-line); }
.img-row { display: flex; align-items: center; gap: 10px; }
.img-ops { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
</style>
