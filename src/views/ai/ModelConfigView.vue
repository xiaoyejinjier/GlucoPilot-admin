<template>
  <div class="page-wrap">
    <div class="head">
      <div class="head-left">
        <h2 class="page-title">AI 模型配置</h2>
        <span class="text-muted head-tip">
          数据库中的配置优先于环境变量/yaml 生效；密钥只在服务端保存，管理端仅展示掩码
        </span>
      </div>
      <div class="ops">
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
        <el-button type="primary" :icon="Plus" :disabled="!canManage" @click="openDialog()">新增模型</el-button>
      </div>
    </div>

    <div class="kt-card">
      <el-alert
        v-if="meta.textDefaultCode"
        class="mb12"
        :type="meta.textDefaultReason === '默认标记' ? 'success' : 'warning'"
        :closable="false"
        show-icon
      >
        <template #title>
          当前文本对话实际使用：<b>{{ meta.textDefaultCode }}</b>
          （来源：{{ meta.textDefaultSource === 'db' ? '后台配置' : '环境变量/yaml' }} · 判据：{{ meta.textDefaultReason }}）
        </template>
        <template v-if="meta.textDefaultReason !== '默认标记'" #default>
          没有「已启用且标为默认」的模型，后端按「{{ meta.textDefaultReason }}」替你选了这一个。
          想让选择变确定，请在上表里对目标模型点「设为默认」——否则下次改动别的模型，默认模型可能跟着漂移。
        </template>
      </el-alert>

      <div class="filter mb12">
        <el-input
          v-model="keyword"
          placeholder="搜索模型编码 / 名称 / endpoint"
          clearable
          :prefix-icon="Search"
          style="width: 280px"
        />
        <span class="text-muted" style="font-size: 12px">
          共 {{ filtered.length }} 个模型 · 修改需带 configVersion，版本不一致后端会拒绝保存
        </span>
      </div>

      <el-table :data="filtered" v-loading="loading" row-key="id">
        <el-table-column label="模型编码" min-width="150">
          <template #default="{ row }">
            <div class="code-cell">
              <span>{{ row.modelCode || '—' }}</span>
              <el-tooltip
                v-if="row.source === 'yaml'"
                content="该模型未启用：这条数据库配置不参与运行时解析，业务侧实际用的是 yaml/环境变量回落值"
                placement="top"
              >
                <el-tag size="small" type="info" effect="plain">yaml 回落</el-tag>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.modelName || '—' }}</template>
        </el-table-column>
        <el-table-column label="厂商" width="120">
          <template #default="{ row }">{{ providerText(row) }}</template>
        </el-table-column>
        <el-table-column label="模型名(endpoint)" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ row.modelEndpoint || '—' }}</template>
        </el-table-column>
        <el-table-column label="密钥" min-width="180">
          <template #default="{ row }">
            <div class="key-cell">
              <span :class="{ 'key-empty': !row.apiKeyMasked }">{{ row.apiKeyMasked || '未配置' }}</span>
              <span class="key-source" :class="`src-${row.apiKeySource || 'none'}`">
                {{ keySourceText(row.apiKeySource) }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="温度" width="76" align="center">
          <template #default="{ row }">{{ row.temperature ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="maxTokens" width="100" align="center">
          <template #default="{ row }">{{ row.maxTokens ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="超时" width="96" align="center">
          <template #default="{ row }">{{ row.timeoutMs ? `${row.timeoutMs} ms` : '—' }}</template>
        </el-table-column>
        <el-table-column label="默认" width="76" align="center">
          <template #default="{ row }">
            <el-tag v-if="Number(row.isDefault) === 1" type="success" size="small" effect="dark">默认</el-tag>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="生效中" width="104" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="row.effectiveRole" placement="top">
              <template #content>
                <div class="tip-box">
                  <div v-if="row.effectiveRole === 'text-default'">
                    文本对话当前就是在调这个模型（不是"标了默认"，是运行时的实际选择）
                  </div>
                  <div v-else>视觉场景（看图/识糖）当前在调这个模型</div>
                </div>
              </template>
              <el-tag :type="row.effectiveRole === 'text-default' ? 'primary' : 'warning'" size="small" effect="dark">
                {{ row.effectiveRole === 'text-default' ? '文本对话' : '视觉' }}
              </el-tag>
            </el-tooltip>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="Number(row.isEnabled) === 1"
              :loading="togglingId === row.id"
              :disabled="!canManage"
              @change="(v: string | number | boolean) => toggleEnabled(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="最近测试" width="104" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="hasTestResult(row)" placement="top">
              <template #content>
                <div class="tip-box">
                  <div>{{ row.lastTestMessage || '后端未返回详情' }}</div>
                  <div class="tip-time">测试时间：{{ fmtTime(row.lastTestAt || '') }}</div>
                </div>
              </template>
              <el-tag :type="row.lastTestOk ? 'success' : 'danger'" size="small" effect="light">
                {{ row.lastTestOk ? '成功' : '失败' }}
              </el-tag>
            </el-tooltip>
            <span v-else class="text-muted">未测试</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="222" fixed="right">
          <template #default="{ row }">
            <template v-if="canManage">
              <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
              <el-button
                link
                type="primary"
                :disabled="Number(row.isDefault) === 1"
                @click="setDefaultRow(row)"
              >设为默认</el-button>
              <el-button
                link
                type="primary"
                :loading="testingId === row.id"
                @click="runTest(row)"
              >测试连通性</el-button>
            </template>
            <span v-else class="text-muted">仅查看（缺 ai:model:manage）</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑模型配置' : '新增模型配置'"
      width="660px"
      @closed="clearSecret"
    >
      <el-form ref="formRef" v-loading="detailLoading" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="模型编码" prop="modelCode">
          <el-input
            v-model="form.modelCode"
            :disabled="isEdit"
            placeholder="引用键，仅字母/数字/下划线/连字符，如 deepseek-chat"
          />
          <div v-if="isEdit" class="text-muted key-tip">模型编码是业务引用键，保存后不可修改</div>
        </el-form-item>
        <el-form-item label="模型名称" prop="modelName">
          <el-input v-model="form.modelName" placeholder="用于管理端展示，如 DeepSeek 对话模型" />
        </el-form-item>
        <el-form-item label="厂商" prop="providerCode">
          <el-select v-model="form.providerCode" placeholder="请选择厂商" style="width: 100%">
            <el-option v-for="p in PROVIDER_OPTIONS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型名(endpoint)" prop="modelEndpoint">
          <el-input v-model="form.modelEndpoint" placeholder="真正发给 provider 的模型名，如 deepseek-chat" />
        </el-form-item>
        <el-form-item label="API Base URL">
          <el-input v-model="form.apiBaseUrl" placeholder="可空；如 https://api.deepseek.com/v1" />
        </el-form-item>

        <el-form-item label="温度" prop="temperature">
          <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" :precision="2" placeholder="0 ~ 2，可空" />
          <span class="text-muted inline-tip">0 ~ 2，越大越发散</span>
        </el-form-item>
        <el-form-item label="topP" prop="topP">
          <el-input-number v-model="form.topP" :min="0" :max="1" :step="0.05" :precision="2" placeholder="0 ~ 1，可空" />
        </el-form-item>
        <el-form-item label="maxTokens" prop="maxTokens">
          <el-input-number v-model="form.maxTokens" :min="1" :step="1" :precision="0" placeholder="正整数，可空" />
        </el-form-item>
        <el-form-item label="超时(ms)" prop="timeoutMs">
          <el-input-number v-model="form.timeoutMs" :min="1" :step="1000" :precision="0" placeholder="正整数毫秒，可空" />
          <span class="text-muted inline-tip">建议不超过 15000，否则前端会先超时</span>
        </el-form-item>
        <el-form-item label="深度思考">
          <el-switch v-model="form.thinking" :disabled="Number(form.providerCode) !== 1" />
          <span class="text-muted inline-tip">
            {{ Number(form.providerCode) === 1 ? '仅 DeepSeek 自研模型生效' : '仅厂商为 DeepSeek 自研时可开启' }}
          </span>
        </el-form-item>

        <el-form-item label="API 密钥" prop="apiKey">
          <div class="key-field">
            <el-input
              v-model="form.apiKey"
              type="password"
              show-password
              clearable
              autocomplete="new-password"
              :disabled="form.clearApiKey"
              :placeholder="apiKeyPlaceholder"
            />
            <div class="key-meta">
              <span class="text-muted">当前：{{ currentKeyText }}</span>
              <el-switch
                v-if="isEdit"
                v-model="form.clearApiKey"
                size="small"
                active-text="清空密钥（回到沿用环境变量）"
              />
            </div>
            <div class="text-muted key-tip">
              留空 = 不修改已保存的密钥；只有在这里输入新的明文密钥才会覆盖。后端只回传掩码，页面不回填、不打印明文。
            </div>
            <el-tag v-if="form.clearApiKey" type="warning" size="small" effect="plain">
              保存后该模型的数据库密钥将被清空，回落到 yaml/环境变量
            </el-tag>
          </div>
        </el-form-item>

        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
          <span class="text-muted inline-tip">停用后业务侧不会调用该模型</span>
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="form.isDefault" />
          <span class="text-muted inline-tip">同时只能有一个默认模型</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="可空" />
        </el-form-item>

        <el-form-item v-if="isEdit && editing && editing.lastTestAt" label="最近测试">
          <span class="text-muted" style="font-size: 12px">
            {{ editing.lastTestOk ? '成功' : '失败' }} · {{ fmtTime(editing.lastTestAt) }} ·
            {{ editing.lastTestMessage || '无详情' }}
          </span>
        </el-form-item>

        <el-alert
          v-if="dialogTest"
          class="test-alert"
          :type="dialogTest.ok ? 'success' : 'error'"
          :closable="false"
          show-icon
          :title="dialogTestTitle"
        >
          <div class="test-advice">{{ dialogTest.advice }}</div>
          <div v-if="dialogTest.modelEcho" class="text-muted">上游回显模型：{{ dialogTest.modelEcho }}</div>
          <el-collapse v-if="dialogTest.message" class="test-collapse">
            <el-collapse-item title="展开原始错误摘要" name="message">
              <div class="test-raw">{{ dialogTest.message }}</div>
            </el-collapse-item>
          </el-collapse>
        </el-alert>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <div class="footer-left">
            <el-button :icon="Connection" :loading="dialogTesting" :disabled="!isEdit" @click="testCurrent">
              测试连通性
            </el-button>
            <span v-if="!isEdit" class="text-muted" style="font-size: 12px">保存后才能测试</span>
          </div>
          <div>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="saving" @click="save">保存</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Connection, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { aiModelApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { fmtTime, nowStr } from '@/utils/format'
import type {
  AiKeySource, AiModelListMeta, AiModelRow, AiModelSavePayload, AiModelTestResult, AiTestCategory
} from '@/types'

/** 厂商编码 → 下拉文案；列表展示优先用后端下发的 providerText（此处文案与后端 PROVIDER_TEXT 对齐）。 */
const PROVIDER_OPTIONS = [
  { value: 1, label: 'DeepSeek（自研 SDK，支持深度思考）' },
  { value: 2, label: 'OpenAI 兼容' },
  { value: 3, label: '通义千问' },
  { value: 4, label: '文心一言' },
  { value: 5, label: '其他' }
]

const TEST_CATEGORY_TEXT: Record<AiTestCategory, string> = {
  OK: '正常',
  AUTH: '鉴权失败',
  MODEL_NOT_FOUND: '模型不存在',
  RATE_LIMIT: '触发限流',
  TIMEOUT: '上游超时',
  NETWORK: '网络异常',
  UNKNOWN: '未知错误'
}

interface ModelForm {
  modelCode: string
  modelName: string
  providerCode: number
  apiBaseUrl: string
  modelEndpoint: string
  // el-input-number 的 modelValue 是 number | null，清空时回传 null，这里都留出 undefined 余量
  temperature: number | null | undefined
  topP: number | null | undefined
  maxTokens: number | null | undefined
  timeoutMs: number | null | undefined
  thinking: boolean
  /** 仅在本次输入明文时才有值；apiKeyMasked 永不写入这里 */
  apiKey: string
  clearApiKey: boolean
  enabled: boolean
  isDefault: boolean
  remark: string
}

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const detailLoading = ref(false)
const keyword = ref('')
const list = ref<AiModelRow[]>([])
/** 后端下发的"当前文本对话实际用哪个模型、为什么是它"，用来解释"改了配置到底生效没有"。 */
const meta = ref<AiModelListMeta>({ textDefaultCode: '', textDefaultSource: 'yaml', textDefaultReason: '' })
const editing = ref<AiModelRow | null>(null)
const dialogVisible = ref(false)
const togglingId = ref('')
const testingId = ref('')
const dialogTest = ref<AiModelTestResult | null>(null)
const formRef = ref<FormInstance>()

function emptyForm(): ModelForm {
  return {
    modelCode: '',
    modelName: '',
    providerCode: 1,
    apiBaseUrl: '',
    modelEndpoint: '',
    temperature: null,
    topP: null,
    maxTokens: null,
    timeoutMs: 60000,
    thinking: false,
    apiKey: '',
    clearApiKey: false,
    enabled: true,
    isDefault: false,
    remark: ''
  }
}
const form = reactive<ModelForm>(emptyForm())

const isEdit = computed(() => Boolean(editing.value))
/** 后端读写分离：列表/详情要 ai:model:query，写操作与连通性测试要 ai:model:manage。 */
const canManage = computed(() => auth.hasPermission('ai:model:manage'))
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter((row) =>
    [row.modelCode, row.modelName, row.modelEndpoint, row.apiBaseUrl]
      .some((field) => (field || '').toLowerCase().includes(kw))
  )
})
const apiKeyPlaceholder = computed(() => {
  if (!isEdit.value) return '可空；留空则先沿用环境变量/yaml 中的密钥'
  const mask = editing.value?.apiKeyMasked
  return `留空表示不修改已保存的密钥；当前：${mask || '未配置'}`
})
const currentKeyText = computed(() => {
  if (!editing.value) return '未配置（新增）'
  return `${editing.value.apiKeyMasked || '未配置'}（${keySourceText(editing.value.apiKeySource)}）`
})
const dialogTesting = computed(() => Boolean(editing.value) && testingId.value === editing.value?.id)
const dialogTestTitle = computed(() => {
  const res = dialogTest.value
  if (!res) return ''
  if (res.ok) return `连通正常，耗时 ${res.elapsedMs ?? 0}ms`
  return `连通失败：${TEST_CATEGORY_TEXT[res.category] || res.category}`
})

