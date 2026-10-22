export interface HostMetrics {
  cpuPercent: number | null; cpuCores: number
  memoryTotalBytes: number; memoryAvailableBytes: number; memoryUsedBytes: number; memoryPercent: number
  swapTotalBytes: number; swapUsedBytes: number
  diskTotalBytes: number; diskUsedBytes: number; diskFreeBytes: number; diskPercent: number; uptimeSeconds: number
}
export interface ResourceSnapshot {
  schemaVersion: number; sampledAt: string; host: HostMetrics; containersAvailable: boolean
  containers: { name: string; service: string; state: string; cpuPercent: number | null; memoryUsedBytes: number | null; memoryLimitBytes: number | null }[]
  history: { sampledAt: string; cpuPercent: number | null; memoryPercent: number }[]
}
export interface ResourceResponse { available: boolean; stale: boolean; message: string; snapshot: ResourceSnapshot | null }

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i < 2 ? 0 : 1)} ${units[i]}`
}
export function formatPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`
}
export function formatUptime(seconds: number) {
  return `${Math.floor(seconds / 86400)} 天 ${Math.floor(seconds % 86400 / 3600)} 小时 ${Math.floor(seconds % 3600 / 60)} 分钟`
}

interface Scheduler { schedule(callback: () => void, ms: number): unknown; cancel(handle: unknown): void }
const clock: Scheduler = {
  schedule: (callback, ms) => setTimeout(callback, ms),
  cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>)
}
/** Serial polling, with no hidden-page polling or late response writes after disposal. */
export function createResourcePoller<T>(fetcher: () => Promise<T>, receive: (data: T) => void,
  failed: (error: unknown) => void, busy: (value: boolean) => void,
  interval = 10000, scheduler: Scheduler = clock) {
  let active = false, disposed = false, pending = false, generation = 0
  let timer: unknown
  function clear() { if (timer !== undefined) scheduler.cancel(timer); timer = undefined }
  async function run() {
    if (!active || disposed || pending) return
    clear(); pending = true
    const requestGeneration = generation
    busy(true)
    try {
      const value = await fetcher()
      if (active && !disposed && requestGeneration === generation) receive(value)
    } catch (error) {
      if (active && !disposed && requestGeneration === generation) failed(error)
    } finally {
      pending = false
      if (active && !disposed) {
        busy(false)
        clear()
        timer = scheduler.schedule(() => { void run() }, requestGeneration === generation ? interval : 0)
      }
    }
  }
  return {
    resume() { if (disposed || active) return; active = true; generation++; void run() },
    pause() { active = false; generation++; clear(); if (!disposed) busy(false) },
    refresh() { clear(); void run() },
    dispose() { active = false; disposed = true; generation++; clear() }
  }
}
