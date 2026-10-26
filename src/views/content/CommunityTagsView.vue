<template>
  <div class="page-wrap tag-management">
    <div class="tag-page-heading"><div><h2 class="page-title">社区标签管理</h2><p>管理社区分类和发文标签，修改后小程序刷新即可同步。</p></div><el-button v-if="canManage" type="primary" @click="openEditor()">新增分类</el-button></div>
    <el-alert title="用户自建标签归入“其他”；删除标签后用户不能再选择，已发布文章保留。" type="info" :closable="false" show-icon />
    <div class="kt-card tag-table-card">
      <div class="tag-filters">
        <el-input v-model="query.keyword" placeholder="搜索标签名称" maxlength="32" clearable @keyup.enter="search" @clear="search" />
        <el-select v-model="query.type" placeholder="全部类型" clearable @change="search"><el-option label="官方分类" value="OFFICIAL"/><el-option label="其他 · 用户标签" value="USER"/></el-select>
        <el-select v-model="query.enabled" placeholder="全部状态" clearable @change="search"><el-option label="可选择" value="1"/><el-option label="已删除" value="0"/></el-select>
        <el-button type="primary" @click="search">搜索</el-button><el-button @click="load">刷新</el-button>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" class="table-error" />
      <el-table v-loading="loading" :data="rows" row-key="code" empty-text="暂无标签">
        <el-table-column prop="name" label="标签名称" min-width="180"><template #default="{row}"><span class="tag-name"># {{ row.name }}</span><el-tag v-if="row.code==='other'" size="small" class="fixed-tag">固定分类</el-tag></template></el-table-column>
        <el-table-column label="类型" min-width="160"><template #default="{row}"><el-tag :type="row.type==='USER'?'info':'primary'" effect="plain">{{ row.type==='USER'?'其他 · 用户标签':'官方分类' }}</el-tag></template></el-table-column>
        <el-table-column prop="articleCount" label="关联文章" width="110"/>
        <el-table-column prop="sortNo" label="排序" width="90"/>
        <el-table-column label="状态" width="110"><template #default="{row}"><el-tag :type="row.enabled===1?'success':'info'">{{ row.enabled===1?'可选择':'已删除' }}</el-tag></template></el-table-column>
        <el-table-column v-if="canManage" label="操作" width="185" fixed="right"><template #default="{row}"><el-button link type="primary" :disabled="saving" @click="openEditor(row)">编辑</el-button><el-button v-if="row.enabled===1&&row.code!=='other'" link type="danger" :disabled="saving" @click="removeTag(row)">删除</el-button><el-button v-if="row.enabled===0" link type="primary" :disabled="saving" @click="restoreTag(row)">恢复</el-button></template></el-table-column>
      </el-table>
      <div class="tag-pagination"><el-pagination v-model:current-page="pageNum" :page-size="10" :total="total" layout="total, prev, pager, next" @current-change="load" /></div>
    </div>
    <el-dialog v-model="editorOpen" :title="editing?'编辑标签':'新增社区分类'" width="460px" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <el-form label-position="top" @submit.prevent="save">
        <el-form-item label="标签名称"><el-input v-model="form.name" maxlength="16" show-word-limit :disabled="saving||editing?.type==='USER'||editing?.code==='other'" placeholder="例如：控糖早餐"/></el-form-item>
        <el-form-item label="显示排序"><el-input-number v-model="form.sortNo" :min="0" :max="9999" :disabled="saving"/><span class="sort-help">数字越小越靠前</span></el-form-item>
        <el-form-item label="状态"><el-switch v-model="form.enabled" :active-value="1" :inactive-value="0" :disabled="saving||editing?.code==='other'" active-text="可选择" inactive-text="已删除"/></el-form-item>
        <el-alert v-if="editing?.type==='USER'" title="用户标签保留原名称，支持调整排序、删除和恢复。" type="info" :closable="false"/>
        <el-alert v-if="editorError" :title="editorError" type="error" :closable="false"/>
      </el-form>
      <template #footer><el-button :disabled="saving" @click="editorOpen=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed,onBeforeUnmount,reactive,ref} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import {communityTagsApi,type ManagedTag,type TagChange} from '@/api/community-tags'
