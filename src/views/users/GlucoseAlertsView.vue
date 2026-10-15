<template>
  <div class="alerts-page">
    <div class="alerts-heading">
      <div><h2>异常血糖事件中心</h2><p class="text-muted">查看实测高低血糖提醒，记录跟进过程与处理结果</p></div>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </div>
    <div class="kt-card filters">
      <el-form :inline="true" @submit.prevent="search">
        <el-form-item label="记录日期"><el-date-picker v-model="dates" type="daterange" value-format="YYYY-MM-DD" :clearable="false" range-separator="至" /></el-form-item>
        <el-form-item label="用户"><el-input v-model="keyword" maxlength="64" placeholder="用户名 / 昵称" clearable @keyup.enter="search" /></el-form-item>
        <el-form-item label="异常类型"><el-select v-model="alertType" placeholder="全部" clearable style="width:130px"><el-option label="低值提醒" value="LOW" /><el-option label="高值提醒" value="HIGH" /></el-select></el-form-item>
        <el-form-item label="处理状态"><el-select v-model="status" placeholder="全部" clearable style="width:130px"><el-option v-for="(label, key) in labels" :key="key" :label="label" :value="key" /></el-select></el-form-item>
        <el-form-item><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
      </el-form>
      <el-alert title="提醒规则：实测值低于 3.9 或达到 10.0 mmol/L。处理仅记录运营跟进，不修改原始血糖；已处理不表示血糖已恢复正常。" type="info" :closable="false" show-icon />
    </div>
    <div class="overview">
      <div v-for="card in cards" :key="card.label" class="kt-card overview-card"><span>{{ card.label }}</span><strong :style="{ color: card.color }">{{ card.value }}</strong></div>
    </div>
    <div class="kt-card">
      <div v-if="loadFailed" class="load-error">事件加载失败，请点击“刷新”重试。</div>
      <el-table v-loading="loading" :data="records" row-key="id" stripe border empty-text="当前筛选范围内暂无异常血糖" :max-height="720">
        <el-table-column label="序号" width="70" align="center"><template #default="{ $index }">{{ (page.pageNum - 1) * page.pageSize + $index + 1 }}</template></el-table-column>
        <el-table-column label="用户" min-width="150"><template #default="{ row }"><strong>{{ row.nickname }}</strong><div class="text-muted">{{ row.username }} · {{ row.phoneMasked || '未绑定手机' }}</div></template></el-table-column>
        <el-table-column prop="recordDate" label="日期" width="115" />
        <el-table-column prop="nodeName" label="时段" width="100" />
        <el-table-column label="实测血糖" width="145"><template #default="{ row }"><strong :class="['glucose-value', row.alertType.toLowerCase()]">{{ row.glucoseValue }} <small>mmol/L</small></strong></template></el-table-column>
        <el-table-column label="类型" width="105"><template #default="{ row }"><el-tag :type="row.alertType === 'LOW' ? 'danger' : 'warning'">{{ row.alertType === 'LOW' ? '低值提醒' : '高值提醒' }}</el-tag></template></el-table-column>
        <el-table-column label="来源" width="100"><template #default="{ row }">{{ sources[row.sourceType] || '未知' }}</template></el-table-column>
        <el-table-column label="记录时间" width="185"><template #default="{ row }"><span class="time">{{ formatTime(row.recordedAt) }}</span></template></el-table-column>
        <el-table-column label="状态" width="105"><template #default="{ row }"><el-tag :type="tagType(row.status)">{{ labels[row.status as AlertStatus] }}</el-tag></template></el-table-column>
        <el-table-column prop="note" label="内部备注（用户不可见）" min-width="200" show-overflow-tooltip><template #default="{ row }">{{ row.note || '尚未处理' }}</template></el-table-column>
        <el-table-column prop="userReply" label="给用户的回复" min-width="200" show-overflow-tooltip><template #default="{ row }">{{ row.userReply || '未发布回复' }}</template></el-table-column>
        <el-table-column label="操作" width="135" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openDetail(row.id)">{{ canHandle(row) ? '查看并处理' : canReply() ? '查看 / 回复' : '查看详情' }}</el-button></template></el-table-column>
      </el-table>
      <TablePagination :page-num="page.pageNum" :page-size="page.pageSize" :total="page.total" :summary="pageSummary" :disabled="loading" @size-change="changeSize" @page-change="changePage" />
    </div>

    <el-drawer v-model="drawerOpen" title="异常事件详情与跟进" size="min(680px, 96vw)" :before-close="beforeClose">
      <div v-loading="detailLoading" class="detail-body">
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" show-icon />
        <el-button v-if="detailError" class="retry" @click="openDetail(activeId)">重新加载详情</el-button>
        <template v-if="detail">
          <div :class="['event-summary', detail.event.alertType.toLowerCase()]">
            <div>{{ detail.event.nickname }} · {{ detail.event.recordDate }} · {{ detail.event.nodeName }}</div>
            <strong>{{ detail.event.glucoseValue }} <small>mmol/L · {{ detail.event.alertType === 'LOW' ? '低值提醒' : '高值提醒' }}</small></strong>
            <div>{{ labels[detail.event.status] }} · {{ formatTime(detail.event.recordedAt) }}</div>
          </div>
          <p class="full-text">原始备注：{{ detail.event.remark || '无' }}</p>
          <div class="public-reply">
            <strong>给用户的回复（用户可见）</strong>
            <p class="full-text">{{ detail.event.userReply || '尚未发布回复' }}</p>
            <span v-if="detail.event.repliedAt" class="text-muted">回复时间：{{ formatTime(detail.event.repliedAt) }}</span>
          </div>
          <el-divider />
          <h3>处理记录</h3>
          <el-empty v-if="!detail.history.length" description="尚无处理记录" :image-size="60" />
          <el-timeline v-else>
            <el-timeline-item v-for="log in detail.history" :key="log.id" :timestamp="formatTime(log.operatedAt)" placement="top">
              <strong>{{ labels[log.fromStatus] }} → {{ labels[log.toStatus] }}</strong>
              <p class="full-text">内部备注：{{ log.note }}</p>
              <p class="full-text public-log">用户回复：{{ log.userReply || '未发布回复' }}</p>
              <div class="text-muted">处理人 #{{ log.operatorId }} · 对应实测 {{ log.glucoseValue }} mmol/L · {{ formatTime(log.recordedAt) }}</div>
            </el-timeline-item>
          </el-timeline>
          <template v-if="canReply()">
            <el-divider /><h3>{{ canHandle(detail.event) ? '填写跟进结果及用户回复' : '补充 / 修改用户回复' }}</h3>
            <p v-if="!canHandle(detail.event)" class="text-muted">本次事件已结束，可修改给用户的回复，内部备注和处理状态保持不变。</p>
            <el-form label-position="top" @submit.prevent="save">
              <el-form-item label="处理状态" required><el-select v-model="handlingStatus" :disabled="saving || !canHandle(detail.event)" style="width:100%"><el-option label="跟进中" value="PROCESSING" /><el-option label="已处理" value="RESOLVED" /><el-option label="已关闭" value="CLOSED" /></el-select></el-form-item>
              <el-form-item label="内部备注（仅后台可见）" required><el-input v-model="note" type="textarea" :rows="3" maxlength="1000" show-word-limit placeholder="填写联系情况、核对结果或关闭原因" :disabled="saving || !canHandle(detail.event)" /></el-form-item>
              <el-form-item label="给用户的回复（用户可见）"><el-input v-model="userReply" type="textarea" :rows="4" maxlength="1000" show-word-limit placeholder="填写需要用户看到的反馈，用户可在小程序记录页查看" :disabled="saving" /></el-form-item>
              <p class="text-muted">留空不发布回复；清空已有回复后保存，将撤回公开内容。内部备注不会发送给用户。</p>
              <el-button type="primary" :loading="saving" @click="save">{{ canHandle(detail.event) ? '保存处理记录及回复' : '保存用户回复' }}</el-button>
            </el-form>
          </template>
          <el-alert v-else :title="auth.hasPermission('health:alert:handle') ? '本次事件已结束，处理记录已保留。新的测量异常将作为新快照待处理。' : '当前账号只有查看权限。'" type="info" :closable="false" />
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import TablePagination from '@/components/TablePagination.vue'
import { useServerPagination } from '@/composables/useServerPagination'
import { useAuthStore } from '@/stores/auth'
import { pageGlucoseAlerts, getGlucoseAlert, handleGlucoseAlert, emptyAlertOverview } from '@/api/glucose-alerts'
import type { AlertDetail, AlertFilters, AlertStatus, GlucoseAlert } from '@/api/glucose-alerts'

