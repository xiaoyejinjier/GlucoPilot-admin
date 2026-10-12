<template>
  <div class="archive-page">
    <!-- 左侧：用户选择 -->
    <div class="left">
      <div class="left-head">
        <span class="title">用户列表</span>
        <span class="text-muted count">{{ users.length }} 人</span>
      </div>
      <el-input v-model="keyword" placeholder="搜索昵称 / 手机号" clearable :prefix-icon="Search" size="small" />
      <div v-loading="loading" class="user-scroll">
        <div
          v-for="u in filteredUsers"
          :key="u.id"
          class="user-item"
          :class="{ active: selected?.id === u.id }"
          @click="select(u)"
        >
          <el-avatar :size="34" class="avatar">{{ u.avatarText }}</el-avatar>
          <div class="user-info">
            <div class="line1">
              <span>{{ u.nickname }}</span>
              <el-tag size="small" effect="plain" type="info">{{ u.diabetesType }}</el-tag>
            </div>
            <div class="line2">{{ u.phone }} · 达标率 {{ u.compliance }}%</div>
          </div>
          <el-icon v-if="selected?.id === u.id" color="var(--kt-brand)"><ArrowRight /></el-icon>
        </div>
        <el-empty v-if="!loading && filteredUsers.length === 0" description="无匹配用户" :image-size="60" />
      </div>
    </div>

    <!-- 右侧：档案详情 -->
    <div class="right">
      <template v-if="!selected">
        <div class="empty-hint">
          <el-icon :size="44" color="var(--kt-line)"><Files /></el-icon>
          <p class="text-muted">请在左侧选择一名用户查看其健康档案</p>
          <el-alert type="info" :closable="false" title="本页面仅管理员可访问；档案查阅行为将记录操作日志" />
        </div>
      </template>

      <template v-else>
        <div v-loading="archLoading">
          <template v-if="archive">
            <!-- 头部 -->
            <div class="kt-card head-card">
              <div class="user-main">
                <el-avatar :size="52" class="avatar big">{{ archive.owner.nickname.slice(0, 1) }}</el-avatar>
                <div>
                  <div class="name-row">
                    <span class="name">{{ archive.owner.nickname }}</span>
                    <el-tag size="small" effect="light">{{ archive.owner.diabetesType }}</el-tag>
                    <el-tag v-if="userStatus === 'disabled'" size="small" type="danger" effect="light">已禁用</el-tag>
                  </div>
                  <div class="meta">{{ archive.owner.phone }} · {{ archive.owner.age }} 岁 · 注册于 {{ archive.owner.registeredAt }}</div>
                </div>
              </div>
              <div class="head-actions">
                <el-button :icon="Download" size="small" @click="exportArchive">导出档案(演示)</el-button>
              </div>
            </div>

            <!-- 指标 -->
            <el-row :gutter="12" class="mb12">
              <el-col :span="6">
                <div class="kt-card mini">
                  <div class="label">近 7 日均值</div>
                  <div class="num">{{ avg7 }}<span class="unit">mmol/L</span></div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="kt-card mini">
                  <div class="label">最新达标率</div>
                  <div class="num" :style="{ color: okColor }">{{ latestOk }}%</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="kt-card mini">
                  <div class="label">分时段样本</div>
                  <div class="num">{{ totalSamples }}<span class="unit">次</span></div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="kt-card mini">
                  <div class="label">饮食记录天数</div>
                  <div class="num">{{ archive.mealSummary.recordDays }}<span class="unit">天</span></div>
                </div>
              </el-col>
            </el-row>

            <!-- 趋势图 + 基础资料 -->
            <el-row :gutter="12" class="mb12">
              <el-col :span="16">
                <div class="kt-card">
                  <div class="block-title">近 7 日日均血糖与达标率</div>
                  <EChart :option="trendOption" height="240px" />
                </div>
              </el-col>
              <el-col :span="8">
                <div class="kt-card">
                  <div class="block-title">基础资料</div>
                  <el-descriptions :column="1" size="small" border>
                    <el-descriptions-item label="身高">{{ archive.profile.height == null ? '—' : `${archive.profile.height} cm` }}</el-descriptions-item>
                    <el-descriptions-item label="体重">{{ archive.profile.weight == null ? '—' : `${archive.profile.weight} kg` }}</el-descriptions-item>
                    <el-descriptions-item label="确诊时间">{{ archive.profile.diagnosedAt }}</el-descriptions-item>
                    <el-descriptions-item label="用药">{{ archive.profile.medication }}</el-descriptions-item>
                    <el-descriptions-item label="运动">{{ archive.profile.exercise }}</el-descriptions-item>
                  </el-descriptions>
                </div>
              </el-col>
            </el-row>

            <!-- 分时段 + 饮食 -->
            <el-row :gutter="12">
              <el-col :span="12">
                <div class="kt-card">
                  <div class="block-title">分时段血糖均值</div>
                  <el-table :data="archive.nodeStats" size="small">
                    <el-table-column prop="nodeName" label="时段" />
                    <el-table-column label="均值 (mmol/L)" width="140">
                      <template #default="{ row }">
                        <span :style="{ color: levelColor(row.avg) }">{{ row.avg }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="samples" label="样本数" width="90" />
                  </el-table>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="kt-card">
                  <div class="block-title">饮食记录汇总</div>
                  <el-descriptions :column="1" size="small">
                    <el-descriptions-item label="记录天数">{{ archive.mealSummary.recordDays }} 天</el-descriptions-item>
                    <el-descriptions-item label="平均每餐碳水">{{ archive.mealSummary.avgCarbsG }} g</el-descriptions-item>
                    <el-descriptions-item label="平均每餐热量">{{ archive.mealSummary.avgCal }} kcal</el-descriptions-item>
                    <el-descriptions-item label="高频食物">{{ archive.mealSummary.topFoods.join(' / ') }}</el-descriptions-item>
                  </el-descriptions>
                </div>
              </el-col>
            </el-row>

            <!-- AI 小结 -->
            <div class="kt-card summary-card">
              <div class="block-title">AI 档案小结</div>
              <p class="summary-text">{{ archive.summary }}</p>
              <el-alert type="info" :closable="false" title="本次查阅已记录到操作日志（仅管理员可访问）" />
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowRight, Download, Files, Search } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import EChart from '@/components/EChart.vue'
import type { AppUser, HealthArchive } from '@/types'

