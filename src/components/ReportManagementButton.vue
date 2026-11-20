<template>
  <el-badge v-if="available" is-dot :hidden="!hasPending" class="report-management-entry">
    <el-button
      :aria-label="hasPending ? '举报管理，有待处理举报' : '举报管理'"
      :title="hasPending ? '有待处理举报' : '查看举报管理'"
      @click="openReports"
    ><NavigationArrow />举报管理</el-button>
  </el-badge>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import NavigationArrow from '@/components/NavigationArrow.vue'
import { useAuthStore } from '@/stores/auth'
import { getAccessToken } from '@/utils/request'
import { WORK_REMINDERS_UPDATED, pendingReportCount, workReminderTarget } from '@/utils/work-reminders'

const auth = useAuthStore(), router = useRouter()
const available = computed(() => auth.isLoggedIn && auth.hasPermission('content:news:list'))
const pending = ref(0)
const hasPending = computed(() => pending.value > 0)

function sync() {
  pending.value = available.value ? pendingReportCount(auth.account?.id, getAccessToken()) : 0
}
function openReports() {
  if (available.value) void router.push(workReminderTarget('REPORT'))
}
watch(() => [auth.account?.id, auth.account?.permissions?.join('|'), getAccessToken(), available.value], sync, { immediate: true })
onMounted(() => {
  window.addEventListener(WORK_REMINDERS_UPDATED, sync)
  sync()
})
onBeforeUnmount(() => window.removeEventListener(WORK_REMINDERS_UPDATED, sync))
</script>

<style scoped>
.report-management-entry { display: inline-flex; }
.report-management-entry :deep(.el-badge__content.is-fixed.is-dot) { top: 2px; right: 8px; }
</style>
