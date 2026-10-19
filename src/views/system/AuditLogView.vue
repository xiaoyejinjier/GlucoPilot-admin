<template>
  <div class="page-wrap paginated-page">
    <div class="head">
      <h2 class="page-title">AI 审计日志</h2>
      <span class="text-muted">
        记录管理端对 AI 长期记忆等敏感数据的操作留痕；本页只读，不提供修改与删除
      </span>
    </div>

    <div class="kt-card paginated-card">
      <div class="filter mb12">
        <el-select
          v-model="q.moduleCode"
          placeholder="全部模块"
          clearable
          filterable
          allow-create
          default-first-option
          style="width: 170px"
          @change="search"
        >
          <el-option label="ai（AI 能力）" value="ai" />
        </el-select>
        <el-input
          v-model="q.actionCode"
          placeholder="动作编码，如 ai_memory_delete"
          clearable
          style="width: 230px"
          @keyup.enter="search"
          @clear="search"
        />
        <el-input
          v-model="q.targetType"
          placeholder="目标类型，如 user"
          clearable
          style="width: 170px"
          @keyup.enter="search"
          @clear="search"
        />
        <el-input
          v-model="q.targetId"
          placeholder="目标 ID，如 18"
          clearable
          style="width: 150px"
          @keyup.enter="search"
          @clear="search"
        />
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <span class="text-muted filter-tip">模块可手输其它编码；清空 = 全部模块。筛选条件均为精确匹配。</span>
      </div>

      <el-table
        :data="records"
        v-loading="loading"
        row-key="id"
        height="100%"
        class="paginated-table"
        empty-text="没有符合条件的审计日志"
      >
        <el-table-column label="序号" width="70" align="center">
          <template #default="{ $index }">{{ (page.pageNum - 1) * page.pageSize + $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmtTime(row.gmtCreate) }}</template>
        </el-table-column>
        <el-table-column label="操作人" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.operatorName || '—' }}</div>
            <div class="text-muted cell-sub">ID {{ row.opsId || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.roleCode || '—' }}</template>
        </el-table-column>
        <el-table-column label="模块" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.moduleCode" size="small" effect="plain" disable-transitions>{{ row.moduleCode }}</el-tag>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="动作" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.actionName || '—' }}</div>
            <div class="text-muted cell-sub">{{ row.actionCode || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="目标" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ targetText(row) }}</template>
        </el-table-column>
        <el-table-column label="结果码" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.resultCode === 0 ? 'success' : 'danger'" size="small" effect="light" disable-transitions>
              {{ row.resultCode === 0 ? '成功' : '失败' }}
            </el-tag>
            <div class="text-muted cell-sub">code {{ row.resultCode }}</div>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="96" align="right">
          <template #default="{ row }">
            <span v-if="row.costMs !== null">{{ row.costMs }} ms</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="IP" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.clientIp || '—' }}</template>
        </el-table-column>
        <el-table-column label="请求" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag size="small" effect="plain" disable-transitions>{{ row.requestMethod || '—' }}</el-tag>
            <div class="text-muted cell-sub">{{ row.requestUri || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="详情" width="100" fixed="right">
          <template #default="{ row }">
            <el-popover v-if="row.detailJson" placement="left" :width="440" trigger="click">
              <template #reference>
                <el-button link type="primary">查看 JSON</el-button>
              </template>
              <pre class="json-box">{{ prettyJson(row.detailJson) }}</pre>
            </el-popover>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
      </el-table>

      <TablePagination
        :page-num="page.pageNum"
        :page-size="page.pageSize"
        :total="page.total"
        :summary="pageSummary"
        :disabled="loading"
        @size-change="changeSize"
        @page-change="changePage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import TablePagination from '@/components/TablePagination.vue'
import { useServerPagination } from '@/composables/useServerPagination'
import { opsAuditApi } from '@/api'
import { fmtTime } from '@/utils/format'
import type { OpsAuditLogRow } from '@/types'

/** 默认只筛 AI 模块；其余条件全部可空（空值不参与查询串）。 */
const q = reactive({ moduleCode: 'ai', actionCode: '', targetType: '', targetId: '' })
type AuditFilters = { moduleCode?: string; actionCode?: string; targetType?: string; targetId?: string }

const { page, records, loading, pageSummary, load, search: applyFilters, changeSize, changePage } =
  useServerPagination<OpsAuditLogRow, AuditFilters>(
    (query) => opsAuditApi.list(query),
    { moduleCode: 'ai' },
    { errorMessage: 'AI 审计日志加载失败' }
  )
onMounted(load)

function search() {
  return applyFilters({
    moduleCode: q.moduleCode.trim() || undefined,
    actionCode: q.actionCode.trim() || undefined,
    targetType: q.targetType.trim() || undefined,
    targetId: q.targetId.trim() || undefined
  })
}

function reset() {
  q.moduleCode = 'ai'
  q.actionCode = ''
  q.targetType = ''
  q.targetId = ''
  return search()
}

/** 目标展示固定为 targetType#targetId；缺一边就用 — 占位，不做拼接歧义。 */
function targetText(row: OpsAuditLogRow): string {
  if (!row.targetType && !row.targetId) return '—'
  return `${row.targetType || '—'}#${row.targetId || '—'}`
}

/** detailJson 是后端下发的 JSON **字符串**：能解析就缩进美化，解析不了就原样展示，避免用户看到一坨。 */
function prettyJson(raw: string): string {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}
</script>

<style scoped>
.head { flex: none; margin-bottom: 16px; }
.page-title { margin: 0 0 4px; font-size: 18px; }
.filter { display: flex; flex: none; flex-wrap: wrap; gap: 10px; align-items: center; }
.filter-tip { font-size: 12px; margin-left: auto; }
.cell-sub { font-size: 12px; line-height: 1.6; word-break: break-all; }
.json-box {
  margin: 0;
  max-height: 360px;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--kt-brand-soft);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
