<template>
  <el-popover v-if="available" v-model:visible="visible" trigger="click" placement="bottom-end" :width="320" popper-class="work-reminders-popover" @show="refresh">
    <template #reference>
      <button class="mail-button" :class="{ 'has-messages': hasMessages }" type="button" :aria-label="hasMessages ? `待办消息，${summary.total}条未读` : '待办消息'" :aria-expanded="visible">
        <el-icon :size="20"><Message /></el-icon><span v-if="hasMessages" class="mail-dot" aria-hidden="true"></span>
      </button>
    </template>
    <div class="mail-panel">
      <div class="mail-heading"><strong>待办消息</strong><span><el-button link type="primary" :loading="reading" :disabled="!hasMessages || reading" @click="markRead()">全部已读</el-button><el-button link type="primary" :loading="loading" :disabled="reading" @click="refresh">刷新</el-button></span></div>
      <p class="mail-hint">医生、提现、文章、食品审核及举报、反馈、血糖提醒</p>
      <div v-if="error" class="mail-error" role="status"><span>{{ error }}</span><el-button link type="primary" @click="refresh">重试</el-button></div>
      <div v-if="!ready && loading" class="mail-empty">正在加载消息…</div>
      <template v-else-if="summary.items.length">
        <div v-for="item in summary.items" :key="item.type" class="mail-row">
          <button class="mail-item" type="button" @click="open(item)">
            <span class="mail-kind" :class="['REPORT','GLUCOSE_UPDATE','GLUCOSE_PENDING'].includes(item.type) ? 'report-kind' : 'feedback-kind'"><el-icon><Warning v-if="['REPORT','GLUCOSE_UPDATE','GLUCOSE_PENDING'].includes(item.type)" /><Apple v-else-if="item.type === 'FOOD_REVIEW'" /><FirstAidKit v-else-if="item.type === 'DOCTOR_REVIEW'" /><Wallet v-else-if="item.type === 'WITHDRAWAL_REVIEW'" /><DocumentChecked v-else-if="item.type === 'ARTICLE_REVIEW'" /><ChatLineSquare v-else /></el-icon></span>
            <span class="mail-copy"><span class="mail-title">{{ item.title }}<span v-if="item.count > 0" class="mail-count">{{ item.count > 99 ? '99+' : item.count }}</span><span v-else class="mail-read-label">已读</span></span><span class="mail-subtitle">{{ item.pendingCount ?? item.count }} 条{{ item.type === 'GLUCOSE_UPDATE' ? '记录已更新' : '待处理' }}<span v-if="item.latestAt"> · {{ time(item.latestAt) }}</span></span></span>
            <el-icon class="mail-arrow"><ArrowRight /></el-icon>
          </button>
          <el-button v-if="item.count > 0" class="mail-read-action" link type="primary" :disabled="reading" @click="markRead(item)">标为已读</el-button>
        </div>
      </template>
      <div v-else-if="ready && !error" class="mail-empty"><el-icon :size="30"><CircleCheck /></el-icon><span>暂时没有待处理消息</span></div>
      <p class="mail-footer">已读不代表已处理 · 每 5 秒检查</p>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { Message, Warning, ChatLineSquare, Apple, ArrowRight, CircleCheck, FirstAidKit, Wallet, DocumentChecked } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { getAccessToken } from '@/utils/request'
import { createResourcePoller } from '@/utils/resource-monitor'
import { WORK_REMINDERS_CHANGED, workReminderTarget } from '@/utils/work-reminders'
import { workRemindersApi, type WorkReminder, type WorkReminderSummary } from '@/api/work-reminders'

