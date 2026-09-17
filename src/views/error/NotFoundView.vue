<template>
  <div class="not-found">
    <div class="code">404</div>
    <p class="text-muted">页面不存在或没有访问权限</p>
    <el-button type="primary" @click="$router.push('/dashboard')">返回数据看板</el-button>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.not-found { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
.code { font-size: 64px; font-weight: 800; color: var(--kt-brand); }
</style>
