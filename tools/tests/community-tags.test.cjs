const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const ts=require('../../node_modules/typescript'),{parse}=require('../../node_modules/@vue/compiler-sfc'),root=path.resolve(__dirname,'../..')
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve()}
function harness(overrides={},permission=true){
 const state={token:'ops-one',calls:[],messages:[],unmount:null},rows=[{id:'1',code:'diet',name:'饮食控糖',type:'OFFICIAL',enabled:1,sortNo:1,articleCount:4}]
 const methods={list:async()=>({records:rows,total:1}),create:async()=>rows[0],update:async()=>rows[0],remove:async()=>{},...overrides}
 const api=new Proxy({},{get:(_t,key)=>(...args)=>{state.calls.push({key,args});return methods[key](...args)}})
 const deps={vue:{ref:value=>({value}),reactive:value=>value,computed:get=>({get value(){return get()}}),onBeforeUnmount:fn=>state.unmount=fn},'element-plus':{ElMessage:{success:v=>state.messages.push(v),error:v=>state.messages.push(v)},ElMessageBox:{confirm:async()=>true}},'@/api/community-tags':{communityTagsApi:api},'@/stores/auth':{useAuthStore:()=>({role:permission?'admin':'editor',hasPermission:()=>permission})},'@/utils/request':{getAccessToken:()=>state.token}}
 const script=parse(fs.readFileSync(path.join(root,'src/views/content/CommunityTagsView.vue'),'utf8')).descriptor.scriptSetup.content,module={exports:{}}
 vm.runInNewContext(ts.transpileModule(script+'\nmodule.exports={load,search,openEditor,save,removeTag,restoreTag,query,rows,total,error,editorOpen,editing,form,editorError,saving,canManage};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Error,require:key=>deps[key]})
 return{...module.exports,state}
}
test('新增保存后刷新真实列表，非法名称不请求，删除保留文章提示且固定其他不能删除',async()=>{
 const p=harness();await flush();p.openEditor();p.form.name='早餐科普';await p.save();assert.equal(p.state.calls.some(c=>c.key==='create'&&c.args[0].name==='早餐科普'),true);assert.equal(p.editorOpen.value,false)
 p.openEditor();p.form.name='<script>';await p.save();assert.match(p.editorError.value,/标签限/);assert.equal(p.state.calls.filter(c=>c.key==='create').length,1)
 await p.removeTag({code:'other',name:'其他'});assert.equal(p.state.calls.filter(c=>c.key==='remove').length,0)
 await p.removeTag({code:'diet',name:'饮食控糖'});assert.equal(p.state.calls.filter(c=>c.key==='remove').length,1);assert.ok(p.state.messages.includes('标签已删除'))
})
test('失败保留编辑内容供重试，无写权限不调用接口，离页后不弹成功或刷新',async()=>{
 const p=harness({create:async()=>{throw Error('名称已存在')}});await flush();p.openEditor();p.form.name='早餐';await p.save();assert.equal(p.editorOpen.value,true);assert.equal(p.form.name,'早餐');assert.equal(p.editorError.value,'名称已存在')
 const readonly=harness({},false);await flush();readonly.openEditor();await readonly.save();assert.equal(readonly.state.calls.some(c=>c.key==='create'),false)
 let done;const q=harness({create:()=>new Promise(resolve=>done=resolve)});await flush();q.openEditor();q.form.name='早餐';const work=q.save();q.state.unmount();done({});await work;assert.equal(q.state.messages.length,0);assert.equal(q.state.calls.filter(c=>c.key==='list').length,1)
})
