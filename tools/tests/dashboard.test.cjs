const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('../../node_modules/typescript')
const { parse } = require('../../node_modules/@vue/compiler-sfc')
const root = path.resolve(__dirname, '../..')
const fixture = () => ({
  generatedAt: '2026-11-19T10:00:00', rangeStart: '2026-11-06', rangeEnd: '2026-11-19', foodCount: 29,
  users: { total: 38, today: 2, active: 12 }, records: { todayGlucose: 3, todayMeal: 2, monthTotal: 17 },
  content: { newsViews: 8, newsCount: 5, feedbackPending: 1 },
  trend: Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 6).padStart(2, '0')}`, glucose: i, meal: 0, users: 0 })),
  complianceDist: [{ level: '达标率≥70%', value: 2 }],
  channelDist: [{ channel: '控糖科普', value: 5 }], nodeHeat: [{ node: '早餐前', value: 3 }]
})

function page(provider) {
  const lifecycle = {}, calls = []
  const script = parse(fs.readFileSync(path.join(root, 'src/views/dashboard/DashboardView.vue'), 'utf8')).descriptor.scriptSetup.content
  const deps = {
    vue: { ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
      onMounted: callback => { lifecycle.mount = callback }, onBeforeUnmount: callback => { lifecycle.unmount = callback } },
    '@/api': { api: { dashboardStats: async () => { calls.push('dashboard'); return provider() } } },
    '@/config': { adminConfig: { useMock: false } }, '@element-plus/icons-vue': {},
    '@/components/StatCard.vue': {}, '@/components/EChart.vue': {}
  }
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(script + '\nmodule.exports={load,stats,error,loading,trendOption,nodeOption,hasChannels,hasCompliance,updatedLabel};', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { module, exports: module.exports, require: key => { assert.ok(deps[key], key); return deps[key] } })
  return { ...module.exports, lifecycle, calls }
}

test('看板一次汇总展示真实指标与完整日期，不额外读取整库食品', async () => {
  const p = page(async () => fixture())
  assert.equal(p.stats.value, null)
  await p.load()
  assert.deepEqual(p.calls, ['dashboard'])
  assert.equal(p.stats.value.records.monthTotal, 17)
  assert.equal(p.trendOption.value.xAxis.data[0], '2026-11-06')
  assert.equal(p.trendOption.value.xAxis.data.at(-1), '2026-11-19')
  assert.equal(p.nodeOption.value.yAxis.inverse, true)
  assert.equal(p.hasCompliance.value, true)
  assert.match(p.updatedLabel.value, /2026/)
})

test('刷新失败显示错误并保留上次数据，空记录正常显示空状态', async () => {
  let fail = false
  const p = page(async () => {
    if (fail) throw new Error('服务暂不可用')
    return fixture()
  })
  await p.load()
  const previous = p.stats.value
  fail = true
  await p.load()
  assert.equal(p.stats.value, previous)
  assert.equal(p.error.value, '服务暂不可用')
  assert.equal(p.loading.value, false)
  const empty = page(async () => ({ ...fixture(), channelDist: [], complianceDist: [], nodeHeat: [] }))
  await empty.load()
  assert.equal(empty.hasChannels.value, false)
  assert.equal(empty.hasCompliance.value, false)
})

test('刷新请求互斥，离页后的迟到响应不再写入页面', async () => {
  let resolve
  const p = page(() => new Promise(done => { resolve = done }))
  const first = p.load()
  await p.load()
  assert.equal(p.calls.length, 1)
  p.lifecycle.unmount()
  resolve(fixture())
  await first
  assert.equal(p.stats.value, null)
})

function remote(provider) {
  const source = fs.readFileSync(path.join(root, 'src/api/index.ts'), 'utf8')
  const start = source.indexOf('  async dashboardStats(): Promise<DashboardStats>')
  const end = source.indexOf('  async listMedia()', start)
  const module = { exports: {} }, calls = []
  vm.runInNewContext(ts.transpileModule('const api={' + source.slice(start, end) + '};module.exports=api;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { module, get: async url => { calls.push(url); return provider() } })
  return { api: module.exports, calls }
}

test('生产接口将后端字符串计数转换为图表数值，错误数据不伪装成0', async () => {
  const row = fixture()
  row.users.total = '38'
  row.trend[0].glucose = '2'
  const h = remote(() => row)
  const result = await h.api.dashboardStats()
  assert.deepEqual(h.calls, ['/admin/v1/dashboard'])
  assert.equal(result.users.total, 38)
  assert.equal(result.trend[0].glucose, 2)
  row.records.monthTotal = 'invalid'
  await assert.rejects(h.api.dashboardStats(), /格式异常/)
})
