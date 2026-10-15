const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../../node_modules/typescript')
const { parse } = require('../../node_modules/@vue/compiler-sfc')

function createPage() {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/views/nutrition/FoodView.vue'), 'utf8')
  const script = parse(source).descriptor.scriptSetup.content
  const calls = [], errors = []
  const hooks = {}, listeners = new Set(), observers = []
  const api = { async listCategories() { return [] }, async pageFoods(query) {
    calls.push(JSON.parse(JSON.stringify(query)))
    const offset = (query.pageNum - 1) * query.pageSize
    return { total: 51, records: Array.from({ length: Math.max(0, Math.min(query.pageSize, 51 - offset)) }, (_, index) => ({ id: offset + index + 1 })) }
  } }
  const dependencies = {
    vue: { ref: value => ({ value }), reactive: value => value, computed: getter => ({ get value() { return getter() } }), nextTick: async () => {}, onMounted(fn) { hooks.mount = fn }, onBeforeUnmount(fn) { hooks.unmount = fn } },
    'element-plus': { ElMessage: { error: value => errors.push(value) } },
    '@element-plus/icons-vue': {}, '@/api': { api }, '@/api/food-images': { foodImageApi: {} },
    '@/stores/auth': { useAuthStore: () => ({ account: null }) }, './foodImages': { DEFAULT_FOOD_IMAGE: '', FOOD_IMAGE_OPTIONS: [] }
  }
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(script + '\nmodule.exports = { page, foods, pageSummary, foodTable, getAdaptivePageSize, resizePageToFit, load, changeSize, changePage, formatFoodUpdatedAt };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    module, exports: module.exports, setTimeout, clearTimeout,
    window: { addEventListener(name, fn) { listeners.add(fn) }, removeEventListener(name, fn) { listeners.delete(fn) } },
    ResizeObserver: class { constructor(fn) { this.callback = fn; observers.push(this) } observe(target) { this.target = target } disconnect() { this.disconnected = true } },
    require(name) { assert.ok(dependencies[name], name); return dependencies[name] }
  })
  return { ...module.exports, calls, errors, hooks, listeners, observers }
}

test('自适应条数下首、中、尾页请求/数据范围/页数保持一致', async () => {
  const page = createPage()
  await page.changeSize(12)
  await page.load()
  assert.equal(page.calls[0].pageSize, 12)
  assert.equal(page.foods.value.length, 12)
  assert.equal(page.pageSummary.value, '第 1 / 5 页 · 显示 1–12 条')
  await page.changePage(2)
  assert.equal(page.calls.at(-1).pageNum, 2)
  assert.equal(page.calls.at(-1).pageSize, 12)
  assert.equal(page.foods.value[0].id, 13)
  assert.equal(page.pageSummary.value, '第 2 / 5 页 · 显示 13–24 条')
  await page.changePage(5)
  assert.equal(page.foods.value.length, 3)
  assert.equal(page.pageSummary.value, '第 5 / 5 页 · 显示 49–51 条')
  assert.equal(page.errors.length, 0)
})

test('容量变化重置首页，相同容量和页码不会重复请求', async () => {
  const page = createPage()
  await page.changePage(2)
  await page.changeSize(50)
  assert.equal(page.calls.at(-1).pageNum, 1)
  assert.equal(page.calls.at(-1).pageSize, 50)
  assert.equal(page.foods.value.length, 50)
  await page.changeSize(14)
  assert.equal(page.pageSummary.value, '第 1 / 4 页 · 显示 1–14 条')
  const count = page.calls.length
  page.changePage(1); page.changeSize(14)
  assert.equal(page.calls.length, count)
})

test('按真实可用高度及行高向下取整，保留边界余量并限制接口页大小', () => {
  const { getAdaptivePageSize } = createPage()
  for (const height of [180, 350, 520, 625, 900, 1300]) {
    const size = getAdaptivePageSize(height)
    assert.ok(size * 52 < height)
    assert.ok(height - size * 52 <= 53)
  }
  assert.equal(getAdaptivePageSize(625), 12)
  assert.equal(getAdaptivePageSize(625, 60), 10)
  assert.equal(getAdaptivePageSize(0), 1)
  assert.equal(getAdaptivePageSize(100000), 100)
})

test('首次按容器请求，窗口缩放重新分页；尾页不足不影响容量；卸载取消监听', async () => {
  const page = createPage()
  const viewport = { clientHeight: 833 }
  const table = { querySelector(selector) {
    return selector.includes('tbody') ? { getBoundingClientRect: () => ({ height: 52 }) } : viewport
  } }
  page.foodTable.value = { $el: table }
  await page.hooks.mount()
  assert.equal(page.calls.length, 1)
  assert.equal(page.calls[0].pageSize, 16)
  assert.equal(page.observers[0].target, table)
  assert.equal(page.listeners.size, 1)
  await page.changePage(4)
  assert.equal(page.foods.value.length, 3)
  await page.resizePageToFit()
  assert.equal(page.page.pageSize, 16)
  assert.equal(page.page.pageNum, 4)
  viewport.clientHeight = 521
  await page.resizePageToFit()
  assert.equal(page.page.pageSize, 10)
  assert.equal(page.calls.at(-1).pageSize, 10)
  assert.equal(page.page.pageNum, 1)
  const count = page.calls.length
  viewport.clientHeight = 0
  await page.resizePageToFit()
  assert.equal(page.calls.length, count)
  page.hooks.unmount()
  assert.equal(page.observers[0].disconnected, true)
  assert.equal(page.listeners.size, 0)
  viewport.clientHeight = 833
  await page.resizePageToFit()
  assert.equal(page.calls.length, count)
})

test('更新时间仅压缩展示，不猜测时区；缺失值明确显示，完整时间保留在悬停属性', () => {
  const { formatFoodUpdatedAt } = createPage()
  assert.equal(formatFoodUpdatedAt('2026-10-15T08:12:34.567'), '10-15 08:12')
  assert.equal(formatFoodUpdatedAt('2026-09-08 21:05:00'), '09-08 21:05')
  assert.equal(formatFoodUpdatedAt('2026-10-15T08:12:34Z'), '10-15 08:12')
  assert.equal(formatFoodUpdatedAt(undefined), '—')
  assert.equal(formatFoodUpdatedAt('待同步'), '待同步')
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/views/nutrition/FoodView.vue'), 'utf8')
  assert.ok(source.includes(':title="row.updatedAt ||'))
})
