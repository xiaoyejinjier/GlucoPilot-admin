import { computed, reactive, ref, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'

export interface ServerPage<T> {
  total: number
  records: T[]
}

/** 保存已提交的筛选条件，统一页码、越界回退及异步响应处理。 */
export function useServerPagination<
  T,
  F extends Record<string, unknown>,
  R extends ServerPage<T> = ServerPage<T>
>(
  fetchPage: (query: F & { pageNum: number; pageSize: number }) => Promise<R>,
  initialFilters: F,
  options: { errorMessage: string; onLoaded?: (result: R) => void; onError?: () => void }
) {
  const page = reactive({ pageNum: 1, pageSize: 10, total: 0 })
  const records = shallowRef<T[]>([])
  const loading = ref(false)
  const appliedFilters = shallowRef<F>({ ...initialFilters })
  let latestRequest = 0

  const pageSummary = computed(() => {
    if (!page.total || !records.value.length) return '暂无记录'
    const start = (page.pageNum - 1) * page.pageSize + 1
    const end = Math.min(start + records.value.length - 1, page.total)
    return `第 ${page.pageNum} / ${Math.ceil(page.total / page.pageSize)} 页 · 显示 ${start}–${end} 条`
  })

  async function load(): Promise<void> {
    const requestId = ++latestRequest
    const query = { ...appliedFilters.value, pageNum: page.pageNum, pageSize: page.pageSize }
    loading.value = true
    try {
      const result = await fetchPage(query)
      if (requestId !== latestRequest) return
      const total = Number(result?.total)
      if (!result || !Array.isArray(result.records) || !Number.isInteger(total) || total < 0
          || result.records.length > query.pageSize) {
        throw new Error('接口未返回有效分页数据，请确认后端已更新')
      }
      const lastPage = Math.max(1, Math.ceil(total / query.pageSize))
      if (page.pageNum > lastPage) {
        page.pageNum = lastPage
        await load()
        return
      }
      records.value = result.records
      page.total = total
      options.onLoaded?.(result)
    } catch (error) {
      if (requestId !== latestRequest) return
      records.value = []
      page.pageNum = 1
      page.total = 0
      options.onError?.()
      ElMessage.error(error instanceof Error ? error.message : options.errorMessage)
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }

  function search(filters: F) {
    appliedFilters.value = { ...filters }
    page.pageNum = 1
    return load()
  }

  function changePage(pageNum: number) {
    if (page.pageNum === pageNum) return
    page.pageNum = pageNum
    return load()
  }

  function changeSize(pageSize: number) {
    if (page.pageSize === pageSize) return
    page.pageSize = pageSize
    page.pageNum = 1
    return load()
  }

  return { page, records, loading, pageSummary, appliedFilters, load, search, changePage, changeSize }
}
