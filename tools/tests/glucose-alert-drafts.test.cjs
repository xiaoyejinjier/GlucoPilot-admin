const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const vue = require('vue')
const root = path.resolve(__dirname, '../..')
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return { promise, resolve, reject } }
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function storage() {
  const values = new Map()
  return { values, getItem: key => values.get(key) || null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) }
}
function storeModule(session) {
  const module = { exports: {} }
  vm.runInNewContext(compile(fs.readFileSync(path.join(root,'src/utils/glucose-alert-drafts.ts'),'utf8')), {
    module, exports: module.exports, window: { sessionStorage: session }
  })
  return module.exports
}
const event = (id='10', extra={}) => ({ id, userId:'30', nickname:'糖友', recordDate:'2026-11-04', nodeCode:'after_breakfast', nodeName:'早餐后',
  glucoseValue:12.6, recordedAt:'2026-11-04T08:00:00.000', version:'0', status:'PENDING', note:null, userReply:null, ...extra })
function harness(options={}) {
  const session = options.storage || storage(), hooks = [], mounted = []
  const state = { token:'admin-token', requests:[], saves:[], loads:0, errors:[], successes:[], warnings:[], confirmations:0 }
  const auth = vue.reactive({ account:{id:options.owner || 1,username:'admin'}, hasPermission:()=>options.permission !== false })
  const servers = new Map([['10',event()],['11',event('11',{userId:'31'})]])
  const deps = {
    vue:{...vue,onMounted:fn=>mounted.push(fn),onBeforeUnmount:fn=>hooks.push(fn)},
    'element-plus':{ElMessage:{error:v=>state.errors.push(v),warning:v=>state.warnings.push(v),success:v=>state.successes.push(v)},
      ElMessageBox:{confirm:async()=>{state.confirmations++;if(options.cancelDiscard)throw Error('cancel')}}},
    '@element-plus/icons-vue':{},'@/components/TablePagination.vue':{},
    '@/stores/auth':{useAuthStore:()=>auth},'@/config':{adminConfig:{baseUrl:'',useMock:false}},
    '@/utils/request':{getAccessToken:()=>state.token},'@/utils/glucose-alert-drafts':storeModule(session),
    '@/composables/useServerPagination':{useServerPagination:()=>({page:{pageNum:1,pageSize:10,total:0},records:vue.ref([]),loading:vue.ref(false),
      pageSummary:vue.ref(''),load:async()=>state.loads++,search:async()=>{},changeSize(){},changePage(){}})},
    '@/api/glucose-alerts':{
      emptyAlertOverview:()=>({}),pageGlucoseAlerts:async()=>({records:[],total:0}),
      getGlucoseAlert:async id=>{
        state.requests.push(id)
        if(options.get)return options.get(id,servers)
        return {event:{...servers.get(id)},history:[]}
      },
      handleGlucoseAlert:async (before,status,note,userReply)=>{
        state.saves.push({event:{...before},status,note,userReply})
        if(options.save)return options.save(before,status,note,userReply)
        const current=servers.get(before.id)
        if(current.glucoseValue!==before.glucoseValue || current.recordedAt!==before.recordedAt || current.version!==before.version)
          throw Object.assign(new Error('血糖记录已更新，请刷新后处理最新数据'),{code:40900})
        servers.set(before.id,{...current,status,note,userReply,version:String(Number(current.version)+1)})
      }
    }
  }
  const source=fs.readFileSync(path.join(root,'src/views/users/GlucoseAlertsView.vue'),'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const module={exports:{}},scope=vue.effectScope()
  scope.run(()=>vm.runInNewContext(compile(source+'\nmodule.exports={openDetail,refreshAll,save,beforeClose,discardDraft,detail,activeId,note,userReply,handlingStatus,currentDraft,needsRefresh,draftStorageFailed,detailError,detailLoading,saving,drafts};'),{
    module,exports:module.exports,Error,require:name=>{assert.ok(deps[name],name);return deps[name]}
  }))
  return {...module.exports,session,state,auth,servers,mount:()=>mounted.forEach(fn=>fn()),unmount(){hooks.forEach(fn=>fn());scope.stop()}}
}

test('12.6更正为12.5后冲突保留建议，显式刷新恢复输入并用最新快照提交',async()=>{
  const p=harness();await p.openDetail('10')
  p.note.value='已联系核对原始测量';p.userReply.value='请核对本次记录';p.handlingStatus.value='RESOLVED'
  p.servers.set('10',event('10',{glucoseValue:12.5,recordedAt:'2026-11-04T08:10:00.000'}))
  await p.save()
  assert.match(p.state.errors[0],/血糖记录已更新/)
  assert.equal(p.needsRefresh.value,true);assert.equal(p.note.value,'已联系核对原始测量')
  assert.equal(p.userReply.value,'请核对本次记录');assert.equal(p.state.requests.length,1,'冲突不自动覆盖详情表单')
  await p.save();assert.equal(p.state.saves.length,1,'刷新前不能重复使用旧快照提交')
  await p.refreshAll()
  assert.equal(p.detail.value.event.glucoseValue,12.5);assert.equal(p.needsRefresh.value,false)
  assert.equal(p.note.value,'已联系核对原始测量');assert.equal(p.userReply.value,'请核对本次记录')
  await p.save()
  assert.equal(p.state.saves[1].event.glucoseValue,12.5)
  assert.equal(p.state.saves[1].event.recordedAt,'2026-11-04T08:10:00.000')
  assert.equal(p.currentDraft.value,null);assert.equal(p.drafts.active(),'')
  p.unmount()
})

test('浏览器刷新重新挂载后自动打开未提交记录，恢复建议但采用最新版本',async()=>{
  const session=storage(),first=harness({storage:session});await first.openDetail('10')
  first.note.value='刷新前写的建议';first.userReply.value='公开回复草稿';first.unmount()
  const next=harness({storage:session});next.servers.set('10',event('10',{glucoseValue:12.5,version:'3'}))
  next.mount();await tick()
  assert.equal(next.activeId.value,'10');assert.equal(next.note.value,'刷新前写的建议')
  assert.equal(next.userReply.value,'公开回复草稿');assert.equal(next.detail.value.event.version,'3')
  next.unmount()
})

test('管理员一先提交后管理员二收到版本冲突原文，刷新保留自己的建议',async()=>{
  const message='事件已被其他管理员处理，请刷新后重试'
  const p=harness({owner:3,save:async()=>{throw Object.assign(new Error(message),{code:40900})}})
  await p.openDetail('10');p.note.value='管理员二仍在填写的建议'
  p.servers.set('10',event('10',{status:'PROCESSING',version:'1',note:'管理员一提交的建议'}))
  await p.save()
  assert.equal(p.state.errors[0],message);assert.equal(p.needsRefresh.value,true)
  assert.equal(p.note.value,'管理员二仍在填写的建议')
  await p.refreshAll()
  assert.equal(p.detail.value.event.version,'1')
  assert.equal(p.detail.value.event.note,'管理员一提交的建议')
  assert.equal(p.note.value,'管理员二仍在填写的建议')
  assert.equal(p.needsRefresh.value,false);p.unmount()
})

test('不同记录草稿隔离，其他管理员账号不能恢复或收到迟到的旧详情',async()=>{
  const p=harness();await p.openDetail('10');p.note.value='记录10的备注'
  await p.openDetail('11');assert.equal(p.note.value,'');p.note.value='记录11的备注'
  await p.openDetail('10');assert.equal(p.note.value,'记录10的备注')
  const other=harness({storage:p.session,owner:2});other.mount();await tick()
  assert.equal(other.state.requests.length,0)
  const late=deferred(),racing=harness({get:()=>late.promise})
  const opening=racing.openDetail('10');racing.auth.account={id:2,username:'other'}
  late.resolve({event:event(),history:[]});await opening
  assert.equal(racing.detail.value,null);assert.equal(racing.currentDraft.value,null)
  p.unmount();other.unmount();racing.unmount()
})

test('记录已恢复正常或删除时继续显示草稿，不再提交不存在的异常',async()=>{
  let unavailable=false
  const p=harness({get:async()=>{if(unavailable)throw Object.assign(new Error('当前异常已不存在'),{code:40400});return {event:event(),history:[]}}})
  await p.openDetail('10');p.note.value='尚未提交的联系建议';unavailable=true
  await p.openDetail('10')
  assert.equal(p.detail.value,null);assert.match(p.detailError.value,/已不存在/)
  assert.equal(p.currentDraft.value.note,'尚未提交的联系建议')
  await p.save();assert.equal(p.state.saves.length,0);p.unmount()
})

test('另一管理员已结束事件时保留草稿参考，不覆盖其内部备注和状态',async()=>{
  const p=harness();await p.openDetail('10');p.note.value='我原先输入的备注';p.userReply.value='我的公开回复'
  p.servers.set('10',event('10',{status:'CLOSED',version:'4',note:'另一管理员的处理结论',userReply:'已有回复'}))
  await p.openDetail('10')
  assert.equal(p.currentDraft.value.note,'我原先输入的备注')
  assert.equal(p.note.value,'另一管理员的处理结论');assert.equal(p.handlingStatus.value,'CLOSED')
  assert.equal(p.userReply.value,'我的公开回复')
  await p.save();assert.equal(p.state.saves[0].note,'另一管理员的处理结论');p.unmount()
})

test('主动放弃需确认并恢复服务端内容；存储失败仍保留同页刷新前的输入',async()=>{
  const p=harness();await p.openDetail('10');p.note.value='将放弃'
  await p.discardDraft();assert.equal(p.state.confirmations,1);assert.equal(p.currentDraft.value,null);assert.equal(p.note.value,'')
  p.unmount()
  const broken=storage();broken.setItem=()=>{throw Error('storage full')}
  const fallback=harness({storage:broken});await fallback.openDetail('10');fallback.note.value='请不要丢失'
  assert.equal(fallback.draftStorageFailed.value,true)
  await fallback.openDetail('10');assert.equal(fallback.note.value,'请不要丢失');fallback.unmount()
})

test('临时草稿过期和损坏时安全忽略，并按后端/账号隔离',()=>{
  const memory=storage();let now=1000,owner='server-a:user-1'
  const factory=storeModule(memory).createGlucoseAlertDrafts
  const drafts=factory(()=>owner,()=>memory,()=>now)
  const draft={eventId:'10',userId:'30',glucoseValue:12.6,recordedAt:'time',version:'0',status:'PROCESSING',note:'草稿',userReply:'',updatedAt:now}
  assert.equal(drafts.save(draft),true);assert.equal(drafts.active(),'10')
  owner='server-a:user-2';assert.equal(drafts.active(),'')
  owner='server-b:user-1';assert.equal(drafts.get('10'),null)
  owner='server-a:user-1';now+=24*60*60*1000;assert.equal(drafts.get('10'),null)
  memory.values.set([...memory.values.keys()][0],'{bad json');assert.equal(drafts.get('10'),null)
})
