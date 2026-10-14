<template>
  <div class="records-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">九时段记录</h2>
        <p class="text-muted">统一查看用户每天 6 个实测血糖节点和 3 个饮食节点</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </div>

    <div class="kt-card filter-card mb16">
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :clearable="false"
          />
        </el-form-item>
        <el-form-item label="用户">
          <el-input
            v-model="keyword"
            placeholder="用户名 / 昵称 / 手机号"
            clearable
            :prefix-icon="Search"
            @keyup.enter="search"
            @clear="search"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="餐点列展示 meal_record 饮食记录；血糖列展示 glucose_record 实测值。餐食预测仅作参考，不计入实测均值或达标率。"
      />
    </div>

    <el-row :gutter="16" class="mb16 stats-row">
      <el-col :xs="12" :sm="12" :md="6">
        <StatCard label="九时段总记录" :value="overview.totalRecords" icon="List" :color="brand" :soft="brandSoft" :hint="`${overview.recordDays} 个用户日`" />
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <StatCard label="活跃用户" :value="overview.activeUsers" icon="User" color="#409eff" soft="#ecf5ff" :hint="`饮食 ${overview.mealRecords} 条`" />
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <StatCard label="平均实测血糖" :value="avgGlucoseText" icon="Odometer" color="#e6a23c" soft="#fdf6ec" :hint="`共 ${overview.glucoseRecords} 次实测`" />
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <StatCard label="实测达标率" :value="`${overview.complianceRate}%`" icon="CircleCheck" color="#67c23a" soft="#f0f9eb" :hint="`异常 ${overview.abnormalRecords} 条`" />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="15">
        <div class="kt-card chart-card">
          <div class="block-title">每日记录趋势</div>
          <EChart :option="trendOption" height="280px" />
        </div>
      </el-col>
      <el-col :xs="24" :lg="9">
        <div class="kt-card chart-card">
          <div class="block-title">九时段完成量</div>
          <EChart :option="nodeOption" height="280px" />
        </div>
      </el-col>
    </el-row>

    <div class="kt-card records-card">
      <div class="table-head">
        <div>
          <div class="block-title">用户每日明细</div>
          <span class="text-muted">每行是一名用户一天的完整九时段情况</span>
        </div>
        <div class="legend">
          <span><i class="dot glucose"></i>实测血糖</span>
          <span><i class="dot meal"></i>饮食记录</span>
          <span><i class="dot empty"></i>未记录</span>
        </div>
      </div>

      <el-table v-loading="loading" :data="rows" :row-key="recordRowKey" :max-height="page.pageSize > 10 ? 800 : undefined" border stripe class="records-table" empty-text="所选范围内暂无记录">
        <el-table-column label="序号" width="70" align="center" fixed>
          <template #default="{ $index }">{{ (page.pageNum - 1) * page.pageSize + $index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="recordDate" label="日期" width="108" fixed />
        <el-table-column label="用户" width="148" fixed>
          <template #default="{ row }">
            <div class="user-name">{{ row.nickname }}</div>
            <div class="user-account">{{ row.username }}</div>
          </template>
        </el-table-column>
        <el-table-column label="完成" width="86" align="center" fixed>
          <template #default="{ row }">
            <el-tag :type="row.completedCount === 9 ? 'success' : 'info'" effect="light">
              {{ row.completedCount }}/9
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-for="node in nodes"
          :key="node.code"
          :label="node.name"
          :width="node.meal ? 132 : 118"
          align="center"
        >
          <template #header>
            <span :class="['node-head', { meal: node.meal }]">{{ node.name }}</span>
          </template>
          <template #default="{ row }">
            <el-popover
              v-if="slotOf(row, node.code)?.recorded"
              trigger="hover"
              placement="top"
              :width="300"
              :show-after="120"
            >
              <template #reference>
                <div v-if="node.meal" class="slot-cell meal-cell">
                  <el-tag type="warning" effect="light" size="small">已记录</el-tag>
                  <span class="slot-sub ellipsis">{{ slotOf(row, node.code)?.foodsText || '饮食详情' }}</span>
                </div>
                <div v-else class="slot-cell">
                  <strong :style="{ color: glucoseColor(slotOf(row, node.code)?.glucoseValue) }">
                    {{ slotOf(row, node.code)?.glucoseValue }}
                  </strong>
                  <span class="unit">mmol/L</span>
                  <span class="slot-sub">{{ sourceText(slotOf(row, node.code)?.sourceType) }}</span>
                </div>
              </template>
              <template #default>
                <div class="popover-detail">
                  <strong>{{ node.name }}</strong>
                  <template v-if="node.meal">
                    <p>食物：{{ slotOf(row, node.code)?.foodsText || '未填写' }}</p>
                    <p>碳水：{{ valueText(slotOf(row, node.code)?.carbsG, 'g') }}</p>
                    <p class="predict">餐食预测（非实测）：{{ valueText(slotOf(row, node.code)?.predictNow, 'mmol/L') }}</p>
                  </template>
                  <template v-else>
                    <p>血糖：{{ valueText(slotOf(row, node.code)?.glucoseValue, 'mmol/L') }}</p>
                    <p>来源：{{ sourceText(slotOf(row, node.code)?.sourceType) }}</p>
                    <p>备注：{{ slotOf(row, node.code)?.remark || '无' }}</p>
                  </template>
                  <p class="recorded-time">记录时间：{{ formatRecordedAt(slotOf(row, node.code)?.recordedAt) }}</p>
                </div>
              </template>
            </el-popover>
            <span v-else class="not-recorded">—</span>
          </template>
        </el-table-column>
        <el-table-column label="日均血糖" width="105" align="center" fixed="right">
          <template #default="{ row }">{{ valueText(row.avgGlucose, '') }}</template>
        </el-table-column>
      </el-table>

      <TablePagination
        :page-num="page.pageNum"
        :page-size="page.pageSize"
        :total="page.total"
        :summary="pageSummary"
        :disabled="loading"
        @size-change="changeSize"
        @page-change="changePage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import EChart from '@/components/EChart.vue'
