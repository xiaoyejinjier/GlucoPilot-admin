<template>
  <div class="page-wrap food-page">
    <div class="head">
      <div class="heading-copy">
        <h2 class="page-title">食物营养库</h2>
        <span class="page-description">小程序营养数据源 · 每 100g 参考值</span>
      </div>
      <div class="ops">
        <el-button :icon="Download" @click="exportCsv">导出本页</el-button>
        <el-button :icon="Upload" @click="importVisible = true">批量导入</el-button>
        <el-button type="primary" :icon="Plus" @click="openFood()">新增食物</el-button>
      </div>
    </div>

    <div class="food-layout">
      <aside class="category-column">
        <div class="kt-card category-card">
          <div class="block-title flex-between">
            <span class="category-heading">食物分类 <span class="category-count">{{ categories.length }}</span></span>
            <el-button link type="primary" :icon="Plus" @click="openCategory()"
              >新增</el-button
            >
          </div>
          <div class="category-list" tabindex="0" aria-label="食物分类，可上下滚动">
            <div
              v-for="c in categories"
              :key="c.id"
              class="cat-row"
              :class="{ active: filterCategory === c.id }"
              @click="selectCategory(c.id)"
            >
              <span class="cat-main">
                <img
                  :src="resolveCategoryImage(c)"
                  :alt="c.name"
                  class="cat-img"
                  @error="useCategoryFallback($event, c)"
                />
                <span class="cat-name" :title="c.name">{{ c.name }}</span>
              </span>
              <span class="cat-ops">
                <button type="button" class="cat-icon-button" :aria-label="`编辑${c.name}分类`" @click.stop="openCategory(c)"><el-icon><Edit /></el-icon></button>
                <button type="button" class="cat-icon-button category-delete" :aria-label="`删除${c.name}分类`" @click.stop="removeCategory(c)"><el-icon><Delete /></el-icon></button>
              </span>
            </div>
          </div>
          <el-button class="all-btn" :class="{ 'all-active': filterCategory === 0 }" text size="small" @click="selectCategory(0)"
            >查看全部食物</el-button
          >
        </div>
      </aside>

      <section class="food-column">
        <div class="kt-card food-card">
          <div class="filter mb12">
            <div class="filter-fields">
              <el-input
                v-model="keyword"
                placeholder="搜索食物名称"
                clearable
                :prefix-icon="Search"
                class="food-search"
                @keyup.enter="search"
                @clear="search"
              />
              <el-select
                v-model="enabledFilter"
                placeholder="上下架状态"
                clearable
                class="status-filter"
                @change="search"
              >
                <el-option label="已上架" value="enabled" />
                <el-option label="已下架" value="disabled" />
              </el-select>
              <el-button type="primary" @click="search">查询</el-button>
              <el-button text @click="resetFilters">重置</el-button>
            </div>
            <span class="result-count"
              >共 <strong>{{ page.total }}</strong> 项食物</span
            >
          </div>
          <el-table
            ref="foodTable"
            :data="foods"
            v-loading="loading"
            row-key="id"
            height="100%"
            class="food-table"
            show-overflow-tooltip
          >
            <el-table-column label="序号" min-width="40" align="center" class-name="index-column">
              <template #default="{ $index }">{{
                (page.pageNum - 1) * page.pageSize + $index + 1
              }}</template>
            </el-table-column>
            <el-table-column label="食物" min-width="140">
              <template #default="{ row }">
                <div class="food-cell">
                  <FoodPhoto
                    :food="row"
                    class="food-img"
                  />
                  <span class="food-name" :title="row.name">{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="categoryName" label="分类" min-width="56" class-name="secondary-column" />
            <el-table-column label="营养来源" min-width="76">
              <template #default="{ row }">
                <span
                  v-if="row.nutritionSource === 'AI_ESTIMATE'"
                  class="nutrition-source source-estimate"
                  title="模型估算·待审核"
                  ><i class="source-dot"></i>待审核</span
                >
                <span
                  v-else-if="row.nutritionSource === 'AI_REVIEWED'"
                  class="nutrition-source source-reviewed"
                  title="模型识别·已核对"
                  ><i class="source-dot"></i>已核对</span
                >
                <span v-else class="nutrition-source source-library" title="食品库"><i class="source-dot"></i>食品库</span>
              </template>
            </el-table-column>
            <el-table-column label="碳水 (g)" min-width="60" align="right" class-name="numeric-column">
              <template #default="{ row }">{{ row.carbs }}</template>
            </el-table-column>
            <el-table-column label="热量 (kcal)" min-width="68" align="right" class-name="numeric-column">
              <template #default="{ row }">{{ row.cal }}</template>
            </el-table-column>
            <el-table-column label="GI" min-width="40" align="right" class-name="numeric-column">
              <template #default="{ row }">{{ row.gi ?? "—" }}</template>
            </el-table-column>
            <el-table-column label="启用" min-width="56" align="center" class-name="switch-column">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  @change="(v: string | number | boolean) => toggle(row, Boolean(v))"
                />
              </template>
            </el-table-column>
            <el-table-column label="更新时间" min-width="108">
              <template #default="{ row }"><span class="updated-time" :title="row.updatedAt || '未记录'">{{ formatFoodUpdatedAt(row.updatedAt) }}</span></template>
            </el-table-column>
            <el-table-column label="操作" min-width="76">
              <template #default="{ row }">
                <div class="food-actions">
                  <el-button link type="primary" @click="openFood(row)">编辑</el-button>
                  <el-popconfirm title="确认删除？" @confirm="removeFood(row)">
                    <template #reference
                      ><el-button link type="danger">删除</el-button></template
                    >
                  </el-popconfirm>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-wrap">
            <span class="pagination-summary"><span class="adaptive-size">自适应 · 每页 {{ page.pageSize }} 条</span>{{ pageSummary }}</span>
            <el-pagination
              :current-page="page.pageNum"
              :page-size="page.pageSize"
              :total="page.total"
              :disabled="loading"
              background
              :pager-count="5"
              layout="prev, pager, next, jumper"
              @update:current-page="changePage"
            />
          </div>
        </div>
      </section>
    </div>

    <!-- 分类对话框 -->
    <el-dialog
      v-model="catDialog.visible"
      :title="catDialog.form.id ? '编辑分类' : '新增分类'"
      width="520px"
      :close-on-click-modal="!categoryImageUploading && !categorySaving"
      :close-on-press-escape="!categoryImageUploading && !categorySaving"
      :show-close="!categoryImageUploading && !categorySaving"
    >
      <el-form label-width="80px">
        <el-form-item label="分类名"
          ><el-input v-model="catDialog.form.name" placeholder="如：主食类"
        /></el-form-item>
        <el-form-item label="分类图片">
          <div class="food-image-picker">
            <img
              :src="resolveCategoryImage(catDialog.form)"
              class="food-preview"
              alt="分类图片预览"
            />
            <div class="food-image-controls">
              <el-select
                v-model="catDialog.form.image"
                filterable
                clearable
                style="width: 100%"
                placeholder="选择已有图片，留空使用默认图"
                :disabled="categoryImageUploading || categorySaving"
              >
                <el-option
                  v-for="option in imageOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                >
                  <div class="image-option">
                    <img :src="option.value" :alt="option.label" />
                    <span>{{ option.label }}</span>
                  </div>
                </el-option>
              </el-select>
              <el-upload
                ref="categoryImageUpload"
                :auto-upload="false"
                :show-file-list="false"
                :disabled="categoryImageUploading || categorySaving"
                accept="image/jpeg,image/png"
                :on-change="uploadCategoryImage"
              >
                <el-button
                  :icon="Upload"
                  :loading="categoryImageUploading"
                  :disabled="categorySaving"
                >
                  {{ categoryImageUploading ? "正在上传" : "上传分类图片" }}
                </el-button>
              </el-upload>
              <span class="image-tip"
                >选择已有图片或上传 JPG/PNG（不超过 5MB）；清空选择恢复默认图片</span
              >
            </div>
          </div>
        </el-form-item>
        <el-form-item label="排序"
          ><el-input-number v-model="catDialog.form.sort" :min="1"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button
          :disabled="categoryImageUploading || categorySaving"
          @click="catDialog.visible = false"
          >取消</el-button
        >
        <el-button
          type="primary"
          :disabled="categoryImageUploading"
          :loading="categorySaving"
          @click="saveCategory"
          >保存</el-button
        >
      </template>
    </el-dialog>

    <!-- 食物对话框 -->
    <el-dialog
      v-model="foodDialog.visible"
      :title="foodDialog.form.id ? '编辑食物' : '新增食物'"
      width="520px"
      :close-on-click-modal="!imageUploading && !foodSaving"
      :close-on-press-escape="!imageUploading && !foodSaving"
      :show-close="!imageUploading && !foodSaving"
    >
      <el-form label-width="90px">
        <el-alert
          v-if="foodDialog.form.nutritionSource === 'AI_ESTIMATE'"
          title="这是拍照识别新增的食品，营养为模型估算。请核对名称和每100g营养后再启用。"
          type="warning"
          :closable="false"
          class="mb16"
        />
        <el-form-item label="名称"
          ><el-input v-model="foodDialog.form.name"
        /></el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="foodDialog.form.categoryId"
            style="width: 100%"
            @change="onFoodCategoryChange"
          >
            <template #label="{ label }">
              <span class="image-option category-selected-label">
                <img
                  v-if="selectedFoodCategory"
                  :src="resolveCategoryImage(selectedFoodCategory)"
                  :alt="label"
                />
                <span>{{ label }}</span>
              </span>
            </template>
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id">
              <div class="image-option">
                <img
                  :src="resolveCategoryImage(c)"
                  :alt="c.name"
                  @error="useCategoryFallback($event, c)"
                />
                <span>{{ c.name }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="碳水 g/100g"
          ><el-input-number v-model="foodDialog.form.carbs" :min="0" :precision="1"
        /></el-form-item>
        <el-form-item label="热量 kcal"
          ><el-input-number v-model="foodDialog.form.cal" :min="0" :precision="0"
        /></el-form-item>
        <el-form-item label="GI 值"
          ><el-input-number
            v-model="foodDialog.form.gi"
            :min="0"
            :max="120"
            :step="1"
            placeholder="可空"
        /></el-form-item>
        <el-form-item label="图片">
          <div class="food-image-picker">
            <FoodPhoto
              :food="foodDialog.form"
              :prefer-review="!imageManuallySelected"
              class="food-preview"
            />
            <div class="food-image-controls">
              <el-select
                v-model="foodDialog.form.image"
                filterable
                style="width: 100%"
                placeholder="选择已有图片"
                :disabled="imageUploading || foodSaving"
                @change="imageManuallySelected = true"
              >
                <el-option
                  v-for="option in imageOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                >
                  <div class="image-option">
                    <img :src="option.value" :alt="option.label" />
                    <span>{{ option.label }}</span>
                  </div>
                </el-option>
              </el-select>
              <el-upload
                ref="imageUpload"
                :auto-upload="false"
                :show-file-list="false"
                :disabled="imageUploading || foodSaving"
                accept="image/jpeg,image/png"
                :on-change="uploadFoodImage"
              >
                <el-button
                  :icon="Upload"
                  :loading="imageUploading"
                  :disabled="foodSaving"
                >
                  {{ imageUploading ? "正在上传" : "上传自己的图片" }}
                </el-button>
              </el-upload>
              <span class="image-tip"
                >{{ foodDialog.form.reviewImage && !imageManuallySelected ? '当前优先预览用户实拍；可另选食品库配图' : '可选择已有图片，或上传 JPG/PNG 图片（不超过 5MB）' }}</span
              >
            </div>
          </div>
        </el-form-item>
        <el-form-item label="说明"
          ><el-input v-model="foodDialog.form.description"
        /></el-form-item>
        <el-form-item label="启用"
          ><el-switch v-model="foodDialog.form.enabled"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button
          :disabled="imageUploading || foodSaving"
          @click="foodDialog.visible = false"
          >取消</el-button
        >
        <el-button
          type="primary"
          :disabled="imageUploading"
          :loading="foodSaving"
          @click="saveFood"
          >保存</el-button
        >
      </template>
    </el-dialog>

    <!-- 批量导入 -->
    <el-dialog v-model="importVisible" title="批量导入食物（CSV）" width="560px">
      <p class="text-muted" style="font-size: 12px; margin-top: 0">
        每行一条：名称,分类名,碳水g,热量kcal,GI(可空)<br />示例：糙米饭,主食类,33.1,160,50
      </p>
      <el-input
        v-model="importText"
        type="textarea"
        :rows="8"
        placeholder="糙米饭,主食类,33.1,160,50&#10;全麦面包,主食类,41.0,246,69"
      />
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" @click="doImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { TableInstance, UploadFile, UploadInstance } from "element-plus";
import { Delete, Download, Edit, Plus, Search, Upload } from "@element-plus/icons-vue";
import { api } from "@/api";
import { foodImageApi } from "@/api/food-images";
import { useAuthStore } from "@/stores/auth";
import FoodPhoto from "./FoodPhoto.vue";
import type { FoodCategory, FoodItem } from "@/types";
import {
  DEFAULT_FOOD_IMAGE,
  FOOD_IMAGE_OPTIONS,
  getBundledFoodImage,
  resolveCategoryImage,
  resolveFoodImage,
} from "./foodImages";

const auth = useAuthStore();
const loading = ref(false);
const imageUploading = ref(false);
const foodSaving = ref(false);
const categoryImageUploading = ref(false);
const categorySaving = ref(false);
const imageManuallySelected = ref(false);
const imageUpload = ref<UploadInstance>();
const categoryImageUpload = ref<UploadInstance>();
const uploadedImages = ref<Array<{ label: string; value: string }>>([]);
const categories = ref<FoodCategory[]>([]);
const foods = ref<FoodItem[]>([]);
const keyword = ref("");
const filterCategory = ref(0);
const enabledFilter = ref("");
const page = reactive({ pageNum: 1, pageSize: 12, total: 0 });
const foodTable = ref<TableInstance>();
let tableResizeObserver: ResizeObserver | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
let pageDisposed = false;

// Use the scroll viewport, not the number of loaded rows (especially on the last page).
function getAdaptivePageSize(height: number, rowHeight = 52) {
  return Math.max(1, Math.min(100, Math.floor((height - 1) / rowHeight)));
}

function measurePageSize() {
  const table = foodTable.value?.$el as HTMLElement | undefined;
  const viewport = table?.querySelector<HTMLElement>(".el-table__body-wrapper .el-scrollbar__wrap");
  if (!viewport || viewport.clientHeight <= 1) return;
  const row = table?.querySelector<HTMLElement>(".el-table__body tbody tr");
  return getAdaptivePageSize(viewport.clientHeight, row?.getBoundingClientRect().height || 52);
}

function resizePageToFit() {
  if (pageDisposed) return;
  const size = measurePageSize();
  if (size !== undefined) return changeSize(size);
}

function schedulePageResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizePageToFit, 150);
}

