<template>
  <div class="page-wrap">
    <div class="head">
      <h2 class="page-title">用户管理</h2>
      <span class="text-muted">用户健康档案请在「健康档案」菜单中查看（仅管理员）</span>
    </div>

    <div class="kt-card">
      <div class="filter mb12">
        <el-input v-model="q.keyword" placeholder="用户名 / 昵称 / 手机号" clearable :prefix-icon="Search" style="width: 260px" />
        <el-select v-model="q.status" placeholder="状态" clearable style="width: 130px">
          <el-option label="正常" value="enabled" />
          <el-option label="已禁用" value="disabled" />
        </el-select>
        <el-button link type="primary" style="margin-left: auto" @click="$router.push('/user-service/archives')">前往健康档案 →</el-button>
      </div>
      <el-table :data="userRows" v-loading="loading" row-key="id">
        <el-table-column label="用户" min-width="180">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="30" class="avatar">{{ row.avatarText }}</el-avatar>
              <div>
                <div>{{ row.nickname }}</div>
                <div class="text-muted" style="font-size: 12px">{{ row.phone }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" min-width="150" />
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
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'enabled'" link type="danger" @click="toggle(row, false)">禁用</el-button>
            <el-button v-else link type="success" @click="toggle(row, true)">解禁</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { AppUser } from '@/types'

const auth = useAuthStore()
const loading = ref(false)
const users = ref<AppUser[]>([])
const q = reactive({ keyword: '', status: '' })

async function load() {
  loading.value = true
  try {
    users.value = await api.listUsers()
  } catch (error) {
    users.value = []
    ElMessage.error(error instanceof Error ? error.message : '用户列表加载失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const userRows = computed(() =>
  users.value.filter(
    (u) =>
      (!q.keyword || (u.username || '').includes(q.keyword) || u.nickname.includes(q.keyword) || u.phone.includes(q.keyword)) &&
      (!q.status || u.status === q.status)
  )
)

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
.head { margin-bottom: 16px; }
.page-title { margin: 0 0 4px; font-size: 18px; }
.filter { display: flex; gap: 10px; align-items: center; }
.user-cell { display: flex; align-items: center; gap: 8px; }
.avatar { background: var(--kt-brand); color: #fff; flex: none; }
</style>