const auth = useAuthStore()
const loading = ref(false)
const archLoading = ref(false)
const users = ref<AppUser[]>([])
const keyword = ref('')
const selected = ref<AppUser | null>(null)
const archive = ref<HealthArchive | null>(null)

async function loadUsers() {
  loading.value = true
  users.value = await api.listUsers()
  loading.value = false
}
onMounted(loadUsers)

const filteredUsers = computed(() =>
  users.value.filter((u) => !keyword.value || u.nickname.includes(keyword.value) || u.phone.includes(keyword.value))
)
const userStatus = computed(() => selected.value?.status || 'enabled')

async function select(u: AppUser) {
  selected.value = u
  archive.value = null
  archLoading.value = true
  try {
    archive.value = await api.archiveOf(u.id)
    if (auth.account) api.writeLog(auth.account.username, auth.account.role, '档案', '查看健康档案', `${u.nickname}(${u.id})`)
  } catch (e) {
    ElMessage.error((e as Error).message || '健康档案加载失败')
  } finally {
    archLoading.value = false
  }
}

const avg7 = computed(() => {
  if (!archive.value || !archive.value.trend.length) return '—'
  const sum = archive.value.trend.reduce((s, t) => s + t.avg, 0)
  return (sum / archive.value.trend.length).toFixed(1)
})
const latestOk = computed(() => archive.value?.trend[archive.value.trend.length - 1]?.okRate ?? 0)
const okColor = computed(() => (latestOk.value >= 70 ? 'var(--kt-brand)' : latestOk.value >= 40 ? 'var(--kt-warn)' : 'var(--kt-danger)'))
const totalSamples = computed(() => archive.value?.nodeStats.reduce((s, n) => s + n.samples, 0) ?? 0)

