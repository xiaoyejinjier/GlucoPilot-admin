<template>
  <div class="perm-picker">
    <div class="perm-toolbar">
      <el-input
        v-model="filterText"
        clearable
        placeholder="搜索权限模块或标识"
        class="perm-search"
      />
      <el-input
        v-model="draft"
        clearable
        placeholder="自定义权限，回车添加"
        class="perm-draft"
        @keyup.enter="addCustom"
      />
      <el-button @click="addCustom">添加</el-button>
    </div>

    <div class="perm-actions">
      <el-checkbox v-model="selectedOnly" label="只看已选" />
      <div class="perm-actions-right">
        <el-button link type="primary" @click="expandUseful">展开相关</el-button>
        <el-button link @click="collapseAll">全部折叠</el-button>
        <el-button link type="primary" @click="selectAll">全选目录</el-button>
        <el-button link @click="clearAll">清空</el-button>
      </div>
    </div>

    <div class="perm-summary">
      <span class="perm-summary-count">已选 {{ modelValue.length }} / {{ catalogSize }}</span>
      <div v-if="modelValue.length" class="perm-summary-tags">
        <el-tag
          v-for="code in visibleSelected"
          :key="code"
          size="small"
          closable
          effect="plain"
          @close="removeCode(code)"
        >{{ code }}</el-tag>
        <el-tag v-if="hiddenSelectedCount > 0" size="small" type="info" effect="plain">+{{ hiddenSelectedCount }}</el-tag>
      </div>
      <span v-else class="text-muted">尚未选择权限</span>
    </div>

    <div class="perm-tree-wrap">
      <el-tree
        ref="treeRef"
        :data="displayTree"
        node-key="id"
        show-checkbox
        :props="treeProps"
        :filter-node-method="filterNode"
        :default-expanded-keys="expandedKeys"
        :default-checked-keys="modelValue"
        @check="onCheck"
      >
        <template #default="{ data }">
          <span class="perm-node">
            <span class="perm-node-label">{{ data.label }}</span>
            <span v-if="data.code" class="perm-node-code">{{ data.code }}</span>
            <span v-else-if="data.count" class="perm-node-count">{{ data.count }}</span>
          </span>
        </template>
      </el-tree>
      <div v-if="!displayTree.length" class="perm-empty text-muted">没有匹配的权限节点</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, type ElTree } from 'element-plus'

type TreeNode = {
  id: string
  label: string
  code?: string
  count?: number
  children?: TreeNode[]
}

const props = defineProps<{
  modelValue: string[]
  catalog: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const GROUP_LABELS: Record<string, string> = {
  '*': '全局',
  dashboard: '概览',
  content: '内容',
  food: '营养库',
  feedback: '反馈',
  export: '导出',
  user: '用户',
  device: '设备',
  health: '健康',
  message: '消息',
  ai: 'AI',
  system: '系统',
  monitor: '监控',
  tool: '工具',
  custom: '自定义'
}

const treeProps = { label: 'label', children: 'children' }
const treeRef = ref<InstanceType<typeof ElTree>>()
const filterText = ref('')
const draft = ref('')
const selectedOnly = ref(false)
const expandedKeys = ref<string[]>([])
const SUMMARY_LIMIT = 8

const catalogSize = computed(() => new Set([...props.catalog, ...props.modelValue]).size)

const fullTree = computed(() => buildTree([...props.catalog, ...props.modelValue]))

const displayTree = computed(() => {
  if (!selectedOnly.value) return fullTree.value
  return pruneToSelected(fullTree.value, new Set(props.modelValue))
})

const visibleSelected = computed(() => props.modelValue.slice(0, SUMMARY_LIMIT))
const hiddenSelectedCount = computed(() => Math.max(0, props.modelValue.length - SUMMARY_LIMIT))

watch(filterText, (value) => {
  treeRef.value?.filter(value)
})

watch(
  () => [props.modelValue.join('|'), displayTree.value] as const,
  async () => {
    await nextTick()
    treeRef.value?.setCheckedKeys(props.modelValue)
  },
  { immediate: true }
)

const bootstrapped = ref(false)
watch(
  () => props.modelValue.join('|'),
  () => {
    if (bootstrapped.value) return
    bootstrapped.value = true
    expandUseful()
  }
)

function segmentLabel(segment: string, depth: number, path: string) {
  if (depth === 0) return GROUP_LABELS[segment] || segment
  if (path === '*:*:*') return '全部权限'
  return segment
}

function buildTree(codes: string[]): TreeNode[] {
  type Mutable = { id: string; label: string; code?: string; children: Map<string, Mutable> }
  const root = new Map<string, Mutable>()
  const unique = Array.from(new Set(codes.map((item) => item.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))

  for (const code of unique) {
    const parts = code === '*:*:*' ? ['*', '*', '*'] : code.split(':').filter(Boolean)
    if (!parts.length) continue
    let bucket = root
    let path = ''
    parts.forEach((part, index) => {
      path = path ? `${path}:${part}` : part
      const id = index === parts.length - 1 ? `leaf:${code}` : `node:${path}`
      if (!bucket.has(path)) {
        bucket.set(path, {
          id,
          label: segmentLabel(part, index, path),
          children: new Map()
        })
      }
      const node = bucket.get(path)!
      if (index === parts.length - 1) {
        node.code = code
        node.id = `leaf:${code}`
      }
      bucket = node.children
    })
  }

  const toNodes = (map: Map<string, Mutable>): TreeNode[] =>
    Array.from(map.values()).map((node) => {
      const children = toNodes(node.children)
      return {
        id: node.id,
        label: node.label,
        code: node.code,
        count: node.code ? undefined : countLeaves(children),
        children: children.length ? children : undefined
      }
    })

  return toNodes(root)
}

function countLeaves(nodes: TreeNode[]): number {
  return nodes.reduce((sum, node) => sum + (node.code ? 1 : countLeaves(node.children || [])), 0)
}

function pruneToSelected(nodes: TreeNode[], selected: Set<string>): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    if (node.code) {
      if (selected.has(node.code)) result.push(node)
      continue
    }
    const children = pruneToSelected(node.children || [], selected)
    if (children.length) result.push({ ...node, children, count: countLeaves(children) })
  }
  return result
}

