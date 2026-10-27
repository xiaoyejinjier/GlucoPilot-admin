const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const ts=require('typescript'),{parse}=require('@vue/compiler-sfc'),root=path.resolve(__dirname,'../..')
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const tick=()=>new Promise(resolve=>setImmediate(resolve))
function harness(options={}){
 const state={queries:[],replies:[],errors:[],warnings:[],success:[],reminders:0},row={id:1,userName:'糖友',type:'产品建议',content:'建议',reply:'',status:'received'}
 const vue={ref:value=>({value}),shallowRef:value=>({value}),reactive:value=>value,computed:fn=>({get value(){return fn()}}),watch:(_getter,fn,opts)=>{if(opts?.immediate)fn()}}
 const api={pageFeedback:async query=>{state.queries.push({...query});return {records:query.replyStatus===0&&row.reply?[]:[{...row}],total:query.replyStatus===0&&row.reply?0:1}},replyFeedback:async(...args)=>{state.replies.push(args);if(options.reply)await options.reply();row.reply=args[1].trim();row.status='done'},writeLog:async()=>{}}
 const deps={vue,'vue-router':{useRoute:()=>({query:{}})},'element-plus':{ElMessage:{error:v=>state.errors.push(v),warning:v=>state.warnings.push(v),success:v=>state.success.push(v)}},'@element-plus/icons-vue':{},'@/api':{api},'@/stores/auth':{useAuthStore:()=>({account:{username:'admin',role:'admin'}})},'@/utils/work-reminders':{refreshWorkReminders:()=>state.reminders++}}
 function evaluate(source){const module={exports:{}};vm.runInNewContext(transpile(source),{module,exports:module.exports,require:name=>{assert.ok(deps[name],name);return deps[name]}});return module.exports}
 deps['@/composables/useServerPagination']=evaluate(fs.readFileSync(path.join(root,'src/composables/useServerPagination.ts'),'utf8'))
 const source=parse(fs.readFileSync(path.join(root,'src/views/users/FeedbackView.vue'),'utf8')).descriptor.scriptSetup.content
 const page=evaluate(source+'\nmodule.exports={dialog,form,q,list,saving,search,openHandle,saveReply,statusText};')
 return {...page,state,row}
}
test('审批只显示待审批/已完成，空回复不提交，有效回复自动完成并刷新筛选和提醒',async()=>{
 const p=harness();await tick();assert.equal(p.statusText('received'),'待审批');assert.equal(p.statusText('done'),'已完成')
 p.q.status='received';await p.search();assert.equal(p.state.queries.at(-1).replyStatus,0)
 p.openHandle(p.row);p.form.reply='  ';await p.saveReply();assert.equal(p.state.replies.length,0);assert.equal(p.dialog.visible,true)
 p.form.reply='已处理，请再次尝试';await p.saveReply()
 assert.equal(p.state.replies[0].length,2);assert.equal(p.row.status,'done');assert.equal(p.dialog.visible,false);assert.equal(p.state.reminders,1);assert.equal(p.list.value.length,0)
 p.q.status='done';await p.search();assert.equal(p.state.queries.at(-1).replyStatus,2);assert.equal(p.list.value[0].reply,'已处理，请再次尝试')
})
test('回复失败保留文本和待审批状态，提交中连点不会重复发送',async()=>{
 let reject;const pending=new Promise((_,r)=>reject=r),p=harness({reply:()=>pending});await tick()
 p.openHandle(p.row);p.form.reply='请保留这段回复';const sending=p.saveReply();await p.saveReply();assert.equal(p.state.replies.length,1)
 reject(Error('网络异常'));await sending;assert.equal(p.dialog.visible,true);assert.equal(p.form.reply,'请保留这段回复');assert.equal(p.row.status,'received');assert.equal(p.state.reminders,0);assert.equal(p.saving.value,false)
})
test('真实接口按官方回复映射两种状态，自动提交已完成兼容旧后端必填校验',async()=>{
 const module={exports:{}},calls=[]
 const rows=[{id:'1',replyStatus:1,officialReply:'处理中曾经回复'},{id:'2',replyStatus:3,officialReply:null}]
 const deps={'@/mock':{api:{}},'@/config':{adminConfig:{useMock:false}},'@/api/cms-media':{},'@/utils/format':{fmtTime:v=>v||''},'@/utils/request':{get:async()=>({records:rows,total:2}),put:async(...args)=>{assert.equal(args[1].replyStatus,2,'旧后端要求replyStatus非空，回复操作应自动提交已完成');calls.push(args)}}}
 vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'src/api/index.ts'),'utf8')),{module,exports:module.exports,URLSearchParams,require:name=>{assert.ok(deps[name],name);return deps[name]}})
 const api=module.exports.api,result=await api.pageFeedback({pageNum:1,pageSize:10})
 assert.equal(result.records[0].status,'done');assert.equal(result.records[1].status,'received')
 await api.replyFeedback(1,' 回复内容 ');assert.equal(calls[0][0],'/admin/v1/feedbacks/1/reply');assert.equal(calls[0][1].officialReply,'回复内容');assert.equal(calls[0][1].replyStatus,2)
})
