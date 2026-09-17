<template>
  <div class="page-wrap">
    <div class="head">
      <h2 class="page-title">系统参数</h2>
      <div>
        <el-button :icon="RefreshLeft" @click="load">重置为当前配置</el-button>
        <el-button type="primary" :icon="Check" :loading="saving" @click="save">保存配置</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="12">
        <div class="kt-card mb16">
          <div class="block-title">血糖分级阈值（与小程序端分类着色一致）</div>
          <p class="text-muted desc">
            后台阈值将下发小程序端：低于 lowDanger 或 ≥ dangerStart 为需关注(红)；≥ warnStart 为偏高(橙)；其余为达标(绿)。
          </p>
          <el-form label-width="180px">
            <el-form-item label="低血糖阈值 (mmol/L)">
              <el-input-number v-model="cfg.glucose.lowDanger" :min="1" :max="6" :precision="1" />
            </el-form-item>
            <el-form-item label="偏高预警起始值">
              <el-input-number v-model="cfg.glucose.warnStart" :min="5" :max="9" :precision="1" />
            </el-form-item>
            <el-form-item label="危险起始值">
              <el-input-number v-model="cfg.glucose.dangerStart" :min="8" :max="15" :precision="1" />
            </el-form-item>
          </el-form>
        </div>

        <div class="kt-card mb16">
          <div class="block-title">小程序端默认设置</div>
          <el-form label-width="180px">
            <el-form-item label="默认主题">
              <el-radio-group v-model="cfg.defaults.theme">
                <el-radio-button value="green">健康绿</el-radio-button>
                <el-radio-button value="teal">清新青</el-radio-button>
                <el-radio-button value="simple">极简灰</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="默认字号">
              <el-select v-model="cfg.defaults.fontSize" style="width: 160px">
                <el-option label="较大" value="较大" />
                <el-option label="标准" value="标准" />
                <el-option label="较小" value="较小" />
              </el-select>
            </el-form-item>
            <el-form-item label="默认提醒开关">
              <div class="switches">
                <el-switch v-model="cfg.defaults.notifyGlucose" active-text="血糖提醒" />
                <el-switch v-model="cfg.defaults.notifyMeal" active-text="饮食记录提醒" />
                <el-switch v-model="cfg.defaults.notifyNews" active-text="资讯推送" />
              </div>
            </el-form-item>
          </el-form>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="kt-card mb16">
          <div class="block-title">协议与文案配置（展示于小程序对应页面）</div>
          <el-form label-position="top">
            <el-form-item label="免责声明（disclaimer 页）">
              <el-input v-model="cfg.text.disclaimer" type="textarea" :rows="3" />
            </el-form-item>
            <el-form-item label="用户协议（settings 相关页）">
              <el-input v-model="cfg.text.agreement" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="关于我们（about 页）">
              <el-input v-model="cfg.text.about" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="公告（首页/通知）">
              <el-input v-model="cfg.text.announcement" type="textarea" :rows="2" />
            </el-form-item>
          </el-form>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, RefreshLeft } from '@element-plus/icons-vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { SysConfig } from '@/types'

const auth = useAuthStore()
const saving = ref(false)
const cfg = reactive<SysConfig>({
  glucose: { lowDanger: 3.9, warnStart: 7.8, dangerStart: 10 },
  text: { disclaimer: '', agreement: '', about: '', announcement: '' },
  defaults: { theme: 'green', fontSize: '较大', notifyGlucose: true, notifyMeal: true, notifyNews: false }
})

async function load() {
  const data = await api.getConfig()
  cfg.glucose = { ...data.glucose }
  cfg.text = { ...data.text }
  cfg.defaults = { ...data.defaults }
}
onMounted(load)

async function save() {
  saving.value = true
  await api.saveConfig(JSON.parse(JSON.stringify(cfg)))
  if (auth.account) api.writeLog(auth.account.username, auth.account.role, '系统', '更新系统参数', '血糖阈值/文案/默认设置')
  saving.value = false
  ElMessage.success('配置已保存（演示数据）')
}
</script>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 18px; }
.block-title { font-weight: 600; margin-bottom: 12px; }
.desc { font-size: 12px; margin-top: 0; }
.switches { display: flex; gap: 20px; }
</style>
