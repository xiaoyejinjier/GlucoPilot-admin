const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const vue = require('vue')

const root = path.resolve(__dirname, '../..')
const flush = () => new Promise(resolve => setImmediate(resolve))
function deferred() { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const message = (id, senderId = '1', recipientId = '2') => ({
  id, senderId, recipientId, senderNickname: '甲', recipientNickname: '乙', content: '测试消息',
  createdAt: '2026-10-28T10:00:00', readAt: null
})
function page() {
  const pending = [], calls = [], warnings = [], cleanups = []
  const session = { token: 'admin-a' }
  function fetch(kind, args) {
    calls.push({ kind, args })
    const next = deferred(); pending.push(next); return next.promise
  }
  const source = fs.readFileSync(path.join(root, 'src/views/users/MessageManagementView.vue'), 'utf8')
    .match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const script = ts.transpileModule(source + '\nglobalThis.page = {list,conversation,filters,search,reset,openConversation,closeConversation,selected};',
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const sandbox = { exports: {}, require(name) {
    if (name === 'vue') return { ...vue, onBeforeUnmount: fn => cleanups.push(fn) }
    if (name === 'element-plus') return { ElMessage: { warning: text => warnings.push(text) } }
    if (name === '@/api/messages') return { messageApi: {
      page: args => fetch('list', args), conversation: (...args) => fetch('conversation', args)
    } }
    if (name === '@/utils/request') return { getAccessToken: () => session.token }
    if (name === '@/utils/format') return { fmtTime: v => v }
    return {}
  } }
  vm.runInNewContext(script, sandbox)
  return { ...sandbox.page, pending, calls, warnings, session, unmount: () => cleanups.forEach(fn => fn()) }
}

test('message list uses real pagination results and preserves large user IDs as strings', async () => {
  const p = page()
  p.pending.shift().resolve({ records: [message('9')], total: '21' }); await flush()
  assert.equal(p.list.total, 21)
  assert.equal(p.list.rows[0].id, '9')
  p.filters.senderId = '9223372036854775807'; p.filters.keyword = '  早餐  '
  p.search()
  assert.equal(p.calls.at(-1).args.senderId, '9223372036854775807')
  assert.equal(p.calls.at(-1).args.keyword, '早餐')
  p.pending.shift().resolve({ records: [], total: 0 }); await flush()
  assert.equal(p.list.rows.length, 0)
  const count = p.calls.length
  p.filters.senderId = '9223372036854775808'; p.search()
  assert.equal(p.calls.length, count)
  assert.equal(p.warnings.length, 1)
})

test('late search results cannot overwrite newer results or survive an account change', async () => {
  const p = page(), old = p.pending.shift()
  p.filters.keyword = '新条件'; p.search()
  p.pending.shift().resolve({ records: [message('20')], total: 1 }); await flush()
  old.resolve({ records: [message('1')], total: 1 }); await flush()
  assert.equal(p.list.rows[0].id, '20')
  void p.list.load(); p.session.token = 'admin-b'
  p.pending.shift().resolve({ records: [message('999')], total: 1 }); await flush()
  assert.equal(p.list.rows[0].id, '20')
  p.unmount()
  assert.equal(p.list.rows.length, 0)
})

test('closing and switching conversations discards old responses without changing read state', async () => {
  const p = page()
  p.pending.shift().resolve({ records: [], total: 0 }); await flush()
  p.openConversation(message('1', '1', '2')); const first = p.pending.shift()
  p.closeConversation()
  p.openConversation(message('2', '1', '3')); const second = p.pending.shift()
  first.resolve({ records: [message('old')], total: 1 }); await flush()
  assert.equal(p.conversation.rows.length, 0)
  second.resolve({ records: [message('new', '1', '3')], total: 1 }); await flush()
  assert.equal(p.conversation.rows[0].id, 'new')
  assert.equal(p.conversation.rows[0].readAt, null)
  assert.equal(p.calls.at(-1).args[1], '3')
})

test('shrinking results clamp the current page and retry the last available page', async () => {
  const p = page()
  p.pending.shift().resolve({ records: [message('1')], total: 21 }); await flush()
  p.list.changePage(3)
  p.pending.shift().resolve({ records: [], total: 11 }); await flush()
  assert.equal(p.calls.at(-1).args.pageNum, 2)
  p.pending.shift().resolve({ records: [message('11')], total: 11 }); await flush()
  assert.equal(p.list.pageNum, 2)
  assert.equal(p.list.loading, false)
})

test('message API only issues GET requests and encodes literal keyword values', async () => {
  const calls = []
  const source = fs.readFileSync(path.join(root, 'src/api/messages.ts'), 'utf8')
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const sandbox = { exports: {}, URLSearchParams, require(name) {
    assert.equal(name, '@/utils/request')
    return { get: async url => { calls.push(url); return { records: [], total: 0 } } }
  } }
  vm.runInNewContext(script, sandbox)
  await sandbox.exports.messageApi.page({ keyword: '%_ &', senderId: '36', pageNum: 2, pageSize: 20 })
  const url = new URL(calls[0], 'https://example.test')
  assert.equal(url.pathname, '/admin/v1/community/messages')
  assert.equal(url.searchParams.get('keyword'), '%_ &')
  assert.equal(url.searchParams.get('senderId'), '36')
  await sandbox.exports.messageApi.conversation('36', '30', { pageNum: 1, pageSize: 10 })
  assert.match(calls[1], /messages\/conversation\/36\/30\?pageNum=1&pageSize=10$/)
})
