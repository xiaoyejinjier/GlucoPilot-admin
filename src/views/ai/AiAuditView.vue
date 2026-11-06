<template>
  <section class="page">
    <header class="page-head">
      <div>
        <h2>AI 审计</h2>
        <p class="page-desc">
          模型在业务里到底做了什么：一次对话（会话）、它调了哪些工具、系统记住了什么、摘要写了什么、
          社区内容被判了什么、文章与昵称被翻译成什么、图片识别成了什么。全部只读，没有删除与导出。
        </p>
      </div>
    </header>

    <el-tabs v-model="tab" class="audit-tabs" @tab-change="onTabChange">
      <el-tab-pane label="会话" name="sessions" lazy>
        <ChatSessionView />
      </el-tab-pane>

      <el-tab-pane label="工具调用" name="tools" lazy>
        <div class="audit-block">
          <div class="review-filters">
            <label class="filter-field">
              <span class="filter-label">用户 ID</span>
              <el-input v-model="tools.userId" clearable placeholder="全部" style="width: 140px" />
            </label>
            <label class="filter-field">
              <span class="filter-label">会话 ID</span>
              <el-input v-model="tools.sessionId" clearable placeholder="全部" style="width: 140px" />
            </label>
            <label class="filter-field">
              <span class="filter-label">工具名</span>
              <el-input v-model="tools.toolName" clearable placeholder="如 query_glucose_range" style="width: 220px" />
            </label>
            <label class="filter-field">
              <span class="filter-label">结果</span>
              <el-select v-model="tools.ok" style="width: 120px">
                <el-option label="全部" value="" />
                <el-option label="成功" value="1" />
                <el-option label="失败" value="0" />
              </el-select>
            </label>
            <div class="filter-actions">
              <el-button type="primary" :loading="tools.loading" @click="loadTools(1)">查询</el-button>
            </div>
          </div>

          <el-table :data="tools.rows" v-loading="tools.loading" size="small" class="audit-table">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="createdAt" label="时间" width="170">
              <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column prop="userId" label="用户" width="90" />
            <el-table-column prop="sessionId" label="会话" width="90" />
            <el-table-column prop="toolName" label="工具" min-width="200" />
            <el-table-column prop="callIndex" label="序号" width="70" />
            <el-table-column label="结果" width="90">
              <template #default="{ row }">
                <el-tag :type="row.ok ? 'success' : 'danger'" size="small">{{ row.ok ? '成功' : '失败' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="durationMs" label="耗时(ms)" width="100">
              <template #default="{ row }">{{ row.durationMs ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="errorType" label="异常" width="180">
              <template #default="{ row }">{{ row.errorType || '—' }}</template>
            </el-table-column>
            <el-table-column prop="resultDigest" label="返回摘要" min-width="260">
              <template #default="{ row }">{{ row.resultDigest || '（无摘要）' }}</template>
            </el-table-column>
          </el-table>
          <div class="pager-row">
            <el-pagination
              layout="total, prev, pager, next"
              :total="tools.total"
              :current-page="tools.pageNum"
              :page-size="PAGE_SIZE"
              @current-change="loadTools"
            />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="长期记忆" name="memories" lazy>
        <div class="audit-block">
          <div class="review-filters">
            <label class="filter-field">
              <span class="filter-label">用户 ID</span>
              <el-input v-model="memories.userId" clearable placeholder="全部" style="width: 140px" />
            </label>
            <label class="filter-field">
              <span class="filter-label">记忆键</span>
              <el-input v-model="memories.memoryKey" clearable placeholder="如 diet_taboo" style="width: 180px" />
            </label>
            <label class="filter-field">
              <span class="filter-label">内容搜索</span>
              <el-input v-model="memories.keyword" clearable maxlength="50" placeholder="≤50 字" style="width: 200px" />
            </label>
            <label class="filter-field">
              <span class="filter-label">含已删除</span>
              <el-switch v-model="memories.includeDeleted" />
            </label>
            <div class="filter-actions">
              <el-button type="primary" :loading="memories.loading" @click="loadMemories(1)">查询</el-button>
            </div>
          </div>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="记忆是模型自己写下的长期事实，会被注入后续每一次对话。打开「含已删除」可以看到被用户或系统抹掉的记录。"
          />

          <el-table :data="memories.rows" v-loading="memories.loading" size="small" class="audit-table">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="userId" label="用户" width="90" />
            <el-table-column prop="memoryKey" label="记忆键" width="150" />
            <el-table-column prop="memoryText" label="内容" min-width="320" />
            <el-table-column prop="confidence" label="置信度" width="90" />
            <el-table-column prop="sourceSessionId" label="来源会话" width="110">
              <template #default="{ row }">{{ row.sourceSessionId ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.deleted ? 'info' : 'success'" size="small">{{ row.deleted ? '已删除' : '生效' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="最后更新" width="170">
              <template #default="{ row }">{{ fmtTime(row.updatedAt) }}</template>
            </el-table-column>
          </el-table>
          <div class="pager-row">
            <el-pagination
              layout="total, prev, pager, next"
              :total="memories.total"
              :current-page="memories.pageNum"
              :page-size="PAGE_SIZE"
              @current-change="loadMemories"
            />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="滚动摘要" name="summaries" lazy>
        <div class="audit-block">
          <div class="review-filters">
            <label class="filter-field">
              <span class="filter-label">用户 ID</span>
              <el-input v-model="summaries.userId" clearable placeholder="全部" style="width: 140px" />
            </label>
            <label class="filter-field">
              <span class="filter-label">会话标题</span>
              <el-input v-model="summaries.keyword" clearable maxlength="50" placeholder="≤50 字" style="width: 200px" />
            </label>
            <div class="filter-actions">
              <el-button type="primary" :loading="summaries.loading" @click="loadSummaries(1)">查询</el-button>
            </div>
          </div>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="摘要只前进不回退（summary_upto_msg_id），长对话靠它续接上下文；这里列的是被写进 chat_session.context_summary 的全文。"
          />

          <el-table :data="summaries.rows" v-loading="summaries.loading" size="small" class="audit-table">
            <el-table-column prop="sessionId" label="会话" width="90" />
            <el-table-column prop="userId" label="用户" width="90" />
            <el-table-column prop="title" label="标题" min-width="160" />
            <el-table-column prop="msgCount" label="消息数" width="90" />
            <el-table-column prop="summaryUptoMsgId" label="覆盖至" width="100">
              <template #default="{ row }">{{ row.summaryUptoMsgId ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="summaryChars" label="字数" width="80" />
            <el-table-column prop="summaryUpdatedAt" label="更新时间" width="170">
              <template #default="{ row }">{{ fmtTime(row.summaryUpdatedAt) }}</template>
            </el-table-column>
            <el-table-column type="expand">
              <template #default="{ row }">
                <pre class="summary-body">{{ row.summary }}</pre>
              </template>
            </el-table-column>
          </el-table>
          <div class="pager-row">
            <el-pagination
              layout="total, prev, pager, next"
              :total="summaries.total"
              :current-page="summaries.pageNum"
              :page-size="PAGE_SIZE"
              @current-change="loadSummaries"
            />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="内容审核" name="moderation" lazy>
        <div class="audit-block">
          <div class="review-filters">
            <label class="filter-field">
              <span class="filter-label">对象</span>
              <el-select v-model="moderation.targetType" style="width: 130px">
                <el-option label="全部" value="" />
                <el-option label="文章" value="ARTICLE" />
                <el-option label="评论" value="COMMENT" />
              </el-select>
            </label>
            <label class="filter-field">
              <span class="filter-label">类别</span>
              <el-input v-model="moderation.categoryCode" clearable placeholder="如 medical_advice" style="width: 200px" />
            </label>
            <label class="filter-field">
              <span class="filter-label">严重度</span>
              <el-select v-model="moderation.severity" style="width: 120px">
                <el-option label="全部" value="" />
                <el-option label="1 低" value="1" />
                <el-option label="2 中" value="2" />
                <el-option label="3 高" value="3" />
              </el-select>
            </label>
            <div class="filter-actions">
              <el-button type="primary" :loading="moderation.loading" @click="loadModeration(1)">查询</el-button>
            </div>
          </div>
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            title="命中明细只存位置与片段哈希，不存原文（V43 的隐私设计）；要看原文请到内容管理对应条目。"
          />

          <el-table :data="moderation.rows" v-loading="moderation.loading" size="small" class="audit-table">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="createdAt" label="时间" width="170">
              <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column prop="targetType" label="对象" width="90">
              <template #default="{ row }">{{ row.targetType === 'ARTICLE' ? '文章' : '评论' }}</template>
            </el-table-column>
            <el-table-column prop="targetId" label="业务 ID" width="100" />
            <el-table-column prop="categoryCode" label="类别" width="170" />
            <el-table-column label="严重度" width="90">
              <template #default="{ row }">
                <el-tag :type="severityType(row.severity)" size="small">{{ row.severity }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="confidence" label="置信度" width="90">
              <template #default="{ row }">{{ row.confidence ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="命中区间" width="130">
              <template #default="{ row }">
                {{ row.startOffset === null ? '—' : `${row.startOffset}~${row.endOffset}` }}
              </template>
            </el-table-column>
            <el-table-column prop="snippetLen" label="片段长度" width="100">
              <template #default="{ row }">{{ row.snippetLen ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="reason" label="模型说明" min-width="240" />
            <el-table-column prop="modelCode" label="模型" width="160" />
            <el-table-column prop="promptVer" label="提示词" width="140">
              <template #default="{ row }">{{ row.promptVer || '—' }}</template>
            </el-table-column>
          </el-table>
          <div class="pager-row">
            <el-pagination
              layout="total, prev, pager, next"
              :total="moderation.total"
              :current-page="moderation.pageNum"
              :page-size="PAGE_SIZE"
              @current-change="loadModeration"
            />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="翻译" name="translations" lazy>
        <div class="audit-block">
          <div class="review-filters">
            <label class="filter-field">
              <span class="filter-label">类型</span>
              <el-select v-model="translations.kind" style="width: 190px">
                <el-option label="全部" value="" />
                <el-option label="文章预览（标题+摘要）" value="ARTICLE_PREVIEW" />
                <el-option label="文章正文" value="ARTICLE_BODY" />
                <el-option label="昵称" value="PROFILE_NAME" />
              </el-select>
            </label>
            <label class="filter-field">
              <span class="filter-label">状态</span>
              <el-select v-model="translations.status" style="width: 140px">
                <el-option label="全部" value="" />
                <el-option label="排队中" value="PENDING" />
                <el-option label="已完成" value="READY" />
                <el-option label="失败" value="FAILED" />
              </el-select>
            </label>
            <div class="filter-actions">
              <el-button type="primary" :loading="translations.loading" @click="loadTranslations(1)">查询</el-button>
            </div>
          </div>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="sourceHash = SHA-256(提示词版本 + 原文)：换提示词或改原文都会生成新的一行，旧行保留；列表只给 200 字预览。"
          />

          <el-table :data="translations.rows" v-loading="translations.loading" size="small" class="audit-table">
            <el-table-column prop="kind" label="类型" width="170" />
            <el-table-column prop="resourceId" label="资源 ID" width="110" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="promptVer" label="提示词" width="140">
              <template #default="{ row }">{{ row.promptVer || '—' }}</template>
            </el-table-column>
            <el-table-column prop="translatedChars" label="译文字数" width="100" />
            <el-table-column prop="translatedPreview" label="译文预览" min-width="300">
              <template #default="{ row }">{{ row.translatedPreview || '（暂无译文）' }}</template>
            </el-table-column>
            <el-table-column prop="sourceHash" label="原文指纹" width="150">
              <template #default="{ row }">{{ (row.sourceHash || '').slice(0, 12) }}…</template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="170">
              <template #default="{ row }">{{ fmtTime(row.updatedAt) }}</template>
            </el-table-column>
          </el-table>
          <div class="pager-row">
            <el-pagination
              layout="total, prev, pager, next"
              :total="translations.total"
              :current-page="translations.pageNum"
              :page-size="PAGE_SIZE"
              @current-change="loadTranslations"
            />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="多模态" name="ocr" lazy>
        <div class="audit-block">
          <div class="review-filters">
            <label class="filter-field">
              <span class="filter-label">用户 ID</span>
              <el-input v-model="ocr.userId" clearable placeholder="全部" style="width: 140px" />
            </label>
            <label class="filter-field">
              <span class="filter-label">业务</span>
              <el-select v-model="ocr.bizType" style="width: 130px">
                <el-option label="全部" value="" />
                <el-option label="血糖" value="1" />
                <el-option label="餐食" value="2" />
              </el-select>
            </label>
            <label class="filter-field">
              <span class="filter-label">状态</span>
              <el-select v-model="ocr.taskStatus" style="width: 140px">
                <el-option label="全部" value="" />
                <el-option label="待处理" value="0" />
                <el-option label="进行中" value="1" />
                <el-option label="成功" value="2" />
                <el-option label="失败" value="3" />
              </el-select>
            </label>
            <div class="filter-actions">
              <el-button type="primary" :loading="ocr.loading" @click="loadOcr(1)">查询</el-button>
            </div>
          </div>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="耗时是 finished_at - gmt_create 的近似值（表里没有独立耗时列）；结果只给 200 字预览。"
          />

          <el-table :data="ocr.rows" v-loading="ocr.loading" size="small" class="audit-table">
            <el-table-column prop="id" label="任务" width="80" />
            <el-table-column prop="createdAt" label="创建时间" width="170">
              <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column prop="userId" label="用户" width="90" />
            <el-table-column prop="mediaId" label="图片" width="90" />
            <el-table-column prop="bizType" label="业务" width="90">
              <template #default="{ row }">{{ row.bizType === 1 ? '血糖' : '餐食' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="taskType(row.taskStatus)" size="small">{{ TASK_TEXT[row.taskStatus] || row.taskStatus }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="durationMs" label="耗时(ms)" width="100">
              <template #default="{ row }">{{ row.durationMs ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="resultChars" label="结果字数" width="100" />
            <el-table-column prop="resultPreview" label="结果预览" min-width="280">
              <template #default="{ row }">{{ row.resultPreview || '（暂无结果）' }}</template>
            </el-table-column>
            <el-table-column prop="errorMsg" label="失败原因" min-width="180">
              <template #default="{ row }">{{ row.errorMsg || '—' }}</template>
            </el-table-column>
          </el-table>
          <div class="pager-row">
            <el-pagination
              layout="total, prev, pager, next"
              :total="ocr.total"
              :current-page="ocr.pageNum"
              :page-size="PAGE_SIZE"
              @current-change="loadOcr"
            />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import ChatSessionView from '@/views/ai/ChatSessionView.vue'
import { aiAuditApi, localizationAuditApi, moderationHitAuditApi } from '@/api'
import type {
  AiAuditMemoryRow,
  AiAuditOcrTaskRow,
  AiAuditSummaryRow,
  AiAuditToolCallRow,
  LocalizationAuditRow,
  ModerationHitAuditRow
} from '@/types'

const PAGE_SIZE = 20
const TASK_TEXT: Record<number, string> = { 0: '待处理', 1: '进行中', 2: '成功', 3: '失败' }

const tab = ref('sessions')

interface Paged<T> {
  rows: T[]
  total: number
  pageNum: number
  loading: boolean
}

function paged<T>(): Paged<T> {
  return { rows: [], total: 0, pageNum: 1, loading: false }
}

const tools = reactive({ ...paged<AiAuditToolCallRow>(), userId: '', sessionId: '', toolName: '', ok: '' })
const memories = reactive({
  ...paged<AiAuditMemoryRow>(),
  userId: '',
  memoryKey: '',
  keyword: '',
  includeDeleted: false
})
const summaries = reactive({ ...paged<AiAuditSummaryRow>(), userId: '', keyword: '' })
const moderation = reactive({
  ...paged<ModerationHitAuditRow>(),
  targetType: '',
  categoryCode: '',
  severity: ''
})
const translations = reactive({ ...paged<LocalizationAuditRow>(), kind: '', status: '' })
const ocr = reactive({ ...paged<AiAuditOcrTaskRow>(), userId: '', bizType: '', taskStatus: '' })

/** 文本输入转数字：空串与非法值都当「不过滤」，避免把 NaN 发给后端。 */
function toNumber(value: string): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toBoolean(value: string): boolean | undefined {
  if (value === '') return undefined
  return value === '1'
}

async function loadTools(pageNum = 1) {
  tools.loading = true
  tools.pageNum = pageNum
  try {
    const result = await aiAuditApi.toolCalls({
      userId: toNumber(tools.userId),
      sessionId: toNumber(tools.sessionId),
      toolName: tools.toolName.trim() || undefined,
      ok: toBoolean(tools.ok),
      pageNum,
      pageSize: PAGE_SIZE
    })
    tools.rows = result.records
    tools.total = result.total
  } finally {
    tools.loading = false
  }
}

async function loadMemories(pageNum = 1) {
  memories.loading = true
  memories.pageNum = pageNum
  try {
    const result = await aiAuditApi.memories({
      userId: toNumber(memories.userId),
      memoryKey: memories.memoryKey.trim() || undefined,
      keyword: memories.keyword.trim() || undefined,
      includeDeleted: memories.includeDeleted,
      pageNum,
      pageSize: PAGE_SIZE
    })
    memories.rows = result.records
    memories.total = result.total
  } finally {
    memories.loading = false
  }
}

async function loadSummaries(pageNum = 1) {
  summaries.loading = true
  summaries.pageNum = pageNum
  try {
    const result = await aiAuditApi.summaries({
      userId: toNumber(summaries.userId),
      keyword: summaries.keyword.trim() || undefined,
      pageNum,
      pageSize: PAGE_SIZE
    })
    summaries.rows = result.records
    summaries.total = result.total
  } finally {
    summaries.loading = false
  }
}

async function loadModeration(pageNum = 1) {
  moderation.loading = true
  moderation.pageNum = pageNum
  try {
    const result = await moderationHitAuditApi.list({
      targetType: moderation.targetType || undefined,
      categoryCode: moderation.categoryCode.trim() || undefined,
      severity: toNumber(moderation.severity),
      pageNum,
      pageSize: PAGE_SIZE
    })
    moderation.rows = result.records
    moderation.total = result.total
  } finally {
    moderation.loading = false
  }
}

async function loadTranslations(pageNum = 1) {
  translations.loading = true
  translations.pageNum = pageNum
  try {
    const result = await localizationAuditApi.list({
      kind: translations.kind || undefined,
      status: translations.status || undefined,
      pageNum,
      pageSize: PAGE_SIZE
    })
    translations.rows = result.records
    translations.total = result.total
  } finally {
    translations.loading = false
  }
}

async function loadOcr(pageNum = 1) {
  ocr.loading = true
  ocr.pageNum = pageNum
  try {
    const result = await aiAuditApi.ocrTasks({
      userId: toNumber(ocr.userId),
      bizType: toNumber(ocr.bizType),
      taskStatus: toNumber(ocr.taskStatus),
      pageNum,
      pageSize: PAGE_SIZE
    })
    ocr.rows = result.records
    ocr.total = result.total
  } finally {
    ocr.loading = false
  }
}

/**
 * 页签首次激活时才请求：七个页签一次全拉会在打开页面时打出七次查询，
 * 而运营通常只看其中一个。
 */
function onTabChange(name: string | number) {
  const loaders: Record<string, () => void> = {
    tools: () => tools.total === 0 && loadTools(1),
    memories: () => memories.total === 0 && loadMemories(1),
    summaries: () => summaries.total === 0 && loadSummaries(1),
    moderation: () => moderation.total === 0 && loadModeration(1),
    translations: () => translations.total === 0 && loadTranslations(1),
    ocr: () => ocr.total === 0 && loadOcr(1)
  }
  loaders[String(name)]?.()
}

function fmtTime(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 19)
}

function severityType(severity: number) {
  if (severity >= 3) return 'danger'
  if (severity === 2) return 'warning'
  return 'info'
}

function statusType(status: string) {
  if (status === 'READY') return 'success'
  if (status === 'FAILED') return 'danger'
  return 'info'
}

function taskType(status: number) {
  if (status === 2) return 'success'
  if (status === 3) return 'danger'
  return 'info'
}
</script>

<style scoped>
.page-head h2 {
  margin: 0 0 6px;
  font-size: 20px;
}
.page-desc {
  margin: 0 0 12px;
  color: #606266;
  font-size: 13px;
  line-height: 1.7;
}
.audit-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.audit-table {
  width: 100%;
}
.summary-body {
  margin: 0;
  padding: 12px 16px;
  background: #f7f8fa;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.7;
}
.pager-row {
  display: flex;
  justify-content: flex-end;
}
.review-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  align-items: flex-end;
}
.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.filter-label {
  font-size: 12px;
  color: #909399;
}
.filter-actions {
  display: flex;
  gap: 8px;
}
</style>