function filterNode(value: string, data: TreeNode) {
  if (!value) return true
  const keyword = value.trim().toLowerCase()
  return data.label.toLowerCase().includes(keyword) || String(data.code || '').toLowerCase().includes(keyword)
}

function collectLeafCodes(nodes: TreeNode[]): string[] {
  const codes: string[] = []
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      if (node.code) codes.push(node.code)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return codes
}

function onCheck() {
  const checked = (treeRef.value?.getCheckedKeys(true) || []) as string[]
  const codes = checked
    .filter((id) => String(id).startsWith('leaf:'))
    .map((id) => String(id).slice(5))
  emit('update:modelValue', Array.from(new Set(codes)))
}

function setCodes(codes: string[]) {
  emit('update:modelValue', Array.from(new Set(codes.map((item) => item.trim()).filter(Boolean))))
}

function removeCode(code: string) {
  setCodes(props.modelValue.filter((item) => item !== code))
}

function selectAll() {
  setCodes(collectLeafCodes(fullTree.value))
}

function clearAll() {
  setCodes([])
}

function collapseAll() {
  const nodesMap = (treeRef.value as { store?: { nodesMap?: Record<string, { expanded: boolean }> } } | undefined)?.store?.nodesMap
  if (nodesMap) Object.values(nodesMap).forEach((node) => { node.expanded = false })
  expandedKeys.value = []
}

function expandUseful() {
  const selected = new Set(props.modelValue)
  const keys: string[] = []
  const walk = (nodes: TreeNode[], parents: string[]) => {
    for (const node of nodes) {
      const nextParents = [...parents, node.id]
      if (node.code) {
        if (selected.has(node.code)) keys.push(...parents)
        continue
      }
      // Keep top-level modules collapsed unless they contain selections or filter is active.
      walk(node.children || [], nextParents)
    }
  }
  walk(fullTree.value, [])
  if (!keys.length) {
    // First open: expand first few modules only, avoid exploding large trees.
    expandedKeys.value = fullTree.value.slice(0, 3).map((node) => node.id)
  } else {
    expandedKeys.value = Array.from(new Set(keys))
  }
  nextTick(() => {
    expandedKeys.value.forEach((key) => {
      const node = treeRef.value?.getNode(key)
      if (node) node.expanded = true
    })
  })
}

function addCustom() {
  const code = draft.value.trim()
  if (!code) return
  if (!/^[A-Za-z0-9_*:.-]+$/.test(code)) {
    ElMessage.warning('权限标识仅支持字母、数字、冒号、下划线、点、星号和连字符')
    return
  }
  setCodes([...props.modelValue, code])
  draft.value = ''
  selectedOnly.value = false
  nextTick(() => {
    const node = treeRef.value?.getNode(`leaf:${code}`)
    let current = node?.parent
    while (current && current.level > 0) {
      current.expanded = true
      current = current.parent
    }
  })
}
</script>

<style scoped>
.perm-picker { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.perm-toolbar, .perm-actions { display: flex; gap: 8px; align-items: center; }
.perm-search, .perm-draft { flex: 1; }
.perm-actions { justify-content: space-between; }
.perm-actions-right { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.perm-summary { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-fill-color-blank); }
.perm-summary-count { font-size: 12px; color: var(--el-text-color-secondary); }
.perm-summary-tags { display: flex; flex-wrap: wrap; gap: 6px; max-height: 72px; overflow: auto; }
.perm-tree-wrap { border: 1px solid var(--el-border-color-lighter); border-radius: 10px; padding: 8px 10px; max-height: 360px; overflow: auto; background: #fff; }
.perm-empty { padding: 24px 8px; text-align: center; font-size: 13px; }
.perm-node { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.perm-node-label { font-size: 13px; }
.perm-node-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: var(--el-text-color-secondary); }
.perm-node-count { font-size: 12px; color: var(--el-text-color-placeholder); }
</style>
