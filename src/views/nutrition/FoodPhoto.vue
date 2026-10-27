<template>
  <el-image
    :key="source"
    :src="source"
    :alt="`${food.name || '食物'}图片`"
    :fit="preview ? 'contain' : 'cover'"
    :preview-src-list="preview ? [source] : []"
    preview-teleported
    hide-on-click-modal
    @error="onImageError"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { foodImageApi } from '@/api/food-images'
import { getAccessToken } from '@/utils/request'
import type { FoodItem } from '@/types'
import { getBundledFoodImage, isUploadedFoodImage, resolveFoodImage } from './foodImages'

const props = withDefaults(defineProps<{
  food: Pick<FoodItem, 'name' | 'categoryName' | 'image' | 'reviewImage'>
  preferReview?: boolean
  preview?: boolean
}>(), { preferReview: true, preview: false })

const photo = ref('')
const publicFailed = ref(false)
const source = computed(() => photo.value || (publicFailed.value
  ? getBundledFoodImage(props.food.name, props.food.categoryName)
  : resolveFoodImage(props.food)))

watch(() => props.preferReview && !isUploadedFoodImage(props.food.image) ? props.food.reviewImage : '', async (path, _previous, onCleanup) => {
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
    // 原食品/照片已删除或读取失败时沿用现有配图；审核和上下架不更换照片。
  }
}, { immediate: true })

watch(() => props.food.image, () => { publicFailed.value = false })

function onImageError() {
  if (photo.value) photo.value = ''
  else publicFailed.value = true
}
</script>
