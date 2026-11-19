<template>
  <div class="page-wrap paginated-page">
    <div class="head">
      <h2 class="page-title">AI 用量</h2>
      <span class="text-muted">
        口径是<strong>模型调用流水</strong>（<code>ai_call_log</code>）：一次模型请求一行，摘要、记忆抽取、内容审核、翻译都在内。
        它与 <code>chat_message</code> 上「按轮」的 token <strong>不可相加</strong>（后者工具回环里只留最后一次用量）。
      </span>
    </div>

    <div class="kt-card paginated-card">
      <div class="filter mb12">
        <el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :clearable="true"
          style="width: 260px"
          @change="load"
        />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="useLastDays(7)">最近 7 天</el-button>
        <el-button @click="useLastDays(30)">最近 30 天</el-button>
        <span class="text-muted filter-tip">清空日期 = 默认最近 7 天；单次最多查询 92 天。</span>
      </div>

      <div class="stat-row mb12">
        <div class="stat-card">
          <div class="stat-label">调用次数</div>
          <div class="stat-value">{{ fmtNum(report?.totals.calls) }}</div>
          <div class="stat-sub" :class="{ 'is-warn': (report?.totals.failedCalls || 0) > 0 }">
            失败 {{ fmtNum(report?.totals.failedCalls) }} 次
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">输入 token</div>
          <div class="stat-value">{{ fmtNum(report?.totals.promptTokens) }}</div>
          <div class="stat-sub">
            命中 {{ fmtNum(report?.totals.cacheHitTokens) }} · 未命中
            {{ fmtNum(report?.totals.cacheMissTokens) }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">输出 token</div>
          <div class="stat-value">{{ fmtNum(report?.totals.completionTokens) }}</div>
          <div class="stat-sub">合计 {{ fmtNum(report?.totals.totalTokens) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">缓存命中率</div>
          <div class="stat-value">{{ fmtRate(report?.totals.cacheHitRate) }}</div>
          <div class="stat-sub">未命中部分按 30 倍计价（这才是成本）</div>
        </div>
      </div>

      <el-table
        :data="report?.rows || []"
        v-loading="loading"
        height="100%"
        class="paginated-table"
        empty-text="所选区间内没有调用记录"
      >
        <el-table-column label="日期" width="120" prop="date" />
        <el-table-column label="场景" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="!row.sceneCode" size="small" type="info" effect="plain" disable-transitions>
              {{ row.sceneLabel }}
            </el-tag>
            <span v-else>{{ row.sceneLabel }}</span>
          </template>
        </el-table-column>
        <el-table-column label="模型" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="row.modelCode === UNKNOWN_MODEL" size="small" type="info" effect="plain" disable-transitions>
              {{ row.modelCode }}
            </el-tag>
            <span v-else>{{ row.modelCode }}</span>
          </template>
        </el-table-column>
        <el-table-column label="调用" width="90" align="right">
          <template #default="{ row }">{{ fmtNum(row.calls) }}</template>
        </el-table-column>
        <el-table-column label="失败" width="80" align="right">
          <template #default="{ row }">
            <span :class="{ 'is-warn': row.failedCalls > 0 }">{{ fmtNum(row.failedCalls) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="输入 token" width="120" align="right">
          <template #default="{ row }">{{ fmtNum(row.promptTokens) }}</template>
        </el-table-column>
        <el-table-column label="未命中 token" width="130" align="right">
          <!-- 未命中 = 按全价计的部分。DeepSeek 命中/未命中是 1:30，所以这一列才是钱 -->
          <template #default="{ row }">
            <span :class="{ 'is-warn': (row.cacheMissTokens || 0) > 0 }">
              {{ fmtNum(row.cacheMissTokens) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="输出 token" width="120" align="right">
          <template #default="{ row }">{{ fmtNum(row.completionTokens) }}</template>
        </el-table-column>
        <el-table-column label="命中率" width="100" align="right">
          <template #default="{ row }">{{ fmtRate(row.cacheHitRate) }}</template>
        </el-table-column>
        <el-table-column label="合计 token" width="120" align="right">
          <template #default="{ row }">{{ fmtNum(row.totalTokens) }}</template>
        </el-table-column>
      </el-table>

      <div class="text-muted note-line">{{ report?.note || '' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { aiUsageApi } from '@/api'
import type { AiUsageReport } from '@/types'

/** 与后端 AiUsageDtos.UNKNOWN_MODEL 保持一致：历史行没记模型编码。 */
const UNKNOWN_MODEL = '（未记录）'

const loading = ref(false)
const report = ref<AiUsageReport | null>(null)
/** el-date-picker 的 daterange 值是 [start, end] 字符串数组。 */
const range = ref<[string, string] | null>(null)

onMounted(() => {
  useLastDays(7)
})

function useLastDays(days: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  range.value = [isoDate(start), isoDate(end)]
  load()
}

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function load() {
  loading.value = true
  try {
    report.value = await aiUsageApi.report(range.value?.[0], range.value?.[1])
  } catch (e) {
    // request 层已经把后端 message 抛成 Error，这里只补一条提示，不吞掉控制台堆栈
    ElMessage.error((e as Error)?.message || '用量查询失败')
  } finally {
    loading.value = false
  }
}

function fmtNum(value?: number | null) {
  return (value ?? 0).toLocaleString('zh-CN')
}

/** null = 上游没上报，显示「—」而不是 0%：两者含义完全不同。 */
function fmtRate(value?: number | null) {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(1)}%`
}
</script>

<style scoped>
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.stat-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px 14px;
}
.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.stat-value {
  margin-top: 4px;
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.stat-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.stat-sub.is-warn,
.is-warn {
  color: var(--el-color-warning);
}
.note-line {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
}
</style>
