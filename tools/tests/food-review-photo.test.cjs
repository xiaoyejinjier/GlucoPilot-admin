const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../../node_modules/typescript')
const { parse } = require('../../node_modules/@vue/compiler-sfc')
const root = path.resolve(__dirname, '../..')
const flush = () => new Promise(resolve => setImmediate(resolve))

function photo(food = {}) {
  const props = { food: { name: '新食品', image: '/public-food.jpg', categoryName: '主食类', reviewImage: '/admin/v1/foods/7/review-image', ...food }, preferReview: true }
  const calls = [], revoked = [], watchers = []
  let token = 'admin', urls = 0
  const imageHelpers={exports:{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/views/nutrition/foodImages.ts'),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText,{module:imageHelpers,exports:imageHelpers.exports})
  const dependencies = {
    vue: { ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
      watch(getter, callback, options = {}) {
        const watcher = { getter, callback, value: getter(), cleanup: null }
        watcher.run = () => callback(getter(), undefined, fn => { watcher.cleanup = fn })
        watchers.push(watcher); if (options.immediate) watcher.run()
      } },
    '@/api/food-images': { foodImageApi: { review(path) { return new Promise((resolve, reject) => calls.push({ path, resolve, reject })) } } },
    '@/utils/request': { getAccessToken: () => token },
    './foodImages': { ...imageHelpers.exports, resolveFoodImage: food => food.image || '/bundled.svg', getBundledFoodImage: () => '/bundled.svg' }
  }
  const script = parse(fs.readFileSync(path.join(root, 'src/views/nutrition/FoodPhoto.vue'), 'utf8')).descriptor.scriptSetup.content
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(script + '\nmodule.exports = { source, onImageError };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    module, exports: module.exports, defineProps: () => props, withDefaults: value => value,
    URL: { createObjectURL: () => `blob:photo-${++urls}`, revokeObjectURL: value => revoked.push(value) },
    require(name) { assert.ok(dependencies[name], name); return dependencies[name] }
  })
  return { ...module.exports, props, calls, revoked, setToken(value) { token = value },
    update(values) {
      Object.assign(props, values)
      for (const w of watchers) { const value = w.getter(); if (value !== w.value) { if (w.cleanup) w.cleanup(); w.value = value; w.run() } }
    },
    unmount() { watchers.forEach(w => { if (w.cleanup) w.cleanup() }) }
  }
}

test('食品优先用户实拍，缺失或失败逐级回落且不改公开配图', async () => {
  const page = photo()
  assert.equal(page.source.value, '/public-food.jpg')
  page.calls[0].resolve(new Blob(['photo'], { type: 'image/jpeg' })); await flush()
  assert.equal(page.source.value, 'blob:photo-1')
  assert.equal(page.props.food.image, '/public-food.jpg')
  page.onImageError(); assert.equal(page.source.value, '/public-food.jpg')
  page.onImageError(); assert.equal(page.source.value, '/bundled.svg')
  page.unmount(); assert.deepEqual(page.revoked, ['blob:photo-1'])
  const failure = photo(); failure.calls[0].reject(new Error('deleted')); await flush()
  assert.equal(failure.source.value, '/public-food.jpg')
})

test('启用、停用及保存营养值不替换已显示的用户实拍图', async () => {
  const page = photo()
  page.calls[0].resolve(new Blob(['same-real-photo'], { type: 'image/jpeg' })); await flush()
  const original = page.source.value
  for (const state of [{ enabled: true, nutritionSource: 'AI_REVIEWED' },
    { enabled: false, nutritionSource: 'AI_REVIEWED' }, { enabled: true, carbs: 18 }]) {
    page.update({ food: { ...page.props.food, ...state } })
    assert.equal(page.source.value, original)
  }
  assert.equal(page.calls.length, 1)
  page.unmount()
  assert.deepEqual(page.revoked, [original])
})

test('换食品丢弃迟到结果，离页回收实拍临时地址', async () => {
  const page = photo()
  page.update({ food: { ...page.props.food, reviewImage: '/admin/v1/foods/8/review-image' } })
  page.calls[0].resolve(new Blob(['old'])); await flush()
  assert.equal(page.source.value, '/public-food.jpg')
  page.calls[1].resolve(new Blob(['new'])); await flush()
  assert.equal(page.source.value, 'blob:photo-1')
  page.unmount(); assert.deepEqual(page.revoked, ['blob:photo-1'])
})

test('运营改选图片后展示所选配图，账号变更不展示旧请求照片', async () => {
  const page = photo()
  page.update({ preferReview: false })
  page.calls[0].resolve(new Blob(['old'])); await flush()
  assert.equal(page.source.value, '/public-food.jpg')
  const changed = photo(); changed.setToken('another-admin')
  changed.calls[0].resolve(new Blob(['private'])); await flush()
  assert.equal(changed.source.value, '/public-food.jpg')
})

test('上传图保存后重新打开和重新加载列表仍展示管理员配图，不被旧实拍覆盖', async () => {
  const saved='/api/v1/foods/images/72'
  const reopened=photo({image:saved})
  await flush()
  assert.equal(reopened.source.value,saved)
  assert.equal(reopened.calls.length,0)
  reopened.update({food:{...reopened.props.food,enabled:true,nutritionSource:'AI_REVIEWED'}})
  assert.equal(reopened.source.value,saved)
  assert.equal(reopened.calls.length,0)
  reopened.unmount()
  const pending=photo()
  pending.update({food:{...pending.props.food,image:saved}})
  pending.calls[0].resolve(new Blob(['old-source']));await flush()
  assert.equal(pending.source.value,saved)
  assert.equal(pending.calls.length,1)
  pending.unmount()
})

function requester(response) {
  const values = new Map([['kt_admin_token', 'admin-token']]), calls = []
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/utils/request.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    module, exports: module.exports, Headers, AbortController,
    window: { setTimeout, clearTimeout, location: { pathname: '/login', assign() {} } },
    localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    fetch: async (url, options) => { calls.push({ url, options }); return typeof response === 'function' ? response() : response },
    require: () => ({ adminConfig: { baseUrl: '' } })
  })
  return { request: module.exports.request, calls, values }
}

