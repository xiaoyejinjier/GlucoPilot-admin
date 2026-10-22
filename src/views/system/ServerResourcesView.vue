<template>
  <div class="page-wrap resource-page">
    <div class="resource-head">
      <div><h2>服务器资源</h2><p class="text-muted">整台服务器与本项目容器的真实资源采样，每 10 秒刷新。</p></div>
      <el-button :icon="Refresh" :loading="loading" @click="poller.refresh()">刷新</el-button>
    </div>
    <el-alert v-if="transportError" :title="`刷新失败：${transportError}`" description="当前值不会被替换为零；请检查连接或登录状态。" type="error" :closable="false" show-icon />
    <el-alert v-if="response && (!response.available || stale || !snapshot?.containersAvailable)" :title="stale && response.available ? '采样已过期' : response.message" :description="response.available ? '下方保留最后一次真实采样，请核对采样时间。' : '请检查宿主机采集器及后端只读快照挂载。'" type="warning" :closable="false" show-icon />
    <div class="sample-meta">
      <span>采样时间：{{ snapshot ? time(snapshot.sampledAt) : '尚未采集' }}</span>
      <el-tag :type="stale || transportError ? 'warning' : 'info'">{{ paused ? '后台暂停刷新' : '自动刷新' }}</el-tag>
    </div>
    <template v-if="snapshot">
      <div class="metric-grid">
        <section class="kt-card metric"><span class="metric-label">宿主机 CPU</span><strong>{{ formatPercent(host!.cpuPercent) }}</strong><span>{{ host!.cpuCores }} 个逻辑核<span v-if="host!.cpuPercent == null"> · 等待下一次采样</span></span></section>
        <section class="kt-card metric"><span class="metric-label">宿主机内存</span><strong>{{ formatPercent(host!.memoryPercent) }}</strong><span>已用 {{ formatBytes(host!.memoryUsedBytes) }} / {{ formatBytes(host!.memoryTotalBytes) }}</span><span>可用 {{ formatBytes(host!.memoryAvailableBytes) }}</span></section>
        <section class="kt-card metric"><span class="metric-label">根文件系统磁盘</span><strong>{{ formatPercent(host!.diskPercent) }}</strong><span>已用 {{ formatBytes(host!.diskUsedBytes) }} / {{ formatBytes(host!.diskTotalBytes) }}</span><span>可用 {{ formatBytes(host!.diskFreeBytes) }}</span></section>
        <section class="kt-card metric"><span class="metric-label">宿主机运行时长</span><strong class="uptime">{{ formatUptime(host!.uptimeSeconds) }}</strong><span>Swap {{ formatBytes(host!.swapUsedBytes) }} / {{ formatBytes(host!.swapTotalBytes) }}</span><span>此处不是 Java 进程运行时长</span></section>
      </div>
      <section class="kt-card trend">
        <h3>CPU 与内存趋势</h3><p class="text-muted">最近 {{ snapshot.history.length }} 次真实采样，最多保留 60 次（约 10 分钟）；CPU 首次采样为空。</p>
        <EChart v-if="snapshot.history.length" :option="chartOption" height="300px" />
        <el-empty v-else description="等待历史采样" />
      </section>
      <section class="kt-card">
        <h3>本项目容器</h3>
        <el-alert v-if="!snapshot.containersAvailable" title="容器采集暂不可用，请检查采集器的 Docker 访问。" type="warning" :closable="false" />
        <el-table :data="snapshot.containers" row-key="name" :empty-text="snapshot.containersAvailable ? '当前未发现本项目容器' : '尚未取得容器数据'">
          <el-table-column prop="name" label="容器" min-width="240" show-overflow-tooltip />
          <el-table-column label="服务" width="110"><template #default="{ row }">{{ services[row.service] || row.service || '—' }}</template></el-table-column>
          <el-table-column label="状态" width="130"><template #default="{ row }"><el-tag :type="row.state === 'running' ? 'success' : 'warning'">{{ states[row.state] || row.state }}</el-tag></template></el-table-column>
          <el-table-column label="CPU" width="110"><template #default="{ row }">{{ formatPercent(row.cpuPercent) }}</template></el-table-column>
          <el-table-column label="内存占用" width="140"><template #default="{ row }">{{ formatBytes(row.memoryUsedBytes) }}</template></el-table-column>
          <el-table-column label="内存上限" width="150"><template #default="{ row }">{{ row.memoryLimitBytes == null ? '未设置' : formatBytes(row.memoryLimitBytes) }}</template></el-table-column>
        </el-table>
        <p class="scope-note">容器内存与 docker stats 口径一致，不等同于 JVM 堆。容器 CPU 使用率可超过 100%；宿主机内存已用量为总量减可用量，磁盘只统计根文件系统。</p>
      </section>
    </template>
    <el-empty v-else-if="!loading" description="尚无可用的服务器资源快照" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import EChart from '@/components/EChart.vue'
