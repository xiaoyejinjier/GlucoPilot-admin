import { adminConfig } from '@/config'
import { get, post, request } from '@/utils/request'

export interface FoodImage {
  id: string
  fileUrl: string
}

export const foodImageApi = {
  async list(): Promise<FoodImage[]> {
    if (adminConfig.useMock) return []
    return get<FoodImage[]>('/admin/v1/food-images')
  },

  async upload(file: File): Promise<FoodImage> {
    if (adminConfig.useMock) throw new Error('上传食物图片需要连接后端，请关闭演示模式')
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('请选择 JPG 或 PNG 图片')
    if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('图片大小不能超过 5MB')

    const body = { bizType: 5, mimeType: file.type, sizeBytes: file.size }
    const credential = await post<{ uploadUrl: string; storageKey: string; expireIn: number }>(
      '/admin/v1/food-images/upload-credentials', body
    )
    // 本地直传也经过统一代理；云存储预签名 URL 必须原样使用。
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
    return request<FoodImage>('/admin/v1/food-images', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ ...body, storageKey: credential.storageKey })
    })
  }
}