const auth = useAuthStore()
const labels: Record<AlertStatus, string> = { PENDING: '待处理', PROCESSING: '跟进中', RESOLVED: '已处理', CLOSED: '已关闭' }
const sources: Record<number, string> = { 1: '手动录入', 2: '拍照识别', 3: '设备同步' }
function dateText(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function defaultDates(): [string, string] { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return [dateText(start), dateText(end)] }
const dates = ref<[string, string]>(defaultDates())
const keyword = ref(''), alertType = ref(''), status = ref('')
const overview = ref(emptyAlertOverview()), loadFailed = ref(false)
const initial: AlertFilters = { startDate: dates.value[0], endDate: dates.value[1] }
const { page, records, loading, pageSummary, load, search: applyFilters, changeSize, changePage } = useServerPagination<GlucoseAlert, AlertFilters, Awaited<ReturnType<typeof pageGlucoseAlerts>>>(pageGlucoseAlerts, initial, {
  errorMessage: '异常事件加载失败',
  onLoaded: (data) => { overview.value = data.overview; loadFailed.value = false },
  onError: () => { overview.value = emptyAlertOverview(); loadFailed.value = true }
})
const cards = computed(() => [
  { label: '异常总记录', value: overview.value.total, color: 'var(--kt-text)' },
  { label: '待处理', value: overview.value.pendingCount, color: '#dc2626' },
  { label: '跟进中', value: overview.value.processingCount, color: '#d97706' },
  { label: '已处理 / 已关闭', value: `${overview.value.resolvedCount} / ${overview.value.closedCount}`, color: '#16a34a' }
])
function search() {
  if (!dates.value?.[0] || !dates.value?.[1]) { ElMessage.warning('请选择记录日期范围'); return }
  return applyFilters({ startDate: dates.value[0], endDate: dates.value[1], keyword: keyword.value.trim() || undefined, alertType: alertType.value || undefined, status: status.value || undefined })
}
function reset() { dates.value = defaultDates(); keyword.value = ''; alertType.value = ''; status.value = ''; return search() }
function formatTime(value: string | null) { return value ? value.replace('T', ' ').replace(/\.\d+$/, '') : '—' }
function tagType(value: AlertStatus): 'danger' | 'warning' | 'success' | 'info' { return ({ PENDING: 'danger', PROCESSING: 'warning', RESOLVED: 'success', CLOSED: 'info' } as const)[value] }
function canHandle(event: GlucoseAlert) { return auth.hasPermission('health:alert:handle') && (event.status === 'PENDING' || event.status === 'PROCESSING') }
function canReply() { return auth.hasPermission('health:alert:handle') }

const drawerOpen = ref(false), detailLoading = ref(false), saving = ref(false), detailError = ref(''), activeId = ref('')
const detail = ref<AlertDetail | null>(null)
const handlingStatus = ref<Exclude<AlertStatus, 'PENDING'>>('PROCESSING'), note = ref(''), userReply = ref('')
let detailVersion = 0, alive = true
async function openDetail(id: string) {
  const version = ++detailVersion
  activeId.value = id; drawerOpen.value = true; detail.value = null; detailError.value = ''; detailLoading.value = true
  try {
    const data = await getGlucoseAlert(id)
    if (!alive || version !== detailVersion) return
    detail.value = data
    handlingStatus.value = data.event.status === 'PENDING' ? 'PROCESSING' : data.event.status
    note.value = data.event.note || ''; userReply.value = data.event.userReply || ''
  } catch (error) {
    if (alive && version === detailVersion) detailError.value = error instanceof Error ? error.message : '详情读取失败'
  } finally { if (alive && version === detailVersion) detailLoading.value = false }
}
function beforeClose(done: () => void) { if (!saving.value) { ++detailVersion; done() } }
async function save() {
  if (!detail.value || saving.value || !canReply()) return
  if (!note.value.trim()) { ElMessage.warning('请填写处理备注'); return }
  const event = detail.value.event
  saving.value = true
  try {
    await handleGlucoseAlert(event, handlingStatus.value, note.value.trim(), userReply.value.trim())
    if (!alive) return
    ElMessage.success('处理结果已保存')
    await Promise.all([openDetail(event.id), load()])
  } catch (error) {
    if (!alive) return
    ElMessage.error(error instanceof Error ? error.message : '保存失败，请重试')
    const code = (error as { code?: number }).code
    if (code === 40900 || code === 40400) { await Promise.all([openDetail(event.id), load()]) }
  } finally { if (alive) saving.value = false }
}
onMounted(load)
onBeforeUnmount(() => { alive = false; ++detailVersion })
</script>

<style scoped>
.alerts-page { padding: 24px; }
.alerts-heading { display:flex; justify-content:space-between; align-items:center; gap:20px; margin-bottom:28px; }
.alerts-heading h2 { margin:0 0 12px; font-size:24px; }
.alerts-heading p { margin:0; line-height:1.8; }
.filters { margin-bottom:24px; }
.overview { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:20px; margin-bottom:28px; }
.overview-card { display:flex; flex-direction:column; gap:18px; color:var(--kt-muted); }
.overview-card strong { font-size:30px; }
.time { white-space:nowrap; }
.glucose-value { font-size:18px; }
.glucose-value small { font-size:11px; font-weight:400; }
.low { color:#b91c1c; }
.high { color:#b45309; }
.event-summary { padding:22px; border-radius:12px; background:#fff7ed; line-height:1.8; }
.event-summary.low { background:#fef2f2; }
.event-summary strong { display:block; margin:14px 0; font-size:30px; }
.event-summary small { font-size:14px; }
.full-text { white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.8; }
.detail-body h3 { margin:24px 0; }
.retry { margin-top:16px; }
.load-error { margin-bottom:16px; color:#b91c1c; }
.public-reply { padding:18px; border:1px solid #cce8d9; border-radius:10px; background:#f1faf5; margin-top:20px; }
.public-log { color:#246647; }
@media(max-width:1000px) { .overview { grid-template-columns:repeat(2,minmax(0,1fr)); } .alerts-page { padding:16px; } }
</style>
