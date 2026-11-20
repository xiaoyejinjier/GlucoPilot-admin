<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { refreshWorkReminders } from '@/utils/work-reminders'
import { ElMessage } from 'element-plus'
import { consultationApi, type DoctorProfile } from '@/api/consultations'
import { getAccessToken } from '@/utils/request'
import TablePagination from '@/components/TablePagination.vue'

const labels: Record<string, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '未通过', DISABLED: '已停用' }
const status = ref('PENDING'), pageNum = ref(1), pageSize = ref(10), total = ref(0)
const records = ref<DoctorProfile[]>([]), loading = ref(false), saving = ref(false)
const visible = ref(false), selected = ref<DoctorProfile | null>(null), decision = ref('APPROVED'), note = ref('')
const error = ref(''), stale = ref(false)
const route = useRoute()
let alive = true, epoch = 0
async function load() {
  const run = ++epoch, token = getAccessToken()
  loading.value = true; error.value = ''
  try {
    const data = await consultationApi.page(status.value, pageNum.value, pageSize.value)
    if (!alive || run !== epoch || token !== getAccessToken()) return
    records.value = data.records; total.value = Number(data.total)
  } catch (e) {
    if (alive && run === epoch && token === getAccessToken()) error.value = (e as Error).message
  } finally { if (alive && run === epoch && token === getAccessToken()) loading.value = false }
}
function open(row: DoctorProfile) {
  selected.value = { ...row }; note.value = ''; decision.value = row.status === 'APPROVED' ? 'DISABLED' : 'APPROVED'
  stale.value = false; visible.value = true
}
async function submit() {
  if (!selected.value || saving.value || stale.value) return
  if (!note.value.trim()) { ElMessage.warning('请填写审核意见'); return }
  const profile = selected.value, token = getAccessToken()
  saving.value = true
  try {
    await consultationApi.review(profile, decision.value, note.value.trim())
    if (!alive || token !== getAccessToken()) return
    visible.value = false; ElMessage.success('审核已保存'); refreshWorkReminders(); await load()
  } catch (e) {
    if (!alive || token !== getAccessToken()) return
    ElMessage.error((e as Error).message)
    if ((e as { code?: number }).code === 40900) { stale.value = true; await load() }
  } finally { if (alive && token === getAccessToken()) saving.value = false }
}
function filter() { pageNum.value = 1; load() }
function reminder() { visible.value = false; status.value = 'PENDING'; pageNum.value = 1; void load() }
watch(() => route.query.reminder, value => { if (value) reminder() })
onMounted(load)
onBeforeUnmount(() => { alive = false; epoch++; selected.value = null; records.value = [] })
</script>

<template>
  <section class="page-wrap paginated-page consultation-management">
    <header class="head"><div><h2 class="page-title">医生审核</h2><p>审核医生身份与执业资料，通过后方可接诊。问诊费用使用沙箱钱包结算。</p></div><el-button @click="load">刷新</el-button></header>
    <div class="kt-card paginated-card">
      <div class="filters"><span>审核状态</span><el-select v-model="status" style="width:180px" @change="filter"><el-option label="全部" value="" /><el-option v-for="(label, value) in labels" :key="value" :label="label" :value="value" /></el-select></div>
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
      <el-table v-loading="loading" :data="records" row-key="userId" height="100%" class="paginated-table" stripe>
        <el-table-column prop="userId" label="用户ID" width="100" />
        <el-table-column prop="realName" label="医生姓名" min-width="110" />
        <el-table-column prop="hospital" label="执业机构" min-width="180" />
        <el-table-column prop="specialty" label="专业科室" min-width="130" />
        <el-table-column label="审核状态" width="110"><template #default="{row}"><el-tag :type="row.status === 'APPROVED' ? 'success' : row.status === 'PENDING' ? 'warning' : 'info'">{{labels[row.status]}}</el-tag></template></el-table-column>
        <el-table-column label="申请时间" min-width="170"><template #default="{row}">{{row.createdAt?.replace('T',' ').slice(0,19)}}</template></el-table-column>
        <el-table-column label="操作" width="100" fixed="right"><template #default="{row}"><el-button link type="primary" @click="open(row)">查看审核</el-button></template></el-table-column>
      </el-table>
      <TablePagination :page-num="pageNum" :page-size="pageSize" :total="total" :page-sizes="[10,20,50]" :summary="`共 ${total} 位医生`" :disabled="loading" @size-change="size => { pageSize=size; filter() }" @page-change="page => { pageNum=page; load() }" />
    </div>
    <el-dialog v-model="visible" title="医生资质审核" width="620px" :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving">
      <template v-if="selected">
        <el-descriptions :column="1" border><el-descriptions-item label="姓名">{{selected.realName}}</el-descriptions-item><el-descriptions-item label="执业机构">{{selected.hospital}}</el-descriptions-item><el-descriptions-item label="专业科室">{{selected.specialty}}</el-descriptions-item><el-descriptions-item label="执业证号">{{selected.licenseNumber}}</el-descriptions-item><el-descriptions-item label="资质说明"><span class="note">{{selected.qualificationNote}}</span></el-descriptions-item><el-descriptions-item label="上次审核意见">{{selected.reviewNote || '—'}}</el-descriptions-item></el-descriptions>
        <el-alert v-if="stale" title="资料已更新，已保留当前意见，请重新打开最新申请后审核。" type="warning" :closable="false" />
        <el-form label-position="top" class="review-form">
          <el-form-item label="审核结果"><el-radio-group v-model="decision" :disabled="saving || stale"><el-radio value="APPROVED">通过</el-radio><el-radio value="REJECTED">未通过</el-radio><el-radio value="DISABLED">停用</el-radio></el-radio-group></el-form-item>
          <el-form-item label="审核意见（必填）"><el-input v-model="note" type="textarea" :rows="4" maxlength="500" show-word-limit :disabled="saving || stale" /></el-form-item>
        </el-form>
      </template>
      <template #footer><el-button :disabled="saving" @click="visible=false">关闭</el-button><el-button type="primary" :loading="saving" :disabled="stale" @click="submit">保存审核</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.consultation-management header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}
h2{margin:0 0 8px}p{color:#7b879a;margin:0;line-height:1.7}.filters{display:flex;align-items:center;gap:16px;margin-bottom:20px}.el-pagination{margin-top:20px;justify-content:flex-end}.review-form{margin-top:24px}.note{white-space:pre-wrap;overflow-wrap:anywhere}
</style>
