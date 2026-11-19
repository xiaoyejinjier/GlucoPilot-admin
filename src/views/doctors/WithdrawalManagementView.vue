<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import TablePagination from '@/components/TablePagination.vue'
import {withdrawalApi,type Withdrawal,type WorkDay} from '@/api/withdrawals'
import {getAccessToken} from '@/utils/request'
import {fmtTime} from '@/utils/format'
import {withdrawalStatus} from '@/utils/withdrawal'
const labels:Record<string,string>={PENDING:'待审核',APPROVED:'待发放',REJECTED:'已拒绝',COMPLETED:'已模拟发放'}
const rows=ref<Withdrawal[]>([]),status=ref('PENDING'),loading=ref(false),error=ref(''),pageNum=ref(1),pageSize=ref(10),total=ref(0)
const selected=ref<Withdrawal|null>(null),visible=ref(false),decision=ref('APPROVED'),note=ref(''),saving=ref(false)
const calendarOpen=ref(false),calendarDate=ref(''),working=ref(false),calendarNote=ref(''),days=ref<WorkDay[]>([]),calendarSaving=ref(false)
let alive=true,epoch=0
const scopeToken=getAccessToken()
const valid=(token:string)=>alive&&scopeToken===token&&token===getAccessToken()
const money=(n:unknown)=>(Number(n)/100).toFixed(2)
async function load(){const token=getAccessToken(),run=++epoch;loading.value=true;error.value=''
 try{const p=await withdrawalApi.list(pageNum.value,pageSize.value,status.value);if(valid(token)&&run===epoch){rows.value=p.records;total.value=Number(p.total)}}
 catch(e){if(valid(token)&&run===epoch)error.value=(e as Error).message}finally{if(valid(token)&&run===epoch)loading.value=false}}
function open(row:Withdrawal){selected.value={...row};decision.value='APPROVED';note.value='';visible.value=true}
async function review(){if(!selected.value||saving.value||scopeToken!==getAccessToken())return;if(!note.value.trim()){ElMessage.warning('请填写审核意见');return}
 const token=getAccessToken();saving.value=true
 try{await withdrawalApi.review(selected.value,decision.value,note.value.trim());if(!valid(token))return;visible.value=false;ElMessage.success('审核已保存');await load()}
 catch(e){if(valid(token))ElMessage.error((e as Error).message)}finally{if(valid(token))saving.value=false}}
async function payout(row:Withdrawal){if(saving.value)return;const token=getAccessToken()
 try{await ElMessageBox.confirm('向该订单绑定的支付宝沙箱账号转账测试资金。未到预计发放日期不能执行。','确认沙箱转账')}catch{return}
 if(!valid(token))return;saving.value=true
 try{const result=await withdrawalApi.payout(row.orderNo);if(valid(token)){if(result.status==='COMPLETED')ElMessage.success('支付宝沙箱转账已确认到账');else ElMessage.info('转账结果待核实，请查看状态与错误码');await load()}}
 catch(e){if(valid(token))ElMessage.error((e as Error).message)}finally{if(valid(token))saving.value=false}}
async function refreshTransfer(row:Withdrawal){if(saving.value)return;const token=getAccessToken();saving.value=true
 try{await withdrawalApi.refresh(row.orderNo);if(valid(token))await load()}catch(e){if(valid(token))ElMessage.error((e as Error).message)}finally{if(valid(token))saving.value=false}}
async function openCalendar(){calendarOpen.value=true;const token=getAccessToken(),y=calendarDate.value?Number(calendarDate.value.slice(0,4)):new Date().getFullYear()
 try{const result=await withdrawalApi.calendar(`${y}-01-01`,`${y}-12-31`);if(valid(token))days.value=result}catch(e){if(valid(token))ElMessage.error((e as Error).message)}}
async function saveDay(){if(!calendarDate.value||calendarSaving.value)return;const token=getAccessToken();calendarSaving.value=true
 try{await withdrawalApi.saveDay(calendarDate.value,working.value,calendarNote.value);if(!valid(token))return;ElMessage.success('工作日设置已保存');await openCalendar()}
 catch(e){if(valid(token))ElMessage.error((e as Error).message)}finally{if(valid(token))calendarSaving.value=false}}
