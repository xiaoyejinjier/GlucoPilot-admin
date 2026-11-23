const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{parse}=require('@vue/compiler-sfc')
const root=path.resolve(__dirname,'../..'),flush=()=>new Promise(resolve=>setImmediate(resolve))
function execute(source,deps,globals={}){
 const module={exports:{}}
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>{assert.ok(deps[name],name);return deps[name]},...globals})
 return module.exports
}
function page(name,options={}){
 const state={token:'admin-one',calls:[],routes:[],watchers:[],mounted:[],unmount:[],refreshes:0},route={query:options.query||{}}
 const auth={role:options.role||'admin',hasPermission:code=>(options.permissions||['doctor:account:manage','doctor:withdrawal:manage']).includes(code)}
 const vue={ref:value=>({value}),reactive:value=>value,computed:getter=>({get value(){return getter()}}),watch:(get,fn)=>state.watchers.push(fn),onMounted:fn=>state.mounted.push(fn),onBeforeUnmount:fn=>state.unmount.push(fn)}
 const deps={vue,'vue-router':{useRoute:()=>route,useRouter:()=>({push:target=>state.routes.push(target)})},'@/stores/auth':{useAuthStore:()=>auth},'@element-plus/icons-vue':{},'element-plus':{ElMessage:{success(){},error(){},warning(){}},ElMessageBox:{}},'@/utils/request':{getAccessToken:()=>state.token},'@/utils/work-reminders':{refreshWorkReminders:()=>state.refreshes++},'@/utils/format':{fmtTime:x=>x},'@/utils/withdrawal':{withdrawalStatus:x=>x.status},'@/api/doctor-portal':{doctorApi:{accounts:async()=>({records:[],total:0})}},'@/api/withdrawals':{withdrawalApi:{list:async(...args)=>{state.calls.push(args);return options.list?options.list(...args):{records:[],total:0}},review:async()=>({})}}}
 const script=parse(fs.readFileSync(path.join(root,`src/views/doctors/${name}.vue`),'utf8')).descriptor.scriptSetup.content
 const fields=name==='DoctorAccountsView'?'openWithdrawals,canViewWithdrawals':'load,status,pageNum,rows,total,error,doctorUserId,viewAll,returnToAccounts,selected,note,review'
 const result=execute(script+`\nmodule.exports={${fields}}`,deps)
 state.mounted.forEach(fn=>fn())
 return{...result,state,route,auth,dispose:()=>state.unmount.forEach(fn=>fn())}
}

test('医生账号按小程序医生ID进入提现明细，权限不足不跳转',async()=>{
 const p=page('DoctorAccountsView');await flush()
 p.openWithdrawals({doctorUserId:'22',opsId:'99',realName:'测试医生'})
 assert.equal(p.state.routes[0].query.userId,'22');assert.equal(p.state.routes[0].query.doctorName,'测试医生')
 p.openWithdrawals();assert.deepEqual(Object.keys(p.state.routes[1].query),[])
 p.openWithdrawals({doctorUserId:'bad'});assert.equal(p.state.routes.length,2)
 const denied=page('DoctorAccountsView',{permissions:['doctor:account:manage']})
 denied.openWithdrawals({doctorUserId:'22'});assert.equal(denied.state.routes.length,0)
})

test('医生提现详情默认全部状态，筛选和分页始终带本人ID，支持返回与全局入口',async()=>{
 const p=page('WithdrawalManagementView',{query:{userId:'22',doctorName:'测试医生'}});await flush()
 assert.equal(p.state.calls[0][2],'');assert.equal(p.state.calls[0][3],'22')
 p.status.value='APPROVED';p.pageNum.value=2;await p.load()
 assert.equal(p.state.calls.at(-1)[0],2);assert.equal(p.state.calls.at(-1)[3],'22')
 p.returnToAccounts();assert.equal(p.state.routes[0],'/doctor-management/accounts')
 p.viewAll();assert.deepEqual(Object.keys(p.state.routes[1].query),[])
 p.route.query={reminder:'next'};p.state.watchers[0]();await flush()
 assert.equal(p.status.value,'PENDING');assert.equal(p.pageNum.value,1);assert.equal(p.state.calls.at(-1)[3],undefined)
})

test('无效医生编号不会退化成查询全部，快速切换医生不写入旧结果',async()=>{
 for(const id of ['0','-1','abc',['22']]){
  const p=page('WithdrawalManagementView',{query:{userId:id}});await flush()
  assert.equal(p.state.calls.length,0);assert.match(p.error.value,/医生编号无效/)
 }
 const pending=[],p=page('WithdrawalManagementView',{query:{userId:'22'},list:()=>new Promise(resolve=>pending.push(resolve))})
 p.route.query={userId:'23'};p.state.watchers[0]()
 pending[1]({records:[{userId:'23'}],total:1});await flush()
 pending[0]({records:[{userId:'22'}],total:1});await flush()
 assert.equal(p.rows.value[0].userId,'23')
 p.dispose()
})

test('提现API使用独立userId参数，不把医生姓名当关键词，默认不带医生筛选',async()=>{
 const calls=[],api=execute(fs.readFileSync(path.join(root,'src/api/withdrawals.ts'),'utf8'),{'@/utils/request':{get:async url=>calls.push(url)}}).withdrawalApi
 await api.list(2,10,'APPROVED','22')
 const url=new URL(calls[0],'https://example.test')
 assert.equal(url.searchParams.get('userId'),'22');assert.equal(url.searchParams.get('pageNum'),'2')
 await api.list(1,10,'PENDING');assert.equal(new URL(calls[1],'https://example.test').searchParams.has('userId'),false)
})

test('提现侧栏通常合入医生账号，仅有提现权限的管理员仍有独立入口',()=>{
 const routerText=fs.readFileSync(path.join(root,'src/router/index.ts'),'utf8')
 const catalog=routerText.slice(routerText.indexOf('export const menuGroups:'),routerText.indexOf('\nconst router ='))
 const {menuGroups}=execute(catalog,{})
 const script=parse(fs.readFileSync(path.join(root,'src/layouts/AdminLayout.vue'),'utf8')).descriptor.scriptSetup.content
 const permissions=new Set(['doctor:withdrawal:manage']),auth={account:{role:'admin'},hasPermission:code=>permissions.has(code)}
 const parent={meta:{title:'医生账号',permission:'doctor:account:manage'},path:'/doctor-management/accounts'}
 const route={path:'/doctor-management/withdrawals',meta:{activeMenu:parent.path},matched:[]}
 const p=execute(script+'\nmodule.exports={visibleGroups,activePath,breadcrumbs}',{vue:{computed:get=>({get value(){return get()}})},'vue-router':{useRoute:()=>route,useRouter:()=>({resolve:()=>({meta:parent.meta,matched:[parent]})})},'element-plus':{},'@/stores/app':{useAppStore:()=>({})},'@/stores/auth':{useAuthStore:()=>auth},'@/router':{menuGroups},'@/config':{adminConfig:{useMock:false}},'@/utils/doctor-access':{doctorPageAllowed:()=>false}})
 const paths=()=>p.visibleGroups.value.flatMap(group=>group.children.map(child=>child.path))
 assert.ok(paths().includes('/doctor-management/withdrawals'));assert.equal(p.activePath.value,route.path)
 permissions.add('doctor:account:manage')
 assert.ok(!paths().includes('/doctor-management/withdrawals'));assert.ok(paths().includes('/doctor-management/accounts'))
 assert.equal(p.activePath.value,parent.path)
})
