<template>
  <div class="page-wrap">
    <div class="head">
      <div class="head-left">
        <h2 class="page-title">场景 → 模型绑定</h2>
        <span class="text-muted head-tip">
          留空 = 继承（走 yaml / 通道默认）；保存是整体覆盖语义，会连同未填字段一起写成本次表单的内容
        </span>
      </div>
      <div class="ops">
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
      </div>
    </div>

    <el-alert class="mb12" type="info" :closable="false" show-icon title="改动如何生效">
      <div class="alert-body">
        保存后<b>本实例立即生效</b>，其他实例最多滞后 60 秒（配置缓存刷新周期）。
        绑定的模型必须存在且已启用，否则后端拒绝保存并返回 400。
      </div>
    </el-alert>

    <div class="kt-card">
      <div class="flex-between mb12">
        <div class="pane-title">
          共 {{ rows.length }} 个场景
          <span class="text-muted pane-sub">其中 {{ configuredCount }} 个有库内覆盖，其余全部继承</span>
        </div>
        <span class="text-muted pane-sub">
          可绑定模型 {{ models.length }} 个 · 修改需带 configVersion，版本不一致后端会拒绝
        </span>
      </div>

      <el-table :data="rows" v-loading="loading" row-key="sceneCode">
        <el-table-column label="场景" min-width="190">
          <template #default="{ row }">
            <div class="scene-line">
              <span class="scene-name">{{ row.sceneName }}</span>
              <el-tag v-if="row.requiresVision" size="small" type="warning" effect="plain">视觉</el-tag>
            </div>
            <div class="text-muted cell-sub">{{ row.sceneCode }} · configKey={{ row.configKey || '—' }}</div>
          </template>
        </el-table-column>

        <el-table-column label="库内覆盖" min-width="220">
          <template #default="{ row }">
            <template v-if="row.configured">
              <div class="ov-line">
                <span class="text-muted">模型：</span>
                <template v-if="row.modelCodeApplies">
                  <b>{{ row.modelCode || '继承' }}</b>
                </template>
                <template v-else>
                  <span class="text-muted">不适用（视觉通道统一解析）</span>
                </template>
              </div>
              <div class="text-muted cell-sub">
                温度：{{ row.temperature ?? '继承' }} · 输出上限：{{ row.maxTokens ?? '继承' }} ·
                思维链：{{ thinkingText(row.thinking) }}
              </div>
              <div v-if="row.remark" class="text-muted cell-sub">备注：{{ row.remark }}</div>
            </template>
            <el-tag v-else size="small" type="info" effect="plain">未配置（全部继承）</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="实际生效" min-width="180">
          <template #default="{ row }">
            <div v-if="row.modelCodeApplies" class="ov-line">
              <span>{{ row.effectiveModelCode || '未解析' }}</span>
              <el-tag size="small" :type="row.effectiveModelSource === 'db' ? 'success' : 'info'" effect="plain">
                {{ sourceText(row.effectiveModelSource) }}
              </el-tag>
            </div>
            <div v-else class="text-muted">该场景模型由视觉通道统一解析</div>
            <el-tooltip v-if="row.hint" placement="top">
              <template #content><div class="tip-box">{{ row.hint }}</div></template>
              <span class="text-muted cell-sub hint-link">生效说明</span>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column label="yaml 兜底值" min-width="190">
          <template #default="{ row }">
            <div class="yaml-line">模型：{{ row.yamlModelCode || '—' }}</div>
            <div class="text-muted cell-sub">
              温度：{{ row.yamlTemperature ?? '—' }} · 上限：{{ row.yamlMaxTokens ?? '—' }} ·
              思维链：{{ thinkingText(row.yamlThinking) }}
            </div>
            <div class="text-muted cell-sub">留空的字段按这里的值生效</div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="86" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 1 ? 'success' : 'info'" effect="plain">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="176" fixed="right">
          <template #default="{ row }">
            <template v-if="canManage">
              <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
              <el-button
                link
                type="danger"
                :disabled="!row.configured"
                :loading="clearingCode === row.sceneCode"
                @click="clearOverride(row)"
              >清空覆盖</el-button>
            </template>
            <span v-else class="text-muted">仅查看（缺 ai:scene:manage）</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="720px" @closed="resetDialog">
      <template v-if="editing">
        <el-alert
          v-if="!editing.modelCodeApplies"
          class="mb12"
          type="warning"
          :closable="false"
          show-icon
          title="该场景模型由视觉通道统一解析，暂不支持逐场景绑定"
        >
          <div class="alert-body">
            {{ editing.hint || '模型编码对该场景不生效；温度与输出上限仍然会生效。' }}
          </div>
        </el-alert>
        <el-alert
          v-else-if="editing.hint"
          class="mb12"
          type="info"
          :closable="false"
          show-icon
          :title="editing.hint"
        />

        <el-form ref="formRef" v-loading="saving" :model="form" :rules="rules" label-width="110px">
          <el-form-item label="模型">
            <el-select
              v-model="form.modelCode"
              class="full-select"
              clearable
              filterable
              :disabled="!editing.modelCodeApplies"
              :placeholder="editing.modelCodeApplies ? '留空 = 继承（走 yaml / 通道默认）' : '该场景不支持逐场景绑定模型'"
            >
              <el-option
                v-for="m in models"
                :key="m.code"
                :label="modelLabel(m)"
                :value="m.code"
              />
            </el-select>
            <div class="text-muted field-tip">
              <template v-if="editing.modelCodeApplies">
                只能绑定存在且已启用的模型（后端会校验，未启用会返回 400）；留空表示不在这一层做覆盖。
              </template>
              <template v-else>
                模型编码固定不生效：视觉场景的模型由视觉通道统一解析，这一栏不可编辑。
              </template>
            </div>
          </el-form-item>

          <el-form-item label="温度" prop="temperature">
            <el-input-number
              v-model="form.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              :precision="2"
              placeholder="留空 = 继承"
            />
            <span class="text-muted inline-tip">0 ~ 2，越大越发散</span>
          </el-form-item>

          <el-form-item label="输出上限" prop="maxTokens">
            <el-input-number
              v-model="form.maxTokens"
              :min="1"
              :step="256"
              :precision="0"
              placeholder="留空 = 继承"
            />
            <span class="text-muted inline-tip">≥ 1（maxTokens）</span>
          </el-form-item>

          <el-form-item label="思维链">
            <el-select v-model="form.thinking" class="mid-select" clearable placeholder="留空 = 继承">
              <el-option label="开启" :value="true" />
              <el-option label="关闭" :value="false" />
            </el-select>
            <div class="text-muted field-tip">留空 = 继承；仅 DeepSeek 自研模型的思考开关有意义，其他厂商由模型自身决定。</div>
          </el-form-item>

          <el-form-item label="状态">
            <el-radio-group v-model="form.status">
              <el-radio :value="1">启用</el-radio>
              <el-radio :value="0">停用</el-radio>
            </el-radio-group>
            <span class="text-muted inline-tip">0=停用 1=启用；不确定就保持当前值（本字段 PUT 必填）</span>
          </el-form-item>

          <el-form-item label="备注">
            <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="可选，例如：V17：CHAT 场景准备切到 flash" />
          </el-form-item>

          <el-form-item label="当前实际生效">
            <div class="ref-box">
              <div class="ref-line">
                生效模型：<b>{{ editing.effectiveModelCode || '未解析' }}</b>
                <el-tag size="small" type="info" effect="plain">{{ sourceText(editing.effectiveModelSource) }}</el-tag>
              </div>
              <div class="text-muted ref-line">
                yaml 兜底：模型 {{ editing.yamlModelCode || '—' }} · 温度 {{ editing.yamlTemperature ?? '—' }} ·
                上限 {{ editing.yamlMaxTokens ?? '—' }} · 思维链 {{ thinkingText(editing.yamlThinking) }}
              </div>
              <div class="text-muted ref-line">configVersion：{{ editing.configVersion }} · 库内覆盖：{{ editing.configured ? '有' : '无' }}</div>
            </div>
          </el-form-item>
        </el-form>
      </template>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { aiSceneApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { errorMessage, isStaleConflict } from '@/utils/api-error'
import type { AiSceneModelOption, AiSceneRow, AiSceneSavePayload } from '@/types'

interface SceneForm {
  /** '' = 留空 = 继承 */
  modelCode: string
  temperature: number | null | undefined
  maxTokens: number | null | undefined
  /** null = 留空 = 继承（true/false 才会写覆盖值） */
  thinking: boolean | null
  status: number
  remark: string
}

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const rows = ref<AiSceneRow[]>([])
const models = ref<AiSceneModelOption[]>([])
const dialogVisible = ref(false)
const editing = ref<AiSceneRow | null>(null)
const clearingCode = ref('')
const formRef = ref<FormInstance>()
const form = reactive<SceneForm>(emptySceneForm())

function emptySceneForm(): SceneForm {
  return { modelCode: '', temperature: null, maxTokens: null, thinking: null, status: 1, remark: '' }
}

const rules: FormRules = {
  temperature: [{ type: 'number', min: 0, max: 2, message: '温度需在 0 ~ 2 之间', trigger: 'change' }],
  maxTokens: [{ type: 'integer', min: 1, message: '输出上限必须是 ≥ 1 的整数', trigger: 'change' }]
}

/** 写操作要 ai:scene:manage；列表本身要 ai:scene:list（由路由 meta 把关）。 */
const canManage = computed(() => auth.hasPermission('ai:scene:manage'))
const configuredCount = computed(() => rows.value.filter((r) => r.configured).length)
const dialogTitle = computed(() => (editing.value ? `编辑绑定 · ${editing.value.sceneName}` : '编辑绑定'))

/** 生效来源：db=库内绑定（这一层真的在起作用），其余是兜底，原样展示避免编造 */
function sourceText(source: string): string {
  if (source === 'db') return '库内绑定'
  if (source === 'yaml') return 'yaml / 环境变量'
  return source || '未知来源'
}

/** 三态：null=继承，不能显示成"关闭" */
function thinkingText(value: boolean | null | undefined): string {
  if (value === true) return '开启'
  if (value === false) return '关闭'
  return '继承'
}

function modelLabel(m: AiSceneModelOption): string {
  const parts = [`${m.name || m.code}（${m.code}）`]
  if (m.providerName) parts.push(m.providerName)
  if (m.isDefault) parts.push('默认')
  return parts.join(' · ')
}

async function load() {
  loading.value = true
  try {
    const data = await aiSceneApi.list()
    rows.value = data.records
    models.value = data.models
  } catch (e) {
    ElMessage.error(errorMessage(e, '加载场景绑定失败'))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openDialog(row: AiSceneRow) {
  editing.value = row
  Object.assign(form, {
    // 视觉场景也把库内已有的值带进来，保存时原样回传，不凭空改动
    modelCode: row.modelCode || '',
    temperature: row.temperature ?? null,
    maxTokens: row.maxTokens ?? null,
    thinking: row.thinking ?? null,
    status: row.status === 0 ? 0 : 1,
    remark: row.remark || ''
  })
  dialogVisible.value = true
  formRef.value?.clearValidate()
}

function resetDialog() {
  editing.value = null
  Object.assign(form, emptySceneForm())
}

function buildPayload(row: AiSceneRow): AiSceneSavePayload {
  const payload: AiSceneSavePayload = {
    // 留空 = 继承：null 才是"清掉这一层覆盖"，'' 不是合法值
    modelCode: row.modelCodeApplies ? (form.modelCode || null) : (row.modelCode ?? null),
    temperature: form.temperature ?? null,
    maxTokens: form.maxTokens ?? null,
    thinking: form.thinking === true ? true : form.thinking === false ? false : null,
    status: Number(form.status) === 0 ? 0 : 1,
    remark: form.remark.trim() || null
  }
  // 该场景已有配置行时必须带乐观锁版本号
  if (row.configured) payload.configVersion = row.configVersion
  return payload
}

async function save() {
  const row = editing.value
  if (!formRef.value || !row) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const saved = await aiSceneApi.save(row.sceneCode, buildPayload(row))
    // 保存会让 configVersion +1，用返回行覆盖本地，避免下次编辑拿着旧版本号提交
    const index = rows.value.findIndex((r) => r.sceneCode === saved.sceneCode)
    if (index >= 0) rows.value[index] = saved
    else rows.value.push(saved)
    dialogVisible.value = false
    ElMessage.success('已保存：本实例立即生效，其他实例最多滞后 60 秒')
    await load()
  } catch (e) {
    if (isStaleConflict(e)) {
      ElMessage.error('该场景配置已被他人修改，已刷新列表，请重新编辑')
      dialogVisible.value = false
      await load()
    } else {
      ElMessage.error(errorMessage(e, '保存失败'))
    }
  } finally {
    saving.value = false
  }
}

async function clearOverride(row: AiSceneRow) {
  try {
    await ElMessageBox.confirm(
      `确认清空「${row.sceneName}」的全部库内覆盖（模型 / 温度 / 输出上限 / 思维链）并改回继承？` +
        '清空后该场景按 yaml 兜底值解析。',
      '清空覆盖',
      { type: 'warning', confirmButtonText: '确认清空', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  clearingCode.value = row.sceneCode
  try {
    const saved = await aiSceneApi.clear(row.sceneCode, {
      configVersion: row.configVersion,
      status: row.status
    })
    const index = rows.value.findIndex((r) => r.sceneCode === saved.sceneCode)
    if (index >= 0) rows.value[index] = saved
    ElMessage.success('已清空覆盖，改回继承：本实例立即生效，其他实例最多滞后 60 秒')
    await load()
  } catch (e) {
    if (isStaleConflict(e)) {
      ElMessage.error('该场景配置已被他人修改，已刷新列表，请重试')
      await load()
    } else {
      ElMessage.error(errorMessage(e, '清空覆盖失败'))
    }
  } finally {
    clearingCode.value = ''
  }
}
</script>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.head-left { display: flex; align-items: baseline; gap: 10px; }
.page-title { margin: 0; font-size: 18px; }
.head-tip { font-size: 12px; }
.ops { display: flex; gap: 8px; }
.alert-body { font-size: 12px; line-height: 1.6; }

.pane-title { font-size: 14px; font-weight: 600; }
.pane-sub { font-size: 12px; font-weight: 400; margin-left: 6px; }
.scene-line { display: flex; align-items: center; gap: 6px; }
.scene-name { font-weight: 600; }
.cell-sub { font-size: 12px; }
.ov-line { display: flex; align-items: center; gap: 6px; }
.yaml-line { font-size: 13px; }
.hint-link { text-decoration: underline dotted; cursor: help; }
.tip-box { max-width: 340px; line-height: 1.5; }

.inline-tip { margin-left: 10px; font-size: 12px; }
.field-tip { font-size: 12px; line-height: 1.5; margin-top: 4px; }
.full-select { width: 100%; }
.mid-select { width: 200px; }

.ref-box { width: 100%; padding: 10px 12px; background: #f7f8f8; border: 1px solid var(--kt-line); border-radius: 8px; }
.ref-line { font-size: 12px; line-height: 1.8; }
</style>
