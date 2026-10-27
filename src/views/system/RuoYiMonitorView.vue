<template>
  <div class="page-wrap">
    <div class="head">
      <div><h2 class="page-title">{{ config.title }}</h2><p class="text-muted description">{{ config.description }}</p></div>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>
    <div class="kt-card" v-loading="loading">
      <template v-if="config.kind === 'server' || config.kind === 'cache'">
        <el-descriptions :column="2" border>
          <el-descriptions-item v-for="item in details" :key="item.key" :label="item.label">{{ item.value }}</el-descriptions-item>
        </el-descriptions>
      </template>
      <template v-else>
        <el-alert v-if="config.kind === 'online'" title="强退将使该会话立即失效，不会删除运营账号。" type="info" :closable="false" class="mb12" />
        <el-table :data="rows" row-key="id">
          <el-table-column v-for="column in config.columns" :key="column" :prop="column" :label="labels[column] || column" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ display(row[column]) }}</template>
          </el-table-column>
          <el-table-column v-if="config.kind === 'online'" label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-popconfirm title="确认强制退出该会话？" @confirm="forceLogout(row.id)"><template #reference><el-button link type="danger">强退</el-button></template></el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { ruoyiApi, type RuoYiRow } from '@/api'

type MonitorKind = 'online' | 'login-logs' | 'oper-logs' | 'job-logs' | 'server' | 'cache'
const configs: Record<MonitorKind, { title: string; description: string; kind: MonitorKind; resource: string; columns: string[] }> = {
  online: { title: '在线用户', description: '查看当前有效的运营后台会话。', kind: 'online', resource: 'online', columns: ['username', 'nickname', 'clientIp', 'userAgent', 'expireAt', 'createdAt'] },
  'login-logs': { title: '登录日志', description: '记录运营账号的登录成功与失败情况。', kind: 'login-logs', resource: 'login-logs', columns: ['username', 'loginStatus', 'loginMessage', 'clientIp', 'loginAt'] },
  'oper-logs': { title: '操作日志', description: '若依系统管理操作及业务写操作的审计轨迹。', kind: 'oper-logs', resource: 'oper-logs', columns: ['operatorName', 'title', 'businessType', 'requestParam', 'clientIp', 'operStatus', 'operAt'] },
  'job-logs': { title: '任务日志', description: '定时任务的执行结果与异常信息。', kind: 'job-logs', resource: 'job-logs', columns: ['jobName', 'jobGroup', 'invokeTarget', 'jobMessage', 'jobStatus', 'startAt', 'endAt'] },
  server: { title: '服务监控', description: '应用进程与在线会话的实时状态。', kind: 'server', resource: 'monitor/server', columns: [] },
  cache: { title: '缓存监控', description: '只检查 Redis 连通性；为保护团队共享数据，后台不会提供清空整个 Redis 的操作。', kind: 'cache', resource: 'monitor/cache', columns: [] }
}
const labels: Record<string, string> = { username: '账号', nickname: '昵称', clientIp: 'IP', userAgent: '用户代理', expireAt: '过期时间', createdAt: '登录时间', loginStatus: '结果', loginMessage: '说明', loginAt: '登录时间', operatorName: '操作人', title: '模块', businessType: '动作', requestParam: '详情', operStatus: '结果', operAt: '操作时间', jobName: '任务名称', jobGroup: '分组', invokeTarget: '调用目标', jobMessage: '执行结果', jobStatus: '状态', startAt: '开始时间', endAt: '结束时间' }
const route = useRoute()
const config = computed(() => configs[String(route.meta.ruoyiMonitor) as MonitorKind] || configs.online)
const loading = ref(false)
const rows = ref<RuoYiRow[]>([])
const info = ref<Record<string, unknown>>({})
const details = computed(() => Object.entries(info.value).map(([key, value]) => ({ key, label: labels[key] || key, value: display(value) })))

let loadVersion = 0
async function load() {
  const version = ++loadVersion
  const { kind, resource } = config.value
  loading.value = true
  try {
    if (kind === 'server' || kind === 'cache') {
      const result = await ruoyiApi.getOne<Record<string, unknown>>(resource)
      if (version === loadVersion) info.value = result
    } else {
      const result = await ruoyiApi.list<RuoYiRow>(resource)
      if (version === loadVersion) rows.value = result
    }
  } catch (error) {
    if (version === loadVersion) ElMessage.error((error as Error).message || '加载失败')
  } finally {
    if (version === loadVersion) loading.value = false
  }
}
async function forceLogout(id: string | number) {
  try { await ruoyiApi.remove('online', id); ElMessage.success('会话已强退'); await load() }
  catch (error) { ElMessage.error((error as Error).message || '强退失败') }
}
function display(value: unknown) {
  if (value === true) return '是'
  if (value === false) return '否'
  if (value === 1 || value === '1') return '成功/启用'
  if (value === 0 || value === '0') return '失败/停用'
  return value == null || value === '' ? '—' : String(value)
}
// Monitoring routes share this component; each resource needs its own data.
watch(() => config.value.resource, () => {
  rows.value = []
  info.value = {}
  void load()
}, { immediate: true })
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 18px; }.description { margin: 6px 0 0; font-size: 13px; }.mb12 { margin-bottom: 12px; }
</style>
