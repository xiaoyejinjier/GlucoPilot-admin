/**
 * 内容媒体（资讯配图 / 轮播图 / 资讯视频）API。
 * 上传：凭证 → PUT（local 或 minio 同源代理）→ 登记。
 * 图：/api/v1/cms/images/{id}；视频：/api/v1/cms/videos/{id}。
 */
import { adminConfig } from '@/config'
import { del, get, post, request } from '@/utils/request'
import type { MediaBizType, MediaFile } from '@/types'

/** 后端 purpose */
export type CmsMediaPurpose = 'news' | 'banner' | 'news-video'

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

export interface CmsMediaOption {
  id: number
  label: string
  value: string
  displayUrl: string
}

export function displayMediaUrl(fileUrl: string): string {
  if (!fileUrl) return ''
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl
  return `${adminConfig.baseUrl}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`
}

function purposeLabel(purpose: CmsMediaPurpose): string {
  if (purpose === 'banner') return '轮播'
  if (purpose === 'news-video') return '资讯视频'
  return '资讯'
}

function toMediaFile(item: CmsMediaItem): MediaFile {
  const ext = item.mimeType === 'video/mp4' ? 'mp4' : item.mimeType === 'image/png' ? 'png' : 'jpg'
  return {
    id: Number(item.id),
    name: `${item.purpose}-${item.id}.${ext}`,
    bizType: item.purpose,
    url: displayMediaUrl(item.fileUrl),
    size: Number(item.sizeBytes) || 0,
    mime: item.mimeType || 'image/jpeg',
    uploader: item.uploader || '',
    createdAt: item.createdAt || ''
  }
}

function toOption(item: CmsMediaItem): CmsMediaOption {
  return {
    id: Number(item.id),
    label: `${purposeLabel(item.purpose)} #${item.id}`,
    value: item.fileUrl,
    displayUrl: displayMediaUrl(item.fileUrl)
  }
}

function resolveUploadUrl(uploadUrl: string): string {
  const localPath = new URL(uploadUrl, window.location.origin).pathname
  if (
    localPath.startsWith('/api/v1/media-files/local-uploads/') ||
    localPath.startsWith('/api/v1/media-files/minio-uploads/')
  ) {
    return `${adminConfig.baseUrl}${localPath}`
  }
  return uploadUrl
}

async function fetchItems(purpose?: CmsMediaPurpose | 'all'): Promise<CmsMediaItem[]> {
  if (adminConfig.useMock) return []
  const query = purpose && purpose !== 'all' ? `?purpose=${encodeURIComponent(purpose)}` : ''
  return (await get<CmsMediaItem[]>(`/admin/v1/cms-media${query}`)) || []
}

export const cmsMediaApi = {
  async list(purpose?: CmsMediaPurpose | 'all'): Promise<MediaFile[]> {
    return (await fetchItems(purpose)).map(toMediaFile)
  },

  async listOptions(purpose: CmsMediaPurpose): Promise<CmsMediaOption[]> {
    return (await fetchItems(purpose)).map(toOption)
  },

  /**
   * 上传 JPG/PNG（≤5MB）或 MP4（purpose=news-video，≤100MB）。
   */
  async upload(file: File, purpose: CmsMediaPurpose): Promise<CmsMediaOption> {
    if (adminConfig.useMock) throw new Error('上传内容媒体需要连接后端，请关闭演示模式')

    const isVideo = purpose === 'news-video'
    if (isVideo) {
      if (file.type !== 'video/mp4') throw new Error('请选择 MP4 视频')
      if (!file.size || file.size > 100 * 1024 * 1024) throw new Error('视频大小不能超过 100MB')
    } else {
      if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('请选择 JPG 或 PNG 图片')
      if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('图片大小不能超过 5MB')
    }

    const body = { purpose, bizType: 5, mimeType: file.type, sizeBytes: file.size }
    const credential = await post<{ uploadUrl: string; storageKey: string; expireIn: number }>(
      '/admin/v1/cms-media/upload-credentials',
      body
    )
    const uploadUrl = resolveUploadUrl(credential.uploadUrl)
    const timeoutMs = isVideo ? 300000 : 60000
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'application/octet-stream' },
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`上传失败 (${response.status})，请重新选择`)
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw new Error('上传超时，请重新选择')
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
    return toOption(saved)
  },

  async remove(id: number): Promise<void> {
    if (adminConfig.useMock) throw new Error('删除内容媒体需要连接后端，请关闭演示模式')
    await del(`/admin/v1/cms-media/${id}`)
  }
}

export type { MediaBizType }
