<template>
  <div class="stat-card">
    <div class="stat-icon" :style="{ background: soft, color: color }">
      <el-icon :size="20"><component :is="icon" /></el-icon>
    </div>
    <div class="stat-body">
      <div class="stat-label">{{ label }}</div>
      <div class="stat-value">{{ value }}</div>
      <div v-if="hint" class="stat-hint">{{ hint }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  icon: string
  color?: string
  soft?: string
  hint?: string
}>()
</script>

<style scoped>
.stat-card {
  background: var(--kt-surface);
  border: 1px solid var(--kt-line);
  border-radius: var(--kt-radius);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 92px;
}
.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.stat-label { font-size: 13px; color: var(--kt-muted); }
.stat-value { font-size: 26px; font-weight: 700; color: var(--kt-ink); line-height: 1.3; }
.stat-hint { font-size: 12px; color: var(--kt-muted); }
</style>
