<script setup lang="ts">
import {ref,watch,onBeforeUnmount} from 'vue'
import {get,post} from '@/utils/request'
import {getAccessToken} from '@/utils/request'
import {fmtTime} from '@/utils/format'
const props=defineProps<{id:string;enabled:boolean}>()
interface Message{id:string;content:string;mine:boolean;senderRole:string;createdAt:string}
interface Messages{records:Message[];canSend:boolean;hasMore:boolean}
const photos=ref<string[]>([]),messages=ref<Message[]>([]),text=ref(''),error=ref(''),sending=ref(false),canSend=ref(false),hasEarlier=ref(false),loading=ref(false)
const photoError=ref('')
let alive=true,epoch=0,timer:ReturnType<typeof setInterval>|null=null,busy=false,attempt='',attemptText=''
const scopeToken=getAccessToken()
const root=()=>`/admin/v1/doctor/consultations/${encodeURIComponent(props.id)}`
const valid=(token:string,run:number)=>alive&&props.enabled&&scopeToken===token&&getAccessToken()===token&&run===epoch
function clear(){epoch++;if(timer)clearInterval(timer);timer=null;busy=false;photos.value.forEach(URL.revokeObjectURL);photos.value=[];messages.value=[];text.value='';attempt='';attemptText='';canSend.value=false;error.value='';photoError.value='';sending.value=false}
function merge(rows:Message[]){const map=new Map(messages.value.map(r=>[r.id,r]));rows.forEach(r=>map.set(r.id,r));messages.value=[...map.values()].sort((a,b)=>a.id.length-b.id.length||a.id.localeCompare(b.id))}
async function loadMessages(older=false){if(busy||!props.enabled)return;busy=true;const token=getAccessToken(),run=epoch
 const cursor=messages.value.length?(older?`&beforeId=${messages.value[0]!.id}`:`&afterId=${messages.value[messages.value.length-1]!.id}`):''
 try{const page=await get<Messages>(root()+'/messages?pageSize=30'+cursor);if(!valid(token,run))return;merge(page.records);canSend.value=page.canSend;if(older||!cursor)hasEarlier.value=page.hasMore;error.value=''}
 catch(e){if(valid(token,run))error.value=(e as Error).message}finally{if(valid(token,run))busy=false}}
async function load(){clear();if(!props.enabled)return;const token=getAccessToken(),run=epoch;loading.value=true
 try{const images=await get<{url:string;mediaId:string}[]>(root()+'/images');if(!valid(token,run))return
  const results=await Promise.allSettled(images.map(async p=>URL.createObjectURL(await get<Blob>(p.url,{responseType:'blob'}))))
  const local=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[])
  if(!valid(token,run)){local.forEach(URL.revokeObjectURL);return}photos.value=local
  if(results.some(r=>r.status==='rejected'))photoError.value='部分问诊图片加载失败，请重新打开详情重试'
 }catch(e){if(valid(token,run))photoError.value=(e as Error).message}finally{if(valid(token,run))loading.value=false}
 await loadMessages();if(valid(token,run))timer=setInterval(()=>{if(document.visibilityState==='visible')loadMessages()},5000)
}
async function send(){if(!canSend.value||sending.value||!text.value.trim()||scopeToken!==getAccessToken())return;const token=getAccessToken(),run=epoch,content=text.value.trim();sending.value=true
 if(!attempt||attemptText!==content){attempt=`reply_${Date.now()}_${Math.random().toString(36).slice(2,12)}`;attemptText=content}
 try{const saved=await post<Message>(root()+'/messages',{content,clientRequestId:attempt});if(valid(token,run)){merge([saved]);text.value='';attempt='';error.value=''}}
 catch(e){if(valid(token,run))error.value=(e as Error).message}finally{if(valid(token,run))sending.value=false}}
watch(()=>[props.id,props.enabled],load,{immediate:true});onBeforeUnmount(()=>{clear();alive=false})
</script>
<template><section v-if="enabled" v-loading="loading" class="doctor-conversation"><h4>患者补充图片</h4><el-alert v-if="photoError" :title="photoError" type="warning" :closable="false"/><div v-if="photos.length" class="photos"><el-image v-for="(src,index) in photos" :key="src" :src="src" :preview-src-list="photos" :initial-index="index" fit="cover" preview-teleported/></div><p v-else class="text-muted">暂无补充图片</p><h4>问诊交流</h4><el-button v-if="hasEarlier" link @click="loadMessages(true)">查看更早的交流</el-button><div class="message-list"><p v-if="!messages.length" class="text-muted">可回复患者的问题或请求补充情况，交流不代替正式问诊单。</p><div v-for="message in messages" :key="message.id" class="message" :class="{mine:message.mine}"><span>{{message.mine?'我':message.senderRole==='DOCTOR'?'接诊医生':'患者'}} · {{fmtTime(message.createdAt)}}</span><p>{{message.content}}</p></div></div><el-alert v-if="error" :title="error" type="error" :closable="false"/><div v-if="canSend" class="compose"><el-input v-model="text" type="textarea" :rows="3" maxlength="2000" show-word-limit :disabled="sending" placeholder="输入回复或请患者补充情况"/><el-button type="primary" :loading="sending" :disabled="!text.trim()" @click="send">发送回复</el-button></div></section></template>
<style scoped>.doctor-conversation{margin-top:22px;border-top:1px solid var(--kt-line);padding-top:10px}.photos{display:flex;gap:12px;flex-wrap:wrap}.photos .el-image{width:110px;height:110px;border-radius:12px}.message-list{max-height:340px;overflow:auto;margin:15px 0}.message{display:flex;flex-direction:column;align-items:flex-start;margin:14px 0}.message.mine{align-items:flex-end}.message span{color:var(--kt-muted);font-size:12px}.message p{max-width:95%;padding:12px 16px;border-radius:12px;background:#f1f5fb;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 0}.mine p{background:#e5efff;color:#315c96}.compose{display:flex;flex-direction:column;align-items:flex-end;gap:12px}</style>
