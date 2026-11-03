<template>
  <div class="page-wrap recommendation-page">
    <div class="heading">
      <div><h2>推荐管理</h2><p class="text-muted">查看用户实际可见文章的前 20 名、兴趣向量和评分过程。</p></div>
      <div class="user-picker">
        <el-select v-model="selectedUser" filterable remote :remote-method="searchUsers" :loading="usersLoading"
          placeholder="搜索用户昵称或手机号" @change="loadReport">
          <el-option v-for="user in users" :key="user.id" :value="String(user.id)" :label="`${user.nickname} · ${user.phone || 'ID ' + user.id}`" />
        </el-select>
        <el-button :icon="Refresh" :loading="loading" :disabled="!selectedUser" @click="loadReport">刷新</el-button>
      </div>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="notice" />
    <div v-loading="loading" class="report-area">
      <template v-if="report">
        <div class="summary">
          <div class="kt-card"><span>当前用户</span><strong>{{ report.user.nickname }}</strong><small>ID：{{ report.user.id }}</small></div>
          <div class="kt-card"><span>可推荐文章</span><strong>{{ report.candidateCount }} <small>篇</small></strong><small>展示前 {{ report.articles.length }} 篇</small></div>
          <div class="kt-card"><span>兴趣标签</span><strong>{{ report.vector.length }} <small>个</small></strong><small>{{ report.coldStart ? '暂无行为，使用默认推荐' : '根据近 30 天有效行为计算' }}</small></div>
          <div class="kt-card"><span>生成时间</span><strong class="time">{{ fmtTime(report.generatedAt) }}</strong><small>本次查看不产生浏览记录</small></div>
        </div>
        <el-alert v-if="report.coldStart" title="该用户暂无有效兴趣记录，当前按热度、新鲜度及关注作者推荐。" type="info" :closable="false" show-icon class="notice" />
        <div class="kt-card flow-card">
          <el-collapse><el-collapse-item title="计算流程 · 点击展开" name="flow">
            <ol class="steps"><li v-for="(step, index) in report.steps" :key="index">{{ step }}</li></ol>
            <p class="formula">总分 = 兴趣分 + 热度分 + 新鲜度分 + 关注分</p>
          </el-collapse-item></el-collapse>
        </div>
        <div class="kt-card vector-card">
          <div class="section-heading"><h3>用户兴趣向量</h3><span class="text-muted">L2 范数 {{ number(report.vectorNorm) }} · 从 {{ report.historyStart }} 起</span></div>
          <el-table :data="report.vector" row-key="tagId" max-height="270" empty-text="暂无兴趣向量">
            <el-table-column prop="name" label="标签" min-width="150" />
            <el-table-column label="原始权重" min-width="120"><template #default="{ row }">{{ number(row.rawWeight) }}</template></el-table-column>
            <el-table-column label="衰减后权重" min-width="140"><template #default="{ row }">{{ number(row.decayedWeight) }}</template></el-table-column>
            <el-table-column label="向量值（权重 ÷ 范数）" min-width="190"><template #default="{ row }"><strong class="brand-text">{{ number(row.normalizedWeight, 6) }}</strong></template></el-table-column>
          </el-table>
        </div>
        <div class="kt-card rankings">
          <div class="section-heading"><h3>文章推荐前 20 名</h3><span class="text-muted">展示值已四舍五入，排序使用原始精度</span></div>
          <el-table :data="report.articles" row-key="id" empty-text="该用户暂无可推荐文章">
            <el-table-column type="index" label="排名" width="65" />
            <el-table-column label="文章 / 发布人" min-width="230"><template #default="{ row }"><div class="article-title">{{ row.title }}</div><div class="article-author">{{ row.author }} · #{{ row.id }}</div><div class="tags"><el-tag v-for="tag in row.tags" :key="tag.tagId" size="small" effect="plain">{{ tag.name }}</el-tag></div></template></el-table-column>
            <el-table-column label="总分" width="100"><template #default="{ row }"><strong class="total-score">{{ number(row.totalScore) }}</strong></template></el-table-column>
            <el-table-column label="兴趣 / 60" width="110"><template #default="{ row }">{{ number(row.interestScore) }}</template></el-table-column>
            <el-table-column label="热度 / 15" width="110"><template #default="{ row }">{{ number(row.popularityScore) }}</template></el-table-column>
            <el-table-column label="新鲜度 / 15" width="115"><template #default="{ row }">{{ number(row.freshnessScore) }}</template></el-table-column>
            <el-table-column label="关注 / 10" width="100"><template #default="{ row }">{{ number(row.followingScore) }}</template></el-table-column>
            <el-table-column label="计算过程" width="110" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="selectedArticle = row">查看计算</el-button></template></el-table-column>
          </el-table>
        </div>
      </template>
      <el-empty v-else-if="!loading && !error" description="选择用户后查看推荐结果" />
    </div>
    <el-dialog :model-value="!!selectedArticle" title="文章评分过程" width="min(900px, 94vw)" @close="selectedArticle = null">
      <template v-if="selectedArticle">
        <h3 class="dialog-title">{{ selectedArticle.title }}</h3>
        <p class="text-muted">每个标签的点积贡献相加，得到余弦相似度。文章向量值为 1 ÷ √启用标签数。</p>
        <el-table :data="selectedArticle.tags" row-key="tagId" max-height="300" empty-text="文章暂无启用标签，相似度为 0">
          <el-table-column prop="name" label="标签" min-width="130" />
          <el-table-column label="用户向量值" min-width="130"><template #default="{ row }">{{ number(row.userWeight, 6) }}</template></el-table-column>
          <el-table-column label="文章向量值" min-width="130"><template #default="{ row }">{{ number(row.articleWeight, 6) }}</template></el-table-column>
          <el-table-column label="点积贡献（两者相乘）" min-width="180"><template #default="{ row }">{{ number(row.contribution, 6) }}</template></el-table-column>
        </el-table>
        <div class="calculation">
          <p>相似度：{{ number(selectedArticle.similarity, 6) }}</p>
          <p>兴趣分：60 × {{ number(selectedArticle.similarity, 6) }} = {{ number(selectedArticle.interestScore) }}</p>
          <p>热度分：{{ number(selectedArticle.popularityScore) }}　新鲜度分：{{ number(selectedArticle.freshnessScore) }}　关注分：{{ number(selectedArticle.followingScore) }}</p>
          <strong>总分：{{ number(selectedArticle.interestScore) }} + {{ number(selectedArticle.popularityScore) }} + {{ number(selectedArticle.freshnessScore) }} + {{ number(selectedArticle.followingScore) }} ≈ {{ number(selectedArticle.totalScore) }}</strong>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { api } from '@/api'
