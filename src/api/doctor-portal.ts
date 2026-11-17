import { get, post, put } from '@/utils/request'
import type { DoctorProfile } from './consultations'

export interface DoctorAccount {
  doctorUserId: string; realName: string; hospital: string; specialty: string; doctorStatus: string
  opsId: string | null; username: string | null; accountStatus: number
}
export interface CaseReport { id: string; access: string; ready: boolean; assessment?: string; medicationAdvice?: string; followUpAdvice?: string; doctorName?: string }
export interface DoctorCase {
  id: string; title: string; topic: string; status: string; patientName: string; createdAt: string
  detailsVisible: boolean; symptoms: string | null; glucoseNote: string | null; medicationNote: string | null
  canClaim: boolean; canReply: boolean; report: CaseReport | null
}
export interface Page<T> { records: T[]; total: string | number }
export interface IncomeEntry { orderNo: string; consultationId: string; amountCents: number; balanceAfterCents: string; createdAt: string }
export interface DoctorIncome { wallet: { balanceCents: string | null; activated: boolean }; entries: Page<IncomeEntry> }
const query = (pageNum: number, pageSize: number) => `pageNum=${pageNum}&pageSize=${pageSize}`
export const doctorApi = {
  accounts: (pageNum: number, pageSize: number) => get<Page<DoctorAccount>>(`/admin/v1/doctor-accounts?${query(pageNum,pageSize)}`),
  create: (id: string, form: { username: string; password: string }) => post(`/admin/v1/doctor-accounts/${encodeURIComponent(id)}`,form),
  update: (id: string, form: { status: number; password?: string }) => put(`/admin/v1/doctor-accounts/${encodeURIComponent(id)}`,form),
  permissions: () => get<{permissions: string[]}>('/admin/v1/doctor-role-permissions'),
  savePermissions: (permissions: string[]) => put('/admin/v1/doctor-role-permissions',{permissions}),
  workbench: (pageNum: number, pageSize: number) => get<{doctor: DoctorProfile; requests: Page<DoctorCase>}>(`/admin/v1/doctor/workbench?${query(pageNum,pageSize)}`),
  cases: (pageNum: number, pageSize: number) => get<Page<DoctorCase>>(`/admin/v1/doctor/consultations?${query(pageNum,pageSize)}`),
  detail: (id: string) => get<DoctorCase>(`/admin/v1/doctor/consultations/${encodeURIComponent(id)}`),
  claim: (id: string) => post<DoctorCase>(`/admin/v1/doctor/consultations/${encodeURIComponent(id)}/claim`,{}),
  report: (id: string, form: {assessment: string; medicationAdvice: string; followUpAdvice: string; clientRequestId: string}) => post<DoctorCase>(`/admin/v1/doctor/consultations/${encodeURIComponent(id)}/report`,form),
  income: (pageNum: number, pageSize: number) => get<DoctorIncome>(`/admin/v1/doctor/income?${query(pageNum,pageSize)}`)
}
