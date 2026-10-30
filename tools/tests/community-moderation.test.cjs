const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('../../node_modules/typescript')
const { parse } = require('../../node_modules/@vue/compiler-sfc')
const root = path.resolve(__dirname,'../..')
const flush = async () => { for(let i=0;i<20;i++)await Promise.resolve() }
const deferred = () => {let resolve;const promise = new Promise(r=>{resolve=r});return {promise,resolve}}
const report={id:'9',target_type:'ARTICLE',target_id:'7',reason:'MISINFORMATION',details:'内容存在问题',state:'OPEN',reporter_id:'2',target_content:'被举报的文章正文'}
const article={id:'7',title:'投稿文章',source:'COMMUNITY',author:{nickname:'用户小明',key:'u2'},state:'PENDING_ADMIN',revision:3,aiVerdict:'PASS',body:'文章正文',tags:[]}
function page(options={}) {
  const state={calls:[],warnings:[],successes:[],errors:[],reminderRefreshes:0,watchers:[],routes:[]}, route={path:options.path || '/content/community',query:{}}
  const auth={role:options.role || 'admin',hasPermission:()=>options.permission !== false}
  const defaults={articles:async()=>({records:[article],total:1}),reports:async()=>({records:[report],total:1}),article:async()=>({...article}),review:async()=>({...article,state:'PUBLISHED'}),resolve:async()=>({}),...options.api}
  const api=new Proxy({}, {get:(_t,key)=>(...args)=>{state.calls.push({key,args});return defaults[key](...args)}})
  const deps={
    vue:{ref:v=>({value:v}),computed:get=>({get value(){return get()}}),watch:(get,callback,opts)=>{state.watchers.push({get,callback});if(opts?.immediate)callback()},onBeforeUnmount(){}},
    'vue-router':{useRoute:()=>route,useRouter:()=>({push:value=>state.routes.push(value)})},
    'element-plus':{ElMessage:{warning:v=>state.warnings.push(v),success:v=>state.successes.push(v),error:v=>state.errors.push(v)},ElMessageBox:{confirm:options.confirm || (async()=>true)}},
    '@element-plus/icons-vue':{}, '@/api':{api:{setNewsStatus:async(...args)=>{state.calls.push({key:'setNewsStatus',args})},removeNews:async(...args)=>{state.calls.push({key:'removeNews',args})}}}, '@/api/community':{communityApi:api}, '@/stores/auth':{useAuthStore:()=>auth}, '@/utils/work-reminders':{refreshWorkReminders:()=>state.reminderRefreshes++}
  }
  const script=parse(fs.readFileSync(path.join(root,'src/views/content/CommunityReviewView.vue'),'utf8')).descriptor.scriptSetup.content
  const module={exports:{}}
  vm.runInNewContext(ts.transpileModule(script+'\nmodule.exports={load,search,resetFilters,openReport,openArticle,editArticle,unpublishArticle,removeArticle,resolveReport,decide,note,resolution,selectedReport,selectedArticle,drawer,canReview,saving,status,source,keyword,pageNum,articles,reports,detailError};',{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText,{module,exports:module.exports,require:key=>{assert.ok(deps[key],key);return deps[key]}})
  return {...module.exports,state,route,auth}
}

test('管理员能读取举报原文并提交带原因的精确处理，空说明不提交',async()=>{
  const p=page({path:'/content/community-reports'});await flush()
  assert.equal(p.state.calls[0].key,'reports');assert.equal(p.state.calls[0].args[0],'OPEN')
  p.openReport(p.reports.value[0]);assert.equal(p.selectedReport.value.target_content,'被举报的文章正文')
  await p.resolveReport();assert.equal(p.state.calls.filter(c=>c.key==='resolve').length,0)
  p.note.value='核查后确认内容存在误导';p.resolution.value='HIDE_ARTICLE';await p.resolveReport()
  const call=p.state.calls.find(c=>c.key==='resolve');assert.deepEqual(call.args,['9','HIDE_ARTICLE','核查后确认内容存在误导'])
  assert.equal(p.drawer.value,false);assert.equal(p.state.successes.length,1)
  assert.equal(p.state.reminderRefreshes,1)
})

test('文章管理默认读取全部状态与来源，按发布人搜索时回到第一页',async()=>{
  const p=page();await flush()
  assert.deepEqual(p.state.calls[0].args,['',1,'',''])
  assert.equal(p.articles.value[0].author.nickname,'用户小明')
  p.pageNum.value=3;p.source.value='COMMUNITY';p.keyword.value='小明';p.status.value='PUBLISHED';p.search();await flush()
  assert.deepEqual(p.state.calls.filter(c=>c.key==='articles').at(-1).args,['PUBLISHED',1,'COMMUNITY','小明'])
  p.resetFilters();await flush();assert.deepEqual(p.state.calls.filter(c=>c.key==='articles').at(-1).args,['',1,'',''])
})

test('停留举报页面时再次点击全局提醒，恢复待处理筛选并回第一页',async()=>{
  const p=page({path:'/content/community-reports'});await flush();p.status.value='DISMISSED';p.pageNum.value=7;p.drawer.value=true;p.route.query.reminder='next'
  const watcher=p.state.watchers.find(w=>typeof w.get==='function'&&w.get()==='next');assert.ok(watcher);watcher.callback('next');await flush()
  assert.equal(p.status.value,'OPEN');assert.equal(p.pageNum.value,1);assert.equal(p.drawer.value,false);assert.deepEqual(p.state.calls.filter(call=>call.key==='reports').at(-1).args,['OPEN',1])
})

test('官方文章只能走官方编辑，不通过投稿终审接口处理',async()=>{
  const p=page();await flush();p.selectedArticle.value={...article,source:'OFFICIAL',state:'PUBLISHED'};p.note.value='下架原因'
  await p.decide('HIDE');assert.equal(p.state.calls.filter(c=>c.key==='review').length,0)
})

test('官方文章编辑跳转官方编辑器，下架使用官方接口',async()=>{
  const p=page();await flush();const official={...article,source:'OFFICIAL',state:'PUBLISHED'}
  p.editArticle(official);assert.deepEqual(p.state.routes,['/content/news/7/edit'])
  await p.unpublishArticle(official)
  assert.deepEqual(p.state.calls.find(c=>c.key==='setNewsStatus').args,[7,'unpublished'])
  assert.equal(p.state.calls.filter(c=>c.key==='review').length,0)
})

test('社区文章下架要求管理员审核权限，且保留版本',async()=>{
  const p=page();await flush();await p.unpublishArticle({...article,state:'PUBLISHED'})
  const call=p.state.calls.find(c=>c.key==='review');assert.equal(call.args[0].revision,3);assert.equal(call.args[1],'HIDE')
  const editor=page({role:'editor'});await flush();await editor.unpublishArticle({...article,state:'PUBLISHED'})
  assert.equal(editor.state.calls.filter(c=>['review','setNewsStatus'].includes(c.key)).length,0)
  assert.equal(editor.saving.value,false)
})

test('删除文章仅在有编辑权限时调用，并在取消下架确认后不发请求',async()=>{
  const p=page();await flush();await p.removeArticle(article)
  assert.deepEqual(p.state.calls.find(c=>c.key==='removeNews').args,[7])
  const denied=page({permission:false});await flush();await denied.removeArticle(article)
  assert.equal(denied.state.calls.filter(c=>c.key==='removeNews').length,0)
  const cancel=page({confirm:async()=>{throw new Error('cancel')}});await flush()
  await cancel.unpublishArticle({...article,source:'OFFICIAL',state:'PUBLISHED'})
  assert.equal(cancel.state.calls.filter(c=>['setNewsStatus','review'].includes(c.key)).length,0)
  assert.equal(cancel.saving.value,false)
})

test('非管理员只读，不能通过界面处理举报或终审发布',async()=>{
  const p=page({role:'editor'});await flush();p.openReport(report);p.note.value='意见';await p.resolveReport()
  p.selectedReport.value=null;p.selectedArticle.value=article;await p.decide('APPROVE')
  assert.equal(p.canReview.value,false);assert.equal(p.state.calls.filter(c=>['resolve','review'].includes(c.key)).length,0)
})

test('终审必须初审通过并提交当前版本，不伪造AI通过',async()=>{
  const p=page();await flush();p.selectedArticle.value={...article,state:'AI_ERROR',aiVerdict:'ERROR'}
  await p.decide('APPROVE');assert.equal(p.state.calls.filter(c=>c.key==='review').length,0)
  p.selectedArticle.value=article;p.note.value='内容核查通过';await p.decide('APPROVE')
  const call=p.state.calls.find(c=>c.key==='review');assert.equal(call.args[0].revision,3);assert.equal(call.args[1],'APPROVE')
})

test('快速切换文章详情时，较早的响应不能替换当前文章',async()=>{
  const old=deferred(),p=page({api:{article:id=>id==='7'?old.promise:Promise.resolve({...article,id:'8'})}})
  await flush();const first=p.openArticle(article);await p.openArticle({...article,id:'8'});old.resolve(article);await first
  assert.equal(p.selectedArticle.value.id,'8')
})

test('举报处理确认期间禁止连点，取消确认不会提示成功',async()=>{
  const confirm=deferred(),p=page({confirm:()=>confirm.promise});await flush();p.openReport(report);p.note.value='核查说明'
  const first=p.resolveReport();p.resolveReport();assert.equal(p.saving.value,true)
  confirm.resolve(true);await first;assert.equal(p.state.calls.filter(c=>c.key==='resolve').length,1)
  const cancel=page({confirm:async()=>{throw new Error('cancel')}});await flush();cancel.openReport(report);cancel.note.value='说明';await cancel.resolveReport()
  assert.equal(cancel.state.successes.length,0);assert.equal(cancel.saving.value,false)
})

test('审核与举报API统一使用管理端前缀及版本字段',async()=>{
  const calls=[],module={exports:{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/api/community.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    module,exports:module.exports,URLSearchParams,require:()=>({get:async(url)=>{calls.push({url})},post:async(url,body)=>{calls.push({url,body})}})
  })
  const api=module.exports.communityApi;await api.reports('OPEN',2);await api.review(article,'APPROVE','通过');await api.resolve('9','DISMISS','核查不成立')
  assert.equal(calls[0].url,'/admin/v1/community/reports?status=OPEN&pageNum=2&pageSize=10')
  assert.equal(calls[1].body.revision,3);assert.match(calls[2].url,/^\/admin\/v1\/community\/reports\/9\/resolve$/)
  await api.articles('',1,'COMMUNITY',' 小明 ')
  const url=new URL(calls[3].url,'https://example.invalid');assert.equal(url.searchParams.get('keyword'),'小明');assert.equal(url.searchParams.get('source'),'COMMUNITY');assert.equal(url.searchParams.has('status'),false)
})
