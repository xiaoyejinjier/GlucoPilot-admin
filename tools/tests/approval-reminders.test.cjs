const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{parse}=require('@vue/compiler-sfc')
const root=path.resolve(__dirname,'../..')
function reviewPage(kind){
 const state={loads:[],watchers:[],mounted:[],reminders:0},route={query:{reminder:'1'}},token='session'
 const api={page:async(...args)=>{state.loads.push(args);return{records:[],total:0}},list:async(...args)=>{state.loads.push(args);return{records:[],total:0}},review:async()=>({})}
 const auth={role:'admin',hasPermission:()=>true}
 const deps={vue:{ref:value=>({value}),watch:(getter,callback)=>state.watchers.push(callback),onMounted:callback=>state.mounted.push(callback),onBeforeUnmount(){}},'vue-router':{useRoute:()=>route},'element-plus':{ElMessage:{success(){},warning(){},error(){}},ElMessageBox:{}},'@/utils/request':{getAccessToken:()=>token},'@/utils/work-reminders':{refreshWorkReminders:()=>state.reminders++},'@/components/TablePagination.vue':{},'@/api/consultations':{consultationApi:api},'@/api/withdrawals':{withdrawalApi:api},'@/utils/format':{fmtTime:()=>''},'@/utils/withdrawal':{withdrawalStatus:()=>''}}
 deps.vue.computed=getter=>({get value(){return getter()}})
 deps['vue-router'].useRouter=()=>({push(){}})
 deps['@/stores/auth']={useAuthStore:()=>auth}
 const file=kind==='doctor'?'users/ConsultationManagementView.vue':'doctors/WithdrawalManagementView.vue'
 const source=parse(fs.readFileSync(path.join(root,'src/views',file),'utf8')).descriptor.scriptSetup.content
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(source+`\nmodule.exports={status,pageNum,visible,selected,note,save:${kind==='doctor'?'submit':'review'}}`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>{assert.ok(deps[name],name);return deps[name]}})
 return{...module.exports,state,route}
}
for(const kind of ['doctor','withdrawal']){
 test(`${kind}提醒进入已打开的审核页面时重置旧状态与页码`,async()=>{
  const p=reviewPage(kind);p.status.value='APPROVED';p.pageNum.value=4;p.visible.value=true
  p.state.watchers[0]('2');await Promise.resolve()
  assert.equal(p.status.value,'PENDING');assert.equal(p.pageNum.value,1);assert.equal(p.visible.value,false)
  const args=p.state.loads[0];assert.equal(kind==='doctor'?args[0]:args[2],'PENDING')
 })
 test(`${kind}审核成功立即刷新顶部提醒`,async()=>{
  const p=reviewPage(kind);p.selected.value={userId:'1',orderNo:'WD1',version:0};p.note.value='审核通过'
  await p.save();assert.equal(p.state.reminders,1);assert.equal(p.state.loads.length,1)
 })
}