test('审核原图使用Bearer读取二进制，401仍走统一鉴权失败处理', async () => {
  const good = requester(new Response(new Blob(['photo']), { headers: { 'Content-Type': 'image/jpeg' } }))
  const blob = await good.request('/admin/v1/foods/7/review-image', { responseType: 'blob' })
  assert.equal(await blob.text(), 'photo')
  assert.equal(good.calls[0].options.headers.get('Authorization'), 'Bearer admin-token')
  assert.equal('responseType' in good.calls[0].options, false)
  const denied = requester(new Response(JSON.stringify({ code: 40100, message: 'expired' }), { status: 401 }))
  await assert.rejects(denied.request('/admin/v1/foods/7/review-image', { responseType: 'blob' }), error => error.code === 40100)
  assert.equal(denied.values.has('kt_admin_token'), false)
})

test('真实PDF导出下载保留二进制，业务失败仍解析ApiResponse且不伪装文件',async()=>{
  const mime='application/pdf'
  const good=requester(new Response(new Blob([new Uint8Array([37,80,68,70,45])]),{headers:{'Content-Type':mime}}))
  const blob=await good.request('/admin/v1/exports/7/file',{responseType:'blob'});assert.deepEqual(Array.from(new Uint8Array(await blob.arrayBuffer())),[37,80,68,70,45]);assert.equal(good.calls[0].options.headers.get('Authorization'),'Bearer admin-token')
  const waiting=requester(new Response(JSON.stringify({code:40900,message:'文件尚未就绪'}),{status:409,headers:{'Content-Type':'application/json'}}))
  await assert.rejects(waiting.request('/admin/v1/exports/7/file',{responseType:'blob'}),error=>error.code===40900)
  let resolve
  const late=requester(()=>new Promise(done=>resolve=done))
  const pending=late.request('/admin/v1/exports/7/file',{responseType:'blob'})
  late.values.set('kt_admin_token','new-admin')
  resolve(new Response(new Blob(['old-private-file']),{headers:{'Content-Type':mime}}))
  await assert.rejects(pending,/登录状态已变化/);assert.equal(late.values.get('kt_admin_token'),'new-admin')
})

test('旧账号照片请求迟到的401不会清除新账号登录态', async () => {
  let complete
  const client = requester(() => new Promise(resolve => { complete = resolve }))
  const pending = client.request('/admin/v1/foods/7/review-image', { responseType: 'blob' })
  client.values.set('kt_admin_token', 'new-admin-token')
  client.values.set('kt_admin_auth', 'new-account')
  complete(new Response(JSON.stringify({ code: 40100, message: 'expired' }), { status: 401 }))
  await assert.rejects(pending, error => error.code === 40100)
  assert.equal(client.values.get('kt_admin_token'), 'new-admin-token')
  assert.equal(client.values.get('kt_admin_auth'), 'new-account')
})
