import { get, put } from '@/utils/request'

export type AlertStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'
export interface GlucoseAlert {
  id: string
  userId: string
  username: string
  nickname: string
  phoneMasked: string
  recordDate: string
  nodeCode: string
  nodeName: string
  glucoseValue: number
  recordedAt: string
  sourceType: number
  remark: string | null
  alertType: 'LOW' | 'HIGH'
  status: AlertStatus
  note: string | null
  version: number
  handledBy: string | null
  handledAt: string | null
  userReply: string | null
  repliedAt: string | null
}
export interface AlertHistory {
  id: string
  glucoseValue: number
  recordedAt: string
  fromStatus: AlertStatus
  toStatus: AlertStatus
  note: string
  operatorId: string
  operatedAt: string
  requestId: string | null
  userReply: string | null
}
export interface AlertDetail { event: GlucoseAlert; history: AlertHistory[] }
export type AlertFilters = { startDate: string; endDate: string; keyword?: string; alertType?: string; status?: string }
export interface AlertOverview {
  total: number; lowCount: number; highCount: number; pendingCount: number
  processingCount: number; resolvedCount: number; closedCount: number
}
export const emptyAlertOverview = (): AlertOverview => ({ total: 0, lowCount: 0, highCount: 0,
  pendingCount: 0, processingCount: 0, resolvedCount: 0, closedCount: 0 })

export async function pageGlucoseAlerts(query: AlertFilters & { pageNum: number; pageSize: number }) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
  const data = await get<{ page: { records: GlucoseAlert[]; total: number }; overview: AlertOverview }>(`/admin/v1/glucose-alerts?${params}`)
  return { ...data.page, overview: data.overview }
}
export const getGlucoseAlert = (id: string) => get<AlertDetail>(`/admin/v1/glucose-alerts/${encodeURIComponent(id)}`)
export const handleGlucoseAlert = (event: GlucoseAlert, status: Exclude<AlertStatus, 'PENDING'>, note: string, userReply?: string) =>
  put<GlucoseAlert>(`/admin/v1/glucose-alerts/${encodeURIComponent(event.id)}/handling`, {
    glucoseValue: event.glucoseValue, recordedAt: event.recordedAt, expectedVersion: event.version, status, note,
    ...(userReply === undefined ? {} : { userReply })
  })
