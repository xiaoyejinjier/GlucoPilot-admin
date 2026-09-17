<template>
  <div class="page-wrap">
    <div class="head mb16">
      <div>
        <h2 class="page-title">数据看板</h2>
        <p class="text-muted">控糖健康管理系统运营概览（演示数据）</p>
      </div>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <el-row :gutter="16" class="mb16">
      <el-col :span="6"><StatCard label="注册用户" :value="stats.users.total" icon="User" :color="brand" :soft="brandSoft" :hint="`今日 +${stats.users.today} · 活跃 ${stats.users.active}`" /></el-col>
      <el-col :span="6"><StatCard label="今日血糖记录" :value="stats.records.todayGlucose" icon="Odometer" color="#fa9d3b" soft="#fdf1e2" hint="本月累计 {{ stats.records.monthTotal }}" /></el-col>
      <el-col :span="6"><StatCard label="今日饮食记录" :value="stats.records.todayMeal" icon="KnifeFork" :color="brand" :soft="brandSoft" hint="含拍食物估糖" /></el-col>
      <el-col :span="6"><StatCard label="待处理反馈" :value="stats.content.feedbackPending" icon="ChatDotRound" color="#fa5151" soft="#fee9e9" :hint="`资讯 ${stats.content.newsCount} 篇 · 阅读 ${stats.content.newsViews}`" /></el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="16">
        <div class="kt-card mb16">
          <div class="chart-head">近 14 天记录趋势（血糖 / 饮食 / 新增用户）</div>
          <EChart :option="trendOption" height="320px" />
        </div>
        <el-row :gutter="16">
          <el-col :span="12">
            <div class="kt-card">
              <div class="chart-head">资讯频道内容分布</div>
              <EChart :option="channelOption" height="240px" />
            </div>
          </el-col>
          <el-col :span="12">
            <div class="kt-card">
              <div class="chart-head">九时段记录热度</div>
              <EChart :option="nodeOption" height="240px" />
            </div>
          </el-col>
        </el-row>
      </el-col>
      <el-col :span="8">
        <div class="kt-card mb16">
          <div class="chart-head">用户血糖达标分布</div>
          <EChart :option="complianceOption" height="240px" />
        </div>
        <div class="kt-card">
          <div class="chart-head mb12">运营提示</div>
          <ul class="tips">
            <li>待处理反馈 {{ stats.content.feedbackPending }} 条，建议今日跟进。</li>
            <li>《控糖科普周报》轮播将于 {{ '3' }} 天后结束，可前往轮播管理续期。</li>
            <li>营养库当前 {{ foodCount }} 条食物数据，可批量导入扩展。</li>
          </ul>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import StatCard from '@/components/StatCard.vue'
import EChart from '@/components/EChart.vue'
import { api } from '@/api'
import type { DashboardStats } from '@/types'
import { ElMessage } from 'element-plus'

const brand = 'var(--kt-brand)'
const brandSoft = 'var(--kt-brand-soft)'
const foodCount = ref(0)
const stats = ref<DashboardStats>({
  users: { total: 0, today: 0, active: 0 },
  records: { todayGlucose: 0, todayMeal: 0, monthTotal: 0 },
  content: { newsViews: 0, newsCount: 0, feedbackPending: 0 },
  trend: [], complianceDist: [], channelDist: [], nodeHeat: []
})

async function load() {
  try {
    stats.value = await api.dashboardStats()
    const foods = await api.listFoods()
    foodCount.value = foods.length
  } catch (e) {
    ElMessage.error((e as Error).message || '加载看板失败')
  }
}
onMounted(load)

const trendOption = computed<EChartsOption>(() => {
  const t = stats.value.trend
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['血糖记录', '饮食记录', '新增用户'] },
    grid: { left: 44, right: 44, top: 40, bottom: 24 },
    xAxis: { type: 'category', data: t.map((d) => d.date.slice(5)) },
    yAxis: [
      { type: 'value', name: '记录数' },
      { type: 'value', name: '用户' }
    ],
    series: [
      { name: '血糖记录', type: 'line', smooth: true, data: t.map((d) => d.glucose), itemStyle: { color: '#07c160' }, areaStyle: { opacity: 0.08 } },
      { name: '饮食记录', type: 'line', smooth: true, data: t.map((d) => d.meal), itemStyle: { color: '#fa9d3b' } },
      { name: '新增用户', type: 'bar', yAxisIndex: 1, barWidth: 10, data: t.map((d) => d.users), itemStyle: { color: '#e5e7eb' } }
    ]
  }
})

const complianceOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0, icon: 'circle' },
  color: ['#07c160', '#fa9d3b', '#fa5151'],
  series: [{
    type: 'pie', radius: ['48%', '72%'], center: ['50%', '44%'],
    label: { formatter: '{b}\n{d}%' },
    data: stats.value.complianceDist.map((d) => ({ name: d.level, value: d.value }))
  }]
}))

const channelOption = computed<EChartsOption>(() => ({
  tooltip: {},
  grid: { left: 40, right: 16, top: 12, bottom: 24 },
  xAxis: { type: 'category', data: stats.value.channelDist.map((d) => d.channel) },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', barWidth: 26, data: stats.value.channelDist.map((d) => d.value), itemStyle: { borderRadius: [6, 6, 0, 0], color: '#07c160' } }]
}))

const nodeOption = computed<EChartsOption>(() => ({
  tooltip: {},
  grid: { left: 70, right: 24, top: 8, bottom: 24 },
  xAxis: { type: 'value' },
  yAxis: { type: 'category', data: stats.value.nodeHeat.map((d) => d.node) },
  series: [{ type: 'bar', data: stats.value.nodeHeat.map((d) => d.value), itemStyle: { borderRadius: [0, 6, 6, 0], color: '#4cd98a' } }]
}))
</script>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; }
.page-title { margin: 0; font-size: 20px; }
.chart-head { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.tips { margin: 0; padding-left: 18px; }
.tips li { font-size: 13px; color: var(--kt-muted); margin: 8px 0; line-height: 1.6; }
</style>