import { ruoyiApi } from '@/api'
import { createResourcePoller, formatBytes, formatPercent, formatUptime, type ResourceResponse } from '@/utils/resource-monitor'

const response = ref<ResourceResponse | null>(null)
const transportError = ref(''), loading = ref(false), paused = ref(false), now = ref(Date.now())
const snapshot = computed(() => response.value?.available ? response.value.snapshot : null)
const host = computed(() => snapshot.value?.host)
const stale = computed(() => {
  if (!response.value || response.value.stale) return true
  const at = snapshot.value ? Date.parse(snapshot.value.sampledAt) : NaN
  return !Number.isFinite(at) || now.value - at > 30000 || now.value - at < -5000
})
const services: Record<string, string> = { api: '后端 API', gateway: '网关', minio: '图片存储' }
const states: Record<string, string> = { running: '运行中', exited: '已停止', restarting: '重启中', paused: '已暂停', created: '已创建', dead: '异常' }
function time(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false }) }
const chartOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' }, legend: { data: ['CPU', '内存'] },
  grid: { left: 55, right: 20, top: 45, bottom: 40 },
  xAxis: { type: 'category', boundaryGap: false, data: snapshot.value?.history.map(r => new Date(r.sampledAt).toLocaleTimeString('zh-CN', { hour12: false })) || [] },
  yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
  series: [
    { name: 'CPU', type: 'line', showSymbol: false, connectNulls: false, data: snapshot.value?.history.map(r => r.cpuPercent) || [], itemStyle: { color: '#10b981' } },
    { name: '内存', type: 'line', showSymbol: false, data: snapshot.value?.history.map(r => r.memoryPercent) || [], itemStyle: { color: '#6b7280' } }
  ]
}))
const poller = createResourcePoller(
  () => ruoyiApi.getOne<ResourceResponse>('monitor/resources'),
  value => { response.value = value; transportError.value = ''; now.value = Date.now() },
  error => { transportError.value = error instanceof Error ? error.message : '请求失败'; now.value = Date.now() },
  value => { loading.value = value; now.value = Date.now() }
)
function visibility() { paused.value = document.hidden; if (document.hidden) poller.pause(); else poller.resume() }
onMounted(() => { document.addEventListener('visibilitychange', visibility); visibility() })
onBeforeUnmount(() => { document.removeEventListener('visibilitychange', visibility); poller.dispose() })
</script>

<style scoped>
.resource-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
h2 { margin: 0; font-size: 20px; } h3 { margin: 0 0 12px; font-size: 15px; }
.resource-head p, .trend p { margin: 8px 0 16px; font-size: 13px; }
.sample-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin: 16px 0; color: #667085; font-size: 13px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
.metric { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.metric-label { color: #667085; font-size: 13px; }.metric strong { font-size: 28px; line-height: 1.3; }
.metric strong.uptime { font-size: 20px; }.metric > span:not(.metric-label) { color: #667085; font-size: 12px; }
.trend { margin-bottom: 16px; }.scope-note { color: #667085; line-height: 1.7; font-size: 12px; margin: 14px 0 0; }
.resource-page > .el-alert { margin-top: 12px; }
@media (max-width: 1100px) { .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .metric-grid { grid-template-columns: 1fr; } }
</style>
