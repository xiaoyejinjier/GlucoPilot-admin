<template>
  <div class="page-wrap paginated-page message-management">
    <div class="head">
      <div>
        <h2 class="page-title">信息管理</h2>
        <p class="description text-muted">查看用户私信及双方对话，按发送时间倒序排列。</p>
      </div>
      <el-button :icon="Refresh" :loading="list.loading" @click="list.load">刷新</el-button>
    </div>
    <div class="kt-card paginated-card">
      <form class="filters" @submit.prevent="search">
        <el-input v-model="filters.keyword" placeholder="消息内容 / 用户昵称" clearable maxlength="80" :prefix-icon="Search" @clear="search" />
        <el-input v-model="filters.senderId" placeholder="发送人用户ID" clearable maxlength="19" @clear="search" />
        <el-input v-model="filters.recipientId" placeholder="接收人用户ID" clearable maxlength="19" @clear="search" />
        <el-select v-model="filters.readState" placeholder="已读状态" clearable @change="search">
          <el-option label="未读" value="UNREAD" />
          <el-option label="已读" value="READ" />
        </el-select>
        <div class="filter-actions">
          <el-button type="primary" native-type="submit">查询</el-button>
          <el-button @click="reset">重置</el-button>
        </div>
      </form>
      <el-alert v-if="list.error" :title="list.error" type="error" :closable="false" show-icon class="error" />
      <el-table v-loading="list.loading" :data="list.rows" row-key="id" height="100%" class="paginated-table" empty-text="暂无符合条件的私信">
        <el-table-column prop="id" label="消息ID" width="90" />
        <el-table-column label="发送人" min-width="150">
          <template #default="{ row }"><div class="user-name">{{ row.senderNickname }}</div><div class="user-id">ID：{{ row.senderId }}</div></template>
        </el-table-column>
        <el-table-column label="接收人" min-width="150">
          <template #default="{ row }"><div class="user-name">{{ row.recipientNickname }}</div><div class="user-id">ID：{{ row.recipientId }}</div></template>
        </el-table-column>
        <el-table-column label="消息内容" min-width="300">
          <template #default="{ row }">
            <div class="message-preview">{{ row.content }}</div>
            <el-button link type="primary" @click="showContent(row)">查看全文</el-button>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="85">
          <template #default="{ row }"><el-tag :type="row.readAt ? 'info' : 'warning'" size="small" effect="plain">{{ row.readAt ? '已读' : '未读' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="发送时间" width="165"><template #default="{ row }">{{ fmtTime(row.createdAt) }}</template></el-table-column>
        <el-table-column label="操作" width="100" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openConversation(row)">查看对话</el-button></template></el-table-column>
      </el-table>
      <TablePagination :page-num="list.pageNum" :page-size="list.pageSize" :total="list.total" :summary="list.summary"
        :disabled="list.loading" @size-change="list.changeSize" @page-change="list.changePage" />
    </div>

    <el-dialog v-model="conversationVisible" title="双方对话" width="min(960px, 94vw)" @close="closeConversation">
      <template v-if="selected">
        <div class="conversation-head">
          <div><strong>{{ selected.senderNickname }}</strong><span class="text-muted">（ID：{{ selected.senderId }}）</span><span class="direction">↔</span><strong>{{ selected.recipientNickname }}</strong><span class="text-muted">（ID：{{ selected.recipientId }}）</span></div>
          <el-button :icon="Refresh" :loading="conversation.loading" @click="conversation.load">刷新</el-button>
        </div>
        <p class="text-muted conversation-hint">最新消息在上方；管理员查看不会改变用户的已读状态。</p>
        <el-alert v-if="conversation.error" :title="conversation.error" type="error" :closable="false" show-icon class="error" />
        <el-table v-loading="conversation.loading" :data="conversation.rows" row-key="id" max-height="420" empty-text="暂无对话消息">
          <el-table-column label="发送人" width="160"><template #default="{ row }"><strong>{{ row.senderNickname }}</strong><div class="user-id">ID：{{ row.senderId }}</div></template></el-table-column>
          <el-table-column label="消息内容" min-width="250"><template #default="{ row }"><div class="message-full">{{ row.content }}</div></template></el-table-column>
          <el-table-column label="发送 / 已读时间" width="180"><template #default="{ row }"><div>{{ fmtTime(row.createdAt) }}</div><div class="user-id">{{ row.readAt ? `已读于 ${fmtTime(row.readAt)}` : '对方未读' }}</div></template></el-table-column>
        </el-table>
        <TablePagination :page-num="conversation.pageNum" :page-size="conversation.pageSize" :total="conversation.total" :summary="conversation.summary"
          :disabled="conversation.loading" @size-change="conversation.changeSize" @page-change="conversation.changePage" />
      </template>
    </el-dialog>
    <el-dialog v-model="contentVisible" title="消息全文" width="min(560px, 94vw)"><div class="message-full full-dialog">{{ fullContent }}</div></el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, toRefs } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import TablePagination from '@/components/TablePagination.vue'
