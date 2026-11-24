import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 共享的"当前时间"（epoch ms），按固定间隔刷新，用于倒计时 / 剩余天数这类展示。
 *
 * 只为让页面自然走时，不承担任何状态判定：是否可恢复、是否超期一律以后端返回的
 * cancelRecoverable / cancelPurgeOverdue 为准，避免客户端时钟漂移导致误操作。
 */
export function useNow(intervalMs = 30_000) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    now.value = Date.now()
    timer = setInterval(() => {
      now.value = Date.now()
    }, intervalMs)
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
  })

  return now
}
