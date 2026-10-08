<template>
  <div class="page-wrap">
    <div class="head">
      <h2 class="page-title">营养库管理（小程序食物营养库数据源）</h2>
      <div class="ops">
        <el-button :icon="Download" @click="exportCsv">导出 CSV</el-button>
        <el-button :icon="Upload" @click="importVisible = true">批量导入</el-button>
        <el-button type="primary" :icon="Plus" @click="openFood()">新增食物</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="6">
        <div class="kt-card">
          <div class="block-title flex-between">
            <span>食物分类</span>
            <el-button link type="primary" :icon="Plus" @click="openCategory()">新增</el-button>
          </div>
          <div
            v-for="c in categories"
            :key="c.id"
            class="cat-row"
            :class="{ active: filterCategory === c.id }"
            @click="filterCategory = c.id"
          >
            <span>{{ c.name }}</span>
            <span class="cat-ops">
              <el-icon @click.stop="openCategory(c)"><Edit /></el-icon>
              <el-icon @click.stop="removeCategory(c)"><Delete /></el-icon>
            </span>
          </div>
          <el-button class="all-btn" text size="small" @click="filterCategory = 0">查看全部</el-button>
        </div>
      </el-col>

      <el-col :span="18">
        <div class="kt-card">
          <div class="filter mb12">
            <el-input v-model="keyword" placeholder="搜索食物名称" clearable :prefix-icon="Search" style="width: 240px" />
            <span class="text-muted" style="font-size: 12px">共 {{ filtered.length }} 条 · 碳水/热量为每 100g 参考值</span>
          </div>
          <el-table :data="filtered" v-loading="loading">
            <el-table-column label="食物" min-width="180">
              <template #default="{ row }">
                <div class="food-cell">
                  <img
                    :src="resolveFoodImage(row)"
                    :alt="`${row.name}图片`"
                    class="food-img"
                    @error="useFallbackImage($event, row)"
                  />
                  <span>{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="categoryName" label="分类" width="100" />
            <el-table-column label="碳水 (g)" width="110">
              <template #default="{ row }">{{ row.carbs }}</template>
            </el-table-column>
            <el-table-column label="热量 (kcal)" width="110">
              <template #default="{ row }">{{ row.cal }}</template>
            </el-table-column>
            <el-table-column label="GI" width="80">
              <template #default="{ row }">{{ row.gi ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="启用" width="80">
              <template #default="{ row }">
                <el-switch :model-value="row.enabled" @change="(v: string | number | boolean) => toggle(row, Boolean(v))" />
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="160" />
            <el-table-column label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openFood(row)">编辑</el-button>
                <el-popconfirm title="确认删除？" @confirm="removeFood(row)">
                  <template #reference><el-button link type="danger">删除</el-button></template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <!-- 分类对话框 -->
    <el-dialog v-model="catDialog.visible" :title="catDialog.form.id ? '编辑分类' : '新增分类'" width="420px">
      <el-form label-width="80px">
        <el-form-item label="分类名"><el-input v-model="catDialog.form.name" placeholder="如：主食类" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="catDialog.form.sort" :min="1" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="catDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveCategory">保存</el-button>
      </template>
    </el-dialog>

    <!-- 食物对话框 -->
    <el-dialog v-model="foodDialog.visible" :title="foodDialog.form.id ? '编辑食物' : '新增食物'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="名称"><el-input v-model="foodDialog.form.name" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="foodDialog.form.categoryId" style="width: 100%" @change="onFoodCategoryChange">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="碳水 g/100g"><el-input-number v-model="foodDialog.form.carbs" :min="0" :precision="1" /></el-form-item>
        <el-form-item label="热量 kcal"><el-input-number v-model="foodDialog.form.cal" :min="0" :precision="0" /></el-form-item>
        <el-form-item label="GI 值"><el-input-number v-model="foodDialog.form.gi" :min="0" :max="120" :step="1" placeholder="可空" /></el-form-item>
        <el-form-item label="图片">
          <div class="food-image-picker">
            <img :src="resolveFoodImage(foodDialog.form)" class="food-preview" alt="食物图片预览" />
            <el-select v-model="foodDialog.form.image" filterable style="width: 100%" placeholder="选择内置食物图片">
              <el-option v-for="option in FOOD_IMAGE_OPTIONS" :key="option.value" :label="option.label" :value="option.value">
                <div class="image-option">
                  <img :src="option.value" :alt="option.label" />
                  <span>{{ option.label }}</span>
                </div>
              </el-option>
            </el-select>
          </div>
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="foodDialog.form.description" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="foodDialog.form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="foodDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveFood">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入 -->
    <el-dialog v-model="importVisible" title="批量导入食物（CSV）" width="560px">
      <p class="text-muted" style="font-size: 12px; margin-top: 0">
        每行一条：名称,分类名,碳水g,热量kcal,GI(可空)<br />示例：糙米饭,主食类,33.1,160,50
      </p>
      <el-input v-model="importText" type="textarea" :rows="8" placeholder="糙米饭,主食类,33.1,160,50&#10;全麦面包,主食类,41.0,246,69" />
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" @click="doImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Download, Edit, Plus, Search, Upload } from '@element-plus/icons-vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { FoodCategory, FoodItem } from '@/types'
import {
  DEFAULT_FOOD_IMAGE,
  FOOD_IMAGE_OPTIONS,
  getBundledFoodImage,
  resolveFoodImage
} from './foodImages'