onMounted(load);onBeforeUnmount(()=>{alive=false;epoch++;rows.value=[];selected.value=null})
</script>
<template>
 <div class="page-wrap paginated-page"><header class="withdraw-header"><div><h2 class="page-title">提现审核</h2><p class="text-muted">医生问诊收入提现，审核通过后按工作日历计算第5个工作日发放。</p></div><div><el-button @click="openCalendar">工作日历</el-button><el-button @click="load">刷新</el-button></div></header>
 <el-alert title="支付宝沙箱转账：申请冻结收入，审核通过后第5个工作日出款到绑定的沙箱买家UID，查询确认成功才显示到账；仅测试资金。" type="info" :closable="false" show-icon class="notice"/>
 <div class="kt-card paginated-card"><div class="filters"><span>处理状态</span><el-select v-model="status" style="width:180px" @change="pageNum=1;load()"><el-option label="全部" value=""/><el-option v-for="(label,key) in labels" :key="key" :label="label" :value="key"/></el-select></div><el-alert v-if="error" :title="error" type="error" :closable="false"/>
 <el-table v-loading="loading" :data="rows" row-key="orderNo" height="100%" class="paginated-table" empty-text="暂无提现申请"><el-table-column label="医生" min-width="120"><template #default="{row}">{{row.doctorName||row.userId}}</template></el-table-column><el-table-column label="金额" width="110"><template #default="{row}">¥{{money(row.amountCents)}}</template></el-table-column><el-table-column label="状态" width="170"><template #default="{row}"><el-tag>{{withdrawalStatus(row)}}</el-tag></template></el-table-column><el-table-column label="申请时间" min-width="170"><template #default="{row}">{{fmtTime(row.createdAt)}}</template></el-table-column><el-table-column prop="expectedPayoutDate" label="预计发放日期" min-width="135"/><el-table-column prop="payeeUserId" label="沙箱收款UID" min-width="190"/><el-table-column prop="transferErrorCode" label="转账核对信息" min-width="190"/><el-table-column prop="orderNo" label="订单编号" min-width="290"/><el-table-column prop="reviewNote" label="审核意见" min-width="180" show-overflow-tooltip/><el-table-column label="操作" width="200" fixed="right"><template #default="{row}"><el-button v-if="row.status==='PENDING'" link type="primary" @click="open(row)">审核</el-button><el-button v-if="row.status==='APPROVED'" link type="primary" :disabled="saving" @click="payout(row)">沙箱转账</el-button><el-button v-if="row.status==='APPROVED'" link type="primary" :disabled="saving" @click="refreshTransfer(row)">刷新状态</el-button></template></el-table-column></el-table>
 <TablePagination :page-num="pageNum" :page-size="pageSize" :total="total" :summary="`共 ${total} 笔提现`" :disabled="loading" :page-sizes="[10,20,50]" @page-change="n=>{pageNum=n;load()}" @size-change="n=>{pageSize=n;pageNum=1;load()}"/></div>
 <el-dialog v-model="visible" title="提现审核" width="520px" :close-on-click-modal="false" :show-close="!saving"><template v-if="selected"><p>医生：{{selected.doctorName||selected.userId}} · 金额：¥{{money(selected.amountCents)}}</p><el-form label-position="top"><el-form-item label="审核结果"><el-radio-group v-model="decision" :disabled="saving"><el-radio value="APPROVED">通过</el-radio><el-radio value="REJECTED">拒绝并解冻</el-radio></el-radio-group></el-form-item><el-form-item label="审核意见" required><el-input v-model="note" type="textarea" :rows="4" maxlength="500" show-word-limit :disabled="saving"/></el-form-item></el-form><p class="text-muted">发放日期按已配置的节假日与调休计算；未配置日期按周一至周五。</p></template><template #footer><el-button :disabled="saving" @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="review">保存审核</el-button></template></el-dialog>
 <el-dialog v-model="calendarOpen" title="提现工作日历" width="min(700px,94vw)"><el-alert title="设置节假日为休息日、调休补班为工作日。已批准订单保留原预计日期。" :closable="false"/><el-form label-position="top" class="calendar-form"><el-form-item label="日期"><el-date-picker v-model="calendarDate" type="date" value-format="YYYY-MM-DD"/></el-form-item><el-form-item label="是否工作日"><el-switch v-model="working" active-text="工作日" inactive-text="休息日"/></el-form-item><el-form-item label="说明"><el-input v-model="calendarNote" maxlength="100"/></el-form-item><el-button type="primary" :loading="calendarSaving" :disabled="!calendarDate" @click="saveDay">保存日期设置</el-button></el-form><el-table :data="days" max-height="300"><el-table-column prop="calendar_date" label="日期"/><el-table-column label="类型"><template #default="{row}">{{Number(row.working_day)?'工作日':'休息日'}}</template></el-table-column><el-table-column prop="note" label="说明"/></el-table></el-dialog>
 </div>
</template>
<style scoped>.withdraw-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:20px}.withdraw-header h2{margin:0 0 8px}.withdraw-header p{margin:0;line-height:1.7}.notice{margin-bottom:18px}.filters{display:flex;align-items:center;gap:16px;margin-bottom:18px}.calendar-form{margin:20px 0}@media(max-width:700px){.withdraw-header{align-items:flex-start;flex-direction:column}}</style>
