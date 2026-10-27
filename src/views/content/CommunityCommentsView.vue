<template>
  <div class="page-wrap comment-moderation">
    <div class="head">
      <div>
        <h2 class="page-title">社区评论管理</h2>
        <p class="text-muted description">评论是先发后审：AI 判违规会立即隐藏并移出公开列表。运营也可以主动隐藏机器放行的内容，两种情况都能在这里恢复。</p>
      </div>
      <div class="heading-actions">
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新列表</el-button>
      </div>
    </div>
    <el-alert title="AI 审核失败（判定为异常）时不会隐藏评论 —— 模型故障不该让社区停摆，但也不等于通过，建议按下「AI 判定：异常」复查一遍。" type="info" :closable="false" show-icon class="mb16" />
    <div class="kt-card moderation-card">
      <form class="review-filters" @submit.prevent="search">
        <div class="filter-field">
          <label class="filter-label" for="comment-hidden">可见状态</label>
          <el-select id="comment-hidden" v-model="query.hidden" placeholder="全部" :empty-values="[null, undefined]" @change="search">
            <el-option label="全部" value="" /><el-option label="已被隐藏" value="1" /><el-option label="正常可见" value="0" />
          </el-select>
        </div>
        <div class="filter-field">
          <label class="filter-label" for="comment-verdict">AI 判定</label>
          <el-select id="comment-verdict" v-model="query.verdict" placeholder="全部" :empty-values="[null, undefined]" @change="search">
            <el-option label="全部" value="" /><el-option label="通过" value="PASS" /><el-option label="违规" value="REJECT" /><el-option label="异常" value="ERROR" /><el-option label="待审" value="PENDING" />
          </el-select>
        </div>
        <div class="filter-field">
          <label class="filter-label" for="comment-status">审核进度</label>
          <el-select id="comment-status" v-model="query.status" placeholder="全部" :empty-values="[null, undefined]" @change="search">
            <el-option label="全部" value="" /><el-option label="已审完" value="DONE" /><el-option label="待审核" value="PENDING" /><el-option label="审核中" value="REVIEWING" /><el-option label="未审（AI 未开启）" value="SKIPPED" />
          </el-select>
        </div>
        <div class="filter-field keyword-field">
          <label class="filter-label" for="comment-keyword">关键词</label>
          <el-input id="comment-keyword" v-model="query.keyword" placeholder="搜索评论内容或作者昵称" clearable maxlength="80" @clear="search" />
        </div>
        <div class="filter-actions"><el-button type="primary" native-type="submit">搜索</el-button><el-button native-type="button" @click="resetFilters">重置</el-button></div>
      </form>
      <div class="filter-result">
        <span>共 <strong>{{ total }}</strong> 条评论</span>
        <span>按评论时间倒序，被隐藏的排在最前可切换到「已被隐藏」单独复查</span>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="mb16" />
      <el-table v-loading="loading" :data="rows" row-key="id" empty-text="没有符合条件的评论">
        <el-table-column label="评论内容" min-width="280">
          <template #default="{row}">
            <div class="comment-body" :class="{ muted: row.hidden }">{{ row.content }}</div>
            <div v-if="row.aiReason" class="table-summary" :title="row.aiReason">判定说明：{{ row.aiReason }}</div>
          </template>
        </el-table-column>
        <el-table-column label="所属文章" min-width="180">
          <template #default="{row}"><div class="table-title link" @click="openArticle(row)">{{ row.articleTitle }}</div><div class="table-summary">#{{ row.newsId }}</div></template>
        </el-table-column>
        <el-table-column label="作者" min-width="130">
          <template #default="{row}"><div class="table-title">{{ row.authorNickname }}</div><div class="table-summary">{{ row.authorKey }}</div></template>
        </el-table-column>
        <el-table-column label="AI 判定" min-width="170">
          <template #default="{row}">
            <el-tag size="small" :type="verdictTone(row.aiVerdict)">{{ verdictText(row.aiVerdict) }}</el-tag>
            <div v-if="row.aiCategory" class="table-summary">{{ categoryText(row.aiCategory) }} · 严重度 {{ row.aiSeverity ?? '-' }} · 置信度 {{ row.aiConfidence ?? '-' }}</div>
            <div v-else-if="row.aiStatus === 'SKIPPED'" class="table-summary">AI 未开启，未参与审核</div>
          </template>
        </el-table-column>
        <el-table-column label="可见状态" width="120">
          <template #default="{row}">
            <el-tag :type="row.hidden ? 'danger' : 'success'" effect="plain">{{ row.hidden ? '已被隐藏' : '正常可见' }}</el-tag>
            <div v-if="row.hidden && row.aiVerdict !== 'REJECT'" class="table-summary">人工隐藏</div>
          </template>
        </el-table-column>
        <el-table-column label="评论时间" width="160">
          <template #default="{row}">{{ date(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{row}">
            <el-button v-if="row.hidden" link type="primary" :disabled="saving || !canManage" @click="setHidden(row, false)">恢复显示</el-button>
            <el-button v-else link type="danger" :disabled="saving || !canManage" @click="setHidden(row, true)">隐藏</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="review-pagination">
        <span>第 {{ pageNum }} / {{ Math.max(1, Math.ceil(total / 10)) }} 页</span>
        <el-pagination v-model:current-page="pageNum" :page-size="10" :total="total" layout="total, prev, pager, next" @current-change="load" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { communityApi, type AdminComment } from '@/api/community'
import { useAuthStore } from '@/stores/auth'
import { getAccessToken } from '@/utils/request'

