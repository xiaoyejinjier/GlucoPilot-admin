<template>
  <div class="page-wrap moderation-page">
    <div class="head">
      <div>
        <h2 class="page-title">{{ reportMode ? '社区举报管理' : '社区文章管理' }}</h2>
        <p class="text-muted description">{{ reportMode ? '认真回应每一条反馈，一起维护友善的交流环境。' : '查看全部文章、发布人与状态，统一管理官方资讯和社区投稿。' }}</p>
      </div>
      <div class="heading-actions">
        <el-button v-if="!reportMode && auth.hasPermission('content:news:edit')" type="primary" @click="router.push('/content/news/new')">发布官方文章</el-button>
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新列表</el-button>
      </div>
    </div>
    <div class="workflow" v-if="!reportMode && source === 'COMMUNITY'"><span><i>1</i>用户投稿</span><b>›</b><span><i>2</i>AI 初审</span><b>›</b><span class="current"><i>3</i>管理员终审</span><b>›</b><span><i>4</i>社区可见</span></div>
    <div class="kt-card moderation-card">
      <form class="review-filters" :class="{'report-filters': reportMode}" @submit.prevent="search">
        <div class="filter-field"><label class="filter-label" for="review-status">{{ reportMode ? '处理状态' : '文章状态' }}</label><el-select id="review-status" v-model="status" :placeholder="reportMode ? '全部状态' : '全部文章状态'" :empty-values="[null, undefined]" @change="search"><el-option v-for="item in statuses" :key="item.value" :label="item.label" :value="item.value" /></el-select></div>
        <template v-if="!reportMode"><div class="filter-field"><label class="filter-label" for="article-source">文章来源</label><el-select id="article-source" v-model="source" placeholder="全部来源" :empty-values="[null, undefined]" @change="search"><el-option label="全部来源" value="" /><el-option label="官方资讯" value="OFFICIAL" /><el-option label="社区投稿" value="COMMUNITY" /></el-select></div><div class="filter-field keyword-field"><label class="filter-label" for="article-keyword">关键词</label><el-input id="article-keyword" v-model="keyword" placeholder="搜索标题或发布人" clearable maxlength="80" @clear="search" /></div></template>
        <div class="filter-actions"><el-button type="primary" native-type="submit">搜索</el-button><el-button native-type="button" @click="resetFilters">重置</el-button></div>
      </form>
      <div class="filter-result"><span>共 <strong>{{ total }}</strong> {{ reportMode ? '条举报' : '篇文章' }}</span><span>{{ reportMode ? '按举报时间排序' : '按创建顺序排列' }}</span></div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="mb16" />
      <el-table v-if="reportMode" :data="reports" v-loading="loading" row-key="id" class="moderation-table">
        <el-table-column label="举报内容" min-width="240"><template #default="{row}"><div class="table-title">{{ targets[row.target_type] || row.target_type }} · #{{ row.target_id }}</div><div class="table-summary">{{ row.details || reasons[row.reason] || row.reason }}</div></template></el-table-column>
        <el-table-column label="举报原因" min-width="120"><template #default="{row}"><el-tag type="warning" effect="plain">{{ reasons[row.reason] || row.reason }}</el-tag></template></el-table-column>
        <el-table-column label="举报人" min-width="115"><template #default="{row}">u{{ row.reporter_id }}</template></el-table-column>
        <el-table-column label="处理状态" min-width="100"><template #default="{row}"><el-tag :type="row.state === 'OPEN' ? 'warning' : 'info'">{{ reportStates[row.state] || row.state }}</el-tag></template></el-table-column>
        <el-table-column label="举报时间" min-width="155"><template #default="{row}">{{ date(row.created_at) }}</template></el-table-column>
        <el-table-column label="操作" width="110" fixed="right"><template #default="{row}"><el-button link type="primary" @click="openReport(row)">{{ row.state === 'OPEN' ? '查看处理' : '查看详情' }}</el-button></template></el-table-column>
        <template #empty><el-empty :description="error ? '暂时无法加载举报，请稍后刷新' : '当前没有符合条件的举报'" :image-size="80" /></template>
      </el-table>
      <el-table v-else :data="articles" v-loading="loading" row-key="id" class="moderation-table">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="文章" min-width="270"><template #default="{row}"><div class="table-title">{{ row.title }}</div><div class="table-summary">{{ row.summary }}</div><div class="tag-list"><el-tag v-for="tag in row.tags" :key="tag.code" size="small" effect="plain" type="info">{{ tag.name }}</el-tag></div></template></el-table-column>
        <el-table-column label="发布人" min-width="140"><template #default="{row}"><div>{{ row.author?.nickname || '未记录发布人' }}</div><div class="table-summary">{{ row.author?.key || '—' }}</div></template></el-table-column>
        <el-table-column label="来源" min-width="100"><template #default="{row}"><el-tag effect="plain" :type="row.source === 'OFFICIAL' ? 'info' : 'success'">{{ row.source === 'OFFICIAL' ? '官方资讯' : '社区投稿' }}</el-tag></template></el-table-column>
        <el-table-column label="AI 初审" min-width="140"><template #default="{row}"><span v-if="row.source === 'OFFICIAL'" class="table-summary">官方资讯</span><template v-else><span class="ai-result" :class="{passed: row.aiVerdict === 'PASS', rejected: row.aiVerdict === 'REJECT'}">{{ aiText(row.aiVerdict) }}</span><div class="table-summary" :title="row.aiReason">{{ row.aiReason || '等待初审结果' }}</div></template></template></el-table-column>
        <el-table-column label="文章状态" min-width="110"><template #default="{row}"><el-tag :type="stateTone(row.state)">{{ stateNames[row.state] || row.state }}</el-tag></template></el-table-column>
        <el-table-column label="创建时间" min-width="155"><template #default="{row}">{{ date(row.createdAt) }}<div v-if="row.source !== 'OFFICIAL'" class="version">第 {{ row.revision }} 版</div></template></el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{row}">
            <template v-if="canEdit">
              <el-button link type="primary" @click="editArticle(row)">编辑</el-button>
              <el-button v-if="row.state === 'PUBLISHED'" link type="warning" @click="unpublishArticle(row)">下架</el-button>
              <el-popconfirm title="确认删除该文章？" @confirm="removeArticle(row)">
                <template #reference><el-button link type="danger">删除</el-button></template>
              </el-popconfirm>
            </template>
            <el-button v-else link type="primary" @click="openArticle(row)">查看详情</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="error ? '暂时无法加载文章，请稍后刷新' : '当前没有符合条件的文章'" :image-size="80" /></template>
      </el-table>
      <div class="review-pagination"><span>每页 10 条</span><el-pagination background layout="prev, pager, next, jumper" :total="total" :page-size="10" :current-page="pageNum" :disabled="loading" @update:current-page="changePage" /></div>
    </div>

    <el-drawer v-model="drawer" :title="selectedReport ? '举报详情与处理' : '文章详情与审核'" size="min(720px, 95vw)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <div v-loading="detailLoading" class="detail-content">
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" show-icon />
        <template v-if="selectedArticle && !selectedReport">
          <div class="article-preview"><span class="preview-kicker">{{ selectedArticle.source === 'OFFICIAL' ? '官方资讯' : `社区投稿 · 第 ${selectedArticle.revision} 版` }}</span><h2>{{ selectedArticle.title }}</h2><div class="preview-meta">发布人：{{ selectedArticle.author?.nickname || '未记录发布人' }}<span v-if="selectedArticle.author?.key">（{{ selectedArticle.author.key }}）</span> · {{ date(selectedArticle.createdAt) }}</div><div class="tag-list"><el-tag v-for="tag in selectedArticle.tags" :key="tag.code" size="small" effect="plain">{{ tag.name }}</el-tag></div><p class="article-text">{{ selectedArticle.body }}</p><div v-if="selectedArticle.videos?.length" class="article-image-review"><el-alert title="请播放核验视频；AI 初审仅检查文字内容" type="info" :closable="false" /><ArticlePhoto v-for="video in selectedArticle.videos" :key="video.mediaId" :article-id="selectedArticle.id" :media-id="video.mediaId" video /></div><div v-if="selectedArticle.images?.length" class="article-image-review"><el-alert title="请一并核验配图；AI 初审仅检查文字内容" type="info" :closable="false" /><div class="review-photo-grid"><ArticlePhoto v-for="image in selectedArticle.images" :key="image.mediaId" :article-id="selectedArticle.id" :media-id="image.mediaId" /></div></div></div>
          <div v-if="selectedArticle.source !== 'OFFICIAL'" class="result-panel" :class="{pass: selectedArticle.aiVerdict === 'PASS'}"><div class="panel-title">AI 初审 <el-tag size="small" :type="selectedArticle.aiVerdict === 'PASS' ? 'success' : 'warning'">{{ aiText(selectedArticle.aiVerdict) }}</el-tag></div><p>{{ selectedArticle.aiReason || '初审结果尚未生成，暂不能终审通过。' }}</p><span v-if="selectedArticle.aiModel" class="model-label">审核模型：{{ selectedArticle.aiModel }}</span></div>
          <div v-if="selectedArticle.reviewNote" class="previous-note"><strong>上次处理意见</strong><p>{{ selectedArticle.reviewNote }}</p></div>
          <template v-if="canReview && selectedArticle.source !== 'OFFICIAL'"><label class="review-label">审核意见</label><el-input v-model="note" type="textarea" :rows="4" maxlength="1000" show-word-limit placeholder="请填写处理意见；驳回或下架时必填" :disabled="saving || detailLoading" /></template>
          <el-alert v-else-if="selectedArticle.source !== 'OFFICIAL'" title="当前账号可查看内容，终审处理需要管理员权限。" type="info" :closable="false" />
        </template>
        <template v-if="selectedReport">
          <div class="report-summary"><span class="report-icon">!</span><div><h3>{{ reasons[selectedReport.reason] || selectedReport.reason }}</h3><p>{{ targets[selectedReport.target_type] }} #{{ selectedReport.target_id }} · {{ reportStates[selectedReport.state] }}</p></div></div>
          <el-descriptions :column="1" border><el-descriptions-item label="举报人">u{{ selectedReport.reporter_id }}</el-descriptions-item><el-descriptions-item label="提交时间">{{ date(selectedReport.created_at) }}</el-descriptions-item><el-descriptions-item label="详细说明">{{ selectedReport.details || '未补充说明' }}</el-descriptions-item></el-descriptions>
          <div class="reported-content"><strong>被举报内容</strong><p class="article-text">{{ selectedReport.target_content || '暂无内容快照' }}</p></div>
          <div v-if="selectedReport.resolution_note" class="previous-note"><strong>处理结果</strong><p>{{ selectedReport.resolution_note }}</p></div>
          <template v-if="selectedReport.state === 'OPEN' && canReview"><label class="review-label">处理方式</label><el-radio-group v-model="resolution" :disabled="saving"><el-radio value="DISMISS">举报不成立</el-radio><el-radio v-if="selectedReport.target_type === 'ARTICLE'" value="HIDE_ARTICLE">下架文章</el-radio><el-radio v-if="selectedReport.target_type === 'COMMENT'" value="HIDE_COMMENT">隐藏评论</el-radio><el-radio value="RESOLVE">其他处理</el-radio></el-radio-group><label class="review-label">处理说明</label><el-input v-model="note" type="textarea" :rows="4" maxlength="1000" show-word-limit placeholder="说明核查结果与处理原因，这段说明会展示给举报人" :disabled="saving" /></template>
        </template>
      </div>
      <template #footer><div class="drawer-actions"><el-button :disabled="saving" @click="drawer = false">关闭</el-button><el-button v-if="selectedArticle?.source === 'OFFICIAL' && !detailLoading && !detailError && auth.hasPermission('content:news:edit')" type="primary" @click="router.push(`/content/news/${selectedArticle.id}/edit`)">编辑官方文章</el-button><template v-if="selectedArticle && selectedArticle.source !== 'OFFICIAL' && !selectedReport && canReview && !detailLoading && !detailError"><el-button v-if="selectedArticle.state === 'AI_ERROR'" :loading="saving" @click="retryAi">重新初审</el-button><el-button v-if="['PENDING_ADMIN','AI_REJECTED','AI_ERROR'].includes(selectedArticle.state)" type="danger" plain :loading="saving" @click="decide('REJECT')">驳回文章</el-button><el-button v-if="selectedArticle.state === 'PUBLISHED'" type="warning" :loading="saving" @click="decide('HIDE')">下架文章</el-button><el-button v-if="selectedArticle.state === 'PENDING_ADMIN' && selectedArticle.aiVerdict === 'PASS'" type="success" :loading="saving" @click="decide('APPROVE')">终审通过并发布</el-button></template><el-button v-if="selectedReport?.state === 'OPEN' && canReview" type="primary" :loading="saving" @click="resolveReport">确认处理</el-button></div></template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { api } from '@/api'
