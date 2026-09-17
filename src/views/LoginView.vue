<template>
  <div class="login-page">
    <div class="login-left">
      <div class="brand">
        <span class="brand-dot"></span>
        <div>
          <div class="title">控糖健康管理系统</div>
          <div class="sub">AI控糖助手 · PC 管理后台</div>
        </div>
      </div>
      <div class="slogan">
        <p class="slogan-1">记录 · 分析 · 建议 · 追踪</p>
        <p class="slogan-2">内容运营、用户服务与系统管理一站式工作台</p>
      </div>
      <ul class="points">
        <li><el-icon><Document /></el-icon>资讯 / 轮播 / 素材内容管理</li>
        <li><el-icon><Apple /></el-icon>食物营养库维护与估糖数据沉淀</li>
        <li><el-icon><ChatLineSquare /></el-icon>用户反馈处理与导出任务跟踪</li>
        <li><el-icon><Lock /></el-icon>角色权限与操作审计</li>
      </ul>
    </div>

    <div class="login-right">
      <el-card class="login-card" shadow="never">
        <h2 class="card-title">管理后台登录</h2>
        <p class="card-desc">请使用管理员分配的账号登录</p>
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="onSubmit">
          <el-form-item label="账号" prop="username">
            <el-input v-model="form.username" placeholder="请输入账号" size="large" :prefix-icon="User" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" size="large" :prefix-icon="Lock" />
          </el-form-item>
          <el-button type="primary" size="large" class="submit" :loading="loading" @click="onSubmit">登 录</el-button>
        </el-form>
        <el-divider><span class="divider-text">演示账号（点击快速填入）</span></el-divider>
        <div class="demo-accounts">
          <el-tag class="acc" effect="plain" @click="fill('admin', 'admin123')">管理员 admin/admin123</el-tag>
          <el-tag class="acc" effect="plain" type="success" @click="fill('editor01', 'editor123')">运营 editor01/editor123</el-tag>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ username: '', password: '' })
const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

function fill(u: string, p: string) {
  form.username = u
  form.password = p
}

async function onSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const acc = await auth.login(form.username, form.password)
      ElMessage.success(`欢迎回来，${acc.nickname}`)
      router.push((route.query.redirect as string) || '/dashboard')
    } catch (e) {
      ElMessage.error((e as Error).message || '登录失败')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-page { display: flex; height: 100%; }
.login-left { flex: 1.15; background: linear-gradient(150deg, var(--kt-brand-soft), #ffffff 70%); padding: 48px 56px; display: flex; flex-direction: column; justify-content: center; }
.brand { display: flex; align-items: center; gap: 14px; }
.brand-dot { width: 18px; height: 18px; border-radius: 50%; background: var(--kt-brand); box-shadow: 0 0 0 6px var(--kt-brand-soft); }
.title { font-size: 26px; font-weight: 800; color: var(--kt-ink); }
.sub { font-size: 13px; color: var(--kt-muted); margin-top: 4px; }
.slogan { margin: 48px 0 28px; }
.slogan-1 { font-size: 30px; font-weight: 700; color: var(--kt-ink); margin: 0; }
.slogan-2 { font-size: 15px; color: var(--kt-muted); margin: 12px 0 0; }
.points { list-style: none; padding: 0; margin: 0; }
.points li { display: flex; align-items: center; gap: 10px; color: var(--kt-ink); margin: 14px 0; font-size: 14px; }
.points li .el-icon { color: var(--kt-brand); }
.login-right { flex: 1; display: flex; align-items: center; justify-content: center; background: var(--kt-bg); }
.login-card { width: 380px; border-radius: var(--kt-radius); border-color: var(--kt-line); }
.card-title { margin: 0 0 6px; font-size: 20px; }
.card-desc { margin: 0 0 22px; color: var(--kt-muted); font-size: 13px; }
.submit { width: 100%; font-weight: 600; letter-spacing: 4px; }
.divider-text { font-size: 12px; color: var(--kt-muted); }
.demo-accounts { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.acc { cursor: pointer; }
</style>