const auth = useAuthStore(), router = useRouter()
const available = computed(() => auth.isLoggedIn && ['content:news:list', 'feedback:manage', 'food:library:manage', 'health:alert:view', 'doctor:review:manage', 'doctor:withdrawal:manage'].some(code => auth.hasPermission(code)))
const summary = ref<WorkReminderSummary>({ total: 0, items: [] }), visible = ref(false), loading = ref(false), ready = ref(false), error = ref('')
const hasMessages = computed(() => summary.value.total > 0)
const reading = ref(false)
let readGeneration = 0
let poller: ReturnType<typeof createResourcePoller> | undefined
const time = (value: string) => value.replace('T', ' ').slice(5, 16)
function refresh() { poller?.refresh() }
function visibility() { if (document.visibilityState === 'hidden' || reading.value) poller?.pause(); else poller?.resume() }
function changed() { poller?.pause(); visibility() }
function reset() {
  readGeneration++; reading.value = false
  poller?.dispose(); poller = undefined
  summary.value = { total: 0, items: [] }; ready.value = false; error.value = ''; visible.value = false; loading.value = false
  if (!available.value) return
  const account = auth.account?.id, token = getAccessToken()
  const current = () => auth.account?.id === account && getAccessToken() === token && available.value
  poller = createResourcePoller(workRemindersApi.summary,
    data => { if (current()) { summary.value = data; ready.value = true; error.value = '' } },
    () => { if (current()) error.value = ready.value ? '更新失败，显示上次结果' : '消息加载失败' },
    value => { loading.value = value }, 5000)
  visibility()
}
function open(item: WorkReminder) {
  visible.value = false
  void router.push(workReminderTarget(item.type, Date.now(), item.recordId))
}
async function markRead(item?: WorkReminder) {
  if (reading.value || !available.value) return
  const selected = (item ? [item] : summary.value.items).filter(row => row.count > 0 && row.revision)
  if (!selected.length) return
  const account = auth.account?.id, token = getAccessToken(), generation = ++readGeneration
  const current = () => account === auth.account?.id && token === getAccessToken() && generation === readGeneration && available.value
  reading.value = true; poller?.pause()
  try {
    await workRemindersApi.read(Object.fromEntries(selected.map(row => [row.type, row.revision])))
    if (!current()) return
    const kinds = new Set(selected.map(row => row.type))
    summary.value = { ...summary.value, items: summary.value.items.map(row => kinds.has(row.type) ? { ...row, count: 0 } : row) }
    summary.value.total = summary.value.items.reduce((total, row) => total + Number(row.count), 0)
    ElMessage.success('已标为已读，待办仍可继续处理')
  } catch (failure) {
    if (current()) ElMessage.warning(failure instanceof Error ? failure.message : '标记失败，请重试')
  } finally {
    if (current()) { reading.value = false; visibility() }
  }
}
watch(() => [auth.account?.id, auth.account?.permissions?.join('|'), available.value], reset, { immediate: true })
onMounted(() => {
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('focus', refresh)
  window.addEventListener(WORK_REMINDERS_CHANGED, changed)
})
onBeforeUnmount(() => {
  readGeneration++
  poller?.dispose()
  document.removeEventListener('visibilitychange', visibility)
  window.removeEventListener('focus', refresh)
  window.removeEventListener(WORK_REMINDERS_CHANGED, changed)
})
</script>

<style scoped>
.mail-panel{max-height:min(680px,calc(100vh - 110px));overflow-y:auto;padding-right:4px}
.mail-row{position:relative}.mail-row .mail-item{padding-bottom:32px}.mail-read-action{position:absolute;right:12px;bottom:9px;font-size:12px}.mail-read-label{font-size:11px;color:var(--kt-muted);font-weight:400}
.mail-button{position:relative;display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:10px;background:transparent;color:var(--kt-muted);cursor:pointer;transition:background .18s,color .18s,transform .18s}.mail-button:hover,.mail-button:focus-visible{background:var(--kt-brand-soft);color:var(--kt-brand)}.mail-button:focus-visible{outline:2px solid var(--kt-brand);outline-offset:2px}.mail-button:active{transform:scale(.94)}.has-messages{color:var(--kt-ink)}.mail-dot{position:absolute;top:4px;right:3px;width:7px;height:7px;border-radius:50%;background:#ef4444;border:2px solid var(--kt-surface);box-sizing:content-box}.mail-panel{color:var(--kt-ink)}.mail-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.mail-heading strong{font-size:15px}.mail-hint{margin:3px 0 14px;font-size:12px;color:var(--kt-muted)}.mail-item{display:flex;align-items:center;gap:11px;width:100%;padding:13px 10px;margin:5px 0;text-align:left;border:1px solid var(--kt-line);border-radius:12px;background:var(--kt-surface);color:var(--kt-ink);cursor:pointer;transition:transform .18s,background .18s,border-color .18s}.mail-item:hover,.mail-item:focus-visible{background:var(--kt-brand-soft);border-color:var(--kt-brand)}.mail-item:active{transform:scale(.98)}.mail-kind{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:11px;font-size:19px}.report-kind{color:#d97706;background:#fff5df}.feedback-kind{color:#2563eb;background:#edf4ff}.mail-copy{flex:1;min-width:0}.mail-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}.mail-count{padding:1px 6px;background:#fff0f0;color:#dc2626;border-radius:8px;font-size:11px;line-height:16px}.mail-subtitle{display:block;margin-top:5px;color:var(--kt-muted);font-size:11px;white-space:normal;line-height:1.5}.mail-arrow{color:var(--kt-muted);font-size:13px}.mail-empty{display:flex;flex-direction:column;align-items:center;gap:11px;padding:29px 8px;color:var(--kt-muted);font-size:13px}.mail-empty .el-icon{color:var(--kt-brand)}.mail-footer{margin:14px 0 0;padding-top:11px;border-top:1px solid var(--kt-line);font-size:11px;color:var(--kt-muted);text-align:center}.mail-error{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff5f5;color:#c24141;padding:8px 10px;border-radius:8px;font-size:12px;margin-bottom:10px}@media(prefers-reduced-motion:reduce){.mail-button,.mail-item{transition:none}}
</style>
