/**
 * 后端错误归类：request.ts 会把业务码、HTTP 状态与 message 都挂在 Error 上，
 * 页面层需要判断的只有两件事——"要不要提示刷新重试"和"给用户看什么文案"。
 * AI 模型配置、提示词管理、场景绑定三处共用这一套判据，避免各写一份。
 */

/**
 * 乐观锁冲突：后端主路径是 CONFLICT(40900)/HTTP 409（2026-10-14 起），
 * 文案兜底是为了兼容旧后端与其它来源（例如 40001）的"请刷新后重试"提示。
 */
export function isVersionConflict(e: unknown): boolean {
  const err = e as { code?: number; status?: number; message?: string }
  if (err?.code === 409 || err?.code === 40900 || err?.status === 409) return true
  return /请刷新后重试|他人修改|乐观锁|configVersion|版本|冲突|conflict/i.test(err?.message || '')
}

/** 统一取错误文案：后端 message 缺失时回落到调用方给的动作提示。 */
export function errorMessage(e: unknown, fallback: string): string {
  const message = (e as { message?: string })?.message
  return message && message.trim() ? message : fallback
}
