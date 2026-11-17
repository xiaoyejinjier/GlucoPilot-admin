const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const ts=require('typescript'),{parse}=require('@vue/compiler-sfc'),root=path.resolve(__dirname,'../..')
const tick=()=>new Promise(resolve=>setImmediate(resolve))
function transpile(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText}
function feed(){
  const state={token:'first',calls:[],reads:[],routes:[],timers:new Map(),listeners:new Map(),watchers:[],unmount:[],next:0},auth={account:{id:1,permissions:['feedback:manage','content:news:list']},isLoggedIn:true,hasPermission(code){return this.account?.permissions.includes(code)||false}}
  const doc={visibilityState:'visible',addEventListener:(name,fn)=>state.listeners.set(name,fn),removeEventListener:name=>state.listeners.delete(name)}
  const win={addEventListener:doc.addEventListener,removeEventListener:doc.removeEventListener}
  const polling={exports:{}};vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'src/utils/resource-monitor.ts'),'utf8')),{module:polling,exports:polling.exports,setTimeout:(fn,delay)=>{const id=++state.next;state.timers.set(id,{fn,delay});return id},clearTimeout:id=>state.timers.delete(id)})
  const targets={exports:{}};vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'src/utils/work-reminders.ts'),'utf8')),{module:targets,exports:targets.exports})
  const deps={vue:{ref:value=>({value}),computed:fn=>({get value(){return fn()}}),watch:(getter,fn,options)=>{state.watchers.push(fn);if(options?.immediate)fn()},onMounted:fn=>fn(),onBeforeUnmount:fn=>state.unmount.push(fn)},'element-plus':{ElMessage:{success(){},warning(){}}},'vue-router':{useRouter:()=>({push:target=>state.routes.push(target)})},'@element-plus/icons-vue':{},'@/stores/auth':{useAuthStore:()=>auth},'@/utils/request':{getAccessToken:()=>state.token},'@/utils/resource-monitor':polling.exports,'@/utils/work-reminders':{...targets.exports,WORK_REMINDERS_CHANGED:'changed'},'@/api/work-reminders':{workRemindersApi:{summary:()=>new Promise((resolve,reject)=>state.calls.push({resolve,reject})),read:revisions=>new Promise((resolve,reject)=>state.reads.push({resolve,reject,revisions}))}}}
  const source=parse(fs.readFileSync(path.join(root,'src/components/WorkReminders.vue'),'utf8')).descriptor.scriptSetup.content
  const module={exports:{}};vm.runInNewContext(transpile(source+'\nmodule.exports={summary,hasMessages,available,visible,loading,error,ready,open,refresh,markRead,reading};'),{module,exports:module.exports,document:doc,window:win,require:name=>{assert.ok(deps[name],name);return deps[name]}})
  return {...module.exports,state,auth,doc,dispose(){state.unmount.forEach(fn=>fn())}}
}
const data={total:3,items:[{type:'REPORT',title:'新举报',count:2,latestAt:'2026-10-23T12:30:00'},{type:'FEEDBACK',title:'新反馈',count:1,latestAt:'2026-10-23T12:20:00'}]}

test('管理员标记已读保留待办，作废在途旧统计，失败不消除红点',async()=>{
  const p=feed(),item={...data.items[0],revision:'a'.repeat(64),pendingCount:2}
  p.state.calls[0].resolve({total:2,items:[item]});await tick()
  p.refresh()
  const saving=p.markRead(item)
  assert.equal(p.reading.value,true);assert.equal(p.state.reads.length,1)
  assert.equal(p.state.reads[0].revisions.REPORT,item.revision)
  p.state.reads[0].resolve();await saving
  assert.equal(p.hasMessages.value,false);assert.equal(p.summary.value.items[0].pendingCount,2)
  p.state.calls[1].resolve({total:2,items:[item]});await tick()
  assert.equal(p.hasMessages.value,false,'旧轮询不能恢复已读红点')
  p.dispose()
  const failed=feed();failed.state.calls[0].resolve({total:2,items:[item]});await tick()
  const attempt=failed.markRead();failed.state.reads[0].reject(new Error('offline'));await attempt
  assert.equal(failed.summary.value.total,2);failed.dispose()
})