const auth = useAuthStore()
const loading = ref(false)
const categories = ref<FoodCategory[]>([])
const foods = ref<FoodItem[]>([])
const keyword = ref('')
const filterCategory = ref(0)

const catDialog = reactive({ visible: false, form: { id: 0, name: '', sort: 1 } })
const foodDialog = reactive({
  visible: false,
  form: {
    id: 0, name: '', categoryId: 1, categoryName: '', carbs: 0, cal: 0, gi: null as number | null,
    image: DEFAULT_FOOD_IMAGE, description: '', enabled: true, updatedAt: ''
  }
})
const importVisible = ref(false)
const importText = ref('')

async function load() {
  loading.value = true
  try {
    categories.value = await api.listCategories()
    foods.value = await api.listFoods()
  } catch (e) {
    ElMessage.error((e as Error).message || '加载营养库失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const filtered = computed(() =>
  foods.value.filter(
    (f) =>
      (filterCategory.value === 0 || f.categoryId === filterCategory.value) &&
      (!keyword.value || f.name.includes(keyword.value))
  )
)

function openCategory(c?: FoodCategory) {
  catDialog.form = c ? { ...c } : { id: 0, name: '', sort: categories.value.length + 1 }
  catDialog.visible = true
}
async function saveCategory() {
  if (!catDialog.form.name.trim()) return ElMessage.warning('请输入分类名')
  await api.saveCategory({ ...catDialog.form })
  catDialog.visible = false
  ElMessage.success('已保存')
  await load()
}
async function removeCategory(c: FoodCategory) {
  try {
    await api.removeCategory(c.id)
    if (filterCategory.value === c.id) filterCategory.value = 0
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.warning((e as Error).message)
  }
}

function openFood(f?: FoodItem) {
  if (f) {
    foodDialog.form = { ...f, image: resolveFoodImage(f) }
  } else {
    const category = categories.value.find((item) => item.id === filterCategory.value) || categories.value[0]
    foodDialog.form = {
      id: 0, name: '', categoryId: category?.id || 1, categoryName: category?.name || '',
      carbs: 0, cal: 0, gi: null, image: getBundledFoodImage('', category?.name),
      description: '', enabled: true, updatedAt: ''
    }
  }
  foodDialog.visible = true
}
async function saveFood() {
  if (!foodDialog.form.name.trim()) return ElMessage.warning('请输入食物名称')
  foodDialog.form.categoryId = Number(foodDialog.form.categoryId)
  foodDialog.form.categoryName = categories.value.find((c) => c.id === foodDialog.form.categoryId)?.name || ''
  if (!foodDialog.form.image) {
    foodDialog.form.image = getBundledFoodImage(foodDialog.form.name, foodDialog.form.categoryName)
  }
  const saved = await api.saveFood({ ...foodDialog.form } as FoodItem)
  if (auth.account) api.writeLog(auth.account.username, auth.account.role, '营养库', foodDialog.form.id ? '编辑食物' : '新增食物', saved.name)
  foodDialog.visible = false
  ElMessage.success('已保存')
  await load()
}
async function removeFood(f: FoodItem) {
  await api.removeFood(f.id)
  ElMessage.success('已删除')
  await load()
}

function onFoodCategoryChange(categoryId: number | string) {
  const category = categories.value.find((item) => item.id === Number(categoryId))
  foodDialog.form.categoryId = Number(categoryId)
  foodDialog.form.categoryName = category?.name || ''
  if (!foodDialog.form.id) {
    foodDialog.form.image = getBundledFoodImage(foodDialog.form.name, category?.name)
  }
}

function useFallbackImage(event: Event, food: FoodItem) {
  const image = event.target as HTMLImageElement
  const fallback = getBundledFoodImage(food.name, food.categoryName)
  if (!image.src.endsWith(fallback)) image.src = fallback
}
async function toggle(f: FoodItem, enabled: boolean) {
  try {
    const saved = await api.saveFood({ ...f, enabled })
    f.enabled = saved.enabled
    ElMessage.success('已更新')
  } catch (e) {
    ElMessage.error((e as Error).message || '更新失败')
  }
}

function exportCsv() {
  const header = '名称,分类,碳水(g/100g),热量(kcal),GI,说明'
  const lines = filtered.value.map((f) => `${f.name},${f.categoryName},${f.carbs},${f.cal},${f.gi ?? ''},${f.description}`)
  const blob = new Blob(['\ufeff' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '营养库导出.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

async function doImport() {
  const rows = importText.value.split('\n').map((l) => l.trim()).filter(Boolean)
  let ok = 0
  for (const line of rows) {
    const parts = line.split(',').map((p) => p.trim())
    if (parts.length < 3) continue
    const cat = categories.value.find((c) => c.name === parts[1]) || categories.value[0]
    await api.saveFood({
      id: 0, name: parts[0], categoryId: cat.id, categoryName: cat.name,
      carbs: Number(parts[2] || 0), cal: Number(parts[3] || 0), gi: parts[4] ? Number(parts[4]) : null,
      image: getBundledFoodImage(parts[0], cat.name), description: '', enabled: true, updatedAt: ''
    })
    ok++
  }
  if (auth.account) api.writeLog(auth.account.username, auth.account.role, '营养库', '批量导入', `成功导入 ${ok} 条`)
  importVisible.value = false
  ElMessage.success(`导入完成：成功 ${ok} 条`)
  await load()
}
</script>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 18px; }
.ops { display: flex; gap: 8px; }
.block-title { font-weight: 600; }
.cat-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; margin-bottom: 4px; }
.cat-row:hover { background: var(--kt-brand-soft); }
.cat-row.active { background: var(--kt-brand-soft); color: var(--kt-brand); font-weight: 600; }
.cat-ops { display: none; gap: 6px; color: var(--kt-muted); }
.cat-row:hover .cat-ops { display: inline-flex; }
.all-btn { margin-top: 6px; }
.filter { display: flex; justify-content: space-between; align-items: center; }
.food-cell { display: flex; align-items: center; gap: 8px; }
.food-img { width: 34px; height: 34px; object-fit: cover; border-radius: 6px; background: #f7f7f7; border: 1px solid var(--kt-line); }
.food-image-picker { display: flex; align-items: center; gap: 12px; width: 100%; }
.food-preview { width: 58px; height: 58px; flex: 0 0 auto; object-fit: cover; border-radius: 8px; border: 1px solid var(--kt-line); background: #f7f7f7; }
.image-option { display: flex; align-items: center; gap: 10px; }
.image-option img { width: 28px; height: 28px; object-fit: cover; border-radius: 5px; }
</style>
