<template>
  <el-popover v-if="available" v-model:visible="visible" trigger="click" placement="bottom-end" :width="320" popper-class="work-reminders-popover" @show="refresh">
    <template #reference>
      <button class="mail-button" :class="{ 'has-messages': hasMessages }" type="button" :aria-label="hasMessages ? `待办消息，${summary.total}条待处理` : '待办消息'" :aria-expanded="visible">
        <el-icon :size="20"><Message /></el-icon><span v-if="hasMessages" class="mail-dot" aria-hidden="true"></span>
      </button>
    </template>
    <div class="mail-panel">
      <div class="mail-heading"><strong>待办消息</strong><el-button link type="primary" :loading="loading" @click="refresh">刷新</el-button></div>
      <p class="mail-hint">举报、反馈和待审核食品会在这里提醒</p>
      <div v-if="error" class="mail-error" role="status"><span>{{ error }}</span><el-button link type="primary" @click="refresh">重试</el-button></div>
      <div v-if="!ready && loading" class="mail-empty">正在加载消息…</div>
      <template v-else-if="summary.items.length">
        <button v-for="item in summary.items" :key="item.type" class="mail-item" type="button" @click="open(item)">
          <span class="mail-kind" :class="item.type === 'REPORT' ? 'report-kind' : 'feedback-kind'"><el-icon><Warning v-if="item.type === 'REPORT'" /><Apple v-else-if="item.type === 'FOOD_REVIEW'" /><ChatLineSquare v-else /></el-icon></span>
          <span class="mail-copy"><span class="mail-title">{{ item.title }}<span class="mail-count">{{ item.count > 99 ? '99+' : item.count }}</span></span><span class="mail-subtitle">{{ item.count }} 条待处理<span v-if="item.latestAt"> · {{ time(item.latestAt) }}</span></span></span>
          <el-icon class="mail-arrow"><ArrowRight /></el-icon>
        </button>
      </template>
      <div v-else-if="ready && !error" class="mail-empty"><el-icon :size="30"><CircleCheck /></el-icon><span>暂时没有待处理消息</span></div>
      <p class="mail-footer">处理后自动更新 · 每 5 秒检查</p>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Message, Warning, ChatLineSquare, Apple, ArrowRight, CircleCheck } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { getAccessToken } from '@/utils/request'
import { createResourcePoller } from '@/utils/resource-monitor'
import { WORK_REMINDERS_CHANGED, workReminderTarget } from '@/utils/work-reminders'
import { workRemindersApi, type WorkReminder, type WorkReminderSummary } from '@/api/work-reminders'

const auth = useAuthStore(), router = useRouter()
const available = computed(() => auth.isLoggedIn && (auth.hasPermission('content:news:list') || auth.hasPermission('feedback:manage') || auth.hasPermission('food:library:manage')))
const summary = ref<WorkReminderSummary>({ total: 0, items: [] }), visible = ref(false), loading = ref(false), ready = ref(false), error = ref('')
const hasMessages = computed(() => summary.value.total > 0)
let poller: ReturnType<typeof createResourcePoller> | undefined
const time = (value: string) => value.replace('T', ' ').slice(5, 16)
function refresh() { poller?.refresh() }
function visibility() { if (document.visibilityState === 'hidden') poller?.pause(); else poller?.resume() }
function changed() { poller?.pause(); visibility() }
function reset() {
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
  void router.push(workReminderTarget(item.type))
}
watch(() => [auth.account?.id, auth.account?.permissions?.join('|'), available.value], reset, { immediate: true })
onMounted(() => {
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('focus', refresh)
  window.addEventListener(WORK_REMINDERS_CHANGED, changed)
})
onBeforeUnmount(() => {
  poller?.dispose()
  document.removeEventListener('visibilitychange', visibility)
  window.removeEventListener('focus', refresh)
  window.removeEventListener(WORK_REMINDERS_CHANGED, changed)
})
</script>

<style scoped>
.mail-button{position:relative;display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:10px;background:transparent;color:var(--kt-muted);cursor:pointer;transition:background .18s,color .18s,transform .18s}.mail-button:hover,.mail-button:focus-visible{background:var(--kt-brand-soft);color:var(--kt-brand)}.mail-button:focus-visible{outline:2px solid var(--kt-brand);outline-offset:2px}.mail-button:active{transform:scale(.94)}.has-messages{color:var(--kt-ink)}.mail-dot{position:absolute;top:4px;right:3px;width:7px;height:7px;border-radius:50%;background:#ef4444;border:2px solid var(--kt-surface);box-sizing:content-box}.mail-panel{color:var(--kt-ink)}.mail-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.mail-heading strong{font-size:15px}.mail-hint{margin:3px 0 14px;font-size:12px;color:var(--kt-muted)}.mail-item{display:flex;align-items:center;gap:11px;width:100%;padding:13px 10px;margin:5px 0;text-align:left;border:1px solid var(--kt-line);border-radius:12px;background:var(--kt-surface);color:var(--kt-ink);cursor:pointer;transition:transform .18s,background .18s,border-color .18s}.mail-item:hover,.mail-item:focus-visible{background:var(--kt-brand-soft);border-color:var(--kt-brand)}.mail-item:active{transform:scale(.98)}.mail-kind{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:11px;font-size:19px}.report-kind{color:#d97706;background:#fff5df}.feedback-kind{color:#2563eb;background:#edf4ff}.mail-copy{flex:1;min-width:0}.mail-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}.mail-count{padding:1px 6px;background:#fff0f0;color:#dc2626;border-radius:8px;font-size:11px;line-height:16px}.mail-subtitle{display:block;margin-top:5px;color:var(--kt-muted);font-size:11px;white-space:normal;line-height:1.5}.mail-arrow{color:var(--kt-muted);font-size:13px}.mail-empty{display:flex;flex-direction:column;align-items:center;gap:11px;padding:29px 8px;color:var(--kt-muted);font-size:13px}.mail-empty .el-icon{color:var(--kt-brand)}.mail-footer{margin:14px 0 0;padding-top:11px;border-top:1px solid var(--kt-line);font-size:11px;color:var(--kt-muted);text-align:center}.mail-error{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff5f5;color:#c24141;padding:8px 10px;border-radius:8px;font-size:12px;margin-bottom:10px}@media(prefers-reduced-motion:reduce){.mail-button,.mail-item{transition:none}}
</style>
