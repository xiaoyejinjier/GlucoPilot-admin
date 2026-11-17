<script setup lang="ts">
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import TablePagination from '@/components/TablePagination.vue'
import { doctorApi, type DoctorCase, type IncomeEntry, type DoctorIncome } from '@/api/doctor-portal'
import { useAuthStore } from '@/stores/auth'
import { getAccessToken } from '@/utils/request'
import { fmtTime } from '@/utils/format'
import DoctorConversation from './DoctorConversation.vue'
import DoctorWithdrawals from './DoctorWithdrawals.vue'

const route=useRoute(), auth=useAuthStore()
const mode=computed(()=>route.path.endsWith('/income')?'income':route.path.endsWith('/consultations')?'assigned':'workbench')
const title=computed(()=>mode.value==='income'?'我的收入':mode.value==='assigned'?'我的问诊':'接诊工作台')
const hints={income:'查看已结算的沙箱问诊收入，仅包含本人收款。',assigned:'查看自己接诊的求助，填写评估、用药与复查建议。',workbench:'接诊前请在小程序开通沙箱钱包，接诊后方可查看健康详情。'}
const cases=ref<DoctorCase[]>([]), entries=ref<IncomeEntry[]>([]), wallet=ref<DoctorIncome['wallet']|null>(null)
const doctorName=ref(''),pageNum=ref(1),pageSize=ref(10),total=ref(0),loading=ref(false),error=ref('')
const visible=ref(false), detail=ref<DoctorCase|null>(null), detailLoading=ref(false), saving=ref(false)
const withdrawalsVisible=ref(false)
const form=reactive({assessment:'',medicationAdvice:'',followUpAdvice:''})
const statusLabels:Record<string,string>={WAITING:'等待医生',IN_PROGRESS:'接诊中',REPORT_READY:'已出具问诊单',CLOSED:'已结束'}
const canManage=computed(()=>auth.hasPermission('doctor:consultation:manage'))
let alive=true,epoch=0,detailEpoch=0,attempt=''
const valid=(token:string)=>alive&&getAccessToken()===token
function money(value:string|number|null|undefined) {return value==null?'—':(Number(value)/100).toFixed(2)}
async function load() {
  const run=++epoch,token=getAccessToken(),kind=mode.value;loading.value=true;error.value=''
  try {
    if(kind==='income') {
      const data=await doctorApi.income(pageNum.value,pageSize.value)
      if(!valid(token)||run!==epoch)return
      wallet.value=data.wallet;entries.value=data.entries.records;total.value=Number(data.entries.total)
    } else if(kind==='assigned') {
      const page=await doctorApi.cases(pageNum.value,pageSize.value)
      if(!valid(token)||run!==epoch)return
      cases.value=page.records;total.value=Number(page.total)
    } else {
      const data=await doctorApi.workbench(pageNum.value,pageSize.value)
      if(!valid(token)||run!==epoch)return
      doctorName.value=data.doctor.realName;cases.value=data.requests.records;total.value=Number(data.requests.total)
    }
  } catch(e) {if(valid(token)&&run===epoch)error.value=(e as Error).message}
  finally {if(valid(token)&&run===epoch)loading.value=false}
}
async function open(row:DoctorCase) {
  if(saving.value)return
  const run=++detailEpoch,token=getAccessToken();detail.value=null;visible.value=true;detailLoading.value=true
  form.assessment='';form.medicationAdvice='';form.followUpAdvice='';attempt=''
  try {const item=await doctorApi.detail(row.id);if(valid(token)&&run===detailEpoch&&visible.value)detail.value=item}
  catch(e) {if(valid(token)&&run===detailEpoch) {visible.value=false;ElMessage.error((e as Error).message)}}
  finally {if(valid(token)&&run===detailEpoch)detailLoading.value=false}
}
async function claim() {
  if(!detail.value||saving.value||!canManage.value)return
  const token=getAccessToken(),id=detail.value.id
  try {await ElMessageBox.confirm('确认接诊？接诊后可查看健康详情，并负责出具问诊单。','确认接诊',{type:'info'})}catch{return}
  if(!valid(token)||!visible.value||detail.value?.id!==id||saving.value)return
  saving.value=true
  try {const item=await doctorApi.claim(id);if(!valid(token))return;detail.value=item;ElMessage.success('接诊成功');await load()}
  catch(e) {if(valid(token))ElMessage.error((e as Error).message)}
  finally {if(valid(token))saving.value=false}
}
async function issue() {
  if(!detail.value||saving.value||!canManage.value)return
  if(Object.values(form).some(text=>!text.trim())) {ElMessage.warning('请填写完整评估与建议');return}
  const token=getAccessToken(),id=detail.value.id
  try {await ElMessageBox.confirm('问诊单出具后不能修改，请核对评估与建议。','确认出具问诊单',{type:'warning'})}catch{return}
  if(!valid(token)||!visible.value||detail.value?.id!==id||saving.value)return
  saving.value=true
  if(!attempt)attempt=`report_${Date.now()}_${Math.random().toString(36).slice(2,12)}`
  try {const item=await doctorApi.report(id,{...form,clientRequestId:attempt})
    if(!valid(token))return
    detail.value=item;ElMessage.success('问诊单已出具');await load()
  } catch(e) {if(valid(token))ElMessage.error((e as Error).message)}
  finally {if(valid(token))saving.value=false}
}
function sizeChange(size:number) {pageSize.value=size;pageNum.value=1;load()}
function closeDetail() {detailEpoch++;detail.value=null;attempt='';form.assessment='';form.medicationAdvice='';form.followUpAdvice=''}
watch(()=>route.path,()=>{epoch++;detailEpoch++;visible.value=false;withdrawalsVisible.value=false;detail.value=null;cases.value=[];entries.value=[];wallet.value=null;pageNum.value=1;load()},{immediate:true})
onBeforeUnmount(()=>{alive=false;epoch++;detailEpoch++;detail.value=null;cases.value=[];entries.value=[]})
</script>

