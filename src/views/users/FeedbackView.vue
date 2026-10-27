<template>
  <div class="page-wrap paginated-page">
    <div class="head">
      <h2 class="page-title">反馈管理</h2>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <div class="kt-card paginated-card">
      <div class="filter mb12">
        <el-select v-model="q.type" placeholder="反馈类型" clearable style="width: 150px" @change="search">
          <el-option v-for="t in types" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="q.status" placeholder="处理状态" clearable style="width: 150px" @change="search">
          <el-option label="待审批" value="received" />
          <el-option label="已完成" value="done" />
        </el-select>
        <el-input v-model="q.keyword" placeholder="关键词" clearable :prefix-icon="Search" style="width: 200px" @keyup.enter="search" @clear="search" />
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <span class="text-muted" style="font-size: 12px">提交回复后自动标为已完成</span>
      </div>

      <el-table :data="list" v-loading="loading" row-key="id" height="100%" class="paginated-table">
        <el-table-column label="序号" width="70" align="center">
          <template #default="{ $index }">{{ (page.pageNum - 1) * page.pageSize + $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="用户" width="120">
          <template #default="{ row }">{{ row.userName }}</template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.type }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="content" label="反馈内容" min-width="280" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="提交时间" width="160" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openHandle(row)">审批/回复</el-button>
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

    <el-dialog v-model="dialog.visible" :title="`审批反馈 #${dialog.row?.id}`" width="560px">
      <template v-if="dialog.row">
        <div class="kt-card mb12" style="background: #fafafa">
          <div class="text-muted" style="font-size: 13px">{{ dialog.row.userName }} · {{ dialog.row.type }} · {{ dialog.row.createdAt }}</div>
          <p style="margin: 8px 0 0">{{ dialog.row.content }}</p>
          <div v-if="dialog.row.reply" style="margin-top: 8px; font-size: 13px" class="reply-pre">上次回复：{{ dialog.row.reply }}</div>
        </div>
        <el-form label-width="90px">
          <el-form-item label="处理状态">
            <el-tag :type="statusType(dialog.row.status)">{{ statusText(dialog.row.status) }}</el-tag>
          </el-form-item>
          <el-form-item label="回复内容" required>
            <el-input v-model="form.reply" type="textarea" :rows="4" maxlength="1000" show-word-limit placeholder="填写给用户的回复，提交后自动完成审批" />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveReply">提交审批</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import { api } from '@/api'
import TablePagination from '@/components/TablePagination.vue'
import { useServerPagination } from '@/composables/useServerPagination'
import { useAuthStore } from '@/stores/auth'
import { refreshWorkReminders } from '@/utils/work-reminders'
import type { Feedback, FeedbackStatus, FeedbackType } from '@/types'

const auth = useAuthStore()
const route = useRoute()
const types: FeedbackType[] = ['产品建议', 'Bug问题', '功能诉求', '其他']
const saving = ref(false)
const q = reactive({ type: '' as FeedbackType | '', status: '' as FeedbackStatus | '', keyword: '' })
type FeedbackFilters = { keyword?: string; feedbackType?: number; replyStatus?: number }
const { page, records: list, loading, pageSummary, load, search: applyFilters, changeSize, changePage } =
  useServerPagination<Feedback, FeedbackFilters>(api.pageFeedback, {}, { errorMessage: '反馈加载失败' })
const dialog = reactive<{ visible: boolean; row: Feedback | null }>({ visible: false, row: null })
const form = reactive({ reply: '' })

watch(() => route.query.reminder, value => {
  if (value) {
    q.type = ''; q.keyword = ''; q.status = 'received'
    void search()
  } else void load()
}, { immediate: true })

function search() {
  return applyFilters({
    keyword: q.keyword.trim() || undefined,
    feedbackType: q.type ? types.indexOf(q.type) + 1 : undefined,
    replyStatus: q.status ? ({ received: 0, done: 2 } as const)[q.status] : undefined
  })
}

function reset() {
  q.type = ''
  q.status = ''
  q.keyword = ''
  return search()
}

function statusType(s: FeedbackStatus): 'danger' | 'warning' | 'success' {
  return s === 'done' ? 'success' : 'warning'
}
function statusText(s: FeedbackStatus): string {
  return s === 'done' ? '已完成' : '待审批'
}

function openHandle(row: Feedback) {
  dialog.row = row
  form.reply = row.reply
  dialog.visible = true
}

async function saveReply() {
  if (!dialog.row || saving.value) return
  if (!form.reply.trim()) {
    ElMessage.warning('请填写回复内容，提交后自动完成审批')
    return
  }
  saving.value = true
  try {
    await api.replyFeedback(dialog.row.id, form.reply)
    refreshWorkReminders()
    if (auth.account) api.writeLog(auth.account.username, auth.account.role, '反馈', '处理反馈', `#${dialog.row.id} → 已完成`)
    dialog.visible = false
    ElMessage.success('审批结果已回写，用户端可在“我的反馈”查看')
    await load()
  } catch (error) {
    ElMessage.error((error as Error).message || '审批提交失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.head { display: flex; flex: none; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 18px; }
.filter { display: flex; flex: none; flex-wrap: wrap; gap: 10px; align-items: center; }
.reply-pre { color: var(--kt-muted); }
</style>
