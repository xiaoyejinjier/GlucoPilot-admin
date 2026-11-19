<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { withdrawalApi, type Withdrawal, type WithdrawalSummary } from '@/api/withdrawals'
import { getAccessToken } from '@/utils/request'
import { fmtTime } from '@/utils/format'
import { withdrawalStatus } from '@/utils/withdrawal'

const summary = ref<WithdrawalSummary | null>(null)
const rows = ref<Withdrawal[]>([])
const loading = ref(false), saving = ref(false), amount = ref(''), payeeUserId = ref(''), error = ref('')
let alive = true, run = 0, attempt = '', attemptAmount = 0, attemptPayee = ''
const scopeToken = getAccessToken()
const valid = (token: string) => alive && scopeToken === token && token === getAccessToken()
const money = (value: unknown) => (Number(value) / 100).toFixed(2)
const validPayee = () => /^2088\d{12,28}$/.test(payeeUserId.value.trim())

async function load() {
  const token = getAccessToken(), current = ++run
  loading.value = true; error.value = ''
  try {
    const [s, page] = await Promise.all([withdrawalApi.ownSummary(), withdrawalApi.ownList()])
    if (valid(token) && current === run) { summary.value = s; rows.value = page.records }
  } catch (e) {
    if (valid(token) && current === run) error.value = (e as Error).message
  } finally {
    if (valid(token) && current === run) loading.value = false
  }
}

async function refreshRecords() {
  if (loading.value || saving.value) return
  const token = getAccessToken()
  loading.value = true; error.value = ''
  try {
    await withdrawalApi.refreshOwn()
    if (valid(token)) await load()
  } catch (e) { if (valid(token)) error.value = (e as Error).message }
  finally { if (valid(token)) loading.value = false }
}

async function apply() {
  if (loading.value || saving.value || !summary.value || scopeToken !== getAccessToken()) return
  if (!summary.value.transferEnabled || !validPayee()) { ElMessage.warning('请配置转账并填写支付宝沙箱买家UID'); return }
  const input = amount.value.trim()
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(input)) { ElMessage.warning('请输入正确金额，最多两位小数'); return }
  const [whole, part = ''] = input.split('.')
  const cents = Number(whole) * 100 + Number((part + '00').slice(0, 2))
  if (cents < 10 || cents > Number(summary.value.availableCents)) { ElMessage.warning('金额至少0.10元，且不能超过可提现收入'); return }
  const token = getAccessToken(), payee = payeeUserId.value.trim()
  try { await ElMessageBox.confirm(`冻结 ¥${money(cents)} 问诊收入，审核后第5个工作日转入沙箱账号 ${payee}，仅测试资金。`, '确认沙箱提现') }
  catch { return }
  if (!valid(token) || saving.value) return
  saving.value = true
  if (!attempt || attemptAmount !== cents || attemptPayee !== payee) {
    attempt = `withdraw_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
    attemptAmount = cents; attemptPayee = payee
  }
  try {
    await withdrawalApi.apply(cents, attempt, payee)
    if (valid(token)) { attempt = ''; amount.value = ''; ElMessage.success('提现申请已提交'); await load() }
  } catch (e) { if (valid(token)) ElMessage.error((e as Error).message) }
  finally { if (valid(token)) saving.value = false }
}

async function bindRecipient(row: Withdrawal) {
  if (saving.value || loading.value) return
  if (!validPayee()) { ElMessage.warning('请先填写支付宝沙箱买家UID'); return }
  const token = getAccessToken(), payee = payeeUserId.value.trim()
  try { await ElMessageBox.confirm(payee, '确认沙箱收款账号') } catch { return }
  if (!valid(token) || saving.value) return
  saving.value = true
  try { await withdrawalApi.recipient(row.orderNo, payee); if (valid(token)) await load() }
  catch (e) { if (valid(token)) ElMessage.error((e as Error).message) }
  finally { if (valid(token)) saving.value = false }
}

onMounted(load)
onBeforeUnmount(() => { alive = false; run++; summary.value = null; rows.value = []; payeeUserId.value = '' })
</script>

<template>
  <section v-loading="loading" class="doctor-withdrawals">
    <el-alert title="医生提现仅使用测试资金：填写沙箱买家UID，审核后第5个工作日调用支付宝沙箱转账，刷新可核对到账状态。" type="info" :closable="false" show-icon />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-if="summary" class="withdraw-summary">
      <span>可提现问诊收入 <strong>¥{{ money(summary.availableCents) }}</strong></span>
      <span>冻结中 <strong>¥{{ money(summary.frozenCents) }}</strong></span>
      <el-input v-model="payeeUserId" placeholder="支付宝沙箱买家UID（2088开头）" maxlength="32" class="payee-input" :disabled="saving" />
      <el-input v-model="amount" placeholder="提现金额（元）" style="width:190px" :disabled="saving" />
      <el-button type="primary" :loading="saving" :disabled="loading || !summary.transferEnabled || !summary.eligible || Number(summary.availableCents) <= 0" @click="apply">申请提现</el-button>
    </div>
    <el-table :data="rows" row-key="orderNo" empty-text="暂无提现记录" max-height="440">
      <el-table-column label="金额" width="115"><template #default="{ row }">¥{{ money(row.amountCents) }}</template></el-table-column>
      <el-table-column label="状态" width="175"><template #default="{ row }">{{ withdrawalStatus(row) }}</template></el-table-column>
      <el-table-column label="申请时间" min-width="165"><template #default="{ row }">{{ fmtTime(row.createdAt) }}</template></el-table-column>
      <el-table-column prop="expectedPayoutDate" label="预计发放日期" min-width="140" />
      <el-table-column prop="reviewNote" label="审核意见" min-width="180" />
      <el-table-column prop="payeeUserId" label="沙箱收款UID" min-width="190" />
      <el-table-column prop="transferErrorCode" label="转账核对信息" min-width="190" />
      <el-table-column prop="payoutReference" label="转账流水" min-width="280" />
      <el-table-column label="收款账号" width="160" fixed="right"><template #default="{ row }">
        <el-button v-if="!row.transferStartedAt && ['PENDING', 'APPROVED'].includes(row.status)" link type="primary" :disabled="saving || loading" @click="bindRecipient(row)">{{ row.payeeUserId ? '修改' : '补充' }}收款账号</el-button>
      </template></el-table-column>
    </el-table>
    <el-button link :disabled="loading || saving" @click="refreshRecords">刷新提现记录</el-button>
  </section>
</template>

<style scoped>
.doctor-withdrawals { margin-top:20px }
.withdraw-summary { display:flex; align-items:center; gap:20px; flex-wrap:wrap; margin:22px 0 }
.withdraw-summary strong { display:block; margin-top:6px; font-size:24px; color:var(--kt-brand) }
.payee-input { width:290px; max-width:100% }
</style>
