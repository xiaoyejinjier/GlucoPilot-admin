<template>
  <div class="page-wrap paginated-page">
    <div class="head">
      <h2 class="page-title">用户管理</h2>
      <span class="text-muted">用户健康档案请在「健康档案」菜单中查看（仅管理员）</span>
    </div>

    <div class="kt-card paginated-card">
      <div class="filter mb12">
        <el-input v-model="q.keyword" placeholder="用户名 / 昵称 / 手机号" clearable :prefix-icon="Search" style="width: 260px" @keyup.enter="search" @clear="search" />
        <el-select v-model="q.status" placeholder="状态" clearable style="width: 130px" @change="search">
          <el-option label="正常" value="enabled" />
          <el-option label="已禁用" value="disabled" />
        </el-select>
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button link type="primary" style="margin-left: auto" @click="$router.push('/user-service/archives')">前往健康档案 →</el-button>
      </div>
      <el-table :data="users" v-loading="loading" row-key="id" height="100%" class="paginated-table">
        <el-table-column label="序号" width="70" align="center">
          <template #default="{ $index }">{{ (page.pageNum - 1) * page.pageSize + $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="用户" min-width="180">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="30" class="avatar">{{ row.avatarText }}</el-avatar>
              <div>
                <div>{{ row.nickname }}</div>

              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" min-width="150" />
        <el-table-column label="手机号" min-width="150"><template #default="{row}">{{row.phone || '未绑定'}}</template></el-table-column>
        <el-table-column prop="age" label="年龄" width="70" />
        <el-table-column prop="diabetesType" label="类型" width="130" />
        <el-table-column label="记录" width="140">
          <template #default="{ row }">血糖 {{ row.recordCount }} · 饮食 {{ row.mealCount }}</template>
        </el-table-column>
        <el-table-column label="达标率" width="170">
          <template #default="{ row }">
            <el-progress :percentage="row.compliance" :color="row.compliance >= 70 ? '#07c160' : row.compliance >= 40 ? '#fa9d3b' : '#fa5151'" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'enabled' ? 'success' : 'danger'" effect="light">
              {{ row.status === 'enabled' ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="registeredAt" label="注册时间" width="170" />
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'enabled'" link type="danger" @click="toggle(row, false)">禁用</el-button>
            <el-button v-else link type="success" @click="toggle(row, true)">解禁</el-button>
          </template>
        </el-table-column>
      </el-table>
      <TablePagination
        :page-num="page.pageNum"
        :page-size="page.pageSize"
        :total="page.total"
        :summary="pageSummary"
        :disabled="loading"
        @size-change="changeSize"
        @page-change="changePage"
      />
    </div>
    <el-drawer v-model="detailVisible" title="用户详情" :size="560" destroy-on-close>
      <div v-loading="detailLoading" class="user-detail-content">
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" show-icon />
        <template v-if="detail"><div class="user-detail-heading"><el-avatar :size="56">{{detail.avatarText || '用'}}</el-avatar><div><h3>{{detail.nickname}}</h3><span>社区号 u{{detail.id}}</span></div><el-tag :type="detail.accountStatus===1?'success':'danger'">{{detail.accountStatus===1?'正常':'已禁用'}}</el-tag></div>
          <el-descriptions :column="1" border><el-descriptions-item label="用户名">{{detail.username || '未设置'}}</el-descriptions-item><el-descriptions-item label="手机号">{{detail.phone || '未绑定'}}</el-descriptions-item><el-descriptions-item label="年龄">{{detail.age == null ? '未填写' : detail.age+' 岁'}}</el-descriptions-item><el-descriptions-item label="糖尿病类型">{{detail.diabetesTypeText || '未填写'}}</el-descriptions-item><el-descriptions-item label="注册时间">{{detailDate(detail.registeredAt)}}</el-descriptions-item><el-descriptions-item label="最后活跃">{{detailDate(detail.lastActiveAt)}}</el-descriptions-item><el-descriptions-item label="血糖记录">{{detail.recordCount}} 条</el-descriptions-item><el-descriptions-item label="饮食记录">{{detail.mealCount}} 条</el-descriptions-item><el-descriptions-item label="达标率">{{detail.complianceRate}}%</el-descriptions-item></el-descriptions>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { api } from '@/api'
import TablePagination from '@/components/TablePagination.vue'
import { useServerPagination } from '@/composables/useServerPagination'
import { useAuthStore } from '@/stores/auth'
import type { AppUser } from '@/types'
import { userDetailsApi,type UserDetail } from '@/api/users'
import { getAccessToken } from '@/utils/request'

const auth = useAuthStore()
const detailVisible=ref(false),detailLoading=ref(false),detailError=ref(''),detail=ref<UserDetail|null>(null)
let detailRun=0,alive=true
const detailDate=(value:string|null)=>value?value.replace('T',' ').slice(0,19):'未记录'
async function openDetail(row:AppUser){const version=++detailRun,token=getAccessToken();detail.value=null;detailError.value='';detailVisible.value=true;detailLoading.value=true;try{const saved=await userDetailsApi.get(row.id);if(alive&&version===detailRun&&token===getAccessToken())detail.value=saved}catch(e){if(alive&&version===detailRun)detailError.value=(e as Error).message||'用户详情读取失败'}finally{if(alive&&version===detailRun)detailLoading.value=false}}
onBeforeUnmount(()=>{alive=false;++detailRun})
const q = reactive({ keyword: '', status: '' })
type UserFilters = { keyword?: string; accountStatus?: number }
const { page, records: users, loading, pageSummary, load, search: applyFilters, changeSize, changePage } =
  useServerPagination<AppUser, UserFilters>(api.pageUsers, {}, { errorMessage: '用户列表加载失败' })
onMounted(load)

function search() {
  return applyFilters({
    keyword: q.keyword.trim() || undefined,
    accountStatus: q.status ? (q.status === 'enabled' ? 1 : 0) : undefined
  })
}

function reset() {
  q.keyword = ''
  q.status = ''
  return search()
}

async function toggle(row: AppUser, enabled: boolean) {
  try {
    await api.toggleUserStatus(row.id, enabled)
    if (auth.account) api.writeLog(auth.account.username, auth.account.role, '用户', enabled ? '解禁用户' : '禁用用户', `${row.nickname}(${row.id})`)
    ElMessage.success(enabled ? '已解禁' : '已禁用')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '用户状态更新失败')
  }
}
</script>

<style scoped>
.head { flex: none; margin-bottom: 16px; }
.page-title { margin: 0 0 4px; font-size: 18px; }
.filter { display: flex; flex: none; flex-wrap: wrap; gap: 10px; align-items: center; }
.user-cell { display: flex; align-items: center; gap: 8px; }
.avatar { background: var(--kt-brand); color: #fff; flex: none; }
.user-detail-content{padding:4px 0;min-height:220px}.user-detail-heading{display:flex;gap:16px;align-items:center;margin:0 0 28px}.user-detail-heading h3{margin:0 0 8px;font-size:21px}.user-detail-heading span{color:var(--kt-muted);font-size:13px}.user-detail-heading .el-tag{margin-left:auto}
</style>
