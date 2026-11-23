<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Plus, Setting } from '@element-plus/icons-vue'
import TablePagination from '@/components/TablePagination.vue'
import NavigationArrow from '@/components/NavigationArrow.vue'
import { useAuthStore } from '@/stores/auth'
import { doctorApi, type DoctorAccount } from '@/api/doctor-portal'
import { getAccessToken } from '@/utils/request'

const rows=ref<DoctorAccount[]>([]), pageNum=ref(1), pageSize=ref(10), total=ref(0), loading=ref(false), error=ref('')
const visible=ref(false), selected=ref<DoctorAccount|null>(null), saving=ref(false)
const form=reactive({username:'',password:'',status:1})
const permissionsVisible=ref(false), selectedPermissions=ref<string[]>([]), permissionsLoading=ref(false), permissionSaving=ref(false), permissionsReady=ref(false)
const features=[{code:'doctor:workbench:view',name:'接诊工作台'},{code:'doctor:consultation:manage',name:'我的问诊与接诊出单'},{code:'doctor:income:view',name:'我的收入'}]
const doctorStates:Record<string,string>={PENDING:'待审核',APPROVED:'已通过',REJECTED:'未通过',DISABLED:'已停用'}
const router=useRouter(),auth=useAuthStore()
const canViewWithdrawals=computed(()=>auth.role==='admin'&&auth.hasPermission('doctor:withdrawal:manage'))
function openWithdrawals(row?:DoctorAccount) {
  if(!canViewWithdrawals.value)return
  if(row&&!/^[1-9]\d{0,18}$/.test(String(row.doctorUserId)))return
  void router.push({path:'/doctor-management/withdrawals',query:row?{userId:String(row.doctorUserId),doctorName:row.realName}:{}})
}
let alive=true, epoch=0
async function load() {
  const run=++epoch, token=getAccessToken();loading.value=true;error.value=''
  try { const data=await doctorApi.accounts(pageNum.value,pageSize.value)
    if(!alive||run!==epoch||token!==getAccessToken())return
    rows.value=data.records;total.value=Number(data.total)
  } catch(e) { if(alive&&run===epoch&&token===getAccessToken())error.value=(e as Error).message }
  finally { if(alive&&run===epoch&&token===getAccessToken())loading.value=false }
}
function open(row:DoctorAccount) {selected.value=row;form.username=row.username||'';form.password='';form.status=row.opsId?row.accountStatus:1;visible.value=true}
async function save() {
  if(!selected.value||saving.value)return
  if(!selected.value.opsId&&!/^[A-Za-z0-9_]{3,40}$/.test(form.username)) {ElMessage.warning('登录名为3～40位字母、数字或下划线');return}
  if((!selected.value.opsId||form.password)&& (form.password.length<8||new TextEncoder().encode(form.password).length>72)) {ElMessage.warning('密码至少8位且不超过72字节');return}
  const token=getAccessToken(), row=selected.value;saving.value=true
  try {
    if(row.opsId)await doctorApi.update(row.doctorUserId,{status:form.status,password:form.password||undefined})
    else await doctorApi.create(row.doctorUserId,{username:form.username,password:form.password})
    if(!alive||token!==getAccessToken())return
    form.password='';visible.value=false;ElMessage.success('医生账号已保存');await load()
  } catch(e) {if(alive&&token===getAccessToken())ElMessage.error((e as Error).message)}
  finally {if(alive&&token===getAccessToken())saving.value=false}
}
async function openPermissions() {
  permissionsVisible.value=true;permissionsLoading.value=true;permissionsReady.value=false;selectedPermissions.value=[]
  const token=getAccessToken()
  try {const data=await doctorApi.permissions();if(alive&&token===getAccessToken()&&permissionsVisible.value) {selectedPermissions.value=data.permissions;permissionsReady.value=true}}
  catch(e) {if(alive&&token===getAccessToken())ElMessage.error((e as Error).message)}
  finally {if(alive&&token===getAccessToken())permissionsLoading.value=false}
}
async function savePermissions() {
  if(permissionSaving.value||!permissionsReady.value)return
  const token=getAccessToken();permissionSaving.value=true
  try {await doctorApi.savePermissions(selectedPermissions.value)
    if(!alive||token!==getAccessToken())return
    permissionsVisible.value=false;ElMessage.success('权限已保存，医生重新登录后生效')
  } catch(e) {if(alive&&token===getAccessToken())ElMessage.error((e as Error).message)}
  finally {if(alive&&token===getAccessToken())permissionSaving.value=false}
}
function sizeChange(size:number) {pageSize.value=size;pageNum.value=1;load()}
onMounted(load)
onBeforeUnmount(()=>{alive=false;epoch++;rows.value=[];selected.value=null;form.password=''})
</script>

