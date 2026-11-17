import { get, put } from '@/utils/request'

export type WorkReminderType = 'REPORT' | 'FEEDBACK' | 'FOOD_REVIEW' | 'GLUCOSE_UPDATE'
export interface WorkReminder { type: WorkReminderType; title: string; count: number; latestAt: string | null; pendingCount: number; revision: string; recordId: string | null }
export interface WorkReminderSummary { total: number; items: WorkReminder[] }
export const workRemindersApi = {
  summary: () => get<WorkReminderSummary>('/admin/v1/work-reminders'),
  read: (revisions: Partial<Record<WorkReminderType, string>>) => put('/admin/v1/work-reminders/read', { revisions })
}
