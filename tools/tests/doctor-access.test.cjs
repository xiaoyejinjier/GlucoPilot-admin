const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const root=path.resolve(__dirname,'../..')
const source=fs.readFileSync(path.join(root,'src/utils/doctor-access.ts'),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const mod={exports:{}};vm.runInNewContext(code,{exports:mod.exports,module:mod});const access=mod.exports
const doctor={role:'doctor',permissions:['doctor:workbench:view','doctor:consultation:manage','doctor:income:view','user:manage','*:*:*'],menuPaths:['/doctor-management/workbench','/doctor-management/consultations','/doctor-management/income','/users']}
test('doctor menus and landing reject all previous admin routes, including wildcard misgrants',()=>{
  for(const route of ['/users','/dashboard','/system/roles','/doctor-management/reviews','/doctor-management/accounts'])assert.equal(access.doctorPageAllowed(doctor,route),false)
  assert.equal(access.landingPath(doctor),'/doctor-management/workbench')
  assert.equal(access.doctorPageAllowed(doctor,'/doctor-management/income'),true)
})
test('disabled or hidden doctor menus are inaccessible and empty permissions have a stable landing',()=>{
  const account={...doctor,menuPaths:['/doctor-management/income']}
  assert.equal(access.landingPath(account),'/doctor-management/income')
  assert.equal(access.doctorPageAllowed(account,'/doctor-management/workbench'),false)
  assert.equal(access.landingPath({...account,permissions:[]}),'/no-access')
  assert.equal(access.landingPath({...doctor,permissions:['*:*:*']}),'/no-access')
  assert.equal(access.landingPath({role:'admin',permissions:['*:*:*']}),'/dashboard')
})
test('doctor role is preserved at login and original global work reminders are not mounted for doctors',()=>{
  assert.match(fs.readFileSync(path.join(root,'src/api/index.ts'),'utf8'),/data.role === 'doctor' \? 'doctor'/)
  const layout=fs.readFileSync(path.join(root,'src/layouts/AdminLayout.vue'),'utf8')
  assert.match(layout,/<WorkReminders v-if="auth.role !== 'doctor'"/)
  assert.match(layout,/doctorPageAllowed\(auth.account, c.path\)/)
})
