import { get } from '@/utils/request'

export type WorkReminderType = 'REPORT' | 'FEEDBACK'
export interface WorkReminder { type: WorkReminderType; title: string; count: number; latestAt: string | null }
export interface WorkReminderSummary { total: number; items: WorkReminder[] }
export const workRemindersApi = {
  summary: () => get<WorkReminderSummary>('/admin/v1/work-reminders')
}
