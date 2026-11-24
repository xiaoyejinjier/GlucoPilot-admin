<template>
  <div class="page-wrap">
    <div class="toolbar">
      <span class="title">设备管理（C 端用户绑定设备档案）</span>
      <el-button type="primary" :icon="Plus" @click="openDialog()">新增设备</el-button>
    </div>

    <div class="kt-card">
      <div class="filter mb12">
        <el-input
          v-model="q.keyword"
          placeholder="序列号 / 设备名称"
          clearable
          :prefix-icon="Search"
          style="width: 220px"
          @clear="search"
          @keyup.enter="search"
        />
        <el-select v-model="q.deviceStatus" placeholder="状态" clearable style="width: 120px" @change="search">
          <el-option label="正常" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-select v-model="q.provider" placeholder="厂商" clearable style="width: 150px" @change="search">
          <el-option v-for="p in providers" :key="p" :label="p" :value="p" />
        </el-select>
        <el-select v-model="q.deviceCategory" placeholder="设备类型" clearable style="width: 150px" @change="search">
          <el-option v-for="c in categories" :key="c" :label="categoryLabel(c)" :value="c" />
        </el-select>
        <el-select v-model="q.bound" placeholder="绑定" clearable style="width: 120px" @change="search">
          <el-option label="已绑定" :value="true" />
          <el-option label="未绑定" :value="false" />
        </el-select>
        <el-select v-model="q.cloudLinked" placeholder="云授权" clearable style="width: 120px" @change="search">
          <el-option label="已授权" :value="true" />
          <el-option label="未授权" :value="false" />
        </el-select>
        <el-button type="primary" @click="search">查询</el-button>
      </div>

      <el-table :data="list" v-loading="loading" row-key="id">
        <el-table-column prop="deviceSn" label="序列号" min-width="140" />
        <el-table-column prop="deviceName" label="名称" min-width="120" />
        <el-table-column prop="provider" label="厂商" width="110" />
        <el-table-column label="类型" min-width="130">
          <template #default="{ row }">{{ categoryLabel(row.deviceCategory) }}</template>
        </el-table-column>
        <el-table-column prop="deviceModel" label="型号" min-width="110">
          <template #default="{ row }">{{ row.deviceModel || '—' }}</template>
        </el-table-column>
        <el-table-column prop="userMasked" label="绑定用户" min-width="140" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.deviceStatus === 1 ? 'success' : 'danger'" effect="light">
              {{ row.deviceStatus === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="云授权" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.cloudLinked ? 'success' : 'info'" effect="light">
              {{ row.cloudLinked ? '已授权' : '未授权' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="同步健康" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="syncHealthTag(row.syncHealth)" effect="light">
              {{ syncHealthLabel(row.syncHealth) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近同步" width="160">
          <template #default="{ row }">{{ row.lastSyncAt || '—' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ row.createdAt || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button v-if="row.deviceStatus === 1" link type="danger" @click="toggle(row, 0)">禁用</el-button>
            <el-button v-else link type="success" @click="toggle(row, 1)">启用</el-button>
            <el-popconfirm title="确认删除该设备？" @confirm="remove(row)">
              <template #reference><el-button link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="pageNum"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="load"
          @size-change="search"
        />
      </div>
    </div>

    <el-dialog v-model="dialog.visible" :title="dialog.form.id ? '编辑设备' : '新增设备'" width="480px">
      <el-form :model="dialog.form" label-width="90px">
        <el-form-item label="序列号" required>
          <el-input
            v-model="dialog.form.deviceSn"
            :disabled="!!dialog.form.id"
            placeholder="设备 SN"
            @change="maybeSuggestCategory"
          />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="dialog.form.deviceName" placeholder="设备名称" @change="maybeSuggestCategory" />
        </el-form-item>
        <el-form-item label="厂商">
          <el-select v-model="dialog.form.provider" style="width: 100%">
            <el-option v-for="p in providers" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备类型">
          <el-select
            v-model="dialog.form.deviceCategory"
            clearable
            placeholder="可选，可按 SN/名称自动建议"
            style="width: 100%"
            @clear="categoryTouched = false"
            @change="categoryTouched = true"
          >
            <el-option v-for="c in categories" :key="c" :label="categoryLabel(c)" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="型号">
          <el-input
            v-model="dialog.form.deviceModel"
            placeholder="型号 / SKU，可空"
            maxlength="64"
            @change="maybeSuggestCategory"
          />
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

    <el-drawer v-model="detail.visible" title="设备详情" size="640px" destroy-on-close>
      <template v-if="detail.row">
        <div class="detail-block">
          <div class="detail-title">档案</div>
          <div class="detail-line">序列号：{{ detail.row.deviceSn }}</div>
          <div class="detail-line">名称：{{ detail.row.deviceName }}</div>
          <div class="detail-line">厂商：{{ detail.row.provider }}</div>
          <div class="detail-line">类型：{{ categoryLabel(detail.row.deviceCategory) }}</div>
          <div class="detail-line">型号：{{ detail.row.deviceModel || '—' }}</div>
          <div class="detail-line">绑定用户：{{ detail.row.userMasked }}{{ detail.row.userId ? ` (#${detail.row.userId})` : '' }}</div>
          <div class="detail-line">状态：{{ detail.row.deviceStatus === 1 ? '正常' : '禁用' }}</div>
          <div class="detail-line">同步健康：{{ syncHealthLabel(detail.row.syncHealth) }}</div>
          <div class="detail-line">最近同步：{{ detail.row.lastSyncAt || '—' }}</div>
          <div class="detail-line">创建时间：{{ detail.row.createdAt || '—' }}</div>
        </div>

        <div class="detail-block">
          <div class="detail-title-row">
            <span class="detail-title">云授权</span>
            <el-popconfirm
              v-if="detail.cloudAuth?.linked"
              title="确认撤销该设备云授权？"
              @confirm="revokeCloud"
            >
              <template #reference>
                <el-button link type="danger" :loading="detail.revoking">撤销授权</el-button>
              </template>
            </el-popconfirm>
          </div>
          <div v-loading="detail.cloudLoading">
            <div class="detail-line">状态：{{ detail.cloudAuth?.linked ? '已授权' : '未授权' }}</div>
            <div v-if="detail.cloudAuth?.linked" class="detail-line">主体：{{ detail.cloudAuth.vendorSubjectMasked || '—' }}</div>
            <div v-if="detail.cloudAuth?.linked" class="detail-line">过期：{{ detail.cloudAuth.expiresAt || '—' }}</div>
            <div v-if="detail.cloudAuth?.linked" class="detail-line">Scopes：{{ detail.cloudAuth.scopes || '—' }}</div>
          </div>
        </div>

        <div class="detail-block">
          <div class="detail-title">同步流水（近 20 次，点击行查看血糖曲线）</div>
          <el-table
            :data="detail.logs"
            v-loading="detail.logsLoading"
            size="small"
            empty-text="暂无同步流水"
            highlight-current-row
            :row-class-name="syncRowClass"
            @row-click="onSyncRowClick"
          >
            <el-table-column prop="syncedAt" label="时间" width="150" />
            <el-table-column prop="provider" label="厂商" width="90" />
            <el-table-column prop="sampleCount" label="样本" width="60" />
            <el-table-column prop="createdCount" label="新建" width="60" />
            <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip />
          </el-table>
        </div>

        <div v-if="detail.selectedLogId" class="detail-block">
          <div class="detail-title">
            同步血糖（只读）
            <span class="detail-sub">{{ detail.samples?.syncedAt || '' }}</span>
          </div>
          <div v-loading="detail.samplesLoading">
            <EChart v-if="sampleChartOption" :option="sampleChartOption" height="260px" />
            <div v-else class="detail-empty">该次同步无样本快照（历史流水不回填）</div>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import { api } from '@/api'
import EChart from '@/components/EChart.vue'
import { useAuthStore } from '@/stores/auth'
import { suggestDeviceCategory } from '@/utils/device-category-hints'
import type { DeviceCloudAuthStatus, DeviceItem, DeviceSyncLogItem, DeviceSyncSamples } from '@/types'

const providers = ['MOCK', 'HUAWEI', 'HEALTH_CONNECT', 'APPLE_HEALTH', 'NIGHTSCOUT'] as const
const categories = [
  'CGM', 'BGM', 'PUMP', 'PEN', 'BAND', 'WATCH', 'RING', 'HUB', 'SCALE', 'BP', 'OXIMETER', 'OTHER'
] as const
const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const list = ref<DeviceItem[]>([])
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)

const q = reactive<{
  keyword: string
  deviceStatus: number | ''
  provider: string
  deviceCategory: string
  bound: boolean | ''
  cloudLinked: boolean | ''
}>({
  keyword: '',
  deviceStatus: '',
  provider: '',
  deviceCategory: '',
  bound: '',
  cloudLinked: ''
})

const dialog = reactive<{ visible: boolean; form: DeviceItem }>({
  visible: false,
  form: emptyForm()
})

const categoryTouched = ref(false)

const detail = reactive<{
  visible: boolean
  row: DeviceItem | null
  cloudAuth: DeviceCloudAuthStatus | null
  cloudLoading: boolean
  logs: DeviceSyncLogItem[]
  logsLoading: boolean
  revoking: boolean
  selectedLogId: string
  samples: DeviceSyncSamples | null
  samplesLoading: boolean
}>({
  visible: false,
  row: null,
  cloudAuth: null,
  cloudLoading: false,
  logs: [],
  logsLoading: false,
  revoking: false,
  selectedLogId: '',
  samples: null,
  samplesLoading: false
})

const sampleChartOption = computed<EChartsOption | null>(() => {
  const points = detail.samples?.points || []
  if (!points.length) return null
  return {
    grid: { left: 48, right: 16, top: 24, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.recordedAt),
      axisLabel: { rotate: 30, fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: 'mmol/L',
      min: (v) => Math.max(0, Math.floor((v.min ?? 0) - 1)),
      max: (v) => Math.ceil((v.max ?? 10) + 1)
    },
    series: [
      {
        type: 'line',
        smooth: true,
        showSymbol: points.length <= 24,
        data: points.map((p) => p.glucoseValue),
        name: '血糖'
      }
    ]
  }
})

function emptyForm(): DeviceItem {
  return {
    id: 0,
    deviceSn: '',
    deviceName: '',
    provider: 'MOCK',
    deviceCategory: '',
    deviceModel: '',
    userId: '',
    userMasked: '',
    deviceStatus: 1,
    lastSyncAt: '',
    createdAt: '',
    cloudLinked: false,
    syncHealth: 'NEVER'
  }
}

function categoryLabel(code?: string) {
  const labels: Record<string, string> = {
    CGM: '连续血糖(CGM)',
    BGM: '指尖血糖(BGM)',
    PUMP: '胰岛素泵',
    PEN: '胰岛素笔',
    BAND: '运动手环',
    WATCH: '智能手表',
    RING: '智能戒指',
    HUB: '数据网关',
    SCALE: '体脂秤',
    BP: '血压计',
    OXIMETER: '血氧仪',
    OTHER: '其他'
  }
  return (code && labels[code]) || '—'
}

function syncHealthLabel(health?: string) {
  if (health === 'OK') return '正常'
  if (health === 'STALE') return '已离线'
  return '未同步'
}

function syncHealthTag(health?: string) {
  if (health === 'OK') return 'success'
  if (health === 'STALE') return 'warning'
  return 'info'
}

async function load() {
  loading.value = true
  try {
    const page = await api.listDevices({
      keyword: q.keyword || undefined,
      deviceStatus: q.deviceStatus === '' ? undefined : Number(q.deviceStatus),
      provider: q.provider || undefined,
      deviceCategory: q.deviceCategory || undefined,
      bound: q.bound === '' ? undefined : Boolean(q.bound),
      cloudLinked: q.cloudLinked === '' ? undefined : Boolean(q.cloudLinked),
      pageNum: pageNum.value,
      pageSize: pageSize.value
    })
    list.value = page.records || []
    total.value = page.total || 0
    pageNum.value = page.pageNum || pageNum.value
    pageSize.value = page.pageSize || pageSize.value
  } catch (e) {
    list.value = []
    total.value = 0
    ElMessage.error((e as Error).message || '设备列表加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  pageNum.value = 1
  void load()
}

onMounted(load)

function openDialog(row?: DeviceItem) {
  dialog.form = row ? { ...row, userId: row.userId || '' } : emptyForm()
  categoryTouched.value = !!row?.deviceCategory
  dialog.visible = true
  if (!row) maybeSuggestCategory()
}

function maybeSuggestCategory() {
  if (categoryTouched.value) return
  const hinted = suggestDeviceCategory(dialog.form.deviceSn, dialog.form.deviceName, dialog.form.deviceModel)
  dialog.form.deviceCategory = hinted || ''
}

function syncRowClass({ row }: { row: DeviceSyncLogItem }) {
  return row.id === detail.selectedLogId ? 'sync-row-active' : ''
}

async function onSyncRowClick(row: DeviceSyncLogItem) {
  if (!detail.row) return
  detail.selectedLogId = row.id
  detail.samples = null
  detail.samplesLoading = true
  try {
    detail.samples = await api.fetchDeviceSyncSamples(detail.row.id, row.id)
  } catch (e) {
    ElMessage.error((e as Error).message || '同步样本加载失败')
  } finally {
    detail.samplesLoading = false
  }
}

async function openDetail(row: DeviceItem) {
  detail.visible = true
  detail.row = row
  detail.cloudAuth = null
  detail.logs = []
  detail.selectedLogId = ''
  detail.samples = null
  detail.cloudLoading = true
  detail.logsLoading = true
  try {
    const [cloudAuth, logs] = await Promise.all([
      api.fetchDeviceCloudAuth(row.id),
      api.fetchDeviceSyncLogs(row.id, 20)
    ])
    if (detail.row?.id !== row.id) return
    detail.cloudAuth = cloudAuth
    detail.logs = logs
  } catch (e) {
    ElMessage.error((e as Error).message || '详情加载失败')
  } finally {
    detail.cloudLoading = false
    detail.logsLoading = false
  }
}

async function revokeCloud() {
  if (!detail.row) return
  detail.revoking = true
  try {
    await api.revokeDeviceCloudAuth(detail.row.id)
    if (auth.account) {
      api.writeLog(auth.account.username, auth.account.role, '设备', '撤销云授权', detail.row.deviceSn)
    }
    ElMessage.success('已撤销云授权')
    detail.cloudAuth = { linked: false }
    detail.row.cloudLinked = false
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '撤销失败')
  } finally {
    detail.revoking = false
  }
}

async function save() {
  if (!dialog.form.deviceSn.trim() || !dialog.form.deviceName.trim()) {
    ElMessage.warning('请填写序列号与名称')
    return
  }
  saving.value = true
  try {
    await api.saveDevice({ ...dialog.form })
    if (auth.account) {
      api.writeLog(
        auth.account.username,
        auth.account.role,
        '设备',
        dialog.form.id ? '编辑设备' : '新增设备',
        dialog.form.deviceSn
      )
    }
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
    if (auth.account) {
      api.writeLog(auth.account.username, auth.account.role, '设备', status === 1 ? '启用设备' : '禁用设备', row.deviceSn)
    }
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
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
.detail-block { margin-bottom: 20px; }
.detail-title { font-weight: 600; margin-bottom: 8px; }
.detail-sub { margin-left: 8px; font-weight: 400; color: #6b7280; font-size: 12px; }
.detail-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.detail-line { color: #4b5563; line-height: 1.8; font-size: 13px; }
.detail-empty { color: #9ca3af; font-size: 13px; padding: 12px 0; }
:deep(.sync-row-active) { --el-table-tr-bg-color: #eff6ff; }
:deep(.el-table__body tr) { cursor: pointer; }
</style>
