<template>
  <div class="page-wrap">
    <div class="toolbar">
      <span class="title">设备管理（C 端用户绑定设备档案）</span>
      <el-button type="primary" :icon="Plus" @click="openDialog()">新增设备</el-button>
    </div>

    <div class="kt-card">
      <div class="filter mb12">
        <el-input v-model="q.keyword" placeholder="序列号 / 设备名称" clearable :prefix-icon="Search" style="width: 240px" @clear="load" @keyup.enter="load" />
        <el-select v-model="q.deviceStatus" placeholder="状态" clearable style="width: 130px" @change="load">
          <el-option label="正常" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
      </div>
      <el-table :data="list" v-loading="loading" row-key="id">
        <el-table-column prop="deviceSn" label="序列号" min-width="140" />
        <el-table-column prop="deviceName" label="名称" min-width="120" />
        <el-table-column prop="provider" label="厂商" width="100" />
        <el-table-column prop="userMasked" label="绑定用户" min-width="140" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.deviceStatus === 1 ? 'success' : 'danger'" effect="light">
              {{ row.deviceStatus === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近同步" width="170">
          <template #default="{ row }">{{ row.lastSyncAt || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button v-if="row.deviceStatus === 1" link type="danger" @click="toggle(row, 0)">禁用</el-button>
            <el-button v-else link type="success" @click="toggle(row, 1)">启用</el-button>
            <el-popconfirm title="确认删除该设备？" @confirm="remove(row)">
              <template #reference><el-button link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialog.visible" :title="dialog.form.id ? '编辑设备' : '新增设备'" width="480px">
      <el-form :model="dialog.form" label-width="90px">
        <el-form-item label="序列号" required>
          <el-input v-model="dialog.form.deviceSn" :disabled="!!dialog.form.id" placeholder="设备 SN" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="dialog.form.deviceName" placeholder="设备名称" />
        </el-form-item>
        <el-form-item label="厂商">
          <el-select v-model="dialog.form.provider" style="width: 100%">
            <el-option label="MOCK" value="MOCK" />
            <el-option label="HUAWEI" value="HUAWEI" />
            <el-option label="HEALTH_CONNECT" value="HEALTH_CONNECT" />
            <el-option label="APPLE_HEALTH" value="APPLE_HEALTH" />
            <el-option label="NIGHTSCOUT" value="NIGHTSCOUT" />
          </el-select>
        </el-form-item>
        <el-form-item label="绑定用户">
          <el-input v-model="dialog.form.userId" placeholder="C 端用户 ID，可空" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { DeviceItem } from '@/types'

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const list = ref<DeviceItem[]>([])
const q = reactive<{ keyword: string; deviceStatus: number | '' }>({ keyword: '', deviceStatus: '' })
const dialog = reactive<{ visible: boolean; form: DeviceItem }>({
  visible: false,
  form: { id: 0, deviceSn: '', deviceName: '', provider: 'MOCK', userId: '', userMasked: '', deviceStatus: 1, lastSyncAt: '' }
})

async function load() {
  loading.value = true
  try {
    list.value = await api.listDevices({
      keyword: q.keyword || undefined,
      deviceStatus: q.deviceStatus === '' ? undefined : Number(q.deviceStatus)
    })
  } catch (e) {
    list.value = []
    ElMessage.error((e as Error).message || '设备列表加载失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openDialog(row?: DeviceItem) {
  dialog.form = row
    ? { ...row, userId: row.userId || '' }
    : { id: 0, deviceSn: '', deviceName: '', provider: 'MOCK', userId: '', userMasked: '', deviceStatus: 1, lastSyncAt: '' }
  dialog.visible = true
}

async function save() {
  if (!dialog.form.deviceSn.trim() || !dialog.form.deviceName.trim()) {
    ElMessage.warning('请填写序列号与名称')
    return
  }
  saving.value = true
  try {
    await api.saveDevice({ ...dialog.form })
    if (auth.account) api.writeLog(auth.account.username, auth.account.role, '设备', dialog.form.id ? '编辑设备' : '新增设备', dialog.form.deviceSn)
    dialog.visible = false
    ElMessage.success('已保存')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggle(row: DeviceItem, status: number) {
  try {
    await api.toggleDeviceStatus(row.id, status)
    if (auth.account) api.writeLog(auth.account.username, auth.account.role, '设备', status === 1 ? '启用设备' : '禁用设备', row.deviceSn)
    ElMessage.success('已更新')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '状态更新失败')
  }
}

async function remove(row: DeviceItem) {
  try {
    await api.removeDevice(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败')
  }
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.title { font-size: 16px; font-weight: 600; }
.filter { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.mb12 { margin-bottom: 12px; }
</style>
