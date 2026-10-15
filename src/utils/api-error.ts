/**
 * 后端错误归类：request.ts 会把业务码、HTTP 状态与 message 都挂在 Error 上，
 * 页面层需要判断的只有两件事——"要不要提示刷新重试"和"给用户看什么文案"。
 * AI 模型配置、提示词管理、场景绑定三处共用这一套判据，避免各写一份。
 *
 * ⚠️ 后端 40900(CONFLICT) 覆盖了**两类完全不同**的冲突，处理方式相反，不能混为一谈：
 *   - 乐观锁过期（别人先改了）：刷新后重试即可；
 *   - 唯一键/版本号被别人占了（编码重复、版本号已存在）：刷新没用，必须改输入。
 *   2026-10-15 的实测就踩在这上面：编辑生效提示词时回传了自身版本号，后端报
 *   「场景 CHAT 已存在版本 v1」，而前端把任何 409 都提示成"该版本已被他人修改"，
 *   用户看到的现象是"保存后什么都没发生、也没说清为什么"。
 */

function isConflictCode(err: { code?: number; status?: number } | undefined): boolean {
  return err?.code === 409 || err?.code === 40900 || err?.status === 409
}

function messageOf(e: unknown): string {
  return (e as { message?: string })?.message || ''
}

/**
 * 唯一键/版本号已被占用：**刷新没用，必须改输入**。
 * 判据取后端文案里的"已存在/已占用/重复"，这三类措辞来自服务层的 CONFLICT 提示。
 */
export function isDuplicateEntry(e: unknown): boolean {
  return isConflictCode(e as { code?: number; status?: number }) && /已存在|已占用|重复/.test(messageOf(e))
}

/**
 * 乐观锁过期：后端 CONFLICT(40900)/HTTP 409，且不是"已被占用"那一类。
 * 文案兜底是为了兼容其它来源（例如 40001）的"请刷新后重试"提示。
 */
export function isStaleConflict(e: unknown): boolean {
  if (isDuplicateEntry(e)) return false
  if (isConflictCode(e as { code?: number; status?: number })) return true
  return /请刷新后重试|他人修改|乐观锁|configVersion/i.test(messageOf(e))
}

/** 统一取错误文案：后端 message 缺失时回落到调用方给的动作提示。 */
export function errorMessage(e: unknown, fallback: string): string {
  const message = messageOf(e)
  return message && message.trim() ? message : fallback
}
