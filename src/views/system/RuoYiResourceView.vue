<template>
  <div class="page-wrap">
    <div class="head">
      <div>
        <h2 class="page-title">{{ config.title }}</h2>
        <p class="text-muted description">{{ config.description }}</p>
      </div>
      <div class="actions">
        <el-button :icon="Refresh" @click="load">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增{{ config.singular }}</el-button>
      </div>
    </div>

    <div class="kt-card">
      <el-alert v-if="config.hint" :title="config.hint" type="info" :closable="false" class="mb12" />
      <el-table :data="rows" v-loading="loading" row-key="id">
        <el-table-column v-for="field in config.columns" :key="field.key" :label="field.label" :min-width="field.width || 130" show-overflow-tooltip>
          <template #default="{ row }"><span>{{ display(row[field.key], field.key) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="config.canRun" link type="success" @click="run(row)">执行一次</el-button>
            <el-popconfirm :title="config.deleteConfirm || `确认${config.deleteText || '删除'}该条记录？`" @confirm="remove(row)">
              <template #reference><el-button link type="danger">{{ config.deleteText || '删除' }}</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialog.visible" :title="dialog.editing ? `编辑${config.singular}` : `新增${config.singular}`" width="620px" destroy-on-close>
      <el-form label-width="120px">
        <el-form-item v-for="field in config.fields" :key="field.key" :label="field.label" :required="field.required">
          <el-select v-if="field.options" v-model="dialog.form[field.key]" filterable allow-create style="width: 100%">
            <el-option v-for="option in field.options" :key="String(option.value)" :label="option.label" :value="option.value" />
          </el-select>
          <el-input v-else v-model="dialog.form[field.key]" :type="field.type || 'text'" :rows="field.type === 'textarea' ? 5 : undefined" :placeholder="field.placeholder" />
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { ruoyiApi, type RuoYiRow } from '@/api'

type FormValue = string | number | string[] | number[]
type Field = {
  key: string
  label: string
  required?: boolean
  type?: 'text' | 'textarea' | 'password'
  placeholder?: string
  options?: Array<{ label: string; value: string | number }>
}
type ResourceConfig = {
  title: string
  singular: string
  description: string
  hint?: string
  resource: string
  columns: Array<Field & { width?: number }>
  fields: Field[]
  deleteText?: string
  deleteConfirm?: string
  canRun?: boolean
}

