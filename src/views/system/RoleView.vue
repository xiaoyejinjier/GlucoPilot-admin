<template>
  <div class="page-wrap">
    <el-row :gutter="16">
      <el-col :span="10">
        <div class="kt-card">
          <div class="block-title">角色与权限矩阵</div>
          <el-table :data="permRows" border size="small">
            <el-table-column prop="module" label="模块" min-width="150" />
            <el-table-column label="运营编辑" width="110" align="center">
              <template #default="{ row }"><el-icon v-if="row.editor" color="#07c160"><CircleCheck /></el-icon><span v-else class="text-muted">—</span></template>
            </el-table-column>
            <el-table-column label="管理员" width="110" align="center">
              <template #default="{ row }"><el-icon v-if="row.admin" color="#07c160"><CircleCheck /></el-icon><span v-else class="text-muted">—</span></template>
            </el-table-column>
          </el-table>
          <el-alert class="mt12" type="info" :closable="false">
            <p style="margin: 0 0 4px">· 运营编辑：内容/营养库/反馈/导出（不含用户健康明细与系统管理）</p>
            <p style="margin: 0">· 管理员：全部权限，健康档案查阅将记录操作日志；可维护账号角色与系统参数</p>
          </el-alert>
        </div>
      </el-col>

      <el-col :span="14">
        <div class="kt-card">
          <div class="flex-between mb12">
            <span class="block-title">后台管理员账号</span>
            <el-button type="primary" size="small" :icon="Plus" @click="openAccount()">新增账号</el-button>
          </div>
          <el-table :data="accounts" v-loading="loading">
            <el-table-column prop="username" label="账号" width="120" />
            <el-table-column prop="nickname" label="姓名/昵称" min-width="140" />
            <el-table-column label="角色" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="row.role === 'admin' ? 'warning' : 'success'" effect="light">
                  {{ row.role === 'admin' ? '管理员' : '运营' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.status === 1 ? 'success' : 'info'" effect="plain">
                  {{ row.status === 1 ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="lastLoginAt" label="最近登录" min-width="150" show-overflow-tooltip />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openAccount(row)">编辑</el-button>
                <el-button v-if="row.username !== auth.account?.username" link :type="row.status === 1 ? 'danger' : 'success'" @click="toggleAccount(row)">
                  {{ row.status === 1 ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="dialog.visible" :title="dialog.form.id ? '编辑账号' : '新增账号'" width="460px">
      <el-form label-width="80px">
        <el-form-item label="账号"><el-input v-model="dialog.form.username" :disabled="!!dialog.form.id" placeholder="登录账号" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="dialog.form.password" :placeholder="dialog.form.id ? '留空则不修改' : '初始密码'" type="password" show-password /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="dialog.form.nickname" /></el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="dialog.form.role">
            <el-radio value="editor">运营编辑</el-radio>
            <el-radio value="admin">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="dialog.form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveAccount">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { AdminAccount } from '@/types'

const auth = useAuthStore()
const loading = ref(false)
const accounts = ref<AdminAccount[]>([])
const dialog = reactive({
  visible: false,
  form: { id: 0, username: '', password: '', nickname: '', role: 'editor' as 'admin' | 'editor', status: 1 as 1 | 0 }
})

const permRows = [
  { module: '数据看板', editor: true, admin: true },
  { module: '资讯 / 轮播 / 素材', editor: true, admin: true },
  { module: '食物营养库', editor: true, admin: true },
  { module: '反馈处理', editor: true, admin: true },
  { module: '导出任务', editor: true, admin: true },
  { module: '用户管理与健康档案', editor: false, admin: true },
  { module: '角色权限 / 系统参数 / 操作日志', editor: false, admin: true },
  { module: '消息推送 / AI 服务（二期）', editor: false, admin: true }
]

async function load() {
  loading.value = true
  try {
    accounts.value = await api.listAccounts()
  } catch (e) {
    ElMessage.error((e as Error).message || '加载账号失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openAccount(row?: AdminAccount) {
  if (row) {
    dialog.form = { id: row.id, username: row.username, password: '', nickname: row.nickname, role: row.role, status: row.status }
  } else {
    dialog.form = { id: 0, username: '', password: '', nickname: '', role: 'editor', status: 1 }
  }
  dialog.visible = true
}

async function saveAccount() {
  if (!dialog.form.username.trim() || (!dialog.form.id && !dialog.form.password)) {
    return ElMessage.warning('请填写账号与初始密码')
  }
  const base = accounts.value.find((a) => a.id === dialog.form.id)
  const password = dialog.form.password || base?.password || ''
  try {
    await api.saveAccount({
      id: dialog.form.id,
      username: dialog.form.username,
      password,
      nickname: dialog.form.nickname,
      role: dialog.form.role,
      status: dialog.form.status,
      createdAt: base?.createdAt || '',
      lastLoginAt: base?.lastLoginAt || ''
    })
    if (auth.account) api.writeLog(auth.account.username, auth.account.role, '系统', dialog.form.id ? '编辑账号' : '新增账号', dialog.form.username)
    dialog.visible = false
    ElMessage.success('已保存')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  }
}

async function toggleAccount(row: AdminAccount) {
  try {
    await api.saveAccount({ ...row, status: row.status === 1 ? 0 : 1, password: '' })
    if (auth.account) api.writeLog(auth.account.username, auth.account.role, '系统', row.status === 1 ? '停用账号' : '启用账号', row.username)
    ElMessage.success('已更新')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '更新失败')
  }
}
</script>

<style scoped>
.block-title { font-weight: 600; margin-bottom: 12px; }
.mt12 { margin-top: 12px; }
</style>
