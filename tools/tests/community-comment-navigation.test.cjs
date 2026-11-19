const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const ts=require('../../node_modules/typescript'),{parse}=require('../../node_modules/@vue/compiler-sfc'),root=path.resolve(__dirname,'../..')
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve()}
function harness(query={},list=async()=>({records:[],total:0})){
  const state={calls:[],watchers:[],routes:[],token:'ops-one'},route={query}
  const deps={vue:{ref:v=>({value:v}),reactive:v=>v,computed:get=>({get value(){return get()}}),watch:(get,fn,options)=>{state.watchers.push(fn);if(options?.immediate)fn()},onBeforeUnmount(){}},
    'vue-router':{useRoute:()=>route,useRouter:()=>({push:target=>state.routes.push(target)})},
    'element-plus':{ElMessage:{success(){},error(){}},ElMessageBox:{}},'@element-plus/icons-vue':{},
    '@/api/community':{communityApi:{comments:async params=>{state.calls.push({...params});return list(params)}}},
    '@/stores/auth':{useAuthStore:()=>({hasPermission:()=>true})},'@/utils/request':{getAccessToken:()=>state.token}}
  const script=parse(fs.readFileSync(path.join(root,'src/views/content/CommunityCommentsView.vue'),'utf8')).descriptor.scriptSetup.content,module={exports:{}}
  vm.runInNewContext(ts.transpileModule(script+'\nmodule.exports={load,search,resetFilters,query,rows,total,pageNum,error,articleId};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Error,require:key=>{assert.ok(deps[key],key);return deps[key]}})
  return{...module.exports,state,route}
}
test('从文章进入评论后，搜索、重置与翻页始终携带该文章编号',async()=>{
  const p=harness({newsId:'20',title:'当前文章'},async()=>({records:[{id:'8',newsId:'20'}],total:30}));await flush()
  assert.equal(p.state.calls[0].newsId,'20')
  p.query.keyword='  评论者 ';p.pageNum.value=3;p.search();await flush()
  assert.equal(p.state.calls.at(-1).newsId,'20');assert.equal(p.state.calls.at(-1).keyword,'评论者');assert.equal(p.state.calls.at(-1).pageNum,1)
  p.resetFilters();await flush();assert.equal(p.state.calls.at(-1).newsId,'20')
  p.pageNum.value=2;await p.load();assert.equal(p.state.calls.at(-1).newsId,'20');assert.equal(p.state.calls.at(-1).pageNum,2)
  p.route.query={};p.state.watchers[0]();await flush();assert.equal(p.state.calls.at(-1).newsId,undefined);assert.equal(p.pageNum.value,1)
})
test('快速切换文章丢弃旧响应，非法文章编号不会退回查询所有评论',async()=>{
  const pending=[],p=harness({newsId:'20'},()=>new Promise(resolve=>pending.push(resolve)))
  await flush();p.route.query={newsId:'21'};p.state.watchers[0]();await flush()
  pending[1]({records:[{id:'9',newsId:'21'}],total:1});await flush();pending[0]({records:[{id:'8',newsId:'20'}],total:1});await flush()
  assert.equal(p.rows.value[0].newsId,'21')
  p.route.query={newsId:'-1'};p.state.watchers[0]();await flush()
  assert.equal(p.state.calls.length,2);assert.equal(p.rows.value.length,0);assert.match(p.error.value,/文章编号无效/)
})
test('评论API使用独立newsId参数，不把文章标题混入关键词',async()=>{
  const calls=[],module={exports:{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/api/community.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,URLSearchParams,require:()=>({get:async url=>calls.push(url)})})
  await module.exports.communityApi.comments({newsId:'20',keyword:'',status:'',verdict:'',hidden:'',pageNum:1})
  const params=new URL(calls[0],'http://example.invalid').searchParams
  assert.equal(params.get('newsId'),'20');assert.equal(params.has('keyword'),false);assert.equal(params.get('pageSize'),'10')
})
