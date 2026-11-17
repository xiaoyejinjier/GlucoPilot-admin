<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import {withdrawalApi,type Withdrawal,type WithdrawalSummary} from '@/api/withdrawals'
import {getAccessToken} from '@/utils/request'
import {fmtTime} from '@/utils/format'
const summary=ref<WithdrawalSummary|null>(null),rows=ref<Withdrawal[]>([]),loading=ref(false),saving=ref(false),amount=ref(''),error=ref('')
let alive=true,run=0,attempt='',attemptAmount=0
const scopeToken=getAccessToken()
const labels:Record<string,string>={PENDING:'待审核',APPROVED:'待发放',REJECTED:'已拒绝',COMPLETED:'已模拟发放'}
const valid=(token:string)=>alive&&scopeToken===token&&token===getAccessToken(),money=(n:unknown)=>(Number(n)/100).toFixed(2)
async function load(){const token=getAccessToken(),current=++run;loading.value=true;error.value=''
 try{const [s,p]=await Promise.all([withdrawalApi.ownSummary(),withdrawalApi.ownList()]);if(valid(token)&&current===run){summary.value=s;rows.value=p.records}}
 catch(e){if(valid(token)&&current===run)error.value=(e as Error).message}finally{if(valid(token)&&current===run)loading.value=false}}
async function apply(){if(saving.value||!summary.value||scopeToken!==getAccessToken())return;const input=amount.value.trim();if(!/^\d{1,7}(\.\d{1,2})?$/.test(input)){ElMessage.warning('请输入正确金额，最多两位小数');return}
 const [whole,part='']=input.split('.'),cents=Number(whole)*100+Number((part+'00').slice(0,2));if(cents<1||cents>Number(summary.value.availableCents)){ElMessage.warning('可提现问诊收入不足');return}
 const token=getAccessToken();try{await ElMessageBox.confirm(`冻结 ¥${money(cents)} 问诊收入，审核后第5个工作日模拟发放，不涉及真实转账。`,'确认沙箱提现')}catch{return}
 if(!valid(token)||saving.value)return;saving.value=true
 if(!attempt||attemptAmount!==cents){attempt=`withdraw_${Date.now()}_${Math.random().toString(36).slice(2,12)}`;attemptAmount=cents}
 try{await withdrawalApi.apply(cents,attempt);if(valid(token)){attempt='';amount.value='';ElMessage.success('提现申请已提交');await load()}}
 catch(e){if(valid(token))ElMessage.error((e as Error).message)}finally{if(valid(token))saving.value=false}}
onMounted(load);onBeforeUnmount(()=>{alive=false;run++;summary.value=null;rows.value=[]})
</script>
<template><section v-loading="loading" class="doctor-withdrawals"><el-alert title="医生沙箱提现：仅问诊收入可申请，需管理员审核，第5个工作日模拟发放，不向支付宝真实转账。" type="info" :closable="false" show-icon/><el-alert v-if="error" :title="error" type="error" :closable="false"/><div v-if="summary" class="withdraw-summary"><span>可提现问诊收入 <strong>¥{{money(summary.availableCents)}}</strong></span><span>冻结中 <strong>¥{{money(summary.frozenCents)}}</strong></span><el-input v-model="amount" placeholder="提现金额（元）" style="width:190px" :disabled="saving"/><el-button type="primary" :loading="saving" :disabled="!summary.eligible||Number(summary.availableCents)<=0" @click="apply">申请提现</el-button></div><el-table :data="rows" row-key="orderNo" empty-text="暂无提现记录" max-height="440"><el-table-column label="金额" width="115"><template #default="{row}">¥{{money(row.amountCents)}}</template></el-table-column><el-table-column label="状态" width="130"><template #default="{row}">{{labels[row.status]}}</template></el-table-column><el-table-column label="申请时间" min-width="165"><template #default="{row}">{{fmtTime(row.createdAt)}}</template></el-table-column><el-table-column prop="expectedPayoutDate" label="预计发放日期" min-width="140"/><el-table-column prop="reviewNote" label="审核意见" min-width="180"/><el-table-column prop="payoutReference" label="模拟流水" min-width="280"/></el-table><el-button link @click="load">刷新提现记录</el-button></section></template>
<style scoped>.doctor-withdrawals{margin-top:20px}.withdraw-summary{display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin:22px 0}.withdraw-summary strong{display:block;margin-top:6px;font-size:24px;color:var(--kt-brand)}</style>