import { communityApi, type CommunityArticle, type CommunityReport } from '@/api/community'
import { useAuthStore } from '@/stores/auth'
import { refreshWorkReminders } from '@/utils/work-reminders'
import ArticlePhoto from './ArticlePhoto.vue'

const route = useRoute(), router = useRouter(), auth = useAuthStore()
const reportMode = computed(() => route.path.endsWith('community-reports'))
const canReview = computed(() => auth.role === 'admin' && auth.hasPermission('content:news:edit'))
const canEdit = computed(() => auth.hasPermission('content:news:edit'))
const stateNames: Record<string,string> = { DRAFT:'草稿', AI_PENDING:'等待初审', AI_REVIEWING:'AI 初审中', PENDING_ADMIN:'待管理员终审', AI_REJECTED:'初审未通过', AI_ERROR:'初审异常', PUBLISHED:'已发布', REJECTED:'已驳回', HIDDEN:'已下架' }
const reportStates: Record<string,string> = { OPEN:'待处理', DISMISSED:'不成立', RESOLVED:'已处理' }
const reasons: Record<string,string> = { MISINFORMATION:'健康信息不实', SPAM:'广告或垃圾信息', ABUSE:'攻击辱骂', PRIVACY:'泄露隐私', OTHER:'其他问题' }
const targets: Record<string,string> = { ARTICLE:'文章', COMMENT:'评论', USER:'用户', MESSAGE:'私信' }
const statuses = computed(() => [{value:'',label:'全部状态'}, ...Object.entries(reportMode.value ? reportStates : stateNames).map(([value,label]) => ({value,label}))])
const status = ref(''), source = ref(''), keyword = ref(''), pageNum = ref(1), total = ref(0), loading = ref(false), error = ref('')
const articles = ref<CommunityArticle[]>([]), reports = ref<CommunityReport[]>([])
const drawer = ref(false), detailLoading = ref(false), detailError = ref(''), saving = ref(false), note = ref(''), resolution = ref('DISMISS')
const selectedArticle = ref<CommunityArticle | null>(null), selectedReport = ref<CommunityReport | null>(null)
let listRun = 0, detailRun = 0
function date(value?: string | number | Date) {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? '—' : d.toISOString().replace('T', ' ').slice(0, 16)
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '—' : value.toISOString().replace('T', ' ').slice(0, 16)
  }
  const raw = String(value).trim()
  if (/^\d{10,13}$/.test(raw)) return date(Number(raw))
  return raw.replace('T', ' ').slice(0, 16)
}
function aiText(value: string) { return ({ PASS:'初审通过', REJECT:'建议驳回', ERROR:'初审异常', PENDING:'等待初审' } as Record<string,string>)[value] || '初审中' }
function stateTone(value: string): 'success' | 'warning' | 'danger' | 'info' { return value === 'PUBLISHED' ? 'success' : value === 'PENDING_ADMIN' ? 'warning' : ['AI_REJECTED','AI_ERROR','REJECTED'].includes(value) ? 'danger' : 'info' }
async function load() {
  const run = ++listRun, isReport = reportMode.value
  loading.value = true; error.value = ''
  try {
    if (isReport) { const page = await communityApi.reports(status.value,pageNum.value); if (run !== listRun) return; reports.value = page.records; total.value = Number(page.total) }
    else { const page = await communityApi.articles(status.value,pageNum.value,source.value,keyword.value); if (run !== listRun) return; articles.value = page.records; total.value = Number(page.total) }
    if (pageNum.value > Math.max(1,Math.ceil(total.value / 10))) { pageNum.value = Math.max(1,Math.ceil(total.value / 10)); return load() }
  } catch (e) { if (run === listRun) { error.value = (e as Error).message || '加载失败，请刷新重试'; articles.value = []; reports.value = []; total.value = 0 } }
  finally { if (run === listRun) loading.value = false }
}
function search() { pageNum.value = 1; load() }
function resetFilters() { status.value = reportMode.value ? 'OPEN' : ''; source.value = ''; keyword.value = ''; search() }
function changePage(page: number) { pageNum.value = page; load() }
async function openArticle(row: CommunityArticle) {
  const run = ++detailRun; selectedArticle.value = null; selectedReport.value = null; note.value = ''; detailError.value = ''; drawer.value = true; detailLoading.value = true
  try { const article = await communityApi.article(row.id); if (run === detailRun && drawer.value) selectedArticle.value = article }
  catch (e) { if (run === detailRun) detailError.value = (e as Error).message || '详情加载失败' }
  finally { if (run === detailRun) detailLoading.value = false }
}
function editArticle(row: CommunityArticle) {
  if (row.source === 'OFFICIAL') {
    router.push(`/content/news/${row.id}/edit`)
    return
  }
  openArticle(row)
}
async function unpublishArticle(row: CommunityArticle) {
  if (!canEdit.value || row.state !== 'PUBLISHED' || saving.value) return
  saving.value = true
  try {
    await ElMessageBox.confirm('确认下架该文章？下架后将不再公开展示。', '确认下架', { type: 'warning' })
  } catch {
    saving.value = false
    return
  }
  try {
    if (row.source === 'OFFICIAL') {
      await api.setNewsStatus(Number(row.id), 'unpublished')
    } else {
      if (!canReview.value) {
        ElMessage.warning('社区投稿下架需要管理员权限')
        return
      }
      await communityApi.review(row, 'HIDE', '管理员下架')
    }
    ElMessage.success('已下架')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '下架失败，请重试')
  } finally {
    saving.value = false
  }
}
async function removeArticle(row: CommunityArticle) {
  if (!canEdit.value || saving.value) return
  saving.value = true
  try {
    await api.removeNews(Number(row.id))
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败，请重试')
  } finally {
    saving.value = false
  }
}
function openReport(row: CommunityReport) { ++detailRun; detailLoading.value = false; detailError.value = ''; selectedArticle.value = null; selectedReport.value = row; note.value = ''; resolution.value = 'DISMISS'; drawer.value = true }
async function decide(decision: string) {
  const article = selectedArticle.value
  if (!article || article.source === 'OFFICIAL' || saving.value || !canReview.value || detailError.value) return
  if (decision === 'APPROVE' && (article.state !== 'PENDING_ADMIN' || article.aiVerdict !== 'PASS')) return ElMessage.warning('当前版本还未通过 AI 初审，不能终审发布')
  if (decision !== 'APPROVE' && !note.value.trim()) return ElMessage.warning('请先填写处理意见')
  saving.value = true
  const reviewNote = note.value.trim()
  try { await ElMessageBox.confirm(decision === 'APPROVE' ? '确认终审通过？文章将公开展示到社区。' : '确认执行此操作？', '确认审核', {type:'warning'}) } catch { saving.value = false; return }
  try { if (!canReview.value) return; await communityApi.review(article,decision,reviewNote); drawer.value = false; ElMessage.success('审核结果已保存'); await load() }
  catch (e) { ElMessage.error((e as Error).message || '审核失败，请重试') }
  finally { saving.value = false }
}
async function retryAi() { if (!selectedArticle.value || saving.value || !canReview.value) return; saving.value = true; try { await communityApi.retryAi(selectedArticle.value.id); drawer.value = false; ElMessage.success('已重新提交初审'); await load() } catch (e) { ElMessage.error((e as Error).message) } finally { saving.value = false } }
async function resolveReport() {
  if (!selectedReport.value || saving.value || !canReview.value) return
  if (!note.value.trim()) return ElMessage.warning('请填写处理说明')
  const report = selectedReport.value, action = resolution.value, resolutionNote = note.value.trim()
  saving.value = true
  try { await ElMessageBox.confirm('确认保存并将处理说明反馈给举报人？', '处理举报', {type:'warning'}) } catch { saving.value = false; return }
  try { if (!canReview.value) return; await communityApi.resolve(report.id,action,resolutionNote); refreshWorkReminders(); drawer.value = false; ElMessage.success('处理结果已保存，举报人将收到反馈提醒'); await load() }
  catch (e) { ElMessage.error((e as Error).message || '处理失败，请重试') }
  finally { saving.value = false }
}
watch(reportMode, () => { ++detailRun; drawer.value = false; status.value = reportMode.value ? 'OPEN' : ''; source.value = ''; keyword.value = ''; pageNum.value = 1; total.value = 0; articles.value = []; reports.value = []; load() }, { immediate:true })
watch(() => route.query.reminder, value => { if (value && reportMode.value) { drawer.value = false; status.value = 'OPEN'; source.value = ''; keyword.value = ''; search() } })
watch(drawer, visible => { if (!visible) ++detailRun })
onBeforeUnmount(() => { ++listRun; ++detailRun })
</script>