const statusOptions = [{ label: '启用', value: '1' }, { label: '停用', value: '0' }]
const configs: Record<string, ResourceConfig> = {
  users: {
    title: '用户管理', singular: '运营用户', resource: 'users', description: '若依系统用户映射到现有运营账号，密码仅在创建或重置时填写。',
    hint: '角色编码、岗位 ID 使用英文逗号分隔；超级管理员至少保留一个启用账号。', deleteText: '停用', deleteConfirm: '确认停用该运营用户？',
    columns: [{ key: 'username', label: '登录名' }, { key: 'nickname', label: '昵称' }, { key: 'deptName', label: '部门' }, { key: 'roleCodes', label: '角色' }, { key: 'status', label: '状态', width: 90 }, { key: 'lastLoginAt', label: '最近登录', width: 180 }],
    fields: [{ key: 'username', label: '登录名', required: true }, { key: 'password', label: '密码', type: 'password', placeholder: '新增必填；编辑时留空不修改' }, { key: 'nickname', label: '昵称' }, { key: 'mobile', label: '手机号' }, { key: 'email', label: '邮箱' }, { key: 'deptId', label: '部门 ID' }, { key: 'roleCodes', label: '角色编码', required: true, placeholder: '例如 super_admin,operator' }, { key: 'postIds', label: '岗位 ID' }, { key: 'status', label: '状态', required: true, options: statusOptions }]
  },
  roles: {
    title: '角色管理', singular: '角色', resource: 'roles', description: '角色决定后台权限；权限标识与后端 @ss.hasPermi 规则保持一致。',
    columns: [{ key: 'roleCode', label: '角色编码' }, { key: 'roleName', label: '角色名称' }, { key: 'permissionCodes', label: '权限标识', width: 260 }, { key: 'status', label: '状态', width: 90 }, { key: 'remark', label: '说明' }],
    fields: [{ key: 'roleCode', label: '角色编码', required: true }, { key: 'roleName', label: '角色名称', required: true }, { key: 'sortNo', label: '排序', required: true }, { key: 'status', label: '状态', required: true, options: statusOptions }, { key: 'permissionCodes', label: '权限标识', type: 'textarea', placeholder: '英文逗号分隔，如 system:user:manage' }, { key: 'remark', label: '备注', type: 'textarea' }]
  },
  menus: {
    title: '菜单管理', singular: '菜单', resource: 'menus', description: '维护若依动态菜单与权限标识。目录类型 M、菜单 C、按钮 F。',
    columns: [{ key: 'menuName', label: '菜单名称' }, { key: 'parentId', label: '父级 ID' }, { key: 'pathUrl', label: '路由' }, { key: 'permCode', label: '权限标识' }, { key: 'menuType', label: '类型', width: 80 }, { key: 'menuStatus', label: '状态', width: 80 }],
    fields: [{ key: 'menuName', label: '菜单名称', required: true }, { key: 'parentId', label: '父级 ID', required: true }, { key: 'sortNo', label: '排序', required: true }, { key: 'pathUrl', label: '路由路径' }, { key: 'componentName', label: '组件名' }, { key: 'menuType', label: '类型', required: true, options: [{ label: '目录 M', value: 'M' }, { label: '菜单 C', value: 'C' }, { label: '按钮 F', value: 'F' }] }, { key: 'permCode', label: '权限标识' }, { key: 'iconName', label: '图标' }, { key: 'status', label: '状态', required: true, options: statusOptions }, { key: 'visible', label: '可见', required: true, options: statusOptions }]
  },
  depts: {
    title: '部门管理', singular: '部门', resource: 'depts', description: '维护运营组织树，父级 ID 为 0 表示根部门。',
    columns: [{ key: 'deptName', label: '部门名称' }, { key: 'parentId', label: '父级 ID' }, { key: 'leader', label: '负责人' }, { key: 'phone', label: '联系电话' }, { key: 'deptStatus', label: '状态', width: 80 }],
    fields: [{ key: 'deptName', label: '部门名称', required: true }, { key: 'parentId', label: '父级 ID', required: true }, { key: 'sortNo', label: '排序', required: true }, { key: 'leader', label: '负责人' }, { key: 'phone', label: '联系电话' }, { key: 'email', label: '邮箱' }, { key: 'status', label: '状态', required: true, options: statusOptions }, { key: 'remark', label: '备注', type: 'textarea' }]
  },
  posts: {
    title: '岗位管理', singular: '岗位', resource: 'posts', description: '岗位可被多个运营用户关联，用于若依系统的人事归属。',
    columns: [{ key: 'postCode', label: '岗位编码' }, { key: 'postName', label: '岗位名称' }, { key: 'postSort', label: '排序', width: 80 }, { key: 'postStatus', label: '状态', width: 80 }, { key: 'remark', label: '说明' }],
    fields: [{ key: 'postCode', label: '岗位编码', required: true }, { key: 'postName', label: '岗位名称', required: true }, { key: 'postSort', label: '排序', required: true }, { key: 'status', label: '状态', required: true, options: statusOptions }, { key: 'remark', label: '备注', type: 'textarea' }]
  },
  'dict-types': {
    title: '字典类型', singular: '字典类型', resource: 'dict-types', description: '维护枚举类型；修改类型编码会同步其字典数据。',
    columns: [{ key: 'dictName', label: '字典名称' }, { key: 'dictType', label: '字典类型' }, { key: 'dictStatus', label: '状态', width: 80 }, { key: 'remark', label: '备注' }],
    fields: [{ key: 'dictName', label: '字典名称', required: true }, { key: 'dictType', label: '类型编码', required: true }, { key: 'status', label: '状态', required: true, options: statusOptions }, { key: 'remark', label: '备注', type: 'textarea' }]
  },
  'dict-data': {
    title: '字典数据', singular: '字典数据', resource: 'dict-data', description: '字典数据必须关联一个已启用的字典类型。',
    columns: [{ key: 'dictType', label: '字典类型' }, { key: 'dictLabel', label: '标签' }, { key: 'dictValue', label: '值' }, { key: 'dictSort', label: '排序', width: 80 }, { key: 'dictStatus', label: '状态', width: 80 }],
    fields: [{ key: 'dictType', label: '字典类型', required: true }, { key: 'dictLabel', label: '标签', required: true }, { key: 'dictValue', label: '值', required: true }, { key: 'dictSort', label: '排序', required: true }, { key: 'isDefault', label: '默认值', required: true, options: statusOptions }, { key: 'status', label: '状态', required: true, options: statusOptions }, { key: 'listClass', label: '标签样式' }, { key: 'remark', label: '备注', type: 'textarea' }]
  },
  notices: {
    title: '通知公告', singular: '公告', resource: 'notices', description: '若依通知与公告内容管理，可作为后台和小程序公告来源。',
    columns: [{ key: 'noticeTitle', label: '标题' }, { key: 'noticeType', label: '类型', width: 80 }, { key: 'noticeStatus', label: '状态', width: 80 }, { key: 'gmtCreate', label: '创建时间', width: 180 }],
    fields: [{ key: 'title', label: '标题', required: true }, { key: 'type', label: '类型', required: true, options: [{ label: '通知', value: '1' }, { label: '公告', value: '2' }] }, { key: 'content', label: '内容', required: true, type: 'textarea' }, { key: 'status', label: '状态', required: true, options: statusOptions }]
  },
  configs: {
    title: '系统参数', singular: '参数', resource: 'configs', description: '统一维护系统参数，修改会保留操作人和审计时间。',
    columns: [{ key: 'configKey', label: '参数键名' }, { key: 'configValue', label: '参数值', width: 240 }, { key: 'configGroup', label: '分组' }, { key: 'valueType', label: '类型', width: 80 }, { key: 'remark', label: '说明' }],
    fields: [{ key: 'configKey', label: '参数键名', required: true }, { key: 'configValue', label: '参数值', type: 'textarea' }, { key: 'valueType', label: '数据类型', required: true, options: [{ label: '字符串', value: '1' }, { label: '数字', value: '2' }, { label: '布尔', value: '3' }, { label: 'JSON', value: '4' }] }, { key: 'configGroup', label: '分组', required: true }, { key: 'remark', label: '说明', type: 'textarea' }]
  },
  jobs: {
    title: '定时任务', singular: '任务', resource: 'jobs', description: '任务目标严格采用白名单，禁止输入任意 Bean、类名或脚本。', hint: '可用目标：system.cleanup-sessions、system.refresh-permissions、system.health-check。', canRun: true,
    columns: [{ key: 'jobName', label: '任务名称' }, { key: 'jobGroup', label: '分组' }, { key: 'invokeTarget', label: '调用目标' }, { key: 'cronExpression', label: 'Cron 表达式', width: 160 }, { key: 'jobStatus', label: '状态', width: 80 }],
    fields: [{ key: 'jobName', label: '任务名称', required: true }, { key: 'jobGroup', label: '任务分组', required: true }, { key: 'invokeTarget', label: '调用目标', required: true, options: [{ label: '清理过期会话', value: 'system.cleanup-sessions' }, { label: '刷新权限', value: 'system.refresh-permissions' }, { label: '健康检查', value: 'system.health-check' }] }, { key: 'cronExpression', label: 'Cron 表达式', required: true, placeholder: '例如 0 0/30 * * * *' }, { key: 'concurrentAllowed', label: '允许并发', required: true, options: statusOptions }, { key: 'status', label: '状态', required: true, options: statusOptions }, { key: 'remark', label: '备注', type: 'textarea' }]
  }
}