function formatFoodUpdatedAt(value?: string) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  return match ? `${match[2]}-${match[3]} ${match[4]}:${match[5]}` : value;
}
const appliedFilters = reactive<{
  keyword?: string;
  categoryId?: number;
  enabled?: boolean;
}>({});
let latestFoodRequest = 0;
let latestCategoryRequest = 0;
const pageSummary = computed(() => {
  if (!page.total) return "暂无记录";
  const start = (page.pageNum - 1) * page.pageSize + 1;
  const end = Math.min(start + foods.value.length - 1, page.total);
  return `第 ${page.pageNum} / ${Math.ceil(
    page.total / page.pageSize
  )} 页 · 显示 ${start}–${Math.max(start, end)} 条`;
});

const catDialog = reactive({
  visible: false,
  form: { id: 0, name: "", sort: 1, image: "" },
});
const foodDialog = reactive({
  visible: false,
  form: {
    id: 0,
    name: "",
    categoryId: 1,
    categoryName: "",
    carbs: 0,
    cal: 0,
    gi: null as number | null,
    image: DEFAULT_FOOD_IMAGE,
    reviewImage: "" as FoodItem["reviewImage"],
    description: "",
    enabled: true,
    updatedAt: "",
    nutritionSource: "MANUAL" as FoodItem["nutritionSource"],
  },
});
const importVisible = ref(false);
const importText = ref("");

