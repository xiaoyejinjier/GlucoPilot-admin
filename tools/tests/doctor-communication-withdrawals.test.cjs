const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{parse}=require('@vue/compiler-sfc')
const root=path.resolve(__dirname,'../..'),tick=()=>new Promise(r=>setImmediate(r))
function component(name,overrides={}){
 const state={token:'one',props:{id:'8',enabled:true},unmount:[],mounted:[],timers:new Map(),gets:[],posts:[],revoked:[],watchers:[]}
 const api={get:async(url,options)=>{state.gets.push(url);if(overrides.get)return overrides.get(url,options);return url.endsWith('/images')?[]:{records:[{id:'1',content:'患者补充',mine:false,senderRole:'PATIENT'}],canSend:true,hasMore:false}},post:async(url,body)=>{state.posts.push({url,body});if(overrides.post)return overrides.post(url,body);return{id:'2',content:body.content,mine:true}}}
 const deps={'vue':{ref:value=>({value}),watch:(_fn,callback,options)=>{state.watchers.push(callback);if(options?.immediate)callback()},onBeforeUnmount:fn=>state.unmount.push(fn),onMounted:fn=>state.mounted.push(fn)},'@/utils/request':{...api,getAccessToken:()=>state.token},'@/utils/format':{fmtTime:x=>x},'element-plus':{ElMessage:{success(){},warning(){},error(){}},ElMessageBox:{confirm:async()=>true}},'@/api/withdrawals':{withdrawalApi:{ownSummary:async()=>({eligible:true,availableCents:101,frozenCents:0}),ownList:async()=>({records:[]}),apply:async(amount,key)=>{state.posts.push({amount,key});if(overrides.apply)return overrides.apply(amount,key)}}}}
 const source=parse(fs.readFileSync(path.join(root,`src/views/doctors/${name}.vue`),'utf8')).descriptor.scriptSetup.content
 const exports=name==='DoctorConversation'?'photos,messages,text,error,photoError,canSend,send,load,loadMessages':'summary,rows,amount,error,apply,load'
 const compiled=ts.transpileModule(source+`\nmodule.exports={${exports}}`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 const mod={exports:{}};vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require:key=>{assert.ok(deps[key],key);return deps[key]},defineProps:()=>state.props,document:{visibilityState:'visible'},URL:{createObjectURL:()=>`blob:private-${state.gets.length}`,revokeObjectURL:url=>state.revoked.push(url)},setInterval:(fn,ms)=>{const id=state.timers.size+1;state.timers.set(id,{fn,ms});return id},clearInterval:id=>state.timers.delete(id)})
 state.mounted.forEach(fn=>fn());return{...mod.exports,state,dispose(){state.unmount.forEach(fn=>fn())}}
}
test('医生交流按5秒增量读取，回复重试保留编号，不触发问诊单或扣款接口',async()=>{
 let first=true
 const p=component('DoctorConversation',{post:async(_url,body)=>{if(first){first=false;throw Error('offline')}return{id:'2',content:body.content,mine:true}}})
 await tick();assert.equal(p.messages.value.length,1);assert.equal(p.state.timers.size,1)
 const timer=[...p.state.timers.values()][0];assert.equal(timer.ms,5000);timer.fn();await tick();assert.match(p.state.gets.at(-1),/afterId=1/)
 p.text.value='请补充具体情况';await p.send();assert.equal(p.text.value,'请补充具体情况');await p.send()
 assert.equal(p.state.posts[0].body.clientRequestId,p.state.posts[1].body.clientRequestId);assert.match(p.state.posts[0].url,/\/messages$/)
 assert.equal(p.messages.value.length,2);p.dispose();assert.equal(p.state.timers.size,0)
})
test('旧医生会话的迟到消息不更新新账号，旧输入不能由新账号发送',async()=>{
 let resolve
 const p=component('DoctorConversation',{get:async url=>url.endsWith('/images')?[]:new Promise(done=>{resolve=done})})
 await tick();p.state.token='two';resolve({records:[{id:'1',content:'旧患者资料'}],canSend:true});await tick()
 assert.equal(p.messages.value.length,0);p.canSend.value=true;p.text.value='旧输入';await p.send();assert.equal(p.state.posts.length,0);p.dispose()
})
test('关闭详情后迟到的健康图片blob被释放，不显示到其他问诊',async()=>{
 let resolve
 const p=component('DoctorConversation',{get:async(url,options)=>options?.responseType==='blob'?new Promise(done=>{resolve=done}):url.endsWith('/images')?[{url:'/admin/v1/doctor/consultations/8/images/10'}]:{records:[],canSend:true}})
 await tick();p.dispose();resolve({private:true});await tick();assert.equal(p.photos.value.length,0);assert.equal(p.state.revoked.length,1)
})
test('医生提现以整数分申请，失败重试保留编号且切换账号不能提交旧金额',async()=>{
 let first=true;const p=component('DoctorWithdrawals',{apply:async()=>{if(first){first=false;throw Error('offline')}}})
 await tick();p.amount.value='1.01';await p.apply();assert.equal(p.amount.value,'1.01');await p.apply()
 assert.equal(p.state.posts[0].amount,101);assert.equal(p.state.posts[0].key,p.state.posts[1].key)
 p.amount.value='0.01';p.state.token='two';await p.apply();assert.equal(p.state.posts.length,2);p.dispose()
})
