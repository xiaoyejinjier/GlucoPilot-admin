const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../../node_modules/typescript')

function createApi() {
  const calls = []
  const page = { records: [{ id: '123', glucoseValue: 3.8 }], total: 1 }
  const overview = { total: 1, lowCount: 1 }
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/api/glucose-alerts.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, URLSearchParams, require(name) {
    assert.equal(name, '@/utils/request')
    return {
      async get(url) { calls.push({ method: 'GET', url }); return { page, overview } },
      async put(url, body) { calls.push({ method: 'PUT', url, body }); return { id: '123' } }
    }
  } })
  return { api: exports, calls, page, overview }
}

test('异常列表使用可被Vite/Nginx代理的管理端前缀，保留筛选分页与响应数据', async () => {
  const { api, calls, page, overview } = createApi()
  const result = await api.pageGlucoseAlerts({ startDate: '2026-10-01', endDate: '2026-10-15',
    keyword: '用户 & 甲', status: 'PENDING', alertType: 'LOW', pageNum: 2, pageSize: 10 })
  const url = new URL(calls[0].url, 'https://example.invalid')
  assert.equal(url.pathname, '/admin/v1/glucose-alerts')
  assert.equal(url.searchParams.get('keyword'), '用户 & 甲')
  assert.equal(url.searchParams.get('pageNum'), '2')
  assert.equal(url.searchParams.get('status'), 'PENDING')
  assert.equal(result.records, page.records)
  assert.equal(result.overview, overview)
})

test('异常详情必须访问管理端API路径，而不是返回HTTP200首页的前端路径', async () => {
  const { api, calls } = createApi()
  await api.getGlucoseAlert('123')
  assert.deepEqual(calls, [{ method: 'GET', url: '/admin/v1/glucose-alerts/123' }])
})

test('处理接口也使用管理端前缀并原样发送快照和乐观锁版本', async () => {
  const { api, calls } = createApi()
  const event = { id: '123', glucoseValue: 3.8, recordedAt: '2026-10-15T08:00:00.123', version: 2 }
  await api.handleGlucoseAlert(event, 'PROCESSING', '已联系核对')
  assert.equal(calls[0].method, 'PUT')
  assert.equal(calls[0].url, '/admin/v1/glucose-alerts/123/handling')
  assert.equal(calls[0].body.expectedVersion, 2)
  assert.equal(calls[0].body.recordedAt, event.recordedAt)
  assert.equal(calls[0].body.glucoseValue, 3.8)
  assert.equal(calls[0].body.note, '已联系核对')
})

test('内部备注和公开回复分别提交，省略回复不撤回既有内容', async () => {
  const { api, calls } = createApi()
  const event = { id: '123', glucoseValue: 3.8, recordedAt: '2026-10-15T08:00:00.123', version: 2 }
  await api.handleGlucoseAlert(event, 'RESOLVED', '内部备注', '给用户看')
  assert.equal(calls[0].body.note, '内部备注')
  assert.equal(calls[0].body.userReply, '给用户看')
  await api.handleGlucoseAlert(event, 'RESOLVED', '内部备注')
  assert.equal(Object.hasOwn(calls[1].body, 'userReply'), false)
  await api.handleGlucoseAlert(event, 'RESOLVED', '内部备注', '')
  assert.equal(calls[2].body.userReply, '')
})
