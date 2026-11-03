const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),vue=require('vue')
const root=path.resolve(__dirname,'../..'),flush=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const report=id=>({user:{id,nickname:'测试用户'},generatedAt:'2026-10-28T17:00:00',historyStart:'2026-09-29',candidateCount:'25',vectorNorm:1,coldStart:false,vector:[{tagId:'1',name:'饮食控糖',rawWeight:5,decayedWeight:4,normalizedWeight:1}],articles:[{id:'10',title:'推荐文章',tags:[],totalScore:72}],steps:['读取行为','计算向量','综合排序']})
function page(){
 const state={token:'admin-a'},userRequests=[],reportRequests=[],cleanups=[]
 const source=fs.readFileSync(path.join(root,'src/views/users/RecommendationManagementView.vue'),'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
 const compiled=ts.transpileModule(source+'\nglobalThis.p={selectedUser,users,report,selectedArticle,error,loading,searchUsers,loadReport};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 const sandbox={exports:{},Error,require(name){
  if(name==='vue')return{...vue,onBeforeUnmount:fn=>cleanups.push(fn)}
  if(name==='@/api')return{api:{pageUsers:params=>{const d=deferred();userRequests.push({params,...d});return d.promise}}}
  if(name==='@/api/recommendations')return{recommendationApi:{report:id=>{const d=deferred();reportRequests.push({id,...d});return d.promise}}}
  if(name==='@/utils/request')return{getAccessToken:()=>state.token}
  if(name==='@/utils/format')return{fmtTime:v=>v}
  return{}
 }}
 vm.runInNewContext(compiled,sandbox)
 return{...sandbox.p,state,userRequests,reportRequests,unmount:()=>cleanups.forEach(fn=>fn())}
}

test('推荐管理读取真实有效用户并自动加载前20名报告，不在前端计算推荐分',async()=>{
 const p=page();assert.equal(p.userRequests[0].params.accountStatus,1)
 p.userRequests[0].resolve({records:[{id:30,nickname:'账号用户',phone:'测试号码'}]});await flush()
 assert.equal(p.reportRequests[0].id,'30')
 p.reportRequests[0].resolve(report('30'));await flush()
 assert.equal(p.report.value.articles[0].totalScore,72)
 assert.equal(p.report.value.vector[0].normalizedWeight,1)
 assert.equal(p.loading.value,false)
 p.unmount();assert.equal(p.report.value,null)
})

test('切换用户清空旧分数和计算弹窗，旧响应不能覆盖新用户，退出后结果失效',async()=>{
 const p=page();p.userRequests[0].resolve({records:[]});await flush()
 p.selectedUser.value='30';void p.loadReport();const old=p.reportRequests[0]
 p.report.value=report('30');p.selectedArticle.value=p.report.value.articles[0]
 p.selectedUser.value='31';void p.loadReport()
 assert.equal(p.report.value,null);assert.equal(p.selectedArticle.value,null)
 p.reportRequests[1].resolve(report('31'));await flush()
 old.resolve(report('30'));await flush();assert.equal(p.report.value.user.id,'31')
 void p.loadReport();p.state.token='admin-b';p.reportRequests[2].resolve(report('31'));await flush()
 assert.equal(p.report.value,null)
 p.unmount()
})

test('接口失败保留明确错误且不展示旧推荐，冷启动及不足20篇按真实数量展示',async()=>{
 const p=page();p.userRequests[0].resolve({records:[]});await flush()
 p.selectedUser.value='30';void p.loadReport();p.reportRequests[0].reject(new Error('用户已停用'));await flush()
 assert.equal(p.error.value,'用户已停用');assert.equal(p.report.value,null)
 void p.loadReport();p.reportRequests[1].resolve({...report('30'),coldStart:true,vector:[],vectorNorm:0,articles:[]});await flush()
 assert.equal(p.report.value.coldStart,true);assert.equal(p.report.value.articles.length,0)
 assert.equal(p.error.value,'');p.unmount()
})