test('管理员切换账号丢弃旧已读回调，仅血糖查看权限也可看到更新并定位记录',async()=>{
  const p=feed(),item={type:'GLUCOSE_UPDATE',title:'血糖记录已更新',count:1,pendingCount:1,revision:'b'.repeat(64),recordId:'10'}
  p.auth.account={id:4,permissions:['health:alert:view']};p.state.token='health';p.state.watchers[0]()
  assert.equal(p.available.value,true)
  p.state.calls[1].resolve({total:1,items:[item]});await tick()
  p.open(item);assert.equal(p.state.routes[0].path,'/user-service/glucose-alerts')
  assert.equal(p.state.routes[0].query.recordId,'10')
  const attempt=p.markRead(item)
  p.auth.account={id:5,permissions:['health:alert:view']};p.state.token='other';p.state.watchers[0]()
  p.state.calls[2].resolve({total:1,items:[item]});await tick()
  p.state.reads[0].resolve();await attempt
  assert.equal(p.summary.value.total,1,'旧管理员的已读结果不影响新账号')
  p.dispose()
})

test('全局消息使用真实汇总，红点只随待办存在，消息点击跳到对应模块',async()=>{
  const p=feed();assert.equal(p.state.calls.length,1);assert.equal(p.hasMessages.value,false)
  p.state.calls[0].resolve(data);await tick();assert.equal(p.hasMessages.value,true);assert.equal(p.summary.value.total,3)
  p.visible.value=true;p.open(data.items[0]);assert.equal(p.visible.value,false);assert.equal(p.state.routes[0].path,'/content/community-reports');p.open(data.items[1]);assert.equal(p.state.routes[1].path,'/feedback')
  assert.equal([...p.state.timers.values()][0].delay,5000)
  p.refresh();p.state.calls[1].resolve({total:0,items:[]});await tick();assert.equal(p.hasMessages.value,false);assert.equal(p.summary.value.items.length,0);p.dispose()
})
test('轮询串行，隐藏暂停，处理后立即刷新，失败保留最后数据并显示错误',async()=>{
  const p=feed();p.refresh();p.refresh();assert.equal(p.state.calls.length,1);p.state.calls[0].resolve(data);await tick()
  p.state.listeners.get('changed')();assert.equal(p.state.calls.length,2);p.state.calls[1].reject(new Error('offline'));await tick();assert.equal(p.summary.value.total,3);assert.equal(p.error.value,'更新失败，显示上次结果')
  p.doc.visibilityState='hidden';p.state.listeners.get('visibilitychange')();assert.equal(p.state.timers.size,0);p.refresh();assert.equal(p.state.calls.length,2)
  p.doc.visibilityState='visible';p.state.listeners.get('visibilitychange')();assert.equal(p.state.calls.length,3);p.state.calls[2].resolve({total:0,items:[]});await tick();assert.equal(p.error.value,'');assert.equal(p.hasMessages.value,false);p.dispose()
})
test('退出、切换账号、卸载均清除旧消息并丢弃迟到响应',async()=>{
  const p=feed();p.state.token='second';p.auth.account={id:2,permissions:['feedback:manage']};p.state.watchers[0]();assert.equal(p.state.calls.length,2)
  p.state.calls[0].resolve(data);await tick();assert.equal(p.summary.value.total,0)
  p.state.calls[1].resolve({total:1,items:[data.items[1]]});await tick();assert.equal(p.summary.value.total,1)
  p.refresh();p.auth.account=null;p.auth.isLoggedIn=false;p.state.token='';p.state.watchers[0]();p.state.calls[2].resolve(data);await tick();assert.equal(p.available.value,false);assert.equal(p.summary.value.total,0);assert.equal(p.state.timers.size,0)
  p.dispose();assert.equal(p.state.listeners.size,0)
})
test('处理操作使在途旧统计失效，完成后立即重新请求，不闪回旧红点',async()=>{
  const p=feed();p.state.listeners.get('changed')();assert.equal(p.state.calls.length,1)
  p.state.calls[0].resolve(data);await tick();assert.equal(p.summary.value.total,0)
  const next=[...p.state.timers.values()][0];assert.equal(next.delay,0);next.fn();assert.equal(p.state.calls.length,2)
  p.state.calls[1].resolve({total:0,items:[]});await tick();assert.equal(p.hasMessages.value,false);assert.equal(p.ready.value,true);p.dispose()
})
test('待办跳转带刷新标识，同一模块再次点击也产生新导航',()=>{
  const source=fs.readFileSync(path.join(root,'src/utils/work-reminders.ts'),'utf8'),module={exports:{}}
  vm.runInNewContext(transpile(source),{module,exports:module.exports})
  const a=module.exports.workReminderTarget('FEEDBACK',100),b=module.exports.workReminderTarget('FEEDBACK',101)
  assert.equal(a.path,'/feedback');assert.equal(a.query.reminder,'100');assert.notEqual(a.query.reminder,b.query.reminder);assert.equal(module.exports.workReminderTarget('REPORT',100).path,'/content/community-reports')
})

