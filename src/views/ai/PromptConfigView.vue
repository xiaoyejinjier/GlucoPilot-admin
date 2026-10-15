<template>
  <div class="page-wrap">
    <div class="head">
      <div class="head-left">
        <h2 class="page-title">提示词管理</h2>
        <span class="text-muted head-tip">
          草稿可原地修改；已启用版本不会被原地改，保存时后端自动追加一个新版本（旧版本保留用于回滚）
        </span>
      </div>
      <div class="ops">
        <el-button :icon="Refresh" :loading="loading" @click="load()">刷新</el-button>
        <el-button type="primary" :icon="Plus" :disabled="!canManage || !activeScene" @click="openCreate()">
          新建版本
        </el-button>
      </div>
    </div>

    <div class="prompt-layout">
      <!-- 左：场景切换（场景 + 当前生效版本 + 生效来源） -->
      <aside class="kt-card scene-pane">
        <div class="pane-title mb12">
          场景 <span class="text-muted">（{{ scenes.length }}）</span>
        </div>
        <el-scrollbar class="scene-scroll">
          <div
            v-for="s in scenes"
            :key="s.sceneCode"
            class="scene-item"
            :class="{ 'is-active': s.sceneCode === sceneCode }"
            @click="selectScene(s.sceneCode)"
          >
            <div class="scene-line">
              <span class="scene-name">{{ s.sceneName }}</span>
              <el-tag v-if="s.requiresVision" size="small" type="warning" effect="plain">视觉</el-tag>
            </div>
            <div class="scene-meta text-muted">{{ s.sceneCode }} · configKey={{ s.configKey || '—' }}</div>
            <div class="scene-line">
              <el-tag size="small" :type="sourceTagType(s.activeSource)" effect="plain">
                {{ s.activeVersion || '未启用' }}
              </el-tag>
              <span class="text-muted scene-source" :class="{ warn: isBuiltinSource(s.activeSource) }">
                {{ sourceText(s.activeSource) }}
              </span>
            </div>
          </div>
          <el-empty v-if="!scenes.length" description="后端未下发场景" :image-size="60" />
        </el-scrollbar>
      </aside>

      <!-- 右：版本列表 + 正文详情 -->
      <section class="main-pane">
        <template v-if="activeScene">
          <el-alert
            v-if="isBuiltinSource(activeScene.activeSource)"
            class="mb12"
            type="warning"
            :closable="false"
            show-icon
          >
            <template #title>
              当前生效的是代码内置提示词，库里没有启用版本（activeSource={{ activeScene.activeSource || '—' }}）
            </template>
            <template #default>
              业务侧现在用的是打包进去的 <b>{{ activeScene.builtinVersion || '内置版本' }}</b>。
              新建一个版本并点「启用该版本」后，才会覆盖内置提示词。
            </template>
          </el-alert>

          <div class="kt-card mb12">
            <div class="flex-between mb12">
              <div class="pane-title">
                {{ activeScene.sceneName }} · 全部版本
                <span class="text-muted pane-sub">
                  共 {{ rows.length }} 个（含停用）· 编辑草稿必须带 configVersion，版本不一致后端会拒绝
                </span>
              </div>
              <el-select
                v-model="statusFilter"
                class="status-filter"
                clearable
                placeholder="全部状态"
                @change="load()"
              >
                <el-option label="启用（status=1）" :value="1" />
                <el-option label="草稿 / 已停用（status=0）" :value="0" />
              </el-select>
            </div>

            <el-table
              :data="rows"
              v-loading="loading"
              row-key="id"
              highlight-current-row
              @row-click="onRowClick"
            >
              <el-table-column label="版本" width="150">
                <template #default="{ row }">
                  <div class="ver-cell">
                    <span class="ver-text">{{ row.version || '—' }}</span>
                    <span v-if="row.active" class="live-dot"></span>
                  </div>
                  <div class="text-muted ver-sub">versionNo={{ row.versionNo ?? '—' }}</div>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="132">
                <template #default="{ row }">
                  <el-tag v-if="row.active" type="success" effect="dark" size="small">生效中</el-tag>
                  <el-tag v-else-if="row.status === 1" type="warning" effect="plain" size="small">已启用</el-tag>
                  <el-tag v-else type="info" effect="plain" size="small">草稿 / 停用</el-tag>
                  <div class="text-muted ver-sub">status={{ row.status ?? '—' }}</div>
                </template>
              </el-table-column>
              <el-table-column label="模板名称" min-width="170" show-overflow-tooltip>
                <template #default="{ row }">{{ row.templateName || '—' }}</template>
              </el-table-column>
              <el-table-column label="变量" min-width="140">
                <template #default="{ row }">
                  <template v-if="rowVariables(row).length">
                    <el-tag
                      v-for="v in rowVariables(row)"
                      :key="v"
                      size="small"
                      effect="plain"
                      class="var-tag"
                    >{{ v }}</el-tag>
                  </template>
                  <span v-else class="text-muted">—</span>
                </template>
              </el-table-column>
              <el-table-column label="改动说明" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.changeNote || '—' }}</template>
              </el-table-column>
              <el-table-column label="最后修改" width="150">
                <template #default="{ row }">{{ row.gmtModified ? fmtTime(row.gmtModified) : '—' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="168" fixed="right">
                <template #default="{ row }">
                  <template v-if="canManage">
                    <el-button link type="primary" @click.stop="openEdit(row)">编辑</el-button>
                    <el-button
                      link
                      type="primary"
                      :disabled="row.active"
                      :loading="activatingId === row.id"
                      @click.stop="activate(row)"
                    >启用该版本</el-button>
                  </template>
                  <span v-else class="text-muted">仅查看（缺 ai:prompt:manage）</span>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div class="kt-card detail-card">
            <div class="flex-between mb12">
              <div class="pane-title">
                正文
                <span v-if="selected" class="text-muted pane-sub">
                  {{ selected.version }} · 共 {{ selected.promptText.length }} 字
                </span>
              </div>
              <div v-if="selected" class="flex-between detail-ops">
                <el-tag v-if="selected.active" type="success" size="small" effect="dark">生效中</el-tag>
                <el-button link type="primary" :icon="DocumentCopy" @click="copyText(selected.promptText)">复制正文</el-button>
              </div>
            </div>

            <template v-if="selected">
              <div class="detail-meta text-muted">
                <span>模板名称：{{ selected.templateName || '—' }}</span>
                <span>改动说明：{{ selected.changeNote || '—' }}</span>
                <span>最后修改：{{ selected.gmtModified ? fmtTime(selected.gmtModified) : '—' }}</span>
                <span>configVersion：{{ selected.configVersion }}</span>
              </div>
              <div v-if="rowVariables(selected).length" class="detail-vars">
                <span class="text-muted">变量：</span>
                <el-tag
                  v-for="v in rowVariables(selected)"
                  :key="v"
                  size="small"
                  effect="plain"
                  class="var-tag"
                >{{ v }}</el-tag>
              </div>
              <pre class="prompt-text">{{ selected.promptText || '（空正文）' }}</pre>
            </template>
            <el-empty v-else description="点击上方版本行查看正文" :image-size="60" />
          </div>
        </template>

        <div v-else class="kt-card">
          <el-empty :description="loading ? '加载中…' : '没有可管理的提示词场景，请确认后端已升级'" />
        </div>
      </section>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="880px"
      top="6vh"
      @closed="resetDialog"
    >
      <el-alert
        v-if="editingRow && editingRow.status === 1"
        class="mb12"
        type="warning"
        :closable="false"
        show-icon
        title="该版本已启用：保存不会原地修改它，后端会自动追加一个新版本（旧版本保留用于回滚）"
      >
        <div class="alert-body">
          新版本若要接管线上，保存后在列表里对它点「启用该版本」——启用是单独的动作，编辑本身不会自动切换线上版本。
        </div>
      </el-alert>
      <el-alert
        v-else-if="editingRow"
        class="mb12"
        type="info"
        :closable="false"
        show-icon
        title="草稿可原地修改：保存会直接更新这一条（需要带 configVersion）"
      />

      <el-form ref="formRef" v-loading="saving" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="模板名称">
          <el-input v-model="form.templateName" placeholder="可选，如：对话（文本） v2" />
        </el-form-item>
        <el-form-item label="版本号" prop="version">
          <el-input v-model="form.version" placeholder="可选，如 v2；留空由后端生成" />
          <span class="text-muted inline-tip">同一场景内版本号唯一</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" class="mid-select" clearable placeholder="空 = 草稿">
            <el-option label="草稿（0）" :value="0" />
            <el-option label="启用（1，同场景其它版本会自动停用）" :value="1" />
          </el-select>
          <span class="text-muted inline-tip">不确定就留空：先存草稿，确认无误再启用</span>
          <div v-if="!editingRow && activeScene && isBuiltinSource(activeScene.activeSource)" class="text-muted field-tip">
            该场景当前用代码内置提示词：新版本想立即接管线上，请把状态设为「启用（1）」，或保存后在列表里点「启用该版本」。
          </div>
        </el-form-item>
        <el-form-item label="变量">
          <el-select
            v-model="form.variables"
            class="full-select"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="可选；输入变量名后回车添加，如 nickname"
          />
          <div class="text-muted field-tip">
            这里只是声明该模板会用到哪些变量，真正渲染仍由业务侧完成；列表里生效版本带哪些变量，取决于启用时提交的内容
          </div>
        </el-form-item>
        <el-form-item label="正文" prop="promptText">
          <el-input
            v-model="form.promptText"
            class="prompt-editor"
            type="textarea"
            :rows="16"
            placeholder="提示词正文（必填）"
          />
          <div class="text-muted field-tip">共 {{ form.promptText.length }} 字 · 等宽字体，便于核对占位符与缩进</div>
        </el-form-item>
        <el-form-item label="改动说明">
          <el-input v-model="form.changeNote" placeholder="可选，如：V17：补充低血糖场景话术" />
        </el-form-item>
        <el-form-item label="与生效版本对比">
          <div class="diff-pane">
            <div class="diff-head flex-between">
              <span class="text-muted">
                对比基准：当前生效版本
                <b>{{ diffBase ? diffBase.version : '（未取到）' }}</b>
                <span v-if="diffBase">· {{ diffBase.promptText.length }} 字</span>
              </span>
              <span class="flex-between diff-ops">
                <el-button
                  v-if="diffBase"
                  link
                  type="primary"
                  @click="showActiveText = !showActiveText"
                >{{ showActiveText ? '收起生效版本正文' : '查看生效版本正文' }}</el-button>
                <el-button link type="primary" :loading="baselineLoading" @click="resolveBaseline()">
                  刷新对比基准
                </el-button>
              </span>
            </div>

            <pre v-if="diffBase && showActiveText" class="prompt-text small">{{ diffBase.promptText || '（空正文）' }}</pre>

            <div v-if="diffBase" class="diff-body">
              <div
                v-for="(line, idx) in diffResult"
                :key="idx"
                class="diff-line"
                :class="`d-${line.type}`"
              >
                <span class="diff-sign">{{ line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ' }}</span>
                <span class="diff-text">{{ line.text === '' ? ' ' : line.text }}</span>
              </div>
              <div v-if="!diffResult.length" class="text-muted diff-empty">两版正文均为空</div>
            </div>
            <div v-else class="text-muted diff-empty">
              <template v-if="activeScene && isBuiltinSource(activeScene.activeSource)">
                该场景当前生效的是代码内置提示词（库里没有启用版本），无法做行级对比；本次保存后由这条记录接管。
              </template>
              <template v-else>
                未取到该场景的生效版本，本次不展示行级对比——可点「刷新对比基准」重试。
              </template>
            </div>

            <div class="diff-legend text-muted">
              <span class="legend-add">+ 新增行</span>（本版本有、生效版本没有） ·
              <span class="legend-del">- 删除行</span>（生效版本有、本版本没有） · 未标色的行两版一致
            </div>
          </div>
        </el-form-item>
      </el-form>

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
import { DocumentCopy, Plus, Refresh } from '@element-plus/icons-vue'
import { aiPromptApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { fmtTime } from '@/utils/format'
import { errorMessage, isVersionConflict } from '@/utils/api-error'
import { diffLines, type DiffLine } from '@/utils/line-diff'
import type { AiPromptScene, AiPromptTemplateRow, AiPromptTemplateSavePayload } from '@/types'

interface PromptForm {
  templateName: string
  version: string
  promptText: string
  variables: string[]
  /** null = 不提交状态（后端按"空 = 草稿"处理） */
  status: number | null
  changeNote: string
}

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const baselineLoading = ref(false)
const scenes = ref<AiPromptScene[]>([])
const rows = ref<AiPromptTemplateRow[]>([])
const sceneCode = ref('')
/** null = 不带 status 过滤；0/1 = 只看草稿或只看启用 */
const statusFilter = ref<number | null>(null)
const selectedId = ref(0)
const activatingId = ref(0)
const dialogVisible = ref(false)
const editingRow = ref<AiPromptTemplateRow | null>(null)
/** 行级 diff 的对比基准（当前生效版本）；被状态过滤挡掉时会单独拉一次 */
const diffBase = ref<AiPromptTemplateRow | null>(null)
const showActiveText = ref(false)
const formRef = ref<FormInstance>()
/** 请求序号：快速切换场景时丢弃过期响应，避免旧数据覆盖新场景 */
let reqSeq = 0

function emptyForm(): PromptForm {
  return { templateName: '', version: '', promptText: '', variables: [], status: null, changeNote: '' }
}
const form = reactive<PromptForm>(emptyForm())

const rules: FormRules = {
  promptText: [{ required: true, message: '请输入提示词正文', trigger: 'blur' }],
  version: [{ pattern: /^[A-Za-z0-9._-]*$/, message: '版本号仅支持字母、数字、点、下划线、连字符', trigger: 'blur' }]
}

/** 写操作要 ai:prompt:manage；列表本身要 ai:prompt:list（由路由 meta 把关）。 */
const canManage = computed(() => auth.hasPermission('ai:prompt:manage'))
const activeScene = computed(() => scenes.value.find((s) => s.sceneCode === sceneCode.value) || null)
const selected = computed(() => rows.value.find((r) => r.id === selectedId.value) || null)
const dialogTitle = computed(() => {
  if (editingRow.value) return `编辑版本 ${editingRow.value.version || ''}`
  return `新建版本 · ${activeScene.value?.sceneName || ''}`
})
const diffResult = computed<DiffLine[]>(() => {
  const base = diffBase.value
  if (!base) return []
  return diffLines(base.promptText, form.promptText)
})

function isBuiltinSource(source: string): boolean {
  return (source || '').toLowerCase().startsWith('classpath')
}

function sourceText(source: string): string {
  if (!source) return '来源未知'
  if (isBuiltinSource(source)) return '代码内置兜底'
  if (source.startsWith('db#')) return `库内记录 ${source.slice(3)}`
  return source
}

function sourceTagType(source: string): 'success' | 'danger' {
  return isBuiltinSource(source) ? 'danger' : 'success'
}

/** variables 为空时兜底解析 variablesJson（后端两个字段都下发） */
function rowVariables(row: AiPromptTemplateRow): string[] {
  if (row.variables && row.variables.length) return row.variables
  try {
    const parsed = JSON.parse(row.variablesJson || '[]')
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : []
  } catch {
    return []
  }
}

function applyData(data: { rows: AiPromptTemplateRow[]; scenes: AiPromptScene[] }) {
  scenes.value = data.scenes
  rows.value = data.rows
  if (!scenes.value.some((s) => s.sceneCode === sceneCode.value)) {
    sceneCode.value = scenes.value[0]?.sceneCode || ''
  }
  // 选中的行可能在刷新后消失（例如新增了版本），回落到生效版本再回落到第一行
  if (!rows.value.some((r) => r.id === selectedId.value)) {
    selectedId.value = (rows.value.find((r) => r.active) || rows.value[0])?.id || 0
  }
}

/** 首次进入：不带过滤条件拿一次全量，既得到场景列表，也够渲染首个场景的版本列表（省一次请求） */
async function init() {
  loading.value = true
  const seq = ++reqSeq
  try {
    const data = await aiPromptApi.list()
    if (seq !== reqSeq) return
    scenes.value = data.scenes
    sceneCode.value = scenes.value[0]?.sceneCode || ''
    rows.value = data.rows.filter((r) => r.sceneCode === sceneCode.value)
    selectedId.value = (rows.value.find((r) => r.active) || rows.value[0])?.id || 0
  } catch (e) {
    ElMessage.error(errorMessage(e, '加载提示词列表失败'))
  } finally {
    if (seq === reqSeq) loading.value = false
  }
}

async function load() {
  loading.value = true
  const seq = ++reqSeq
  try {
    const data = await aiPromptApi.list({
      sceneCode: sceneCode.value || undefined,
      // 空 = 不过滤；0 也要真的传出去，所以这里显式判空
      status: statusFilter.value === 0 || statusFilter.value === 1 ? statusFilter.value : undefined
    })
    if (seq !== reqSeq) return
    applyData(data)
  } catch (e) {
    if (seq === reqSeq) ElMessage.error(errorMessage(e, '加载提示词列表失败'))
  } finally {
    if (seq === reqSeq) loading.value = false
  }
}

onMounted(init)

async function selectScene(code: string) {
  if (code === sceneCode.value) return
  sceneCode.value = code
  selectedId.value = 0
  await load()
}

function onRowClick(row: AiPromptTemplateRow) {
  selectedId.value = row.id
}

/**
 * 取"当前生效版本"作为 diff 基准：列表里就有就直接用；
 * 被「状态」过滤挡掉时（例如只看草稿）单独拉一次不带 status 的列表，
 * 否则会误判成"该场景没有生效版本"。
 */
async function resolveBaseline() {
  const inList = rows.value.find((r) => r.active)
  if (inList) {
    diffBase.value = inList
    return
  }
  if (!sceneCode.value) {
    diffBase.value = null
    return
  }
  baselineLoading.value = true
  try {
    const data = await aiPromptApi.list({ sceneCode: sceneCode.value })
    diffBase.value = data.rows.find((r) => r.active) || null
  } catch (e) {
    diffBase.value = null
    ElMessage.warning(errorMessage(e, '拉取生效版本失败，本次不展示行级对比'))
  } finally {
    baselineLoading.value = false
  }
}

function openCreate() {
  if (!activeScene.value) return
  editingRow.value = null
  Object.assign(form, emptyForm())
  showActiveText.value = false
  diffBase.value = null
  dialogVisible.value = true
  void resolveBaseline()
}

function openEdit(row: AiPromptTemplateRow) {
  editingRow.value = row
  Object.assign(form, {
    templateName: row.templateName || '',
    version: row.version || '',
    promptText: row.promptText || '',
    variables: [...rowVariables(row)],
    status: row.status === 1 ? 1 : 0,
    changeNote: row.changeNote || ''
  })
  showActiveText.value = false
  diffBase.value = null
  dialogVisible.value = true
  selectedId.value = row.id
  void resolveBaseline()
}

function resetDialog() {
  editingRow.value = null
  showActiveText.value = false
  diffBase.value = null
  Object.assign(form, emptyForm())
}

/** el-select 清空时不同版本会回传 null / undefined / ''，统一收敛成 null（= 不提交该字段） */
function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function buildPayload(): AiPromptTemplateSavePayload {
  const payload: AiPromptTemplateSavePayload = {
    sceneCode: editingRow.value?.sceneCode || sceneCode.value,
    templateName: form.templateName.trim() || null,
    version: form.version.trim() || null,
    promptText: form.promptText,
    variables: form.variables.map((v) => String(v).trim()).filter(Boolean),
    // 空 = 草稿：这里显式提交 null，语义与"省略该字段"一致
    status: nullableNumber(form.status),
    changeNote: form.changeNote.trim() || null
  }
  if (editingRow.value) payload.configVersion = editingRow.value.configVersion
  return payload
}

async function save() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  // 已启用版本：提交前必须让用户知道"线上那条不会被改，而是追加一条新的"
  if (editingRow.value && editingRow.value.status === 1) {
    try {
      await ElMessageBox.confirm(
        `「${editingRow.value.version}」正在线上生效，保存不会修改它：后端会按本次内容追加一个新版本并沿用启用状态（原版本自动停用、保留下来可一键切回）。确认继续？`,
        '已启用版本将追加新版本并生效',
        { type: 'warning', confirmButtonText: '继续保存', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }

  saving.value = true
  try {
    const payload = buildPayload()
    if (editingRow.value) {
      const res = await aiPromptApi.update(editingRow.value.id, payload)
      ElMessage.success(
        res.appended
          ? Number(res.status) === 1
            ? `已追加新版本 ${res.version} 并生效（原版本已停用，可在列表里一键切回）`
            : `已追加新版本 ${res.version}（草稿，需在列表里启用）`
          : `已保存 ${res.version || ''}`
      )
    } else {
      const res = await aiPromptApi.create(payload)
      ElMessage.success(`已创建 ${res.version || '新版本'}${Number(res.status) === 1 ? '（已启用）' : '（草稿）'}`)
    }
    dialogVisible.value = false
    await load()
  } catch (e) {
    if (editingRow.value && isVersionConflict(e)) {
      ElMessage.error('该版本已被他人修改，已刷新列表，请重新编辑')
      dialogVisible.value = false
      await load()
    } else {
      ElMessage.error(errorMessage(e, '保存失败'))
    }
  } finally {
    saving.value = false
  }
}

async function activate(row: AiPromptTemplateRow) {
  try {
    await ElMessageBox.confirm(
      `确认启用「${row.version}」？启用后同场景其它版本会自动停用，业务侧立即生效（其他实例最多滞后 60 秒）。`,
      '启用该版本',
      { type: 'warning', confirmButtonText: '确认启用', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  activatingId.value = row.id
  try {
    await aiPromptApi.activate(row.id)
    ElMessage.success(`已启用 ${row.version}`)
    selectedId.value = row.id
    await load()
  } catch (e) {
    if (isVersionConflict(e)) {
      ElMessage.error('该版本已被他人修改，已刷新列表，请重试')
      await load()
    } else {
      ElMessage.error(errorMessage(e, '启用失败'))
    }
  } finally {
    activatingId.value = 0
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text || '')
    ElMessage.success('正文已复制到剪贴板')
  } catch {
    ElMessage.warning('浏览器拒绝了剪贴板访问，请手动选中正文复制')
  }
}
</script>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.head-left { display: flex; align-items: baseline; gap: 10px; }
.page-title { margin: 0; font-size: 18px; }
.head-tip { font-size: 12px; }
.ops { display: flex; gap: 8px; }

.prompt-layout { display: flex; gap: 12px; align-items: flex-start; }
.scene-pane { width: 264px; flex: none; }
.pane-title { font-size: 14px; font-weight: 600; }
.pane-sub { font-size: 12px; font-weight: 400; margin-left: 6px; }
.scene-scroll { max-height: 640px; }
.scene-item { padding: 10px; border-radius: 8px; border: 1px solid var(--kt-line); margin-bottom: 8px; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.scene-item:hover { border-color: var(--kt-brand); }
.scene-item.is-active { border-color: var(--kt-brand); background: var(--kt-brand-soft); }
.scene-line { display: flex; align-items: center; gap: 6px; }
.scene-name { font-weight: 600; }
.scene-meta { font-size: 12px; margin: 4px 0; word-break: break-all; }
.scene-source { font-size: 12px; }
.scene-source.warn { color: var(--kt-warn); }

.main-pane { flex: 1; min-width: 0; }
.status-filter { width: 200px; }
.ver-cell { display: flex; align-items: center; gap: 6px; }
.ver-text { font-weight: 600; }
.ver-sub { font-size: 12px; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--kt-brand); box-shadow: 0 0 0 3px var(--kt-brand-soft); }
.var-tag { margin-right: 6px; margin-bottom: 2px; }

.detail-card { min-height: 220px; }
.detail-ops { gap: 10px; }
.detail-meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; margin-bottom: 8px; }
.detail-vars { margin-bottom: 8px; }

.prompt-text {
  margin: 0;
  padding: 12px;
  background: #f7f8f8;
  border: 1px solid var(--kt-line);
  border-radius: 8px;
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: Consolas, 'Courier New', 'Microsoft YaHei Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
}
.prompt-text.small { max-height: 200px; }

.inline-tip { margin-left: 10px; font-size: 12px; }
.field-tip { font-size: 12px; line-height: 1.5; margin-top: 4px; }
.mid-select { width: 320px; }
.full-select { width: 100%; }

/* 等宽 + 保留缩进，提示词缩进是有语义的 */
.prompt-editor :deep(.el-textarea__inner) {
  font-family: Consolas, 'Courier New', 'Microsoft YaHei Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.diff-pane { width: 100%; }
.diff-head { font-size: 12px; margin-bottom: 6px; }
.diff-ops { gap: 10px; }
.alert-body { font-size: 12px; line-height: 1.6; }
.diff-body { max-height: 320px; overflow: auto; border: 1px solid var(--kt-line); border-radius: 8px; background: #fff; }
.diff-line { display: flex; gap: 8px; padding: 1px 8px; font-family: Consolas, 'Courier New', 'Microsoft YaHei Mono', monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.diff-sign { width: 10px; flex: none; text-align: center; opacity: 0.7; }
.diff-text { flex: 1; min-width: 0; }
.diff-line.d-add { background: #eaf9f0; color: #10693c; }
.diff-line.d-del { background: #fdecec; color: #9c2b2b; }
.diff-empty { font-size: 12px; padding: 8px; }
.diff-legend { font-size: 12px; margin-top: 6px; }
.legend-add { color: #10693c; font-weight: 600; }
.legend-del { color: #9c2b2b; font-weight: 600; }
</style>