const selectedFoodCategory = computed(() =>
  categories.value.find((category) => category.id === Number(foodDialog.form.categoryId))
);

const imageOptions = computed(() => {
  const options = [...FOOD_IMAGE_OPTIONS, ...uploadedImages.value];
  const currentImages = [
    { label: "当前食物图片", value: foodDialog.form.image },
    { label: "当前分类图片", value: catDialog.form.image },
  ];
  for (const current of currentImages) {
    if (current.value && !options.some((option) => option.value === current.value)) {
      options.push(current);
    }
  }
  return options;
});

async function loadFoodImages() {
  try {
    const images = await foodImageApi.list();
    uploadedImages.value = images.map((image) => ({
      label: `已上传图片 #${image.id}`,
      value: image.fileUrl,
    }));
  } catch (error) {
    ElMessage.warning(
      (error as Error).message || "已上传图片加载失败，可继续选择内置图片"
    );
  }
}

async function uploadFoodImage(uploadFile: UploadFile) {
  return uploadImage(uploadFile, "food");
}

async function uploadCategoryImage(uploadFile: UploadFile) {
  return uploadImage(uploadFile, "category");
}

async function uploadImage(uploadFile: UploadFile, target: "food" | "category") {
  const uploading = target === "food" ? imageUploading : categoryImageUploading;
  const saving = target === "food" ? foodSaving : categorySaving;
  if (!uploadFile.raw || uploading.value || saving.value) return;
  uploading.value = true;
  try {
    const image = await foodImageApi.upload(uploadFile.raw);
    if (target === "food") {
      foodDialog.form.image = image.fileUrl;
      imageManuallySelected.value = true;
    } else {
      catDialog.form.image = image.fileUrl;
    }
    if (!uploadedImages.value.some((item) => item.value === image.fileUrl)) {
      uploadedImages.value.unshift({
        label: `已上传：${uploadFile.name}`,
        value: image.fileUrl,
      });
    }
    ElMessage.success(
      target === "food"
        ? "图片上传成功，保存食物即可使用"
        : "图片上传成功，保存分类即可使用"
    );
  } catch (error) {
    ElMessage.error((error as Error).message || "图片上传失败，请重新选择");
  } finally {
    uploading.value = false;
    const upload = target === "food" ? imageUpload : categoryImageUpload;
    upload.value?.clearFiles();
  }
}