function levelColor(v: number): string {
  if (v < 3.9 || v >= 10) return 'var(--kt-danger)'
  if (v >= 7.8) return 'var(--kt-warn)'
  return 'var(--kt-brand)'
}

const trendOption = computed<EChartsOption>(() => {
  const t = archive.value?.trend || []
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['日均血糖', '达标率'] },
    grid: { left: 44, right: 44, top: 40, bottom: 24 },
    xAxis: { type: 'category', data: t.map((d) => d.date.slice(5)) },
    yAxis: [
      { type: 'value', name: 'mmol/L', min: 3, max: 12 },
      { type: 'value', name: '%', min: 0, max: 100 }
    ],
    series: [
      { name: '日均血糖', type: 'line', smooth: true, data: t.map((d) => d.avg), itemStyle: { color: '#07c160' }, areaStyle: { opacity: 0.08 } },
      { name: '达标率', type: 'line', yAxisIndex: 1, smooth: true, data: t.map((d) => d.okRate), itemStyle: { color: '#fa9d3b' }, lineStyle: { type: 'dashed' } }
    ]
  }
})

function exportArchive() {
  if (!archive.value) return
  const a = document.createElement('a')
  const content = `用户健康档案导出（${archive.value.owner.nickname}）\n${archive.value.summary}`
  a.href = URL.createObjectURL(new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' }))
  a.download = `archive-${archive.value.userId}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
  if (auth.account) api.writeLog(auth.account.username, auth.account.role, '档案', '导出健康档案', `${archive.value.owner.nickname}(${archive.value.userId})`)
  ElMessage.success('已导出（演示文件）')
}
</script>

<style scoped>
.archive-page { display: flex; gap: 16px; padding: 16px; height: 100%; box-sizing: border-box; }
.left { width: 300px; flex: none; background: var(--kt-surface); border: 1px solid var(--kt-line); border-radius: var(--kt-radius); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.left-head { display: flex; align-items: center; justify-content: space-between; }
.left-head .title { font-weight: 600; }
.user-scroll { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 6px; }
.user-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
.user-item:hover { background: var(--kt-brand-soft); }
.user-item.active { background: var(--kt-brand-soft); border-color: var(--kt-brand); }
.avatar { background: var(--kt-brand); color: #fff; flex: none; }
.user-info { flex: 1; min-width: 0; }
.line1 { display: flex; align-items: center; gap: 6px; font-size: 14px; }
.line2 { font-size: 12px; color: var(--kt-muted); margin-top: 2px; }
.right { flex: 1; min-width: 0; overflow: auto; }
.empty-hint { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
.empty-hint p { margin: 0; }
.head-card { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.user-main { display: flex; align-items: center; gap: 14px; }
.avatar.big { font-size: 20px; }
.name-row { display: flex; align-items: center; gap: 8px; }
.name { font-size: 18px; font-weight: 700; }
.meta { font-size: 12px; color: var(--kt-muted); margin-top: 4px; }
.kt-card.mini { padding: 12px 14px; }
.mini .label { font-size: 12px; color: var(--kt-muted); }
.mini .num { font-size: 22px; font-weight: 700; margin-top: 4px; }
.mini .unit { font-size: 12px; color: var(--kt-muted); margin-left: 4px; font-weight: 400; }
.block-title { font-weight: 600; margin-bottom: 10px; }
.summary-card { margin-top: 12px; }
.summary-text { line-height: 1.8; color: var(--kt-ink); }
</style>