import {useAuthStore} from '@/stores/auth'
import {getAccessToken} from '@/utils/request'
const auth=useAuthStore(),canManage=computed(()=>auth.role==='admin'&&auth.hasPermission('content:news:edit'))
const query=reactive({keyword:'',type:'',enabled:''}),rows=ref<ManagedTag[]>([]),pageNum=ref(1),total=ref(0),loading=ref(false),error=ref('')
const editorOpen=ref(false),editing=ref<ManagedTag|null>(null),form=reactive<TagChange>({name:'',sortNo:10,enabled:1}),editorError=ref(''),saving=ref(false)
let alive=true,run=0,applied={...query}
function current(token:string){return alive&&getAccessToken()===token}
async function load(){
  const id=++run,token=getAccessToken();loading.value=true;error.value=''
  try{const result=await communityTagsApi.list({...applied,pageNum:pageNum.value});if(!current(token)||id!==run)return;rows.value=result.records;total.value=result.total;if(!rows.value.length&&pageNum.value>1){pageNum.value--;await load()}}
  catch(e){if(current(token)&&id===run)error.value=e instanceof Error?e.message:'标签加载失败，请重试'}
  finally{if(current(token)&&id===run)loading.value=false}
}
function search(){applied={...query,keyword:query.keyword.trim()};pageNum.value=1;void load()}
function openEditor(row?:ManagedTag){if(!canManage.value||saving.value)return;editing.value=row||null;Object.assign(form,{name:row?.name||'',sortNo:row?.sortNo??10,enabled:row?.enabled??1});editorError.value='';editorOpen.value=true}
async function save(){
  if(!canManage.value||saving.value)return
  const name=form.name.normalize('NFKC').trim().replace(/\s+/g,' ')
  if(!/^[\p{L}\p{N} _-]{1,16}$/u.test(name)){editorError.value='标签限1～16字，可用中文、字母和数字';return}
  const token=getAccessToken(),code=editing.value?.code; saving.value=true;editorError.value=''
  try{const data={...form,name};if(code)await communityTagsApi.update(code,data);else await communityTagsApi.create(data);if(!current(token))return;editorOpen.value=false;ElMessage.success('标签已保存');await load()}
  catch(e){if(current(token))editorError.value=e instanceof Error?e.message:'保存失败，请重试'}
  finally{if(current(token))saving.value=false}
}
async function removeTag(row:ManagedTag){
  if(!canManage.value||saving.value||row.code==='other')return
  const token=getAccessToken();try{await ElMessageBox.confirm(`删除“${row.name}”后，用户不能再选择，已发布文章会保留。确定删除吗？`,'删除标签',{type:'warning',confirmButtonText:'删除',cancelButtonText:'取消'})}catch{return}
  if(!current(token)||saving.value)return;saving.value=true
  try{await communityTagsApi.remove(row.code);if(!current(token))return;ElMessage.success('标签已删除');await load()}catch(e){if(current(token))ElMessage.error(e instanceof Error?e.message:'删除失败，请重试')}finally{if(current(token))saving.value=false}
}
async function restoreTag(row:ManagedTag){
  if(!canManage.value||saving.value)return;const token=getAccessToken();saving.value=true
  try{await communityTagsApi.update(row.code,{name:row.name,sortNo:row.sortNo,enabled:1});if(!current(token))return;ElMessage.success('标签已恢复');await load()}catch(e){if(current(token))ElMessage.error(e instanceof Error?e.message:'恢复失败，请重试')}finally{if(current(token))saving.value=false}
}
onBeforeUnmount(()=>{alive=false;run++});void load()
</script>

<style scoped>
.tag-page-heading{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:20px}.tag-page-heading p{color:var(--kt-text-secondary,#7c8798);margin:8px 0 0;line-height:1.7}.tag-table-card{margin-top:20px;padding:22px}.tag-filters{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}.tag-filters>.el-input{width:260px}.tag-filters>.el-select{width:175px}.tag-name{font-weight:600}.fixed-tag{margin-left:10px}.tag-pagination{display:flex;justify-content:flex-end;margin-top:22px}.table-error{margin-bottom:16px}.sort-help{margin-left:14px;color:#8793a4;font-size:12px}@media(max-width:760px){.tag-page-heading{align-items:flex-start;flex-direction:column}.tag-table-card{padding:14px}.tag-filters>.el-input,.tag-filters>.el-select{width:100%}.tag-pagination{overflow:auto;justify-content:flex-start}}
</style>