import { messageApi, type AdminMessage, type MessageFilters, type MessagePage } from '@/api/messages'
import { getAccessToken } from '@/utils/request'
import { fmtTime } from '@/utils/format'

let alive = true
const filters = reactive({ keyword: '', senderId: '', recipientId: '', readState: '' })
let applied: MessageFilters = {}
const selected = ref<AdminMessage | null>(null)
const conversationVisible = ref(false)
const contentVisible = ref(false)
const fullContent = ref('')

// Separate request versions keep rapid filtering / opening another conversation from showing stale data.
function createPage(fetchPage: (page: { pageNum: number; pageSize: number }) => Promise<MessagePage>) {
  let version = 0
  const state = reactive({ rows: [] as AdminMessage[], pageNum: 1, pageSize: 10, total: 0, loading: false, error: '' })
  async function load(): Promise<void> {
    const current = ++version
    const token = getAccessToken()
    const valid = () => alive && current === version && token === getAccessToken()
    state.loading = true
    state.error = ''
    try {
      const result = await fetchPage({ pageNum: state.pageNum, pageSize: state.pageSize })
      if (!valid()) return
      const total = Number(result.total)
      if (!Array.isArray(result.records) || !Number.isInteger(total) || total < 0) throw new Error('接口返回的分页数据异常')
      state.total = total
      const lastPage = Math.max(1, Math.ceil(total / state.pageSize))
      if (state.pageNum > lastPage) { state.pageNum = lastPage; await load(); return }
      state.rows = result.records
    } catch (e) {
      if (!valid()) return
      state.rows = []; state.total = 0
      state.error = e instanceof Error ? e.message : '消息加载失败，请重试'
    } finally { if (valid()) state.loading = false }
  }
  function changePage(value: number) { state.pageNum = value; void load() }
  function changeSize(value: number) { state.pageSize = value; state.pageNum = 1; void load() }
  function cancel() { version++; state.loading = false; state.rows = []; state.total = 0; state.error = '' }
  const summary = computed(() => state.total ? `共 ${state.total} 条私信 · 第 ${state.pageNum} / ${Math.ceil(state.total / state.pageSize)} 页` : '暂无记录')
  return reactive({ ...toRefs(state), load, changePage, changeSize, cancel, summary })
}
const list = createPage(page => messageApi.page({ ...applied, ...page }))
const conversation = createPage(page => {
  if (!selected.value) return Promise.resolve({ records: [], total: 0 })
  return messageApi.conversation(selected.value.senderId, selected.value.recipientId, page)
})
function search() {
  const senderId = filters.senderId.trim(), recipientId = filters.recipientId.trim()
  if ([senderId, recipientId].some(id => id && (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n))) {
    ElMessage.warning('请输入有效的用户ID（正整数）'); return
  }
  applied = { keyword: filters.keyword.trim(), senderId, recipientId, readState: filters.readState }
  list.pageNum = 1; void list.load()
}
function reset() { Object.assign(filters, { keyword: '', senderId: '', recipientId: '', readState: '' }); search() }
function openConversation(row: AdminMessage) {
  conversation.cancel(); selected.value = row; conversation.pageNum = 1
  conversationVisible.value = true; void conversation.load()
}
function closeConversation() { conversation.cancel(); selected.value = null }
function showContent(row: AdminMessage) { fullContent.value = row.content; contentVisible.value = true }
onBeforeUnmount(() => { alive = false; list.cancel(); conversation.cancel(); fullContent.value = '' })
void list.load()
</script>

<style scoped>
.head { display:flex; flex:none; align-items:center; justify-content:space-between; gap:16px; margin-bottom:16px; }
.page-title { margin:0; font-size:18px; }
.description { margin:8px 0 0; font-size:13px; }
.filters { display:grid; flex:none; grid-template-columns:minmax(220px,2fr) repeat(2,minmax(130px,1fr)) 120px auto; gap:12px; margin-bottom:18px; }
.filter-actions { display:flex; gap:10px; }
.filter-actions :deep(.el-button+.el-button) { margin-left:0; }
.user-name { font-weight:600; color:var(--kt-ink); }
.user-id { color:var(--kt-muted); font-size:12px; margin-top:5px; }
.message-preview { white-space:pre-wrap; word-break:break-word; line-height:1.7; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.message-full { white-space:pre-wrap; word-break:break-word; line-height:1.8; }
.full-dialog { max-height:55vh; overflow:auto; }
.conversation-head { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.direction { display:inline-block; padding:0 12px; color:var(--kt-brand); }
.conversation-hint { font-size:12px; margin:14px 0; }
.error { flex:none; margin-bottom:12px; }
@media(max-width:1150px) { .filters { grid-template-columns:repeat(2,minmax(0,1fr)); } .filter-actions { grid-column:1/-1; } }
</style>
