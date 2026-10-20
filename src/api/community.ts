import { get, post } from '@/utils/request'

export interface CommunityTag { code: string; name: string }
export interface CommunityArticle {
  id: string; title: string; summary: string; body: string; tags: CommunityTag[]
  images?: { mediaId:string }[]
  videos?: { mediaId:string }[]
  author: { nickname: string; key: string } | null
  source: 'OFFICIAL' | 'COMMUNITY'
  state: string; revision: number; aiVerdict: string; aiReason: string; aiModel: string
  reviewNote: string; createdAt: string; publishAt: string
}
export interface CommunityReport {
  id: string; target_type: string; target_id: string; reporter_id: string
  reason: string; details: string; state: string; created_at: string
  target_content: string; resolution?: string; resolution_note?: string; resolved_at?: string
}
export interface CommunityPage<T> { records: T[]; total: number; pages: number; pageNum: number; pageSize: number }
function query(values: Record<string, string | number>) {
  return new URLSearchParams(Object.entries(values).filter(([,v]) => v !== '').map(([k,v]) => [k,String(v)])).toString()
}
export const communityApi = {
  articles: (status: string, pageNum: number, source = '', keyword = '') => get<CommunityPage<CommunityArticle>>(`/admin/v1/community/articles?${query({ status, source, keyword: keyword.trim(), pageNum, pageSize: 10 })}`),
  article: (id: string) => get<CommunityArticle>(`/admin/v1/community/articles/${encodeURIComponent(id)}`),
  review: (article: CommunityArticle, decision: string, note: string) => post<CommunityArticle>(`/admin/v1/community/articles/${encodeURIComponent(article.id)}/review`, { revision: article.revision, decision, note }),
  retryAi: (id: string) => post(`/admin/v1/community/articles/${encodeURIComponent(id)}/retry-ai`),
  reports: (status: string, pageNum: number) => get<CommunityPage<CommunityReport>>(`/admin/v1/community/reports?${query({ status, pageNum, pageSize: 10 })}`),
  resolve: (id: string, action: string, note: string) => post(`/admin/v1/community/reports/${encodeURIComponent(id)}/resolve`, { action, note })
}
