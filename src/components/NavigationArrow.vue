<template>
  <svg
    class="navigation-arrow"
    :class="{ 'is-back': back }"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M4 19v-6a6 6 0 0 1 6-6h10M15 2l5 5-5 5" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{ back?: boolean }>()
</script>

<style scoped>
.navigation-arrow { width: 1em; height: 1em; margin-right: 6px; flex-shrink: 0; }
.navigation-arrow.is-back { transform: scaleX(-1); }
</style>