import StatCard from '@/components/StatCard.vue'
import TablePagination from '@/components/TablePagination.vue'
import { useServerPagination } from '@/composables/useServerPagination'
import type { NineSlotDayRow, NineSlotOverview, NineSlotResult } from '@/types'

const nodes = [
  { code: 'before_breakfast', name: '早餐前', meal: false },
  { code: 'breakfast', name: '早餐', meal: true },
  { code: 'after_breakfast', name: '早餐后', meal: false },
  { code: 'before_lunch', name: '中餐前', meal: false },
  { code: 'lunch', name: '中餐', meal: true },
  { code: 'after_lunch', name: '中餐后', meal: false },
  { code: 'before_dinner', name: '晚餐前', meal: false },
  { code: 'dinner', name: '晚餐', meal: true },
  { code: 'after_dinner', name: '晚餐后', meal: false }
] as const

const emptyOverview = (): NineSlotOverview => ({
  activeUsers: 0,
  recordDays: 0,
  glucoseRecords: 0,
  mealRecords: 0,
  totalRecords: 0,
  avgGlucose: null,
  complianceRate: 0,
  abnormalRecords: 0,
  trend: [],
  nodeStats: []
})

function localDate(daysBefore = 0) {
  const value = new Date()
  value.setDate(value.getDate() - daysBefore)
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const brand = 'var(--kt-brand)'
const brandSoft = 'var(--kt-brand-soft)'
const keyword = ref('')
const dateRange = ref<[string, string]>([localDate(29), localDate()])
const overview = ref<NineSlotOverview>(emptyOverview())
type RecordFilters = { startDate: string; endDate: string; keyword?: string }
type RecordPage = NineSlotResult['page'] & { overview: NineSlotOverview }
const { page, records: rows, loading, pageSummary, load, search: applyFilters, changeSize, changePage } =
  useServerPagination<NineSlotDayRow, RecordFilters, RecordPage>(
    async (query) => {
      const result = await api.pageNineSlotRecords(query)
      return { ...result.page, overview: result.overview }
    },
    { startDate: dateRange.value[0], endDate: dateRange.value[1] },
    {
      errorMessage: '九时段记录加载失败',
      onLoaded: (result) => { overview.value = result.overview },
      onError: () => { overview.value = emptyOverview() }
    }
  )

const avgGlucoseText = computed(() => overview.value.avgGlucose == null ? '—' : `${overview.value.avgGlucose}`)

function search() {
  if (!dateRange.value?.[0] || !dateRange.value?.[1]) {
    ElMessage.warning('请选择日期范围')
    return
  }
  return applyFilters({
    startDate: dateRange.value[0],
    endDate: dateRange.value[1],
    keyword: keyword.value.trim() || undefined
  })
}

function resetFilters() {
  keyword.value = ''
  dateRange.value = [localDate(29), localDate()]
  return search()
}

function recordRowKey(row: NineSlotDayRow) {
  return `${row.userId}:${row.recordDate}`
}

function slotOf(row: NineSlotDayRow, code: string) {
  return row.slots[code]
}

function sourceText(sourceType: number | null | undefined) {
  return ({ 1: '手动录入', 2: 'OCR识别', 3: '设备同步' } as Record<number, string>)[Number(sourceType)] || '未知来源'
}

function glucoseColor(value: number | null | undefined) {
  if (value == null) return 'var(--kt-muted)'
  if (value < 3.9 || value >= 7.8) return '#f56c6c'
  return '#1b8f4f'
}

function valueText(value: number | null | undefined, unit: string) {
  return value == null ? '—' : `${value}${unit ? ` ${unit}` : ''}`
}

function formatRecordedAt(value: string | null | undefined) {
  if (!value) return '—'
  return value
    .replace('T', ' ')
    .replace(/(\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/, '')
    .slice(0, 19)
}

const trendOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['实测血糖', '饮食记录', '平均血糖'] },
  grid: { left: 48, right: 52, top: 42, bottom: 28 },
  xAxis: { type: 'category', data: overview.value.trend.map((item) => item.date.slice(5)) },
  yAxis: [
    { type: 'value', name: '记录数', minInterval: 1 },
    { type: 'value', name: 'mmol/L', scale: true }
  ],
  series: [
    { name: '实测血糖', type: 'bar', stack: 'records', data: overview.value.trend.map((item) => item.glucoseCount), itemStyle: { color: '#07c160' } },
    { name: '饮食记录', type: 'bar', stack: 'records', data: overview.value.trend.map((item) => item.mealCount), itemStyle: { color: '#fa9d3b' } },
    { name: '平均血糖', type: 'line', yAxisIndex: 1, smooth: true, connectNulls: false, data: overview.value.trend.map((item) => item.avgGlucose), itemStyle: { color: '#409eff' } }
  ]
}))

const nodeOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 64, right: 18, top: 16, bottom: 24 },
  xAxis: { type: 'value', minInterval: 1 },
  yAxis: { type: 'category', data: overview.value.nodeStats.map((item) => item.nodeName) },
  series: [{
    name: '记录量',
    type: 'bar',
    data: overview.value.nodeStats.map((item) => ({
      value: item.recordCount,
      itemStyle: { color: item.meal ? '#fa9d3b' : '#4cd98a', borderRadius: [0, 5, 5, 0] }
    }))
  }]
}))

onMounted(load)
</script>

<style scoped>
.records-page {
  min-width: 0;
  box-sizing: border-box;
  padding: 28px 32px 32px;
}
.page-head, .table-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-head {
  margin-bottom: 24px;
}
.page-head .text-muted {
  margin: 0;
  line-height: 1.7;
}
.page-title {
  margin: 0 0 12px;
  font-size: 20px;
  line-height: 1.35;
}
.filter-card { padding-bottom: 14px; }
.filter-card :deep(.el-form-item) { margin-bottom: 12px; }
.filter-card :deep(.el-alert) { margin-top: 0; }
.stats-row .el-col { margin-bottom: 12px; }
.chart-row { margin-bottom: 32px; }
.chart-card { height: 100%; box-sizing: border-box; }
.block-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.records-card { display: flex; flex-direction: column; min-width: 0; box-sizing: border-box; overflow: hidden; padding: 24px; }
.table-head { flex: none; margin-bottom: 20px; }
.table-head .block-title { margin-bottom: 8px; }
.table-head .text-muted { display: block; line-height: 1.6; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; color: var(--kt-muted); font-size: 12px; }
.dot { display: inline-block; width: 8px; height: 8px; margin-right: 5px; border-radius: 50%; }
.dot.glucose { background: #07c160; }
.dot.meal { background: #fa9d3b; }
.dot.empty { background: #c0c4cc; }
.records-table { flex: none; width: 100%; }
.node-head.meal { color: #c77716; }
.user-name { color: var(--kt-ink); font-weight: 600; }
.user-account, .slot-sub { color: var(--kt-muted); font-size: 11px; }
.slot-cell { display: flex; min-height: 42px; flex-direction: column; align-items: center; justify-content: center; cursor: default; }
.slot-cell strong { font-size: 16px; }
.slot-cell .unit { color: var(--kt-muted); font-size: 10px; }
.meal-cell { gap: 3px; }
.ellipsis { display: block; width: 104px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.not-recorded { color: #c0c4cc; }
.popover-detail p { margin: 7px 0 0; line-height: 1.45; }
.popover-detail .predict { color: #b36b12; }
.popover-detail .recorded-time { white-space: nowrap; }
@media (max-width: 1199px) {
  .chart-row .el-col + .el-col { margin-top: 16px; }
}
@media (max-width: 720px) {
  .records-page { padding: 20px 16px 24px; }
  .page-head, .table-head { align-items: flex-start; flex-direction: column; }
  .page-head { margin-bottom: 20px; }
  .records-card { padding: 20px 16px; }
}
</style>
