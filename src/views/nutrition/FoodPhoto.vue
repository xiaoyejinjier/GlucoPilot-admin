<template>
  <img :src="source" :alt="`${food.name || '食物'}图片`" @error="onImageError" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { foodImageApi } from '@/api/food-images'
import { getAccessToken } from '@/utils/request'
import type { FoodItem } from '@/types'
import { getBundledFoodImage, resolveFoodImage } from './foodImages'

const props = withDefaults(defineProps<{
  food: Pick<FoodItem, 'name' | 'categoryName' | 'image' | 'reviewImage'>
  preferReview?: boolean
}>(), { preferReview: true })

const photo = ref('')
const publicFailed = ref(false)
const source = computed(() => photo.value || (publicFailed.value
  ? getBundledFoodImage(props.food.name, props.food.categoryName)
  : resolveFoodImage(props.food)))

watch(() => props.preferReview ? props.food.reviewImage : '', async (path, _previous, onCleanup) => {
  photo.value = ''
  publicFailed.value = false
  let active = true
  let objectUrl = ''
  onCleanup(() => {
    active = false
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    if (photo.value === objectUrl) photo.value = ''
  })
  if (!path) return
  const token = getAccessToken()
  try {
    const blob = await foodImageApi.review(path)
    if (!active || getAccessToken() !== token) return
    objectUrl = URL.createObjectURL(blob)
    photo.value = objectUrl
  } catch {
    // 删除、禁用、审核完成或读取失败时沿用现有配图，不影响审核表单。
  }
}, { immediate: true })

watch(() => props.food.image, () => { publicFailed.value = false })

function onImageError() {
  if (photo.value) photo.value = ''
  else publicFailed.value = true
}
</script>