async function loadCategories() {
  const requestId = ++latestCategoryRequest;
  try {
    const rows = await api.listCategories();
    if (requestId === latestCategoryRequest) categories.value = rows;
    return rows;
  } catch (error) {
    if (requestId === latestCategoryRequest)
      ElMessage.error((error as Error).message || "加载食物分类失败");
    return null;
  }
}

async function load() {
  const requestId = ++latestFoodRequest;
  const query = { pageNum: page.pageNum, pageSize: page.pageSize, ...appliedFilters };
  loading.value = true;
  try {
    const result = await api.pageFoods(query);
    if (requestId !== latestFoodRequest) return;
    const lastPage = Math.max(1, Math.ceil(result.total / query.pageSize));
    if (page.pageNum > lastPage) {
      page.pageNum = lastPage;
      await load();
      return;
    }
    foods.value = result.records;
    page.total = result.total;
  } catch (e) {
    if (requestId !== latestFoodRequest) return;
    foods.value = [];
    ElMessage.error((e as Error).message || "加载营养库失败");
  } finally {
    if (requestId === latestFoodRequest) loading.value = false;
  }
}
onMounted(async () => {
  loadCategories();
  await nextTick();
  if (pageDisposed) return;
  page.pageSize = measurePageSize() ?? page.pageSize;
  const table = foodTable.value?.$el as HTMLElement | undefined;
  if (table && typeof ResizeObserver !== "undefined") {
    tableResizeObserver = new ResizeObserver(schedulePageResize);
    tableResizeObserver.observe(table);
  }
  window.addEventListener("resize", schedulePageResize);
  await load();
  await nextTick();
  if (!pageDisposed) schedulePageResize();
});