const router = useRouter()
const auth = useAuthStore()
const canManage = computed(() => auth.role === 'admin' && auth.hasPermission('content:news:edit'))

const query = reactive({ status: '', verdict: '', hidden: '', keyword: '' })
const applied = reactive({ ...query })
const rows = ref<AdminComment[]>([])
const pageNum = ref(1)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const verdictNames: Record<string, string> = { PASS: '通过', REJECT: '违规', ERROR: '异常', PENDING: '待审' }
const categories: Record<string, string> = {
  porn: '色情低俗', violence: '暴力血腥', illegal_goods: '违禁品交易', medical_claim: '疗效夸大宣传',
  medical_advice: '个体化医疗建议', scam_ad: '诈骗广告', privacy: '泄露隐私', hate_harass: '仇恨辱骂',
  political: '涉政敏感', minor: '涉未成年人', pseudo_science: '伪科学养生', off_topic: '与主题无关'
}
const verdictText = (v: string) => verdictNames[v] || v || '待审'
function verdictTone(v: string): 'success' | 'danger' | 'warning' | 'info' {
  return v === 'PASS' ? 'success' : v === 'REJECT' ? 'danger' : v === 'ERROR' ? 'warning' : 'info'
}
const categoryText = (code: string) => categories[code] || code
const date = (value: string) => (value ? value.replace('T', ' ').slice(0, 19) : '-')

let alive = true
let run = 0
function current(token: string) { return alive && getAccessToken() === token }

async function load() {
  const id = ++run
  const token = getAccessToken()
  loading.value = true
  error.value = ''
  try {
    const result = await communityApi.comments({ ...applied, pageNum: pageNum.value })
    if (!current(token) || id !== run) return
    rows.value = result.records
    total.value = result.total
    if (!rows.value.length && pageNum.value > 1) { pageNum.value--; await load() }
  } catch (e) {
    if (current(token) && id === run) error.value = e instanceof Error ? e.message : '评论加载失败，请重试'
  } finally {
    if (current(token) && id === run) loading.value = false
  }
}
function search() { Object.assign(applied, query, { keyword: query.keyword.trim() }); pageNum.value = 1; void load() }
function resetFilters() { Object.assign(query, { status: '', verdict: '', hidden: '', keyword: '' }); search() }
function openArticle(row: AdminComment) { void router.push(`/content/news/${row.newsId}/edit`) }

async function setHidden(row: AdminComment, hidden: boolean) {
  if (saving.value || !canManage.value) return
  const token = getAccessToken()
  try {
    await ElMessageBox.confirm(
      hidden
        ? `隐藏后这条评论会立即从公开列表消失，但不会改写 AI 的原始判定（仍保留为「${verdictText(row.aiVerdict)}」），管理员可随时恢复。确定隐藏吗？`
        : `恢复后这条评论会重新出现在公开列表里，但不会改写 AI 的原始判定（仍保留为「${verdictText(row.aiVerdict)}」，便于追溯）。确定恢复吗？`,
      hidden ? '隐藏这条评论' : '恢复被隐藏的评论',
      { type: 'warning', confirmButtonText: hidden ? '隐藏' : '恢复显示', cancelButtonText: '取消' })
  } catch { return }
  if (!current(token) || saving.value) return
  saving.value = true
  try {
    await communityApi.setCommentVisibility(row.id, hidden)
    if (!current(token)) return
    ElMessage.success(hidden ? '评论已隐藏' : '评论已恢复显示')
    await load()
  } catch (e) {
    if (current(token)) ElMessage.error(e instanceof Error ? e.message : `${hidden ? '隐藏' : '恢复'}失败，请重试`)
  } finally {
    if (current(token)) saving.value = false
  }
}

onBeforeUnmount(() => { alive = false; run++ })
void load()
</script>

<style scoped>
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}
.page-title{margin:0;font-size:18px;color:var(--kt-ink)}
.description{margin:6px 0 0;font-size:13px;line-height:1.7}
.mb16{margin-bottom:16px}
.moderation-card{padding-top:24px}
.review-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;align-items:end;gap:18px;margin-bottom:18px}
.filter-field{min-width:0}
.filter-label{display:block;font-size:12px;font-weight:500;color:var(--kt-muted);margin-bottom:9px}
.filter-field :deep(.el-select){width:100%}
.filter-actions{display:flex;align-items:center;gap:10px}
.filter-actions :deep(.el-button+.el-button){margin-left:0}
.filter-result{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:14px 0 18px;border-top:1px solid var(--kt-line);color:var(--kt-muted);font-size:12px}
.filter-result strong{color:var(--kt-ink);font-weight:600}
.comment-body{font-size:13px;color:var(--kt-ink);line-height:1.7;white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.comment-body.muted{color:var(--kt-muted);text-decoration:line-through;text-decoration-color:#d9b3b3}
.table-title{font-weight:600;color:var(--kt-ink);line-height:1.6}
.table-title.link{cursor:pointer}
.table-title.link:hover{color:var(--kt-brand)}
.table-summary{font-size:12px;color:var(--kt-muted);line-height:1.7;margin-top:4px}
.review-pagination{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:22px;color:var(--kt-muted);font-size:12px}
@media(max-width:1200px){.review-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.filter-actions{justify-content:flex-end}}
@media(max-width:760px){.head{flex-direction:column;gap:14px}.review-filters{grid-template-columns:1fr}.filter-actions{justify-content:flex-start}.review-pagination{flex-direction:column;align-items:flex-start}}
</style>
