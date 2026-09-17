<template>
  <div class="page-wrap">
    <div class="kt-card placeholder">
      <el-icon :size="46" color="var(--kt-muted)"><component :is="icon" /></el-icon>
      <h3>{{ title }}（二期规划）</h3>
      <p class="text-muted">{{ desc }}</p>
      <el-empty :image-size="0" description="" />
      <div class="items">
        <div v-for="(it, i) in items" :key="i" class="item">
          <el-icon color="var(--kt-brand)"><CircleCheck /></el-icon><span>{{ it }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const key = computed(() => route.path)

const plan = computed(() =>
  key.value.startsWith('/message')
    ? {
        title: '消息推送',
        icon: 'Bell',
        desc: '面向小程序用户的订阅消息 / 运营通知推送管理',
        items: ['微信订阅消息模板管理（模板 ID、参数说明）', '运营推送：选择受众（全部 / 指定用户）、推送记录与回执', '与小程序端 notifyGlucose / notifyMeal / notifyNews 提醒设置联动']
      }
    : {
        title: 'AI 服务配置',
        icon: 'MagicStick',
        desc: '拍照估糖、食物识别与 AI 对话相关服务参数管理',
        items: ['食物识别 / 血糖估算服务开关与调用额度监控', '估算参数与提示词维护（如估算值标注、置信度阈值）', 'AI 对话日志检索与审计（chat_message）']
      }
)
const title = computed(() => plan.value.title)
const desc = computed(() => plan.value.desc)
const icon = computed(() => plan.value.icon)
const items = computed(() => plan.value.items)
</script>

<style scoped>
.placeholder { display: flex; flex-direction: column; align-items: center; padding: 64px 24px; gap: 8px; text-align: center; }
.items { display: flex; flex-direction: column; gap: 10px; text-align: left; margin-top: 12px; color: var(--kt-muted); }
.item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
</style>
