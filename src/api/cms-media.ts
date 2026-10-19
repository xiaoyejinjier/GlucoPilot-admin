/**
 * 内容媒体（资讯配图 / 轮播图）API。
 * 上传流程与食物图片一致：凭证 → 直传对象存储（local/MinIO/OSS）→ 登记。
 */
import { adminConfig } from '@/config'
import { del, get, post, request } from '@/utils/request'
import type { MediaBizType, MediaFile } from '@/types'

/** 后端 purpose：资讯配图 / 轮播图 */
export type CmsMediaPurpose = 'news' | 'banner'

/** 后端 CmsMediaDtos.MediaItem */
export interface CmsMediaItem {
  id: string
  purpose: CmsMediaPurpose
  fileUrl: string
  mimeType: string
  sizeBytes: number
  widthPx?: number
  heightPx?: number
  uploader?: string
  createdAt?: string
}

/** 相对路径补上管理端 baseUrl，便于表格缩略图直接展示。 */
function resolveUrl(fileUrl: string): string {
  if (!fileUrl) return ''
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl
  return `${adminConfig.baseUrl}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`
}

/** 映射为媒体页沿用的 MediaFile 结构。 */
function toMediaFile(item: CmsMediaItem): MediaFile {
  const ext = item.mimeType === 'image/png' ? 'png' : 'jpg'
  return {
    id: Number(item.id),
    name: `${item.purpose}-${item.id}.${ext}`,
    bizType: item.purpose,
    url: resolveUrl(item.fileUrl),
    size: Number(item.sizeBytes) || 0,
    mime: item.mimeType || 'image/jpeg',
    uploader: item.uploader || '',
    createdAt: item.createdAt || ''
  }
}

export const cmsMediaApi = {
  /** 列出已登记素材；purpose=all 或不传则拉全部。 */
  async list(purpose?: CmsMediaPurpose | 'all'): Promise<MediaFile[]> {
    if (adminConfig.useMock) return []
    const query = purpose && purpose !== 'all' ? `?purpose=${encodeURIComponent(purpose)}` : ''
    const rows = await get<CmsMediaItem[]>(`/admin/v1/cms-media${query}`)
    return (rows || []).map(toMediaFile)
  },

  /**
   * 上传一张 JPG/PNG（≤5MB）。
   * MinIO 场景下 uploadUrl 为预签名地址，原样 PUT；local 场景走同源代理路径。
   */
  async upload(file: File, purpose: CmsMediaPurpose): Promise<MediaFile> {
    if (adminConfig.useMock) throw new Error('上传内容图片需要连接后端，请关闭演示模式')
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('请选择 JPG 或 PNG 图片')
    if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('图片大小不能超过 5MB')

    const body = { purpose, bizType: 5, mimeType: file.type, sizeBytes: file.size }
    const credential = await post<{ uploadUrl: string; storageKey: string; expireIn: number }>(
      '/admin/v1/cms-media/upload-credentials',
      body
    )
    // 本地直传也经过统一代理；云存储/MinIO 预签名 URL 必须原样使用。
    const localPath = new URL(credential.uploadUrl, window.location.origin).pathname
    const uploadUrl = localPath.startsWith('/api/v1/media-files/local-uploads/')
      ? `${adminConfig.baseUrl}${localPath}`
      : credential.uploadUrl
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 60000)
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'application/octet-stream' },
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`图片上传失败 (${response.status})，请重新选择`)
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw new Error('图片上传超时，请重新选择')
      throw error
    } finally {
      window.clearTimeout(timer)
    }

    const idempotencyKey = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join('')
    const saved = await request<CmsMediaItem>('/admin/v1/cms-media', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ ...body, storageKey: credential.storageKey })
    })
    return toMediaFile(saved)
  },

  /** 软删除素材。 */
  async remove(id: number): Promise<void> {
    if (adminConfig.useMock) throw new Error('删除内容图片需要连接后端，请关闭演示模式')
    await del(`/admin/v1/cms-media/${id}`)
  }
}

export type { MediaBizType }
