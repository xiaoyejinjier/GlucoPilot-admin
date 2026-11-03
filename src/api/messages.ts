import { get } from '@/utils/request'

export interface AdminMessage {
  id: string
  senderId: string
  senderNickname: string
  recipientId: string
  recipientNickname: string
  content: string
  createdAt: string
  readAt: string | null
}

export interface MessagePage {
  records: AdminMessage[]
  total: number | string
}

export interface MessageFilters {
  keyword?: string
  senderId?: string
  recipientId?: string
  readState?: string
}

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

export const messageApi = {
  page: (filters: MessageFilters & { pageNum: number; pageSize: number }) =>
    get<MessagePage>(`/admin/v1/community/messages?${query({ ...filters })}`),
  conversation: (first: string, second: string, page: { pageNum: number; pageSize: number }) =>
    get<MessagePage>(`/admin/v1/community/messages/conversation/${encodeURIComponent(first)}/${encodeURIComponent(second)}?${query(page)}`)
}