onBeforeUnmount(() => {
  pageDisposed = true;
  ++latestFoodRequest;
  ++latestCategoryRequest;
  clearTimeout(resizeTimer);
  tableResizeObserver?.disconnect();
  window.removeEventListener("resize", schedulePageResize);
});

function search() {
  Object.assign(appliedFilters, {
    keyword: keyword.value.trim() || undefined,
    categoryId: filterCategory.value || undefined,
    enabled: enabledFilter.value ? enabledFilter.value === "enabled" : undefined,
  });
  page.pageNum = 1;
  return load();
}

function resetFilters() {
  keyword.value = "";
  enabledFilter.value = "";
  filterCategory.value = 0;
  search();
}

function selectCategory(categoryId: number) {
  filterCategory.value = categoryId;
  search();
}

function changeSize(size: number) {
  if (page.pageSize === size) return;
  page.pageSize = size;
  page.pageNum = 1;
  return load();
}

function changePage(pageNum: number) {
  if (page.pageNum === pageNum) return;
  page.pageNum = pageNum;
  return load();
}

function openCategory(c?: FoodCategory) {
  catDialog.form = c
    ? { ...c, image: c.image || "" }
    : { id: 0, name: "", sort: categories.value.length + 1, image: "" };
  catDialog.visible = true;
  loadFoodImages();
}
async function saveCategory() {
  if (categoryImageUploading.value || categorySaving.value) return;
  if (!catDialog.form.name.trim()) return ElMessage.warning("请输入分类名");
  categorySaving.value = true;
  try {
    const submitted = { ...catDialog.form, image: (catDialog.form.image || "").trim() };
    const saved = await api.saveCategory(submitted);
    const rows = await loadCategories();
    if (!rows) throw new Error("分类保存后读取失败，请稍后重试确认");
    const persisted = rows.find((category) => Number(category.id) === Number(saved.id));
    if (
      !persisted ||
      typeof persisted.image !== "string" ||
      persisted.image.trim() !== submitted.image
    ) {
      throw new Error("分类图片未正确保存，请重启后端并确认分类图片迁移已生效");
    }
    catDialog.visible = false;
    ElMessage.success("已保存");
    await load();
  } catch (error) {
    ElMessage.error((error as Error).message || "分类保存失败，请重试");
  } finally {
    categorySaving.value = false;
  }
}
async function removeCategory(c: FoodCategory) {
  try {
    await api.removeCategory(c.id);
    if (filterCategory.value === c.id) {
      filterCategory.value = 0;
      appliedFilters.categoryId = undefined;
      page.pageNum = 1;
    }
    ElMessage.success("已删除");
    await loadCategories();
    await load();
  } catch (e) {
    ElMessage.warning((e as Error).message);
  }
}

