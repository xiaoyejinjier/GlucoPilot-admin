import type { WorkReminderSummary, WorkReminderType } from '@/api/work-reminders'

export const WORK_REMINDERS_CHANGED = 'glucopilot:work-reminders-changed'
export const WORK_REMINDERS_UPDATED = 'glucopilot:work-reminders-updated'
let reportSnapshot: { accountId: number | null; token: string; pending: number } | null = null

// 复用顶部信封的轮询结果，文章页不另起一套查询或定时器。
export function publishWorkReminderSummary(accountId: number | null | undefined, token: string, summary: WorkReminderSummary) {
  const report = summary.items.find(item => item.type === 'REPORT')
  const count = Number(report?.pendingCount ?? report?.count ?? 0)
  reportSnapshot = {
    accountId: accountId ?? null,
    token,
    pending: Number.isSafeInteger(count) && count > 0 ? count : 0
  }
  window.dispatchEvent(new Event(WORK_REMINDERS_UPDATED))
}

export function pendingReportCount(accountId: number | null | undefined, token: string) {
  return accountId != null && !!token && reportSnapshot?.accountId === accountId && reportSnapshot.token === token
    ? reportSnapshot.pending : 0
}

export function refreshWorkReminders() {
  window.dispatchEvent(new Event(WORK_REMINDERS_CHANGED))
}
export function workReminderTarget(type: WorkReminderType, navigation = Date.now(), recordId?: string | null) {
  if (type === 'DOCTOR_REVIEW') return { path: '/doctor-management/reviews', query: { status: 'PENDING', reminder: String(navigation) } }
  if (type === 'WITHDRAWAL_REVIEW') return { path: '/doctor-management/withdrawals', query: { status: 'PENDING', reminder: String(navigation) } }
  if (type === 'ARTICLE_REVIEW') return { path: '/content/community', query: { state: 'PENDING_ADMIN', reminder: String(navigation) } }
  if (type === 'GLUCOSE_PENDING') return { path: '/user-service/glucose-alerts', query: { status: 'PENDING', reminder: String(navigation), ...(recordId ? { recordId } : {}) } }
  if (type === 'GLUCOSE_UPDATE') return { path: '/user-service/glucose-alerts', query: { reminder: String(navigation), ...(recordId ? { recordId } : {}) } }
  if (type === 'FOOD_REVIEW') return { path: '/nutrition/foods', query: { review: 'pending', reminder: String(navigation) } }
  return { path: type === 'REPORT' ? '/content/community-reports' : '/feedback', query: { reminder: String(navigation) } }
}
