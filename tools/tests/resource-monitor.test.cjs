const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../../src/utils/resource-monitor.ts'), 'utf8')
const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod = { exports: {} }
new Function('exports', 'module', result)(mod.exports, mod)
const { createResourcePoller, formatBytes, formatPercent } = mod.exports
const tick = () => new Promise(resolve => setImmediate(resolve))

test('missing readings are distinct from actual zero; container CPU is not clamped', () => {
  assert.equal(formatBytes(null), '—')
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1024 ** 3), '1.0 GiB')
  assert.equal(formatPercent(null), '—')
  assert.equal(formatPercent(0), '0.0%')
  assert.equal(formatPercent(150), '150.0%')
})
test('polling is serial, pauses when hidden, and ignores late data on disposal', async () => {
  const timers = new Map(); let next = 0, calls = 0, resolve
  const received = [], failures = []
  const scheduler = { schedule(fn, delay) { timers.set(++next, { fn, delay }); return next }, cancel(id) { timers.delete(id) } }
  const poller = createResourcePoller(() => { calls++; return new Promise(r => { resolve = r }) },
    v => received.push(v), e => failures.push(e), () => {}, 10000, scheduler)
  poller.resume(); poller.refresh(); poller.refresh()
  assert.equal(calls, 1)
  poller.pause(); resolve('hidden'); await tick()
  assert.deepEqual(received, []); assert.equal(timers.size, 0)
  poller.resume(); assert.equal(calls, 2)
  resolve('visible'); await tick()
  assert.deepEqual(received, ['visible']); assert.equal(timers.size, 1)
  assert.equal([...timers.values()][0].delay, 10000)
  poller.refresh(); assert.equal(calls, 3); assert.equal(timers.size, 0)
  poller.dispose(); resolve('late'); await tick()
  assert.deepEqual(received, ['visible']); assert.equal(timers.size, 0); assert.deepEqual(failures, [])
})
test('failed requests are reported and schedule a retry without inventing samples', async () => {
  const timers = [], received = [], failures = []
  const scheduler = { schedule(fn, delay) { timers.push({ fn, delay }); return 1 }, cancel() {} }
  const poller = createResourcePoller(async () => { throw new Error('offline') },
    x => received.push(x), e => failures.push(e.message), () => {}, 10000, scheduler)
  poller.resume(); await tick()
  assert.deepEqual(received, []); assert.deepEqual(failures, ['offline']); assert.equal(timers.length, 1)
  poller.dispose()
})