test('反馈提醒重置旧筛选和页码，处理成功刷新顶部消息',async()=>{
  let script=parse(fs.readFileSync(path.join(root,'src/views/users/FeedbackView.vue'),'utf8')).descriptor.scriptSetup.content
  const calls=[],route={query:{reminder:'1'}},watchers=[]
  const deps={vue:{ref:value=>({value}),reactive:value=>value,watch:(getter,fn,options)=>{watchers.push(fn);if(options?.immediate)fn(getter())}},'vue-router':{useRoute:()=>route},'element-plus':{ElMessage:{success(){},error(){},warning(){}}},'@element-plus/icons-vue':{},'@/api':{api:{pageFeedback(){},replyFeedback:async()=>calls.push('reply')}},'@/components/TablePagination.vue':{},'@/composables/useServerPagination':{useServerPagination:()=>({page:{pageNum:1,pageSize:10},records:{value:[]},loading:{value:false},pageSummary:{value:''},load:async()=>calls.push('load'),search:async filters=>calls.push({...filters})})},'@/stores/auth':{useAuthStore:()=>({account:null})},'@/utils/work-reminders':{refreshWorkReminders:()=>calls.push('refresh')}}
  const module={exports:{}};vm.runInNewContext(transpile(script+'\nmodule.exports={q,dialog,form,saveReply};'),{module,exports:module.exports,require:name=>{assert.ok(deps[name],name);return deps[name]}})
  assert.equal(calls[0].replyStatus,0);const p=module.exports;p.q.keyword='旧词';p.q.type='产品建议';p.q.status='done';watchers[0]('2');assert.equal(p.q.keyword,'');assert.equal(p.q.status,'received');assert.equal(calls[1].feedbackType,undefined);assert.equal(calls[1].replyStatus,0)
  p.dialog.row={id:1};p.form.status='done';p.form.reply='感谢反馈';await p.saveReply();assert.deepEqual(calls.slice(-3),['reply','refresh','load'])
})

test('只有食品管理权限也显示信封，待审核食品亮红点并跳转实际待审核列表',async()=>{
  const p=feed();p.auth.account={id:3,permissions:['food:library:manage']};p.state.token='food';p.state.watchers[0]()
  assert.equal(p.available.value,true);assert.equal(p.state.calls.length,2)
  p.state.calls[0].resolve(data);await tick();assert.equal(p.summary.value.total,0)
  const item={type:'FOOD_REVIEW',title:'待审核食品',count:2,latestAt:'2026-10-26T12:30:00'}
  p.state.calls[1].resolve({total:2,items:[item]});await tick();assert.equal(p.hasMessages.value,true)
  p.open(item);assert.equal(p.state.routes[0].path,'/nutrition/foods');assert.equal(p.state.routes[0].query.review,'pending')
  p.state.listeners.get('changed')();p.state.calls[2].resolve({total:0,items:[]});await tick();assert.equal(p.hasMessages.value,false)
  p.dispose()
})
