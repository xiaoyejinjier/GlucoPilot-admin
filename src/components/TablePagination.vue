<template>
  <div class="table-pagination">
    <span class="page-summary">{{ summary }}</span>
    <el-pagination
      :current-page="pageNum"
      :page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      :disabled="disabled"
      background
      layout="total, sizes, prev, pager, next, jumper"
      @update:current-page="emit('pageChange', $event)"
      @update:page-size="emit('sizeChange', $event)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  pageNum: number
  pageSize: number
  total: number
  summary: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  pageChange: [pageNum: number]
  sizeChange: [pageSize: number]
}>()
</script>

<style scoped>
.table-pagination {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--kt-line);
}
.page-summary { color: var(--kt-muted); font-size: 12px; }
.table-pagination :deep(.el-pagination) { max-width: 100%; overflow-x: auto; }
</style>
