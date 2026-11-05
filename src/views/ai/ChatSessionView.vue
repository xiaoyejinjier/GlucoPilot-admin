<template>
  <div class="page-wrap chat-audit">
    <div class="head">
      <div>
        <h2 class="page-title">AI 会话审计</h2>
        <p class="text-muted description">
          只读页面。列表只有元数据，消息只给 200 字预览；<strong>点开「展开原文」才读到正文，那一次会在后端写一条审计</strong>
          （<code>ai_chat_audit_view</code>），所以同一会话内的同一条消息不会被重复预取。
        </p>
      </div>
      <div class="heading-actions">
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新列表</el-button>
      </div>
    </div>

    <div class="kt-card audit-card">
      <form class="review-filters" @submit.prevent="search">
        <div class="filter-field">
          <label class="filter-label" for="audit-user">用户 ID</label>
          <el-input id="audit-user" v-model="query.userId" placeholder="精确匹配" clearable @clear="search" />
        </div>
        <div class="filter-field">
          <label class="filter-label" for="audit-status">会话状态</label>
          <el-select id="audit-status" v-model="query.status" placeholder="全部" :empty-values="[null, undefined]" @change="search">
            <el-option label="全部" value="" />
            <el-option label="归档" value="0" />
            <el-option label="进行中" value="1" />
            <el-option label="已结束" value="2" />
          </el-select>
        </div>
        <div class="filter-field keyword-field">
          <label class="filter-label" for="audit-keyword">关键词</label>
          <el-input
            id="audit-keyword"
            v-model="query.keyword"
            placeholder="搜索会话标题或用户昵称（≤50 字）"
            clearable
            maxlength="50"
            @clear="search"
          />
        </div>
        <div class="filter-actions">
          <el-button type="primary" native-type="submit">搜索</el-button>
          <el-button native-type="button" @click="resetFilters">重置</el-button>
        </div>
      </form>

      <div class="filter-result">
        <span>共 <strong>{{ total }}</strong> 个会话</span>
        <span class="text-muted">按最近有人说话的时间倒序</span>
      </div>

      <el-table
        :data="rows"
        v-loading="loading"
        height="100%"
        class="paginated-table"
        empty-text="没有符合条件的会话"
      >
        <el-table-column label="会话" width="90" prop="id" />
        <el-table-column label="用户" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.userNickname || '（未设置昵称）' }}</span>
            <span class="text-muted"> #{{ row.userId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="标题" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.title || '（无标题）' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" disable-transitions :type="row.sessionStatus === 1 ? 'success' : 'info'">
              {{ SESSION_STATUS[row.sessionStatus] || row.sessionStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="消息" width="80" align="right" prop="msgCount" />
        <el-table-column label="分片轮次" width="100" align="right">
          <template #default="{ row }">
            <el-tooltip v-if="row.contextRounds > 0" content="chat_context 里有几轮装配记录可查" placement="top">
              <span>{{ row.contextRounds }}</span>
            </el-tooltip>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="摘要" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.hasSummary" size="small" type="success" effect="plain" disable-transitions>有</el-tag>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="最近消息" width="170">
          <template #default="{ row }">{{ fmtTime(row.lastMsgAt || row.createdAt || '') }}</template>
        </el-table-column>
        <el-table-column label="模型" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.modelCode || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openSession(row)">查看消息</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager-row">
        <span>第 {{ pageNum }} / {{ Math.max(1, Math.ceil(total / pageSize)) }} 页</span>
        <el-pagination
          v-model:current-page="pageNum"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="load"
        />
      </div>
    </div>

    <el-drawer v-model="drawerOpen" :title="drawerTitle" size="52%" destroy-on-close @closed="resetDrawer">
      <div v-if="current" class="drawer-body">
        <div class="drawer-meta">
          <span>用户 #{{ current.userId }} {{ current.userNickname || '' }}</span>
          <span>模型 {{ current.modelCode || '—' }}</span>
          <span>提示词 {{ current.systemPromptVer || '—' }}</span>
          <span>分片轮次 {{ current.contextRounds }}</span>
        </div>

        <div class="context-block">
          <div class="context-head">
            <span class="context-title">上下文构成</span>
            <span class="text-muted">
              <template v-if="contextView">
                共 {{ contextView.rounds.length }} 轮 · 合计 {{ contextView.totalTokens }} token（装配期估算）
              </template>
              <template v-else>每轮 prompt 由哪些分片拼成、各占多少 token</template>
            </span>
            <el-button link type="primary" @click="toggleContext">{{ contextOpen ? '收起' : '展开' }}</el-button>
          </div>
          <div v-if="contextOpen" v-loading="contextLoading" class="context-body">
            <p class="context-hint text-muted">
              只记元数据、不存正文；token 是装配期估算，不是厂商返回的 usage。展开这里不会留下审计记录。
            </p>
            <div v-for="round in contextView?.rounds || []" :key="round.contextRound" class="context-round">
              <div class="context-round-head">
                <span>第 {{ round.contextRound }} 轮</span>
                <span class="text-muted">{{ round.modelCode || '—' }} · {{ round.totalTokens }} token</span>
                <span v-if="round.triggerMsgId" class="text-muted">触发 #{{ round.triggerMsgId }}</span>
              </div>
              <div v-if="round.shards.length" class="shard-bar">
                <span
                  v-for="(shard, sIdx) in round.shards"
                  :key="`bar-${round.contextRound}-${sIdx}`"
                  class="shard-seg"
                  :class="`seg-${shard.contextType ?? 0}`"
                  :style="{ flex: shardFlex(shard) }"
                  :title="`${shardLabel(shard)} ${shard.tokenEstimate ?? 0} token`"
                />
              </div>
              <div v-if="round.shards.length" class="shard-legend">
                <span v-for="(shard, sIdx) in round.shards" :key="`legend-${round.contextRound}-${sIdx}`">
                  <i class="shard-dot" :class="`seg-${shard.contextType ?? 0}`" />
                  {{ shardLabel(shard) }} {{ shard.tokenEstimate ?? 0 }}
                </span>
              </div>
              <div v-else class="text-muted context-hint">这一轮没有分片记录</div>
            </div>
            <div v-if="!contextLoading && !(contextView?.rounds?.length)" class="text-muted context-hint">
              该会话没有分片记录（v1 之前的会话，或这一轮还没跑完）
            </div>
          </div>
        </div>

        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="预览是截断过的正文。点「展开原文」会读到完整内容，并在后端留下一条审计记录。"
          class="mb12"
        />

        <div v-loading="msgLoading" class="msg-list">
          <div v-for="msg in messages" :key="msg.id" class="msg-item">
            <div class="msg-head">
              <el-tag size="small" :type="msg.msgRole === 1 ? 'primary' : msg.msgRole === 2 ? 'success' : 'info'" effect="plain" disable-transitions>
                {{ ROLE_TEXT[msg.msgRole] || msg.msgRole }}
              </el-tag>
              <span class="text-muted">#{{ msg.seqNo }} · {{ TYPE_TEXT[msg.msgType] || msg.msgType }} · {{ fmtTime(msg.createdAt || '') }}</span>
              <span v-if="msg.modelCode" class="text-muted">{{ msg.modelCode }}</span>
              <span v-if="msg.promptTokens != null" class="text-muted">
                in {{ msg.promptTokens }} / out {{ msg.completionTokens ?? 0 }}
              </span>
              <span class="msg-actions">
                <el-button
                  v-if="!detailCache[msg.id]"
                  link
                  type="primary"
                  :loading="detailLoading === msg.id"
                  @click="loadDetail(msg)"
                >展开原文</el-button>
                <el-button v-else link @click="collapse(msg)">收起</el-button>
              </span>
            </div>
            <div class="msg-body">
              <template v-if="detailCache[msg.id]">
                <pre class="msg-full">{{ fullText(detailCache[msg.id]!) }}</pre>
                <div class="msg-detail-meta text-muted">
                  <span v-if="msg.finishReason != null">结束原因 {{ FINISH_TEXT[msg.finishReason] || msg.finishReason }}</span>
                  <span v-if="msg.latencyMs != null">耗时 {{ msg.latencyMs }} ms</span>
                  <span v-if="detailCache[msg.id]!.mediaId">图片 #{{ detailCache[msg.id]!.mediaId }}</span>
                  <span v-if="detailCache[msg.id]!.voiceMediaId">
                    语音 #{{ detailCache[msg.id]!.voiceMediaId }}
                    <template v-if="detailCache[msg.id]!.voiceDurationMs">（{{ detailCache[msg.id]!.voiceDurationMs }} ms）</template>
                  </span>
                  <span v-if="detailCache[msg.id]!.replyToMsgId">回复 #{{ detailCache[msg.id]!.replyToMsgId }}</span>
                </div>
              </template>
              <p v-else class="msg-preview">{{ msg.preview }}</p>
            </div>
          </div>
          <div v-if="!messages.length && !msgLoading" class="text-muted empty-msg">该会话没有消息</div>
        </div>

        <div class="pager-row">
          <span>第 {{ msgPageNum }} / {{ Math.max(1, Math.ceil(msgTotal / msgPageSize)) }} 页</span>
          <el-pagination
            v-model:current-page="msgPageNum"
            :page-size="msgPageSize"
            :total="msgTotal"
            layout="total, prev, pager, next"
            @current-change="loadMessages"
          />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { aiChatAuditApi } from '@/api'
import type { AiChatContextShard, AiChatContextView, AiChatMessageDetail, AiChatMessageRow, AiChatSessionRow } from '@/types'
import { fmtTime } from '@/utils/format'

const SESSION_STATUS: Record<number, string> = { 0: '归档', 1: '进行中', 2: '已结束' }
const ROLE_TEXT: Record<number, string> = { 1: '用户', 2: '助手', 3: '系统' }
const TYPE_TEXT: Record<number, string> = { 1: '文本', 2: '图片', 3: '语音' }
// 与后端 CodeEnum.ChatFinishReason 对齐：1 正常 / 2 长度截断 / 3 内容过滤 / 4 出错
const FINISH_TEXT: Record<number, string> = { 1: '正常', 2: '长度截断', 3: '内容过滤', 4: '出错' }

const loading = ref(false)
const rows = ref<AiChatSessionRow[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10
const query = reactive({ userId: '', status: '', keyword: '' })

const drawerOpen = ref(false)
const current = ref<AiChatSessionRow | null>(null)
const msgLoading = ref(false)
const messages = ref<AiChatMessageRow[]>([])
const msgTotal = ref(0)
const msgPageNum = ref(1)
const msgPageSize = 20
const detailLoading = ref<number | null>(null)
/**
 * 已展开的原文缓存。
 * 只放内存、不预取：每一条都是运维的一次显式请求，背后对应一条审计记录；
 * 来回切换分页时用缓存，避免同一条消息被读两次留下两条重复审计。
 */
const detailCache = reactive<Record<number, AiChatMessageDetail | null>>({})

/** 上下文构成：默认收起。展开才请求，且只在第一次展开时请求一次（元数据不写审计，重读也无副作用）。 */
const contextOpen = ref(false)
const contextLoading = ref(false)
const contextView = ref<AiChatContextView | null>(null)


const drawerTitle = computed(() => (current.value ? `会话 #${current.value.id} ${current.value.title || ''}` : '会话消息'))

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await aiChatAuditApi.list({
      userId: query.userId ? Number(query.userId) : undefined,
      status: query.status === '' ? undefined : Number(query.status),
      keyword: query.keyword || undefined,
      pageNum: pageNum.value,
      pageSize
    })
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    ElMessage.error((e as Error)?.message || '会话列表加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  pageNum.value = 1
  load()
}

function resetFilters() {
  query.userId = ''
  query.status = ''
  query.keyword = ''
  search()
}

function openSession(row: AiChatSessionRow) {
  current.value = row
  drawerOpen.value = true
  resetMessages()
  loadMessages(1)
}

function resetMessages() {
  messages.value = []
  msgTotal.value = 0
  msgPageNum.value = 1
  Object.keys(detailCache).forEach((key) => delete detailCache[Number(key)])
}

function resetContext() {
  contextOpen.value = false
  contextLoading.value = false
  contextView.value = null
}

function resetDrawer() {
  current.value = null
  resetMessages()
  resetContext()
}

async function toggleContext() {
  contextOpen.value = !contextOpen.value
  // 收起时不请求；已加载过就不再重复拉（同一会话的分片在一次抽屉生命周期内不会变）
  if (!contextOpen.value || contextView.value || !current.value) return
  contextLoading.value = true
  try {
    contextView.value = await aiChatAuditApi.context(current.value.id)
  } catch (e) {
    ElMessage.error((e as Error)?.message || '上下文构成加载失败')
  } finally {
    contextLoading.value = false
  }
}

/** 分片占比用 flex 权重表达，省掉百分比舍入，累计永远刚好铺满一条。 */
function shardFlex(shard: AiChatContextShard): string {
  const tokens = shard.tokenEstimate ?? 0
  return String(tokens > 0 ? tokens : 1)
}

const SHARD_TEXT: Record<string, string> = {
  system_prompt: '系统提示词',
  long_term_memory: '长期记忆',
  context_summary: '滚动摘要',
  tool_digest: '工具摘要',
  history_messages: '历史消息'
}

const TYPE_TEXT_SHARD: Record<number, string> = { 1: '系统提示', 3: '历史摘要', 5: '工具结果', 6: '其他' }

function shardLabel(shard: AiChatContextShard): string {
  if (shard.contextKey && SHARD_TEXT[shard.contextKey]) return SHARD_TEXT[shard.contextKey]
  if (shard.contextKey) return shard.contextKey
  const type = shard.contextType
  return type != null && TYPE_TEXT_SHARD[type] ? TYPE_TEXT_SHARD[type] : '分片'
}

async function loadMessages(page = msgPageNum.value) {
  if (!current.value) return
  msgLoading.value = true
  try {
    const data = await aiChatAuditApi.messages(current.value.id, { pageNum: page, pageSize: msgPageSize })
    messages.value = data.records
    msgTotal.value = data.total
    msgPageNum.value = page
  } catch (e) {
    ElMessage.error((e as Error)?.message || '消息加载失败')
  } finally {
    msgLoading.value = false
  }
}

async function loadDetail(msg: AiChatMessageRow) {
  if (!current.value) return
  detailLoading.value = msg.id
  try {
    detailCache[msg.id] = await aiChatAuditApi.messageDetail(current.value.id, msg.id)
  } catch (e) {
    ElMessage.error((e as Error)?.message || '读取原文失败')
  } finally {
    detailLoading.value = null
  }
}

function collapse(msg: AiChatMessageRow) {
  delete detailCache[msg.id]
}

/** 全文展示：文本优先；图片/语音把描述与转写拼在一起，并保留原有换行。 */
function fullText(detail: AiChatMessageDetail): string {
  const parts: string[] = []
  if (detail.contentText) parts.push(detail.contentText)
  if (detail.mediaCaption) parts.push(`[图片描述] ${detail.mediaCaption}`)
  if (detail.asrText) parts.push(`[语音转写] ${detail.asrText}`)
  return parts.length ? parts.join('\n\n') : '（该消息没有可展示的文本内容）'
}
</script>

<style scoped>
.audit-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.review-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}
.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 150px;
}
.keyword-field {
  flex: 1;
  min-width: 240px;
}
.filter-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.filter-actions {
  display: flex;
  gap: 8px;
}
.filter-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 12px 0;
  font-size: 13px;
}
.pager-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}
.drawer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.context-block {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
}
.context-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.context-title {
  font-weight: 600;
}
.context-head .el-button {
  margin-left: auto;
}
.context-body {
  margin-top: 8px;
  max-height: 260px;
  overflow: auto;
}
.context-hint {
  margin: 4px 0;
  font-size: 12px;
  line-height: 1.6;
}
.context-round {
  padding: 8px 0;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.context-round:first-of-type {
  border-top: none;
}
.context-round-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  font-size: 12px;
}
.shard-bar {
  display: flex;
  height: 12px;
  margin: 6px 0 4px;
  border-radius: 6px;
  /* 与卡片同色的细边框，避免相邻同色分片看不出接缝 */
  overflow: hidden;
}

.shard-bar .shard-seg + .shard-seg {
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.55);
}
.shard-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.shard-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 4px;
  border-radius: 2px;
  vertical-align: middle;
}
/* 分片配色按 contextType 区分，legend 与进度条共用 */
.seg-1 {
  background: #409eff;
}
.seg-3 {
  background: #b88230;
}
.seg-5 {
  background: #67c23a;
}
.seg-6 {
  background: #909399;
}
.seg-0 {
  background: #c8c9cc;
}
.msg-list {
  flex: 1;
  min-height: 120px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px 12px;
}
.msg-item {
  padding: 10px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}
.msg-item:last-child {
  border-bottom: none;
}
.msg-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
.msg-actions {
  margin-left: auto;
}
.msg-body {
  margin-top: 6px;
}
.msg-preview {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-full {
  margin: 0;
  padding: 10px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow: auto;
}
.msg-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
}
.empty-msg {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
}
</style>
