<template>
  <div class="review-photo">
    <video v-if="source && video" :src="source" controls preload="metadata" /><el-image v-else-if="source" :src="source" :preview-src-list="[source]" fit="contain" preview-teleported />
    <button v-else type="button" @click="load">{{ failed ? '媒体读取失败，点击重试' : '正在加载媒体…' }}</button>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { getAccessToken, request } from '@/utils/request'
const props = defineProps<{ articleId:string; mediaId:string; video?:boolean }>()
const source = ref(''), failed = ref(false)
let run = 0
function clear() { if (source.value) URL.revokeObjectURL(source.value); source.value = '' }
async function load() {
  const version = ++run, token = getAccessToken()
  clear(); failed.value = false
  try {
    const blob = await request<Blob>(`/admin/v1/community/articles/${encodeURIComponent(props.articleId)}/${props.video?'videos':'images'}/${encodeURIComponent(props.mediaId)}`, { responseType:'blob' })
    if (version !== run || token !== getAccessToken()) return
    source.value = URL.createObjectURL(blob)
  } catch { if (version === run) failed.value = true }
}
watch(() => [props.articleId,props.mediaId,props.video],load,{ immediate:true })
onBeforeUnmount(() => { ++run; clear() })
</script>
<style scoped>
.review-photo { min-width:0; border:1px solid var(--kt-line); border-radius:12px; overflow:hidden; background:var(--kt-bg); }
.review-photo video{width:100%;max-height:360px;display:block;background:#17212e}.review-photo :deep(.el-image) { width:100%; height:220px; display:block; }
button { width:100%; min-height:160px; color:var(--kt-muted); background:none; border:0; cursor:pointer; }
</style>