<template>
  <div class="page-wrap paginated-page">
    <div class="head"><div><h2 class="page-title">医生账号</h2><p class="text-muted">管理医生后台身份，查看对应提现记录。</p></div><div class="actions"><el-button v-if="canViewWithdrawals" @click="openWithdrawals()"><NavigationArrow />提现审核</el-button><el-button :icon="Setting" @click="openPermissions">医生功能权限</el-button><el-button :icon="Refresh" @click="load">刷新</el-button></div></div>
    <div class="kt-card paginated-card">
      <el-alert title="医生不能访问现有管理员业务。功能授权与系统角色、菜单管理共用同一套权限数据。" type="info" :closable="false" show-icon class="mb16" />
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-table v-loading="loading" :data="rows" height="100%" class="paginated-table" row-key="doctorUserId">
        <el-table-column prop="realName" label="医生" min-width="120" /><el-table-column prop="hospital" label="执业机构" min-width="170" /><el-table-column prop="specialty" label="科室" min-width="120" />
        <el-table-column label="资质" width="110"><template #default="{row}"><el-tag :type="row.doctorStatus==='APPROVED'?'success':'info'">{{doctorStates[row.doctorStatus]||row.doctorStatus}}</el-tag></template></el-table-column>
        <el-table-column label="后台账号" min-width="140"><template #default="{row}">{{row.username||'尚未开通'}}</template></el-table-column>
        <el-table-column label="账号状态" width="110"><template #default="{row}"><el-tag :type="!row.opsId?'info':row.accountStatus?'success':'danger'">{{!row.opsId?'未开通':row.accountStatus?'启用':'停用'}}</el-tag></template></el-table-column>
        <el-table-column v-if="canViewWithdrawals" label="提现详情" width="130"><template #default="{row}"><el-button link type="primary" @click="openWithdrawals(row)">查看明细</el-button></template></el-table-column>
        <el-table-column label="操作" width="150" fixed="right"><template #default="{row}"><el-button link type="primary" :icon="!row.opsId?Plus:undefined" :disabled="!row.opsId&&row.doctorStatus!=='APPROVED'" @click="open(row)">{{row.opsId?'编辑账号':'开通后台账号'}}</el-button></template></el-table-column>
      </el-table>
      <TablePagination :page-num="pageNum" :page-size="pageSize" :page-sizes="[10,20,50]" :total="total" :summary="`共 ${total} 位医生`" :disabled="loading" @size-change="sizeChange" @page-change="page=>{pageNum=page;load()}" />
    </div>
    <el-dialog v-model="visible" :title="selected?.opsId?'编辑医生账号':'开通医生后台账号'" width="520px" :close-on-click-modal="false" :show-close="!saving" :close-on-press-escape="!saving" @closed="form.password=''">
      <el-form v-if="selected" label-width="100px" :disabled="saving"><el-form-item label="绑定医生">{{selected.realName}}（用户ID：{{selected.doctorUserId}}）</el-form-item><el-form-item label="登录名" required><el-input v-model="form.username" :disabled="!!selected.opsId" maxlength="40" placeholder="字母、数字或下划线" /></el-form-item><el-form-item :label="selected.opsId?'重置密码':'初始密码'" :required="!selected.opsId"><el-input v-model="form.password" type="password" show-password autocomplete="new-password" :placeholder="selected.opsId?'留空不修改密码':'至少8位，由管理员设置'" /></el-form-item><el-form-item label="账号状态"><el-radio-group v-model="form.status"><el-radio :value="1">启用</el-radio><el-radio :value="0">停用</el-radio></el-radio-group></el-form-item></el-form>
      <template #footer><el-button :disabled="saving" @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="permissionsVisible" title="医生功能权限" width="520px" :close-on-click-modal="false" :show-close="!permissionSaving" :close-on-press-escape="!permissionSaving">
      <el-alert title="配置统一的 doctor 角色。也可在系统管理的角色和菜单中调整，修改后医生需重新登录。" type="info" :closable="false" class="mb16" />
      <div v-loading="permissionsLoading"><el-checkbox-group v-model="selectedPermissions" :disabled="permissionSaving||!permissionsReady"><el-checkbox v-for="item in features" :key="item.code" :value="item.code" class="feature">{{item.name}}</el-checkbox></el-checkbox-group></div>
      <template #footer><el-button :disabled="permissionSaving" @click="permissionsVisible=false">取消</el-button><el-button type="primary" :disabled="!permissionsReady" :loading="permissionSaving" @click="savePermissions">保存权限</el-button></template>
    </el-dialog>
  </div>
</template>
<style scoped>
.head{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:16px}.page-title{margin:0 0 8px;font-size:22px}.head p{margin:0;line-height:1.7}.actions{display:flex;flex-wrap:wrap;gap:8px}.actions :deep(.el-button+.el-button){margin-left:0}.feature{display:flex;margin:14px 0}@media(max-width:900px){.head{align-items:flex-start;flex-direction:column}}
</style>