const rules: FormRules = {
  modelCode: [
    { required: true, message: '请输入模型编码', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_-]+$/, message: '模型编码仅支持字母、数字、下划线、连字符', trigger: 'blur' }
  ],
  modelName: [{ required: true, message: '请输入模型名称', trigger: 'blur' }],
  providerCode: [{ required: true, message: '请选择厂商', trigger: 'change' }],
  modelEndpoint: [{ required: true, message: '请输入真正发给 provider 的模型名', trigger: 'blur' }],
  temperature: [{ type: 'number', min: 0, max: 2, message: '温度需在 0 ~ 2 之间', trigger: 'change' }],
  topP: [{ type: 'number', min: 0, max: 1, message: 'topP 需在 0 ~ 1 之间', trigger: 'change' }],
  maxTokens: [{ type: 'integer', min: 1, message: 'maxTokens 必须是正整数', trigger: 'change' }],
  timeoutMs: [{ type: 'integer', min: 1, message: '超时时间必须是正整数毫秒', trigger: 'change' }]
}

function providerText(row: AiModelRow): string {
  if (row.providerText) return row.providerText
  const hit = PROVIDER_OPTIONS.find((p) => p.value === Number(row.providerCode))
  return hit ? hit.label : '未知厂商'
}

function keySourceText(source?: AiKeySource | null): string {
  if (source === 'db') return '后台已配'
  if (source === 'yaml') return '沿用环境变量'
  return '未配置'
}

