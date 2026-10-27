const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../../node_modules/typescript')
const { parse } = require('../../node_modules/@vue/compiler-sfc')

function createPage(query = {}, preferences = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/views/nutrition/FoodView.vue'), 'utf8')
  const script = parse(source).descriptor.scriptSetup.content
  const calls = [], errors = [], saves = []
  const hooks = {}, listeners = new Set(), observers = [], watchers = [], route = { query }, reminders = []
  const storage = preferences.storage || new Map()
  const auth = { account: preferences.account || null }
  const api = { async removeFood() {}, async saveFood(food) { saves.push({...food}); return food }, async listCategories() { return [] }, async pageFoods(query) {
    calls.push(JSON.parse(JSON.stringify(query)))
    const offset = (query.pageNum - 1) * query.pageSize
    return { total: 51, records: Array.from({ length: Math.max(0, Math.min(query.pageSize, 51 - offset)) }, (_, index) => ({ id: offset + index + 1 })) }
  } }
  const dependencies = {
    vue: { ref: value => ({ value }), reactive: value => value, computed: getter => ({ get value() { return getter() } }), nextTick: async () => {}, watch(getter, fn) { watchers.push(fn) }, onMounted(fn) { hooks.mount = fn }, onBeforeUnmount(fn) { hooks.unmount = fn } },
    'vue-router': { useRoute: () => route },
    'element-plus': { ElMessage: { error: value => errors.push(value), success() {}, warning: value => errors.push(value) } },
    '@element-plus/icons-vue': {}, '@/api': { api }, '@/api/food-images': { foodImageApi: { list: async () => [] } },
    '@/stores/auth': { useAuthStore: () => auth }, './foodImages': { DEFAULT_FOOD_IMAGE: '', FOOD_IMAGE_OPTIONS: [],
      getBundledFoodImage: () => '/images/foods/rice.svg' },
    '@/utils/work-reminders': { refreshWorkReminders: () => reminders.push('refresh') }
  }
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(script + '\nmodule.exports = { page, foods, pageSummary, foodTable, getAdaptivePageSize, resizePageToFit, load, changeSize, changePage, formatFoodUpdatedAt, openFood, saveFood, toggle, foodDialog, keyword, filterCategory, enabledFilter, search, resetFilters, removeFood, savedPageSize, manualPageSize, pageSizeOptions, onPageSizeChange, saveDefaultPageSize };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    module, exports: module.exports, setTimeout, clearTimeout,
    window: { addEventListener(name, fn) { listeners.add(fn) }, removeEventListener(name, fn) { listeners.delete(fn) }, localStorage: preferences.localStorage || { getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,value) } },
    ResizeObserver: class { constructor(fn) { this.callback = fn; observers.push(this) } observe(target) { this.target = target } disconnect() { this.disconnected = true } },
    require(name) { assert.ok(dependencies[name], name); return dependencies[name] }
  })
  return { ...module.exports, calls, errors, hooks, listeners, observers, saves, watchers, route, reminders, api, storage, auth }
}

test('编辑并启用有实拍的旧食品保留空配图，不把显示用卡通图保存进数据库', async () => {
  const page = createPage()
  const food = { id: 7, name: '葡萄', categoryId: 1, categoryName: '水果类', image: '',
    reviewImage: '/admin/v1/foods/7/review-image', nutritionSource: 'AI_ESTIMATE', enabled: false }
  page.openFood(food)
  assert.equal(page.foodDialog.form.image, '')
  page.foodDialog.form.enabled = true
  await page.saveFood()
  assert.equal(page.saves[0].image, '')
  assert.equal(page.saves[0].reviewImage, food.reviewImage)
  await page.toggle({...food}, true)
  assert.equal(page.saves[1].image, '')
  assert.equal(page.errors.length, 0)
})

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

test('食品提醒首次进入及同页再次点击均只查待审核食品并重置旧筛选和页码', async () => {
  const p = createPage({ review: 'pending', reminder: '1' })
  await p.hooks.mount()
  assert.equal(p.calls[0].pendingReview, true)
  assert.equal(p.calls[0].pageNum, 1)
  assert.equal(p.enabledFilter.value, 'pending')
  p.keyword.value='旧词'; p.filterCategory.value=8; p.enabledFilter.value='enabled'; p.page.pageNum=4
  p.route.query.reminder='2'; p.watchers[0](); await new Promise(resolve=>setImmediate(resolve))
  const query=p.calls.at(-1)
  assert.equal(query.pendingReview,true); assert.equal(query.pageNum,1)
  assert.equal(query.keyword,undefined);assert.equal(query.categoryId,undefined);assert.equal(query.enabled,undefined)
  assert.equal(p.keyword.value,'');assert.equal(p.filterCategory.value,0);assert.equal(p.enabledFilter.value,'pending')
  p.resetFilters();await new Promise(resolve=>setImmediate(resolve))
  assert.equal(p.calls.at(-1).pendingReview,undefined)
  p.hooks.unmount()
})