import { recommendationApi, type RecommendationReport, type RankedArticle } from '@/api/recommendations'
import { getAccessToken } from '@/utils/request'
import { fmtTime } from '@/utils/format'
import type { AppUser } from '@/types'

const selectedUser = ref('')
const users = ref<AppUser[]>([])
const usersLoading = ref(false)
const loading = ref(false)
const error = ref('')
const report = ref<RecommendationReport | null>(null)
const selectedArticle = ref<RankedArticle | null>(null)
let alive = true, userRun = 0, reportRun = 0
const number = (value: number, digits = 4) => Number(value).toFixed(digits)

async function searchUsers(keyword: string) {
  const run = ++userRun, token = getAccessToken()
  usersLoading.value = true
  try {
    const result = await api.pageUsers({ pageNum: 1, pageSize: 20, keyword: keyword.trim() || undefined, accountStatus: 1 })
    if (!alive || run !== userRun || token !== getAccessToken()) return
    users.value = result.records
    if (!selectedUser.value && users.value.length) { selectedUser.value = String(users.value[0].id); void loadReport() }
  } catch (e) {
    if (alive && run === userRun && token === getAccessToken()) error.value = e instanceof Error ? e.message : '用户加载失败'
  } finally { if (alive && run === userRun && token === getAccessToken()) usersLoading.value = false }
}

async function loadReport() {
  const run = ++reportRun, token = getAccessToken(), userId = selectedUser.value
  report.value = null; selectedArticle.value = null; error.value = ''
  if (!userId) { loading.value = false; return }
  loading.value = true
  try {
    const result = await recommendationApi.report(userId)
    if (!alive || run !== reportRun || token !== getAccessToken() || userId !== selectedUser.value) return
    if (!result || result.user.id !== userId || !Array.isArray(result.articles) || result.articles.length > 20 || !Array.isArray(result.vector)) throw new Error('推荐接口返回数据异常')
    report.value = result
  } catch (e) {
    if (alive && run === reportRun && token === getAccessToken()) error.value = e instanceof Error ? e.message : '推荐结果加载失败'
  } finally { if (alive && run === reportRun && token === getAccessToken()) loading.value = false }
}

onBeforeUnmount(() => { alive = false; userRun++; reportRun++; report.value = null; selectedArticle.value = null })
void searchUsers('')
</script>

<style scoped>
.heading{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:18px}.heading h2{margin:0;font-size:20px}.heading p{margin:8px 0 0;font-size:13px}.user-picker{display:flex;gap:12px;align-items:center}.user-picker .el-select{width:290px}.report-area{min-height:300px}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:18px}.summary .kt-card{display:flex;flex-direction:column;gap:10px}.summary span,.summary small{color:var(--kt-muted);font-size:12px}.summary strong{font-size:22px;color:var(--kt-ink);word-break:break-word}.summary strong.time{font-size:16px}.summary strong small{font-weight:400}.notice{margin-bottom:16px}.flow-card,.vector-card{margin-bottom:18px}.flow-card :deep(.el-collapse){border:0}.flow-card :deep(.el-collapse-item__header){height:34px;line-height:1.5;font-weight:600}.flow-card :deep(.el-collapse-item__wrap){border:0}.steps{margin:14px 0;padding-left:22px;line-height:2;color:var(--kt-muted)}.formula{padding:12px;border-radius:10px;background:var(--kt-bg);font-weight:600}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.section-heading h3{margin:0;font-size:16px}.section-heading span{font-size:12px}.article-title{font-weight:600;line-height:1.6}.article-author{margin-top:4px;color:var(--kt-muted);font-size:12px}.tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.total-score{color:var(--kt-brand);font-size:16px}.dialog-title{margin-top:0}.calculation{margin-top:18px;padding:16px;background:var(--kt-bg);border-radius:12px;line-height:1.8;overflow-wrap:anywhere}.calculation p{margin:6px 0}
@media(max-width:1100px){.heading{align-items:flex-start;flex-direction:column}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){.summary{grid-template-columns:1fr}.user-picker{width:100%}.user-picker .el-select{flex:1;min-width:0}.section-heading{align-items:flex-start;flex-direction:column}}
</style>