function hasTestResult(row: AiModelRow): boolean {
  return row.lastTestOk === true || row.lastTestOk === false
}

function blankToNull(value: string): string | null {
  const trimmed = (value || '').trim()
  return trimmed ? trimmed : null
}

async function load() {
  loading.value = true
  try {
    const data = await aiModelApi.list()
    list.value = data.rows
    meta.value = data.meta
  } catch (e) {
    ElMessage.error((e as Error).message || '加载 AI 模型配置失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function fillForm(row: AiModelRow) {
  form.modelCode = row.modelCode || ''
  form.modelName = row.modelName || ''
  form.providerCode = Number(row.providerCode) || 1
  form.apiBaseUrl = row.apiBaseUrl || ''
  form.modelEndpoint = row.modelEndpoint || ''
  form.temperature = row.temperature ?? null
  form.topP = row.topP ?? null
  form.maxTokens = row.maxTokens ?? null
  form.timeoutMs = row.timeoutMs ?? null
  form.thinking = row.thinking === true
  // 关键：掩码只用于占位提示，绝不回填输入框；开启弹窗时始终从空串开始
  form.apiKey = ''
  form.clearApiKey = false
  form.enabled = Number(row.isEnabled) === 1
  form.isDefault = Number(row.isDefault) === 1
  form.remark = row.remark || ''
}

function clearSecret() {
  form.apiKey = ''
  form.clearApiKey = false
  dialogTest.value = null
}

async function openDialog(row?: AiModelRow) {
  editing.value = row || null
  Object.assign(form, emptyForm())
  dialogTest.value = null
  if (row) fillForm(row)
  dialogVisible.value = true
  await nextTick()
  formRef.value?.clearValidate()
  if (!row) return

  // 编辑前拉一次详情：确保 configVersion、密钥掩码与最近测试结果是最新的
  detailLoading.value = true
  try {
    const fresh = await aiModelApi.getOne(row.id)
    if (dialogVisible.value && editing.value?.id === fresh.id) {
      editing.value = fresh
      fillForm(fresh)
      await nextTick()
      formRef.value?.clearValidate()
    }
  } catch (e) {
    ElMessage.warning(`拉取最新配置失败，暂用列表数据编辑：${(e as Error).message || '未知错误'}`)
  } finally {
    detailLoading.value = false
  }
}

function buildPayload(): AiModelSavePayload {
  const payload: AiModelSavePayload = {
    modelName: form.modelName.trim(),
    providerCode: Number(form.providerCode),
    apiBaseUrl: blankToNull(form.apiBaseUrl),
    modelEndpoint: form.modelEndpoint.trim(),
    temperature: form.temperature ?? null,
    topP: form.topP ?? null,
    maxTokens: form.maxTokens ?? null,
    // 深度思考只对 DeepSeek 自研有意义，其他厂商显式置空，避免脏配置
    thinking: Number(form.providerCode) === 1 ? form.thinking : null,
    timeoutMs: form.timeoutMs ?? null,
    isEnabled: form.enabled ? 1 : 0,
    isDefault: form.isDefault ? 1 : 0,
    remark: blankToNull(form.remark)
  }
  // 模型编码是引用键，修改时不允许变更，因此只在新增时提交
  if (!isEdit.value) payload.modelCode = form.modelCode.trim()

  if (form.clearApiKey) {
    // 显式清空：回到沿用 yaml/环境变量，此时不能再带明文密钥
    payload.clearApiKey = true
  } else if (form.apiKey.trim()) {
    // 只有用户真的输入了明文才提交；apiKeyMasked 既不回填也不提交
    payload.apiKey = form.apiKey.trim()
  }
  return payload
}

/** request.ts 会把业务码、HTTP 状态与 message 挂在 Error 上，这里逐项判定乐观锁冲突。 */
function isVersionConflict(e: unknown): boolean {
  const err = e as { code?: number; status?: number; message?: string }
  if (err?.code === 409 || err?.code === 40900 || err?.status === 409) return true
  // 后端乐观锁冲突已改用 CONFLICT(40900)（2026-10-14），上面那条是主路径；
  // 保留文案兜底是为了兼容旧后端与其它来源的 40001 提示。
  return /请刷新后重试|他人修改|乐观锁|configVersion|版本|冲突|conflict/i.test(err?.message || '')
}

async function save() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  const payload = buildPayload()
  try {
    if (isEdit.value && editing.value) {
      payload.configVersion = editing.value.configVersion
      await aiModelApi.update(editing.value.id, payload)
    } else {
      await aiModelApi.create(payload)
    }
    ElMessage.success('已保存')
    dialogVisible.value = false
    await load()
  } catch (e) {
    if (isEdit.value && isVersionConflict(e)) {
      ElMessage.error('配置已被他人修改，请刷新后重试')
      dialogVisible.value = false
      await load()
    } else {
      ElMessage.error((e as Error).message || '保存失败')
    }
  } finally {
    // 请求结束即丢弃明文，不在页面内存里长期驻留
    form.apiKey = ''
    saving.value = false
  }
}

function applyTestResult(id: string, res: AiModelTestResult) {
  const row = list.value.find((item) => item.id === id)
  if (!row) return
  row.lastTestOk = res.ok
  row.lastTestMessage = res.advice || res.message
  row.lastTestAt = nowStr()
}

/** 测试由后端真发上游请求，可能超过 request.ts 的 15s 前端超时，这里换成更可操作的提示。 */
function requestFailureAdvice(message: string): string {
  if (/超时/.test(message)) {
    return `连通性测试等待超过 15s 已在前端中断（${message}），请检查模型 timeoutMs 或后端日志`
  }
  return message
}

async function runTest(row: AiModelRow, fromDialog = false) {
  if (!row.id) return
  testingId.value = row.id
  if (fromDialog) dialogTest.value = null
  try {
    const res = await aiModelApi.test(row.id)
    applyTestResult(row.id, res)
    if (fromDialog) dialogTest.value = res
    if (res.ok) {
      ElMessage.success(`连通正常，耗时 ${res.elapsedMs ?? 0}ms`)
    } else {
      ElMessage.error(res.advice || `连通失败：${TEST_CATEGORY_TEXT[res.category] || res.category}`)
    }
  } catch (e) {
    const message = (e as Error).message || '测试失败'
    const advice = requestFailureAdvice(message)
    const res: AiModelTestResult = { ok: false, category: 'UNKNOWN', advice, elapsedMs: 0, message }
    applyTestResult(row.id, res)
    if (fromDialog) dialogTest.value = res
    ElMessage.error(advice)
  } finally {
    testingId.value = ''
  }
}

function testCurrent() {
  if (editing.value) runTest(editing.value, true)
}

async function toggleEnabled(row: AiModelRow, value: string | number | boolean) {
  const next = value ? 1 : 0
  if (next === Number(row.isEnabled)) return
  togglingId.value = row.id
  try {
    // 启停会让后端的 config_version +1，因此用返回的行覆盖本地，避免下次编辑拿着旧版本号提交
    const saved = await aiModelApi.setEnabled(row.id, next)
    Object.assign(row, saved)
    ElMessage.success(next === 1 ? '已启用' : '已停用')
  } catch (e) {
    ElMessage.error((e as Error).message || '更新启用状态失败')
  } finally {
    togglingId.value = ''
  }
}

async function setDefaultRow(row: AiModelRow) {
  try {
    // 设为默认会同时清掉其它行的默认标记（各自 config_version +1），所以整体重拉列表
    await aiModelApi.setDefault(row.id)
    ElMessage.success(`已将「${row.modelName || row.modelCode}」设为默认模型`)
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '设置默认模型失败')
  }
}
</script>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.head-left { display: flex; align-items: baseline; gap: 10px; }
.page-title { margin: 0; font-size: 18px; }
.head-tip { font-size: 12px; }
.ops { display: flex; gap: 8px; }
.filter { display: flex; justify-content: space-between; align-items: center; }
.code-cell { display: flex; align-items: center; gap: 6px; }
.key-cell { display: flex; align-items: center; gap: 6px; }
.key-empty { color: var(--kt-muted); }
.key-source { font-size: 11px; }
.src-db { color: var(--kt-brand); }
.src-yaml { color: #b88230; }
.src-none { color: var(--kt-muted); }
.tip-box { max-width: 320px; line-height: 1.5; }
.tip-time { margin-top: 4px; opacity: 0.75; font-size: 12px; }
.key-field { width: 100%; }
.key-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; font-size: 12px; }
.key-tip { font-size: 12px; line-height: 1.5; margin-top: 4px; }
.inline-tip { margin-left: 10px; font-size: 12px; }
.test-alert { margin-top: 4px; }
.test-advice { font-size: 13px; }
.test-collapse { margin-top: 6px; }
.test-raw { white-space: pre-wrap; word-break: break-all; font-size: 12px; }
.dialog-footer { display: flex; align-items: center; justify-content: space-between; }
.footer-left { display: flex; align-items: center; gap: 8px; }
</style>