test('食品保存、启用及删除成功立即刷新全局提醒，失败不发送处理成功事件', async () => {
  const p=createPage()
  const food={id:7,name:'新食品',categoryId:1,categoryName:'主食类',image:'',nutritionSource:'AI_ESTIMATE',enabled:false}
  p.openFood(food);await p.saveFood();assert.equal(p.reminders.length,1)
  await p.toggle(food,true);assert.equal(p.reminders.length,2)
  await p.removeFood(food);assert.equal(p.reminders.length,3)
  p.foodDialog.form.name='';await p.saveFood();assert.equal(p.reminders.length,3)
  p.api.saveFood=async()=>{throw new Error('failed')};await p.toggle(food,true);assert.equal(p.reminders.length,3)
  p.api.removeFood=async()=>{throw new Error('failed')};await p.removeFood(food);assert.equal(p.reminders.length,3)
})

test('选择每页条数后点击设为默认才保存，重新进入恢复且不会被窗口缩放覆盖', async () => {
  const storage=new Map(),p=createPage({}, {account:{id:7},storage})
  await p.changePage(3)
  await p.onPageSizeChange(20)
  assert.equal(p.calls.at(-1).pageNum,1);assert.equal(p.calls.at(-1).pageSize,20)
  assert.equal(p.manualPageSize.value,true)
  assert.equal(storage.size,0)
  p.saveDefaultPageSize()
  assert.equal(storage.get('kt_food_page_size_v1:7'),'20')
  assert.equal(p.savedPageSize.value,20)
  const reopened=createPage({}, {account:{id:7},storage})
  reopened.foodTable.value={$el:{querySelector:selector=>selector.includes('tbody')?{getBoundingClientRect:()=>({height:52})}:{clientHeight:833}}}
  await reopened.hooks.mount()
  assert.equal(reopened.calls[0].pageSize,20);assert.equal(reopened.page.pageSize,20)
  const count=reopened.calls.length;await reopened.resizePageToFit();assert.equal(reopened.calls.length,count)
  assert.deepEqual(Array.from(reopened.pageSizeOptions.value),[10,20,50,100])
  reopened.hooks.unmount();p.hooks.unmount()
})

test('不同管理员默认条数隔离，切换账号与退出不沿用上一账号偏好和结果', async () => {
  const storage=new Map([['kt_food_page_size_v1:7','20'],['kt_food_page_size_v1:8','50']])
  const p=createPage({}, {account:{id:7},storage});assert.equal(p.page.pageSize,20)
  p.auth.account={id:8};p.watchers[1]();await new Promise(resolve=>setImmediate(resolve))
  assert.equal(p.calls.at(-1).pageSize,50);assert.equal(p.savedPageSize.value,50)
  const fresh=createPage({}, {account:{id:9},storage});assert.equal(fresh.savedPageSize.value,null);assert.equal(fresh.manualPageSize.value,false)
  p.auth.account=null;p.watchers[1]();assert.equal(p.savedPageSize.value,null);assert.equal(p.foods.value.length,0)
  assert.equal(storage.get('kt_food_page_size_v1:7'),'20');assert.equal(storage.get('kt_food_page_size_v1:8'),'50')
})

test('无效默认值及存储异常不会破坏分页，保存失败不假装记住', async () => {
  for(const value of ['0','101','20.5','-1','NaN','garbage']) {
    const p=createPage({}, {account:{id:7},storage:new Map([['kt_food_page_size_v1:7',value]])})
    assert.equal(p.savedPageSize.value,null);assert.equal(p.page.pageSize,12)
  }
  const p=createPage({}, {account:{id:7},localStorage:{getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')}}})
  await p.onPageSizeChange(50);p.saveDefaultPageSize();assert.equal(p.savedPageSize.value,null)
  assert.equal(p.page.pageSize,50);assert.ok(p.errors.some(error=>error.includes('保存失败')))
  const count=p.calls.length
  for(const invalid of [0,101,1.5,NaN])await p.onPageSizeChange(invalid)
  assert.equal(p.calls.length,count);assert.equal(p.page.pageSize,50)
})