<style scoped>
.heading-actions{display:flex;gap:10px;flex-wrap:wrap}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}.page-title{margin:0;font-size:18px;color:var(--kt-ink)}.description{margin:6px 0 0;font-size:13px}.workflow{display:flex;align-items:center;justify-content:center;gap:22px;padding:19px 24px;margin-bottom:22px;border:1px solid #e3ece7;background:linear-gradient(100deg,#f2faf6,#fbfdfb);border-radius:14px;color:#84938c;font-size:13px}.workflow span{display:flex;align-items:center;gap:9px}.workflow i{display:flex;align-items:center;justify-content:center;font-style:normal;width:25px;height:25px;border-radius:50%;background:#e7eee9}.workflow .current{color:#198250;font-weight:600}.workflow .current i{background:#18845a;color:white}.workflow b{font-size:22px;font-weight:400;color:#b6c6bd}.moderation-card{padding-top:0}.review-tabs{display:flex;gap:26px;border-bottom:1px solid var(--kt-line);margin-bottom:20px}.review-tabs button{border:0;background:none;padding:20px 3px 16px;font:inherit;font-size:14px;color:var(--kt-muted);cursor:pointer;border-bottom:3px solid transparent}.review-tabs button.on{color:var(--kt-brand);border-bottom-color:var(--kt-brand);font-weight:600}.review-filters{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.field-label{font-size:13px;margin-right:12px;color:var(--kt-muted)}.total-label,.version{font-size:12px;color:var(--kt-muted)}.total-label strong{color:var(--kt-ink);padding:0 4px}.table-title{font-weight:600;color:var(--kt-ink);line-height:1.6}.table-summary{font-size:12px;color:var(--kt-muted);line-height:1.7;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:4px 0}.tag-list{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.ai-result{font-size:12px;color:#939b97}.ai-result.passed{color:#19865c}.ai-result.rejected{color:#ce5656}.review-pagination{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:22px;color:var(--kt-muted);font-size:12px}.moderation-table :deep(.el-table__cell){padding-top:16px;padding-bottom:16px}.detail-content{padding:0 6px 28px}.preview-kicker,.preview-meta,.model-label{font-size:12px;color:var(--kt-muted)}.article-preview h2{font-size:24px;line-height:1.5;margin:12px 0}.article-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;font-size:14px;color:var(--kt-ink);margin:22px 0}.result-panel{border:1px solid #f0e3c6;background:#fffaf0;border-radius:12px;padding:18px;margin:26px 0}.result-panel.pass{border-color:#d7eadf;background:#f3faf6}.panel-title{display:flex;align-items:center;gap:12px;font-weight:600}.result-panel p{font-size:13px;line-height:1.8;margin:12px 0}.review-label{display:block;margin:22px 0 10px;font-weight:600;font-size:13px}.previous-note,.reported-content{padding:18px;background:var(--kt-bg);border-radius:10px;margin:20px 0}.previous-note p{white-space:pre-wrap;line-height:1.8;font-size:13px}.report-summary{display:flex;gap:16px;align-items:center;margin-bottom:24px}.report-summary h3{margin:0 0 8px}.report-summary p{margin:0;font-size:13px;color:var(--kt-muted)}.report-icon{display:flex;align-items:center;justify-content:center;background:#fff0e9;color:#d17c4b;width:48px;height:48px;border-radius:14px;font-size:25px}.drawer-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.drawer-actions :deep(.el-button+.el-button){margin-left:0}@media(max-width:900px){.workflow{gap:9px;padding:15px 8px;font-size:12px}.workflow i{display:none}.review-filters,.review-pagination{flex-wrap:wrap}}
.moderation-page{min-width:0}.moderation-card{padding-top:24px}.review-filters{display:grid;grid-template-columns:180px 160px minmax(200px,1fr) auto;align-items:end;justify-content:stretch;gap:18px;margin-bottom:18px}.report-filters{grid-template-columns:minmax(180px,240px) auto 1fr}.filter-field{min-width:0}.filter-label{display:block;font-size:12px;font-weight:500;color:var(--kt-muted);margin-bottom:9px}.filter-field :deep(.el-select){width:100%}.filter-actions{display:flex;align-items:center;gap:10px}.filter-actions :deep(.el-button+.el-button){margin-left:0}.filter-result{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:14px 0 18px;border-top:1px solid var(--kt-line);color:var(--kt-muted);font-size:12px}.filter-result strong{color:var(--kt-ink);font-weight:600}.heading-actions{flex-shrink:0}@media(max-width:1200px){.review-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.filter-actions{justify-content:flex-end}.report-filters{grid-template-columns:minmax(180px,1fr) auto}}@media(max-width:760px){.head{flex-direction:column;gap:14px}.review-filters,.report-filters{grid-template-columns:1fr}.filter-actions{justify-content:flex-start}.filter-result{font-size:11px}}
</style>

<style scoped>
.review-photo-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin:18px 0; }
@media(max-width:760px) { .review-photo-grid { grid-template-columns:1fr; } }
</style>