function openFood(f?: FoodItem) {
  imageManuallySelected.value = false;
  if (f) {
    foodDialog.form = { ...f, image: resolveFoodImage(f), reviewImage: f.reviewImage || "", nutritionSource: f.nutritionSource || "MANUAL" };
  } else {
    const category =
      categories.value.find((item) => item.id === filterCategory.value) ||
      categories.value[0];
    foodDialog.form = {
      id: 0,
      name: "",
      categoryId: category?.id || 1,
      categoryName: category?.name || "",
      carbs: 0,
      cal: 0,
      gi: null,
      image: getBundledFoodImage("", category?.name),
      reviewImage: "",
      description: "",
      enabled: true,
      updatedAt: "",
      nutritionSource: "MANUAL",
    };
  }
  foodDialog.visible = true;
  loadFoodImages();
}
async function saveFood() {
  if (imageUploading.value || foodSaving.value) return;
  if (!foodDialog.form.name.trim()) return ElMessage.warning("请输入食物名称");
  foodDialog.form.categoryId = Number(foodDialog.form.categoryId);
  foodDialog.form.categoryName =
    categories.value.find((c) => c.id === foodDialog.form.categoryId)?.name || "";
  if (!foodDialog.form.image) {
    foodDialog.form.image = getBundledFoodImage(
      foodDialog.form.name,
      foodDialog.form.categoryName
    );
  }
  foodSaving.value = true;
  try {
    const saved = await api.saveFood({ ...foodDialog.form } as FoodItem);
    if (auth.account)
      api.writeLog(
        auth.account.username,
        auth.account.role,
        "营养库",
        foodDialog.form.id ? "编辑食物" : "新增食物",
        saved.name
      );
    foodDialog.visible = false;
    ElMessage.success("已保存");
    if (!foodDialog.form.id) page.pageNum = 1;
    await load();
  } catch (error) {
    ElMessage.error((error as Error).message || "食物保存失败，请重试");
  } finally {
    foodSaving.value = false;
  }
}
async function removeFood(f: FoodItem) {
  try {
    await api.removeFood(f.id);
    ElMessage.success("已删除");
    await load();
  } catch (error) {
    ElMessage.error((error as Error).message || "删除失败");
  }
}

function onFoodCategoryChange(categoryId: number | string) {
  const category = categories.value.find((item) => item.id === Number(categoryId));
  foodDialog.form.categoryId = Number(categoryId);
  foodDialog.form.categoryName = category?.name || "";
  if (!foodDialog.form.id && !imageManuallySelected.value) {
    foodDialog.form.image = getBundledFoodImage(foodDialog.form.name, category?.name);
  }
}

function useCategoryFallback(event: Event, category: FoodCategory) {
  const image = event.target as HTMLImageElement;
  const fallback = getBundledFoodImage("", category.name);
  if (!image.src.endsWith(fallback)) image.src = fallback;
}
async function toggle(f: FoodItem, enabled: boolean) {
  try {
    const saved = await api.saveFood({ ...f, enabled });
    f.enabled = saved.enabled;
    ElMessage.success("已更新");
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || "更新失败");
  }
}

