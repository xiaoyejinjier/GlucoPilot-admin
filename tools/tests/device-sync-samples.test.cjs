const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const ts=require('typescript'),root=path.resolve(__dirname,'../..')
function client(get){
  const module={exports:{}}
  const deps={'@/mock':{api:{}},'@/config':{adminConfig:{useMock:false}},'@/api/cms-media':{},
    '@/utils/format':{fmtTime:value=>value},'@/utils/request':{get}}
  const source=ts.transpileModule(fs.readFileSync(path.join(root,'src/api/index.ts'),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText
  vm.runInNewContext(source,{module,exports:module.exports,URLSearchParams,require:name=>{assert.ok(deps[name],name);return deps[name]}})
  return module.exports.api
}
test('设备同步样本访问正确设备和日志路径，保留大整数日志ID并映射曲线值',async()=>{
  const calls=[]
  const api=client(async url=>{calls.push(url);return{syncedAt:'2026-11-26T10:00:00',sampleCount:1,points:[{recordedAt:'2026-11-26T09:59:00',nodeCode:'BEFORE_BREAKFAST',glucoseValue:'5.6'}]}})
  const result=await api.fetchDeviceSyncSamples(8,'9007199254740993')
  assert.equal(calls[0],'/admin/v1/devices/8/sync-logs/9007199254740993/samples')
  assert.equal(result.sampleCount,1);assert.equal(result.points[0].glucoseValue,5.6)
  assert.equal(result.points[0].recordedAt,'2026-11-26T09:59:00')
})
test('同步样本读取失败不伪造成功；日志标识作为单一路径段编码',async()=>{
  const calls=[]
  const api=client(async url=>{calls.push(url);throw new Error('无权查看同步样本')})
  await assert.rejects(api.fetchDeviceSyncSamples(8,'17/../9'),/无权查看同步样本/)
  assert.equal(calls[0],'/admin/v1/devices/8/sync-logs/17%2F..%2F9/samples')
})
test('共享类型文件使用完整UTF8且没有损坏的类型字面量',()=>{
  const source=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,'src/types/index.ts')))
  const parsed=ts.createSourceFile('types.ts',source,ts.ScriptTarget.Latest,true)
  assert.equal(parsed.parseDiagnostics.length,0)
})
