<template>
  <div class="page-wrap"><div class="export-heading"><div><h2>导出任务</h2><p>小程序发起的真实导出申请，生成所选日期内的血糖与饮食 PDF，任务与文件统一保存。</p></div><el-button :loading="loading" @click="load">刷新</el-button></div>
    <div class="kt-card"><div class="export-filters"><el-input v-model="keyword" placeholder="搜索用户昵称或用户名" clearable @keyup.enter="search" @clear="search" /><el-select v-model="status" :empty-values="[null,undefined]" @change="search"><el-option label="全部状态" value=""/><el-option label="待生成" value="pending"/><el-option label="生成中" value="processing"/><el-option label="已完成" value="done"/><el-option label="失败" value="failed"/></el-select><el-button type="primary" @click="search">查询</el-button></div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="export-error"/>
      <el-table :data="list" v-loading="loading" row-key="id">
        <el-table-column prop="id" label="任务" width="80"/><el-table-column label="用户" min-width="160"><template #default="{row}"><strong>{{row.userName}}</strong></template></el-table-column>
        <el-table-column label="日期范围" min-width="220"><template #default="{row}">{{row.startDate}} 至 {{row.endDate}}</template></el-table-column>
        <el-table-column label="状态" width="110"><template #default="{row}"><el-tag :type="row.status==='done'?'success':row.status==='failed'?'danger':'warning'">{{names[row.status]}}</el-tag></template></el-table-column>
        <el-table-column label="格式" width="85"><template #default><el-tag type="info" effect="plain">PDF</el-tag></template></el-table-column>
        <el-table-column label="文件内容" min-width="180"><template #default="{row}"><span v-if="row.status==='done'">血糖 {{row.glucoseCount}} 条 · 饮食 {{row.mealCount}} 条</span><span v-else class="export-muted">{{row.error || '等待生成 PDF 文件'}}</span></template></el-table-column>
        <el-table-column label="申请时间" min-width="170"><template #default="{row}">{{date(row.createdAt)}}</template></el-table-column>
        <el-table-column label="完成时间" min-width="170"><template #default="{row}">{{date(row.finishedAt)}}</template></el-table-column>
        <el-table-column label="操作" width="130" fixed="right"><template #default="{row}"><el-button v-if="row.status==='done'" link type="primary" :loading="busy===row.id" :disabled="!!busy" @click="download(row)">下载 PDF</el-button><el-button v-else link type="primary" :loading="busy===row.id" :disabled="!!busy" @click="generate(row)">{{row.status==='failed'?'重新生成':'生成文件'}}</el-button></template></el-table-column>
        <template #empty><el-empty description="暂无导出申请"/></template>
      </el-table>
      <div class="export-pagination"><span>共 {{total}} 个任务</span><el-pagination v-model:current-page="pageNum" :page-size="20" :total="total" layout="prev,pager,next" :disabled="loading" @current-change="load"/></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted,onBeforeUnmount,ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportsApi,type ExportTask } from '@/api/exports'
const list=ref<ExportTask[]>([]),loading=ref(false),error=ref(''),status=ref(''),keyword=ref(''),pageNum=ref(1),total=ref(0),busy=ref('')
const names:Record<string,string>={pending:'待生成',processing:'生成中',done:'已完成',failed:'失败'}
let run=0,alive=true
const date=(value:string|null)=>value?value.replace('T',' ').slice(0,19):'—'
async function load(){const version=++run;loading.value=true;error.value='';try{const page=await exportsApi.list(pageNum.value,20,status.value,keyword.value.trim());if(!alive||version!==run)return;list.value=page.records;total.value=page.total}catch(e){if(alive&&version===run){error.value=(e as Error).message||'导出任务读取失败';list.value=[];total.value=0}}finally{if(alive&&version===run)loading.value=false}}
function search(){pageNum.value=1;load()}
async function generate(row:ExportTask){if(busy.value)return;busy.value=row.id;try{const result=await exportsApi.generate(row.id);if(!alive)return;if(result.status==='done')ElMessage.success('PDF 文件已生成');else ElMessage.error(result.error||'生成失败，请重试');await load()}catch(e){if(alive)ElMessage.error((e as Error).message)}finally{if(alive)busy.value=''}}
async function download(row:ExportTask){if(busy.value)return;busy.value=row.id;let url='';try{const blob=await exportsApi.file(row.id);if(!alive)return;url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`glucopilot-export-${row.id}.pdf`;a.click()}catch(e){if(alive)ElMessage.error((e as Error).message)}finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);if(alive)busy.value=''}}
onMounted(load);onBeforeUnmount(()=>{alive=false;++run})
</script>
<style scoped>
.export-heading{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:24px}.export-heading h2{margin:0 0 8px;font-size:24px}.export-heading p{margin:0;color:var(--kt-muted);font-size:13px}.export-filters{display:grid;grid-template-columns:minmax(200px,340px) 180px auto;gap:14px;justify-content:start;margin-bottom:22px}.export-muted{color:var(--kt-muted);font-size:12px;margin-top:6px}.export-error{margin-bottom:18px}.export-pagination{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:24px;font-size:13px;color:var(--kt-muted)}@media(max-width:760px){.export-filters{grid-template-columns:1fr}.export-heading{align-items:flex-start}.export-pagination{flex-wrap:wrap}}
</style>
