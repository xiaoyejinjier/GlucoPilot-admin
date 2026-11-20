<template>
  <div class="page-wrap dashboard-page">
    <header class="dashboard-head">
      <div>
        <div class="dashboard-title">
          <h2 class="page-title">数据看板</h2>
          <el-tag v-if="adminConfig.useMock" type="warning" size="small">演示数据</el-tag>
        </div>
        <p class="text-muted">控糖健康管理系统运营概览 · 按北京时间统计</p>
        <p v-if="stats" class="dashboard-updated">更新于 {{ updatedLabel }}</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" :disabled="loading" @click="load">刷新数据</el-button>
    </header>

    <el-alert v-if="error" class="dashboard-error" type="error" :title="error" show-icon :closable="false"
      :description="stats ? '下方保留上次成功加载的数据，请稍后刷新。' : '请稍后点击刷新数据重试。'" />
    <el-skeleton v-if="loading && !stats" :rows="12" animated />

    <template v-if="stats">
      <div class="dashboard-stats">
        <StatCard label="注册用户" :value="formatCount(stats.users.total)" icon="User"
          color="#07c160" soft="#e7f8ef"
          :hint="`今日新增 ${formatCount(stats.users.today)} · 近14天登录 ${formatCount(stats.users.active)}`" />
        <StatCard label="今日实测血糖" :value="formatCount(stats.records.todayGlucose)" icon="Odometer"
          color="#fa9d3b" soft="#fdf1e2" :hint="`本月累计 ${formatCount(stats.records.monthTotal)} 条实测记录`" />
        <StatCard label="今日饮食记录" :value="formatCount(stats.records.todayMeal)" icon="KnifeFork"
          color="#07c160" soft="#e7f8ef" hint="按饮食记录条数统计" />
        <StatCard label="待回复反馈" :value="formatCount(stats.content.feedbackPending)" icon="ChatDotRound"
          color="#fa5151" soft="#fee9e9"
          :hint="`已发布文章 ${formatCount(stats.content.newsCount)} 篇 · 浏览记录 ${formatCount(stats.content.newsViews)}`" />
      </div>

      <div class="dashboard-layout">
        <div class="dashboard-main">
          <section class="kt-card">
            <div class="chart-head">
              <h3>近14天记录趋势</h3>
              <span class="chart-caption">{{ stats.rangeStart }} 至 {{ stats.rangeEnd }}</span>
            </div>
            <EChart :option="trendOption" height="340px" />
          </section>
          <div class="dashboard-details">
            <section class="kt-card">
              <div class="chart-head"><h3>已发布文章频道分布</h3></div>
              <EChart v-if="hasChannels" :option="channelOption" height="300px" />
              <el-empty v-else description="暂无已发布文章" :image-size="76" />
            </section>
            <section class="kt-card">
              <div class="chart-head"><h3>九时段记录量</h3><span class="chart-caption">近14天 · 实测血糖与饮食</span></div>
              <EChart v-if="hasNodes" :option="nodeOption" height="300px" />
              <el-empty v-else description="近14天暂无记录" :image-size="76" />
            </section>
          </div>
        </div>
        <aside class="dashboard-side">
          <section class="kt-card">
            <div class="chart-head"><h3>用户血糖达标率分布</h3></div>
            <p class="chart-caption compliance-caption">近14天有实测记录的用户，统计范围为 3.9 ≤ 血糖 &lt; 7.8 mmol/L</p>
            <EChart v-if="hasCompliance" :option="complianceOption" height="300px" />
            <el-empty v-else description="近14天暂无实测血糖" :image-size="76" />
          </section>
          <section class="kt-card">
            <div class="chart-head"><h3>运营提示</h3></div>
            <ul class="tips">
              <li v-if="stats.content.feedbackPending">有 {{ formatCount(stats.content.feedbackPending) }} 条反馈待回复。</li>
              <li v-else>当前反馈均已回复。</li>
              <li v-if="stats.records.todayGlucose || stats.records.todayMeal">今日已有 {{ formatCount(stats.records.todayGlucose) }} 条实测血糖、{{ formatCount(stats.records.todayMeal) }} 条饮食记录。</li>
              <li v-else>今日尚无血糖或饮食记录。</li>
              <li>食品营养库共有 {{ formatCount(stats.foodCount) }} 条食品记录。</li>
            </ul>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import StatCard from '@/components/StatCard.vue'
import EChart from '@/components/EChart.vue'
import { api } from '@/api'
import { adminConfig } from '@/config'
import type { DashboardStats } from '@/types'

const stats = ref<DashboardStats | null>(null)
const loading = ref(false)
const error = ref('')
let requestVersion = 0