const route = useRoute()
const config = computed(() => configs[String(route.meta.ruoyiResource)] || configs.users)
const rows = ref<RuoYiRow[]>([])
const loading = ref(false)
const saving = ref(false)
const dialog = reactive<{ visible: boolean; editing: boolean; id: string | number | null; form: Record<string, FormValue> }>({ visible: false, editing: false, id: null, form: {} })

function defaults() {
  const result: Record<string, FormValue> = {}
  for (const field of config.value.fields) {
    if (['status', 'visible', 'isDefault', 'concurrentAllowed'].includes(field.key)) result[field.key] = '1'
    else if (['parentId', 'sortNo', 'postSort', 'dictSort'].includes(field.key)) result[field.key] = '0'
    else if (field.key === 'menuType') result[field.key] = 'C'
    else if (field.key === 'type') result[field.key] = '1'
    else if (field.key === 'valueType') result[field.key] = '1'
    else if (field.key === 'jobGroup') result[field.key] = 'DEFAULT'
    else result[field.key] = ''
  }
  return result
}

async function load() {
  loading.value = true
  try { rows.value = await ruoyiApi.list<RuoYiRow>(config.value.resource) }
  catch (error) { ElMessage.error((error as Error).message || '加载失败') }
  finally { loading.value = false }
}