<template>
  <div class="page-wrap paginated-page">
    <div class="head"><div><h2 class="page-title">{{title}}<small v-if="doctorName&&mode==='workbench'"> · {{doctorName}}</small></h2><p class="text-muted">{{hints[mode]}}</p></div><div><el-button v-if="mode==='income'" @click="withdrawalsVisible=true">收入提现</el-button><el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button></div></div>
    <div v-if="mode==='income'&&wallet" class="kt-card balance"><span class="text-muted">沙箱钱包余额</span><strong>¥{{money(wallet.balanceCents)}}</strong><span class="text-muted">{{wallet.activated?'沙箱测试余额，不涉及真实资金':'请在小程序“我的 → 钱包管理”开通钱包'}}</span></div>
    <div class="kt-card paginated-card">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="mb16" />
      <el-table v-if="mode==='income'" v-loading="loading" :data="entries" height="100%" class="paginated-table" row-key="orderNo" empty-text="暂无已结算的问诊收入">
        <el-table-column prop="orderNo" label="问诊订单" min-width="260" /><el-table-column prop="consultationId" label="问诊编号" width="110" /><el-table-column label="收入" width="110"><template #default="{row}"><span class="brand-text">+¥{{money(row.amountCents)}}</span></template></el-table-column><el-table-column label="入账后余额" width="150"><template #default="{row}">¥{{money(row.balanceAfterCents)}}</template></el-table-column><el-table-column label="入账时间" min-width="170"><template #default="{row}">{{fmtTime(row.createdAt)}}</template></el-table-column>
      </el-table>
      <el-table v-else v-loading="loading" :data="cases" height="100%" class="paginated-table" row-key="id" empty-text="暂无问诊记录">
        <el-table-column prop="id" label="问诊编号" width="100" /><el-table-column prop="title" label="求助标题" min-width="250" /><el-table-column prop="patientName" label="患者" min-width="120" /><el-table-column label="状态" width="150"><template #default="{row}"><el-tag :type="row.status==='WAITING'?'warning':row.status==='REPORT_READY'?'success':'info'">{{statusLabels[row.status]||row.status}}</el-tag></template></el-table-column><el-table-column label="发布时间" min-width="170"><template #default="{row}">{{fmtTime(row.createdAt)}}</template></el-table-column><el-table-column label="操作" width="120" fixed="right"><template #default="{row}"><el-button link type="primary" @click="open(row)">{{row.canReply&&canManage?'填写问诊单':row.canClaim&&canManage?'查看并接诊':'查看详情'}}</el-button></template></el-table-column>
      </el-table>
      <TablePagination :page-num="pageNum" :page-size="pageSize" :page-sizes="[10,20,50]" :total="total" :summary="`共 ${total} 条记录`" :disabled="loading" @size-change="sizeChange" @page-change="page=>{pageNum=page;load()}" />
    </div>
    <el-drawer v-model="withdrawalsVisible" title="医生沙箱提现" size="min(960px,95vw)" destroy-on-close><DoctorWithdrawals v-if="withdrawalsVisible"/></el-drawer>
    <el-dialog v-model="visible" title="问诊详情" top="5vh" width="min(780px,94vw)" :close-on-click-modal="false" :show-close="!saving" :close-on-press-escape="!saving" @closed="closeDetail">
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="detail">
          <h3>{{detail.title}}</h3><p class="text-muted">{{detail.patientName}} · {{statusLabels[detail.status]}} · {{fmtTime(detail.createdAt)}}</p>
          <template v-if="detail.detailsVisible"><h4>健康描述</h4><p class="full-text">{{detail.symptoms}}</p><h4>血糖情况</h4><p class="full-text">{{detail.glucoseNote||'未填写'}}</p><h4>用药与过敏</h4><p class="full-text">{{detail.medicationNote||'未填写'}}</p></template>
          <el-alert v-else title="接诊后方可查看患者健康详情。" type="info" :closable="false" show-icon />
          <DoctorConversation v-if="visible&&detail.detailsVisible&&canManage" :id="detail.id" :enabled="visible&&detail.detailsVisible&&canManage"/>
          <el-form v-if="detail.canReply&&canManage" label-position="top" class="report-form" :disabled="saving"><el-form-item label="医生评估" required><el-input v-model="form.assessment" type="textarea" :rows="4" maxlength="3000" show-word-limit @input="attempt=''" /></el-form-item><el-form-item label="用药建议" required><el-input v-model="form.medicationAdvice" type="textarea" :rows="3" maxlength="2000" show-word-limit @input="attempt=''" /></el-form-item><el-form-item label="复查与就医建议" required><el-input v-model="form.followUpAdvice" type="textarea" :rows="3" maxlength="2000" show-word-limit @input="attempt=''" /></el-form-item></el-form>
          <div v-if="detail.report?.access==='UNLOCKED'" class="report"><h4>医生评估</h4><p class="full-text">{{detail.report.assessment}}</p><h4>用药建议</h4><p class="full-text">{{detail.report.medicationAdvice}}</p><h4>复查与就医建议</h4><p class="full-text">{{detail.report.followUpAdvice}}</p></div>
        </template>
      </div>
      <template #footer><el-button :disabled="saving" @click="visible=false">关闭</el-button><el-button v-if="detail?.canClaim&&canManage" type="primary" :loading="saving" @click="claim">确认接诊</el-button><el-button v-if="detail?.canReply&&canManage" type="primary" :loading="saving" @click="issue">出具问诊单</el-button></template>
    </el-dialog>
  </div>
</template>
<style scoped>
.head{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:16px}.page-title{margin:0 0 8px;font-size:22px}.page-title small{font-size:14px;font-weight:normal;color:var(--kt-muted)}.head p{margin:0;line-height:1.7}.balance{display:flex;align-items:center;gap:24px;margin-bottom:16px}.balance strong{font-size:28px;color:var(--kt-brand)}.detail-body{min-height:140px;max-height:calc(85vh - 140px);overflow-y:auto;padding-right:8px}.full-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;color:#4b5563}.report-form,.report{margin-top:24px;padding-top:20px;border-top:1px solid var(--kt-line)}h3{margin-top:0}h4{margin-bottom:8px}
</style>
