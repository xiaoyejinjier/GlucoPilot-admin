import type { AlertStatus } from '@/api/glucose-alerts'

export interface AlertHandlingDraft {
  eventId: string
  userId: string
  glucoseValue: number
  recordedAt: string
  version: string
  status: Exclude<AlertStatus, 'PENDING'>
  note: string
  userReply: string
  updatedAt: number
}

interface Drafts { activeId: string; items: Record<string, AlertHandlingDraft> }
type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const PREFIX = 'kt_glucose_alert_drafts:v1:'
const TTL = 24 * 60 * 60 * 1000

/** 当前标签页的临时草稿，按账号和后端隔离；不保存Token或用户资料。 */
export function createGlucoseAlertDrafts(
  scope: () => string,
  storage: () => StorageAccess = () => window.sessionStorage,
  now = () => Date.now()
) {
  function key() { const owner = scope(); return owner ? PREFIX + encodeURIComponent(owner) : '' }
  function read(): Drafts {
    try {
      const name = key()
      const data = name ? JSON.parse(storage().getItem(name) || '{}') : {}
      const items: Record<string, AlertHandlingDraft> = {}
      for (const [id, raw] of Object.entries(data.items || {})) {
        const item = raw as AlertHandlingDraft
        if (!item || item.eventId !== id || !/^[1-9]\d{0,19}$/.test(id)
          || typeof item.userId !== 'string' || !Number.isFinite(item.glucoseValue)
          || typeof item.recordedAt !== 'string' || typeof item.version !== 'string'
          || !['PROCESSING', 'RESOLVED', 'CLOSED'].includes(item.status)
          || typeof item.note !== 'string' || item.note.length > 1000
          || typeof item.userReply !== 'string' || item.userReply.length > 1000
          || !Number.isFinite(item.updatedAt) || item.updatedAt > now() || now() - item.updatedAt >= TTL) continue
        items[id] = item
      }
      return { activeId: typeof data.activeId === 'string' ? data.activeId : '', items }
    } catch { return { activeId: '', items: {} } }
  }
  function write(data: Drafts) {
    try {
      const name = key()
      if (!name) return false
      if (!Object.keys(data.items).length) storage().removeItem(name)
      else storage().setItem(name, JSON.stringify(data))
      return true
    } catch { return false }
  }
  return {
    get(id: string) { return read().items[id] || null },
    active() { const data = read(); return data.items[data.activeId] ? data.activeId : '' },
    save(draft: AlertHandlingDraft) {
      const data = read()
      data.items[draft.eventId] = draft
      data.activeId = draft.eventId
      data.items = Object.fromEntries(Object.entries(data.items)
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 20))
      return write(data)
    },
    remove(id: string) {
      const data = read()
      delete data.items[id]
      if (data.activeId === id) data.activeId = ''
      return write(data)
    }
  }
}