function openCreate() {
  dialog.editing = false; dialog.id = null; dialog.form = defaults(); dialog.visible = true
}

function openEdit(row: RuoYiRow) {
  const form = defaults()
  for (const field of config.value.fields) {
    const value = field.key === 'status' ? row[statusField()] : row[field.key]
    form[field.key] = Array.isArray(value) ? value.join(',') : value == null ? form[field.key] : String(value)
  }
  if (config.value.resource === 'notices') {
    form.title = String(row.noticeTitle || '')
    form.type = String(row.noticeType || '1')
    form.content = String(row.noticeContent || '')
  }
  dialog.editing = true; dialog.id = row.id; dialog.form = form; dialog.visible = true
}

function statusField() {
  return ({ menus: 'menuStatus', depts: 'deptStatus', posts: 'postStatus', 'dict-types': 'dictStatus', 'dict-data': 'dictStatus', notices: 'noticeStatus', jobs: 'jobStatus' } as Record<string, string>)[config.value.resource] || 'status'
}

function payload() {
  const body: Record<string, unknown> = { ...dialog.form }
  for (const key of ['status', 'visible', 'isDefault', 'concurrentAllowed', 'parentId', 'sortNo', 'postSort', 'dictSort', 'valueType']) {
    if (body[key] !== undefined && body[key] !== '') body[key] = Number(body[key])
  }
  if (config.value.resource === 'users') {
    body.roleCodes = split(body.roleCodes)
    body.postIds = split(body.postIds).map(Number).filter(Number.isFinite)
  }
  if (config.value.resource === 'roles') body.permissionCodes = split(body.permissionCodes)
  return body
}

function split(value: unknown): string[] { return String(value || '').split(',').map((item) => item.trim()).filter(Boolean) }
async function save() {
  const required = config.value.fields.filter((field) => field.required && field.key !== 'password')
  if (required.some((field) => !String(dialog.form[field.key] ?? '').trim())) return ElMessage.warning('请填写必填项')
  if (config.value.resource === 'users' && !dialog.editing && !String(dialog.form.password || '').trim()) return ElMessage.warning('新增用户必须设置初始密码')
  saving.value = true
  try {
    if (dialog.editing && dialog.id != null) await ruoyiApi.update(config.value.resource, dialog.id, payload())
    else await ruoyiApi.create(config.value.resource, payload())
    dialog.visible = false; ElMessage.success('已保存'); await load()
  } catch (error) { ElMessage.error((error as Error).message || '保存失败') }
  finally { saving.value = false }
}
async function remove(row: RuoYiRow) {
  try { await ruoyiApi.remove(config.value.resource, row.id); ElMessage.success('已处理'); await load() }
  catch (error) { ElMessage.error((error as Error).message || '操作失败') }
}
async function run(row: RuoYiRow) {
  try { await ruoyiApi.runJob(row.id); ElMessage.success('任务已执行'); await load() }
  catch (error) { ElMessage.error((error as Error).message || '任务执行失败') }
}
function display(value: unknown, field: string) {
  if (Array.isArray(value)) return value.join(', ')
  if (['status', 'visible', 'deptStatus', 'postStatus', 'dictStatus', 'noticeStatus', 'menuStatus', 'jobStatus'].includes(field)) {
    if (value === 1 || value === '1') return '启用'
    if (value === 0 || value === '0') return '停用'
  }
  return value == null || value === '' ? '—' : String(value)
}
onMounted(load)
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 16px; }
.page-title { margin: 0; font-size: 18px; }
.description { margin: 6px 0 0; font-size: 13px; }
.actions { display: flex; flex: none; gap: 8px; }
.mb12 { margin-bottom: 12px; }
</style>