function exportCsv() {
  const header = "名称,分类,碳水(g/100g),热量(kcal),GI,说明";
  const lines = foods.value.map(
    (f) =>
      `${f.name},${f.categoryName},${f.carbs},${f.cal},${f.gi ?? ""},${f.description}`
  );
  const blob = new Blob(["\ufeff" + [header, ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "营养库导出.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function doImport() {
  const rows = importText.value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let ok = 0;
  for (const line of rows) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 3) continue;
    const cat = categories.value.find((c) => c.name === parts[1]) || categories.value[0];
    await api.saveFood({
      id: 0,
      name: parts[0],
      categoryId: cat.id,
      categoryName: cat.name,
      carbs: Number(parts[2] || 0),
      cal: Number(parts[3] || 0),
      gi: parts[4] ? Number(parts[4]) : null,
      image: getBundledFoodImage(parts[0], cat.name),
      description: "",
      enabled: true,
      updatedAt: "",
    });
    ok++;
  }
  if (auth.account)
    api.writeLog(
      auth.account.username,
      auth.account.role,
      "营养库",
      "批量导入",
      `成功导入 ${ok} 条`
    );
  importVisible.value = false;
  ElMessage.success(`导入完成：成功 ${ok} 条`);
  page.pageNum = 1;
  await load();
}
</script>

<style scoped>
.food-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 520px;
  box-sizing: border-box;
}
.food-layout {
  display: grid;
  grid-template-columns: clamp(236px, 17vw, 260px) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.category-column {
  display: flex;
  min-width: 0;
  min-height: 0;
}
.category-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 16px 12px;
  box-sizing: border-box;
}
.category-card .block-title {
  flex: none;
  padding: 0 6px;
  margin-bottom: 12px;
  font-size: 16px;
}
.category-card, .food-card {
  border-color: #e5ebe7;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(32, 57, 43, 0.025);
}
.category-heading { display: inline-flex; align-items: center; gap: 8px; }
.category-count { color: #97a49b; font-size: 12px; font-weight: 400; }
.category-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  scrollbar-color: #d1ddd5 transparent;
  scrollbar-gutter: stable;
}
.category-list:focus-visible {
  outline: 2px solid var(--kt-brand);
  outline-offset: 2px;
  border-radius: 8px;
}
.food-column {
  display: flex;
  min-width: 0;
  min-height: 0;
}
.food-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
}
.food-table {
  flex: 1;
  min-width: 0;
  min-height: 0;
  font-size: var(--el-font-size-base);
  --el-table-border-color: #eef2ef;
  --el-table-header-bg-color: #f6f8f7;
  --el-table-row-hover-bg-color: #f7fbf8;
}
.food-table :deep(.cell) {
  padding: 0 8px;
  white-space: normal;
  word-break: normal;
  overflow-wrap: anywhere;
  line-height: 1.5;
}
.food-table :deep(.el-table__body .cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}
.food-table :deep(.el-table__header .cell) {
  color: var(--el-table-header-text-color);
}
.food-table :deep(.el-table__header-wrapper) {
  border-radius: 9px;
}
.food-table :deep(th.el-table__cell) {
  padding: 11px 0;
}
.food-table :deep(td.el-table__cell) {
  padding: 7px 0;
}
.food-table :deep(.el-table__body tr) { height: 52px; }
.food-table :deep(.index-column .cell) { color: var(--kt-muted); }
.food-table :deep(.el-table__body .numeric-column .cell) { font-variant-numeric: tabular-nums; }
.food-table :deep(.switch-column .cell) { padding: 0 4px; text-overflow: clip; }
.nutrition-source { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; font-size: 12px; white-space: nowrap; }
.source-dot { flex: none; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.source-estimate { color: #b48c4e; }
.source-reviewed { color: var(--kt-brand-dark); }
.source-library { color: #8b978f; }
.updated-time { font-variant-numeric: tabular-nums; }
.food-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
}
.food-actions :deep(.el-button) {
  margin: 0;
  padding: 0;
  border: 0;
  min-height: 28px;
  font-size: var(--el-font-size-base);
  font-weight: 500;
}
.food-actions :deep(.el-button--danger) { color: #a0aaa4; }
.food-actions :deep(.el-button--danger:hover) { color: var(--el-color-danger); }
.head {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.page-title {
  margin: 0;
  color: var(--kt-ink);
  font-size: 18px;
}
.heading-copy { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px; }
.page-description { color: var(--kt-muted); font-size: 14px; }
.ops {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ops :deep(.el-button) { height: 34px; border-radius: 8px; }
.ops :deep(.el-button + .el-button) { margin-left: 0; }
.block-title {
  font-weight: 600;
  margin-bottom: 10px;
}
.cat-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px;
  min-height: 68px;
  box-sizing: border-box;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  color: var(--el-text-color-regular);
  transition: background-color 0.15s, border-color 0.15s;
}
.cat-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.cat-img {
  width: 44px;
  height: 44px;
  box-sizing: border-box;
  flex: none;
  object-fit: cover;
  border-radius: 8px;
  background: #f7f7f7;
  border: 1px solid var(--kt-line);
}
.cat-name {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  font-weight: 400;
}
.cat-row:hover {
  background: #f5f9f6;
}
.cat-row.active {
  background: var(--kt-brand-soft);
  color: var(--kt-brand);
  font-weight: 600;
  border-color: #d4e9dc;
}
.cat-row.active::before { content: ''; position: absolute; left: 0; top: calc(50% - 12px); width: 3px; height: 24px; border-radius: 3px; background: var(--kt-brand); }
.cat-ops {
  display: inline-flex;
  flex: none;
  gap: 2px;
  margin-left: 4px;
  color: var(--kt-muted);
  opacity: 0.35;
  transition: opacity 0.15s;
}
.cat-row:hover .cat-ops, .cat-row:focus-within .cat-ops, .cat-row.active .cat-ops { opacity: 1; }
.cat-icon-button { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
.cat-icon-button:hover { color: var(--kt-brand-dark); background: var(--kt-brand-soft); }
.category-delete:hover { color: var(--el-color-danger); background: #fff1ef; }
.all-btn {
  flex: none;
  width: 100%;
  min-height: 38px;
  margin-top: 12px;
  font-size: 14px;
  border-radius: 9px;
  color: #7c9182;
  background: #f6f8f7;
}
.all-btn.all-active { color: var(--kt-brand-dark); background: var(--kt-brand-soft); font-weight: 600; }
.filter {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.filter-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.food-search { width: 210px; }
.status-filter { width: 118px; }
.filter-fields :deep(.el-input__wrapper), .filter-fields :deep(.el-select__wrapper) { border-radius: 8px; background: #fafcfb; }
.filter-fields :deep(.el-button) { border-radius: 8px; }
.filter-fields :deep(.el-button + .el-button) { margin-left: 0; }
.result-count { padding: 6px 10px; border-radius: 7px; background: #f7f9f8; color: #93a097; font-size: 12px; white-space: nowrap; }
.result-count strong { color: #637d6c; font-weight: 600; }
.food-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.food-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: inherit;
  font-weight: 400;
}
.food-img {
  width: 36px;
  height: 36px;
  box-sizing: border-box;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 9px;
  background: #f7f7f7;
  border: 1px solid var(--kt-line);
}
.food-image-picker {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
}
.food-preview {
  width: 88px;
  height: 88px;
  flex: 0 0 auto;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--kt-line);
  background: #f7f7f7;
}
.food-image-controls {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.image-tip {
  font-size: 12px;
  line-height: 1.6;
  color: var(--kt-muted);
}
.image-option {
  display: flex;
  align-items: center;
  gap: 10px;
}
.image-option img {
  width: 28px;
  height: 28px;
  object-fit: cover;
  border-radius: 5px;
}
.category-selected-label img {
  width: 20px;
  height: 20px;
}
.pagination-wrap {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--kt-line);
}
.pagination-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  color: #93a097;
  font-size: 12px;
}
.adaptive-size { color: #637d6c; }
.pagination-wrap :deep(.el-pagination) {
  max-width: 100%;
  flex-wrap: wrap;
  gap: 8px;
}
.pagination-wrap :deep(.el-pager li) { border-radius: 7px; font-weight: 400; }
.pagination-wrap :deep(.el-pager li.is-active) { color: var(--kt-brand-dark); background: var(--kt-brand-soft); font-weight: 600; }
@media (max-width: 1380px) {
  .food-card { padding: 12px; }
}
@media (max-width: 1240px) {
  .food-card {
    padding: 12px;
  }
  .food-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 260px minmax(340px, 1fr);
  }
  .category-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    align-content: start;
    gap: 8px 12px;
  }
  .cat-row {
    min-width: 0;
    margin-bottom: 0;
  }
}
</style>
