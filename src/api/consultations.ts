import { get, post } from '@/utils/request'

export interface DoctorProfile {
  userId: string
  realName: string
  hospital: string
  specialty: string
  licenseNumber: string
  qualificationNote: string
  status: string
  reviewNote: string
  version: string | number
  createdAt: string
}
export const consultationApi = {
  page: (status: string, pageNum: number, pageSize: number) =>
    get<{ records: DoctorProfile[]; total: string | number }>(`/admin/v1/consultation-doctors?${new URLSearchParams({ status, pageNum: String(pageNum), pageSize: String(pageSize) })}`),
  review: (profile: DoctorProfile, status: string, reviewNote: string) =>
    post<DoctorProfile>(`/admin/v1/consultation-doctors/${encodeURIComponent(profile.userId)}/review`, { status, reviewNote, version: profile.version })
}
