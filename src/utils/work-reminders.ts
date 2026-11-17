import type { WorkReminderType } from '@/api/work-reminders'

export const WORK_REMINDERS_CHANGED = 'glucopilot:work-reminders-changed'
export function refreshWorkReminders() {
  window.dispatchEvent(new Event(WORK_REMINDERS_CHANGED))
}
export function workReminderTarget(type: WorkReminderType, navigation = Date.now(), recordId?: string | null) {
  if (type === 'GLUCOSE_UPDATE') return { path: '/user-service/glucose-alerts', query: { reminder: String(navigation), ...(recordId ? { recordId } : {}) } }
  if (type === 'FOOD_REVIEW') return { path: '/nutrition/foods', query: { review: 'pending', reminder: String(navigation) } }
  return { path: type === 'REPORT' ? '/content/community-reports' : '/feedback', query: { reminder: String(navigation) } }
}
