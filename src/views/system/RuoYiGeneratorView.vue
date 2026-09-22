<template>
  <div class="page-wrap">
    <div class="head">
      <div><h2 class="page-title">代码生成</h2><p class="text-muted description">从当前数据库同步元数据，并预览受控的实体与控制器模板；生成结果不会自动写入生产代码。</p></div>
      <el-button :icon="Refresh" @click="load">刷新数据表</el-button>
    </div>
    <div class="kt-card" v-loading="loading">
      <el-alert title="只允许同步当前数据库中符合命名规则的表；模板生成不执行任何代码。" type="info" :closable="false" class="mb12" />
      <el-table :data="tables" row-key="tableName">
        <el-table-column prop="tableName" label="表名" min-width="200" />
        <el-table-column prop="tableComment" label="说明" min-width="220" show-overflow-tooltip />
        <el-table-column label="状态" width="120"><template #default="{ row }"><el-tag :type="row.imported ? 'success' : 'info'">{{ row.imported ? '已同步' : '未同步' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="sync(row.tableName)">{{ row.imported ? '重新同步' : '同步' }}</el-button>
            <el-button v-if="row.genTableId" link type="success" @click="preview(row.genTableId)">预览</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-dialog v-model="dialog.visible" title="生成代码预览" width="900px" top="5vh">
      <el-tabs>
        <el-tab-pane label="实体类"><pre>{{ dialog.entitySource }}</pre></el-tab-pane>
        <el-tab-pane label="控制器"><pre>{{ dialog.controllerSource }}</pre></el-tab-pane>
        <el-tab-pane label="字段元数据"><el-table :data="dialog.columns" size="small"><el-table-column prop="columnName" label="字段" /><el-table-column prop="columnType" label="数据库类型" /><el-table-column prop="javaType" label="Java 类型" /><el-table-column prop="javaField" label="属性" /></el-table></el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { ruoyiApi, type RuoYiRow } from '@/api'

const loading = ref(false)
const tables = ref<Array<RuoYiRow & { tableName: string; tableComment?: string; imported?: boolean; genTableId?: string | number }>>([])
const dialog = reactive({ visible: false, entitySource: '', controllerSource: '', columns: [] as RuoYiRow[] })

async function load() {
  loading.value = true
  try { tables.value = await ruoyiApi.generatorTables() as typeof tables.value }
  catch (error) { ElMessage.error((error as Error).message || '加载表元数据失败') }
  finally { loading.value = false }
}
async function sync(name: string) {
  try { const result = await ruoyiApi.syncGeneratorTable(name); showPreview(result); ElMessage.success('已同步元数据'); await load() }
  catch (error) { ElMessage.error((error as Error).message || '同步失败') }
}
async function preview(id: string | number) {
  try { showPreview(await ruoyiApi.previewGeneratorTable(id)) }
  catch (error) { ElMessage.error((error as Error).message || '预览失败') }
}
function showPreview(result: Record<string, unknown>) {
  dialog.entitySource = String(result.entitySource || '')
  dialog.controllerSource = String(result.controllerSource || '')
  dialog.columns = Array.isArray(result.columns) ? result.columns as RuoYiRow[] : []
  dialog.visible = true
}
onMounted(load)
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 16px; }
.page-title { margin: 0; font-size: 18px; }.description { margin: 6px 0 0; font-size: 13px; }.mb12 { margin-bottom: 12px; }
pre { max-height: 60vh; overflow: auto; margin: 0; padding: 16px; border-radius: 6px; background: #f5f7fa; color: #303133; font: 12px/1.55 Consolas, Monaco, monospace; white-space: pre; }
</style>