async function load() {
  if (loading.value) return
  const version = ++requestVersion
  loading.value = true
  error.value = ''
  try {
    const result = await api.dashboardStats()
    if (version === requestVersion) stats.value = result
  } catch (cause) {
    if (version === requestVersion) error.value = (cause as Error).message || '加载看板失败'
  } finally {
    if (version === requestVersion) loading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => { requestVersion++ })

function formatCount(value: number) { return value.toLocaleString('zh-CN') }

const updatedLabel = computed(() => {
  const value = stats.value?.generatedAt
  if (!value) return ''
  const zoned = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+08:00`
  return new Date(zoned).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
})
const hasChannels = computed(() => stats.value?.channelDist.some(item => item.value > 0))
const hasNodes = computed(() => stats.value?.nodeHeat.some(item => item.value > 0))
const hasCompliance = computed(() => stats.value?.complianceDist.some(item => item.value > 0))

const trendOption = computed<EChartsOption>(() => {
  const points = stats.value?.trend || []
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 8, data: ['血糖记录', '饮食记录', '新增用户'] },
    grid: { left: 18, right: 18, top: 72, bottom: 16, containLabel: true },
    xAxis: { type: 'category', data: points.map(point => point.date),
      axisLabel: { hideOverlap: true, formatter: (value: string) => value.slice(5) } },
    yAxis: [{ type: 'value', name: '记录数', minInterval: 1 },
      { type: 'value', name: '新增用户', minInterval: 1, splitLine: { show: false } }],
    series: [
      { name: '血糖记录', type: 'line', smooth: false, data: points.map(point => point.glucose),
        itemStyle: { color: '#07c160' }, areaStyle: { opacity: 0.06 } },
      { name: '饮食记录', type: 'line', smooth: false, data: points.map(point => point.meal),
        itemStyle: { color: '#fa9d3b' } },
      { name: '新增用户', type: 'bar', yAxisIndex: 1, barMaxWidth: 16,
        data: points.map(point => point.users), itemStyle: { color: '#99b2d3', borderRadius: [3, 3, 0, 0] } }
    ]
  }
})

const complianceOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 位用户（{d}%）' },
  legend: { bottom: 0, icon: 'circle', textStyle: { fontSize: 12 } },
  color: ['#07c160', '#fa9d3b', '#fa5151'],
  series: [{ type: 'pie', radius: ['46%', '68%'], center: ['50%', '40%'],
    label: { position: 'inside', formatter: '{d}%', color: '#fff' },
    data: (stats.value?.complianceDist || []).map(item => ({ name: item.level, value: item.value,
      label: { show: item.value > 0 } })) }]
}))

const channelOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 12, right: 16, top: 34, bottom: 12, containLabel: true },
  xAxis: { type: 'category', data: (stats.value?.channelDist || []).map(item => item.channel),
    axisLabel: { interval: 0 } },
  yAxis: { type: 'value', name: '文章数', minInterval: 1 },
  series: [{ type: 'bar', barMaxWidth: 34, data: (stats.value?.channelDist || []).map(item => item.value),
    itemStyle: { borderRadius: [5, 5, 0, 0], color: '#07c160' } }]
}))

const nodeOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 12, right: 24, top: 12, bottom: 12, containLabel: true },
  xAxis: { type: 'value', minInterval: 1 },
  yAxis: { type: 'category', inverse: true, data: (stats.value?.nodeHeat || []).map(item => item.node) },
  series: [{ type: 'bar', barMaxWidth: 18, data: (stats.value?.nodeHeat || []).map(item => item.value),
    itemStyle: { borderRadius: [0, 5, 5, 0], color: '#4cd98a' } }]
}))
</script>

<style scoped>
.dashboard-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 22px; }
.dashboard-title { display: flex; align-items: center; gap: 12px; }
.page-title { margin: 0; font-size: 22px; }
.dashboard-head p { margin: 10px 0 0; }
.dashboard-updated, .chart-caption { color: var(--kt-muted); font-size: 12px; line-height: 1.7; }
.dashboard-error { margin-bottom: 18px; }
.dashboard-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
.dashboard-stats :deep(.stat-card) { min-width: 0; min-height: 124px; box-sizing: border-box; }
.dashboard-stats :deep(.stat-body) { min-width: 0; }
.dashboard-stats :deep(.stat-hint) { margin-top: 6px; line-height: 1.6; overflow-wrap: anywhere; }
.dashboard-layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 18px; }
.dashboard-main, .dashboard-side { min-width: 0; display: flex; flex-direction: column; gap: 18px; }
.dashboard-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.kt-card { min-width: 0; }
.chart-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.chart-head h3 { margin: 0; font-size: 15px; font-weight: 600; }
.compliance-caption { margin: 0 0 8px; }
.tips { margin: 0; padding-left: 18px; }
.tips li { font-size: 13px; color: var(--kt-muted); margin: 10px 0; line-height: 1.8; }
@media (max-width: 1200px) {
  .dashboard-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-layout { grid-template-columns: 1fr; }
  .dashboard-side { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}
@media (max-width: 720px) {
  .dashboard-head { align-items: center; }
  .dashboard-stats, .dashboard-details, .dashboard-side { grid-template-columns: 1fr; }
  .dashboard-head .text-muted { font-size: 12px; }
}
</style>
