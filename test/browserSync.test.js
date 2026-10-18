import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserSyncHandler, compareAndSwapScript } from '../api/browser-sync.js'
import { defaultBrowserData, diffBrowserData, readBrowserData, writeBrowserData } from '../src/utils/browserData.js'
import { BROWSER_LINK_KEY, createBrowserSyncClient } from '../src/utils/browserSync.js'
import { createAdminHandler } from '../api/admin.js'
import { getPendingGlobalQuizCount, queueGlobalQuizIncrement, queueInitialGlobalQuizCount } from '../src/utils/globalQuizCount.js'

const adminPassword = 'test-only-admin-password'

// Redis boundary fake. The actual Lua transaction is also exercised against local Redis.
class MemoryRedis {
  constructor() { this.values = new Map(); this.clock = 1000000 }
  raw(key) {
    const entry = this.values.get(key)
    if (entry && entry.expires <= this.clock) { this.values.delete(key); return null }
    return entry?.value ?? null
  }
  async get(key) { const value = this.raw(key); return value === null ? null : JSON.parse(value) }
  async set(key, value, options = {}) {
    if (options.nx && this.raw(key) !== null) return null
    this.values.set(key, { value: String(value), expires: this.clock + (options.ex || 99999999) * 1000 })
    return 'OK'
  }
  async expire(key, seconds) { const entry = this.values.get(key); if (entry) entry.expires = this.clock + seconds * 1000 }
  createScript(script) {
    return { eval: async (keys, args) => {
      if (script !== compareAndSwapScript) {
        const count = Number(this.raw(keys[0]) || 0) + 1
        const expires = this.values.get(keys[0])?.expires || this.clock + Number(args[0]) * 1000
        this.values.set(keys[0], { value: String(count), expires })
        return count
      }
      const current = this.raw(keys[0])
      if (current === null) return [-1, '']
      if (current !== args[0]) return [0, current]
      if (args[3] && this.raw(keys[1]) !== args[3]) return [-2, '']
      await this.set(keys[0], args[1], { ex: Number(args[2]) })
      if (args[3]) {
        this.values.delete(keys[1])
        await this.set(keys[2], args[4], { ex: Number(args[5]) })
      }
      return [1, args[1]]
    } }
  }
}

const id = (number) => number.toString(16).padStart(32, '0')
function api() {
  const redis = new MemoryRedis()
  const now = () => 1700000000000 + redis.clock
  const handler = createBrowserSyncHandler(redis, { now, getAdminPassword: () => adminPassword })
  const adminHandler = createAdminHandler({ getRedis: () => redis, getPassword: () => adminPassword, now })
  const call = async (body, token, extra = {}, endpoint = '/api/browser-sync') => {
    const response = { headers: {}, status(code) { this.statusCode = code; return this },
      setHeader(key, value) { this.headers[key] = value }, json(data) { this.data = data; return this } }
    await (endpoint === '/api/admin' ? adminHandler : handler)({ method: 'POST', headers: { 'content-type': 'application/json', host: 'leaper.test', origin: 'https://leaper.test',
      ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra.headers }, body, ...extra, }, response)
    return response
  }
  return { redis, call, admin: (body, token, extra) => call(body, token, extra, '/api/admin') }
}

async function group(service, data = defaultBrowserData()) {
  const source = await service.call({ action: 'create', deviceId: id(1), data })
  assert.equal(source.statusCode, 200)
  const invite = await service.call({ action: 'invite', deviceId: id(1) }, source.data.token)
  assert.equal(invite.statusCode, 200)
  return { token: source.data.token, code: invite.data.code }
}

test('codes expire after five minutes, are single-use, and issuing a new one invalidates the old one', async () => {
  const service = api()
  const first = await group(service)
  const second = await service.call({ action: 'invite', deviceId: id(1) }, first.token)
  assert.equal((await service.call({ action: 'join', deviceId: id(2), code: first.code, data: defaultBrowserData() })).statusCode, 410)
  const joined = await service.call({ action: 'join', deviceId: id(2), code: second.data.code.toLowerCase(), data: defaultBrowserData() })
  assert.equal(joined.statusCode, 200)
  assert.equal(joined.data.token, first.token)
  assert.equal((await service.call({ action: 'join', deviceId: id(3), code: second.data.code, data: defaultBrowserData() })).statusCode, 410)
  // A retry of the same successful join is recoverable after its response was lost.
  assert.equal((await service.call({ action: 'join', deviceId: id(2), code: second.data.code, data: defaultBrowserData() })).statusCode, 200)
  const third = await service.call({ action: 'invite', deviceId: id(1) }, first.token)
  service.redis.clock += 300001
  assert.equal((await service.call({ action: 'join', deviceId: id(4), code: third.data.code, data: defaultBrowserData() })).statusCode, 410)
})

test('authenticated devices merge concurrent writes and duplicate sequence numbers do not increment twice', async () => {
  const service = api()
  const link = await group(service)
  await service.call({ action: 'join', deviceId: id(2), code: link.code, data: defaultBrowserData() })
  const patch = (word) => diffBrowserData(defaultBrowserData(), { ...defaultBrowserData(), usedIds: [word], totalCount: 1 })
  const updates = await Promise.all([1, 2].map((device) => service.call({ action: 'sync', deviceId: id(device), seq: 1, patch: patch(device) }, link.token)))
  assert.ok(updates.every((response) => response.statusCode === 200))
  const retry = await service.call({ action: 'sync', deviceId: id(1), seq: 1, patch: patch(1) }, link.token)
  assert.equal(retry.data.data.totalCount, 2)
  assert.deepEqual(retry.data.data.usedIds, [1, 2])
  assert.equal((await service.call({ action: 'sync', deviceId: id(1), seq: 3, patch: patch(1) }, link.token)).statusCode, 409)
})

test('authorization, origin, method, payload, expiry and rate limits fail closed', async () => {
  const service = api()
  const link = await group(service)
  assert.equal((await service.call({ action: 'read', deviceId: id(1) })).statusCode, 401)
  assert.equal((await service.call({ action: 'read', deviceId: id(9) }, link.token)).statusCode, 401)
  assert.equal((await service.call({ action: 'read', deviceId: id(1) }, '0'.repeat(64))).statusCode, 401)
  assert.equal((await service.call({}, null, { method: 'GET' })).statusCode, 405)
  assert.equal((await service.call({}, null, { headers: { origin: 'https://attacker.test', host: 'leaper.test', 'content-type': 'application/json' } })).statusCode, 403)
  assert.equal((await service.call({}, null, { headers: { 'content-type': 'text/plain' } })).statusCode, 415)
  assert.equal((await service.call({ action: 'create', deviceId: id(3), data: { ...defaultBrowserData(), usedIds: [2301] } })).statusCode, 400)
  assert.equal((await service.call({ action: 'create', deviceId: id(3), extra: 'x'.repeat(100001) })).statusCode, 413)
  for (let attempt = 0; attempt < 30; attempt += 1) await service.call({ action: 'join', deviceId: id(3), code: 'bad' })
  assert.equal((await service.call({ action: 'create', deviceId: id(4), data: defaultBrowserData() })).statusCode, 429)
  service.redis.clock += 181 * 24 * 60 * 60 * 1000
  assert.equal((await service.call({ action: 'read', deviceId: id(1) }, link.token)).statusCode, 401)
})

function browser(service, initial = defaultBrowserData(), options = {}) {
  const values = new Map()
  const store = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
  const document = { cookie: '' }
  writeBrowserData(store, document, initial)
  const faults = { action: null, before: false, after: false, pause: null }
  const request = async (url, request) => {
    const body = JSON.parse(request.body)
    if (faults.action === body.action && faults.before) { faults.before = false; throw new TypeError('offline') }
    const token = request.headers.Authorization?.slice(7)
    const response = await service.call(body, token, {}, url)
    if (faults.pause) await faults.pause(body)
    if (faults.action === body.action && faults.after) { faults.after = false; throw new TypeError('lost response') }
    return { ok: response.statusCode === 200, status: response.statusCode, json: async () => response.data }
  }
  const migrations = []
  const received = []
  const create = () => createBrowserSyncClient({ getStorage: () => store, getDocument: () => document,
    fetchImpl: request, beforeRemoteApply: (data) => migrations.push(data.totalCount), onRemoteData: (data) => received.push(data), ...options })
  return { client: create(), create, store, document, faults, migrations, received, read: () => readBrowserData(store, document.cookie),
    write: (data) => writeBrowserData(store, document, data), link: () => JSON.parse(store.getItem(BROWSER_LINK_KEY)) }
}

test('two browsers join, auto-sync changes in both directions, and remote totals do not enter global queues', async () => {
  const service = api()
  const source = browser(service, { ...defaultBrowserData(), usedIds: [1], totalCount: 20 })
  const target = browser(service, { ...defaultBrowserData(), checkedIds: [2], totalCount: 4 })
  target.store.setItem('leapGlobalQuizCountQueue', '{"pending":4}')
  const invite = await source.client.issueCode()
  await target.client.join(invite.code)
  await source.client.sync()
  assert.deepEqual(source.read(), target.read())
  assert.equal(target.read().totalCount, 24)
  assert.equal(target.store.getItem('leapGlobalQuizCountQueue'), '{"pending":4}')
  source.write({ ...source.read(), usedIds: [1, 3], totalCount: 25 })
  target.write({ ...target.read(), checkedIds: [2, 4], totalCount: 26 })
  await Promise.all([source.client.sync(), target.client.sync()])
  await Promise.all([source.client.sync(), target.client.sync()])
  assert.deepEqual(source.read(), target.read())
  assert.equal(source.read().totalCount, 27)
  assert.deepEqual(source.read().checkedIds, [2, 4])
  assert.deepEqual(source.read().usedIds, [1, 3])
})

test('a committed sync with a lost response is retried exactly once, including after a reload', async () => {
  const service = api()
  const source = browser(service)
  await source.client.issueCode()
  source.write({ ...source.read(), totalCount: 3, usedIds: [1, 2, 3] })
  source.faults.action = 'sync'
  source.faults.after = true
  await assert.rejects(source.client.sync(), /通信できません/)
  assert.equal(source.link().pending.patch.totalDelta, 3)
  source.write({ ...source.read(), totalCount: 4, usedIds: [1, 2, 3, 4] })
  const reloaded = source.create()
  await reloaded.sync()
  assert.equal(source.read().totalCount, 4)
  assert.equal(source.link().pending, null)
  const check = await service.call({ action: 'read', deviceId: source.link().deviceId }, source.link().token)
  assert.equal(check.data.data.totalCount, 4)
})

test('offline writes remain local, reconnect replays them, and a lost join can be retried', async () => {
  const service = api()
  const source = browser(service)
  const target = browser(service)
  const invite = await source.client.issueCode()
  target.faults.action = 'join'
  target.faults.after = true
  await assert.rejects(target.client.join(invite.code), /通信できません/)
  assert.equal(target.link(), null)
  await target.client.join(invite.code)
  target.write({ ...target.read(), totalCount: 2 })
  target.faults.action = 'sync'
  target.faults.before = true
  await assert.rejects(target.client.sync())
  assert.equal(target.read().totalCount, 2)
  await target.client.sync()
  await source.client.sync()
  assert.equal(source.read().totalCount, 2)
})

test('changes made while a response is in flight survive rebasing onto the remote state', async () => {
  const service = api()
  const source = browser(service)
  await source.client.issueCode()
  source.write({ ...source.read(), totalCount: 1, usedIds: [1] })
  let changed = false
  source.faults.pause = async (body) => {
    if (body.action === 'sync' && !changed) { changed = true; source.write({ ...source.read(), totalCount: 2, usedIds: [1, 2] }) }
  }
  await source.client.sync()
  assert.equal(source.read().totalCount, 2)
  assert.deepEqual(source.read().usedIds, [1, 2])
  assert.equal(source.link().pending, null)
})

test('disconnect preserves data and a late response cannot reconnect the browser', async () => {
  const service = api()
  const source = browser(service)
  await source.client.issueCode()
  const data = source.read()
  let finish
  source.faults.pause = () => new Promise((resolve) => { finish = resolve })
  const syncing = source.client.sync()
  while (!finish) await new Promise((resolve) => setImmediate(resolve))
  source.client.disconnect()
  finish()
  await syncing
  assert.equal(source.link(), null)
  assert.deepEqual(source.read(), data)
  assert.equal(source.client.getStatus().linked, false)
})

test('unavailable browser storage and malformed codes fail without creating a link', async () => {
  const service = api()
  const source = browser(service)
  await assert.rejects(source.client.join('bad'), /12文字/)
  const blocked = createBrowserSyncClient({ getStorage() { throw new Error('blocked') } })
  await assert.rejects(blocked.issueCode(), /保存できません/)
  assert.equal(source.link(), null)
})

test('a lost join sums the original contribution once and preserves later local draws', async () => {
  const service = api()
  const source = browser(service, { ...defaultBrowserData(), totalCount: 10 })
  const target = browser(service, { ...defaultBrowserData(), totalCount: 5 })
  const invite = await source.client.issueCode()
  target.faults.action = 'join'
  target.faults.after = true
  await assert.rejects(target.client.join(invite.code))
  target.write({ ...target.read(), totalCount: 7 })
  await target.create().join(invite.code)
  await source.client.sync()
  assert.equal(target.read().totalCount, 17)
  assert.equal(source.read().totalCount, 17)
  await target.client.sync()
  assert.equal(target.read().totalCount, 17)
})

test('authenticated count commands can increase, reduce and zero a linked total without touching history or global queues', async () => {
  const service = api()
  const source = browser(service, { ...defaultBrowserData(), totalCount: 20, usedIds: [1], checkedIds: [2] })
  const target = browser(service, { ...defaultBrowserData(), totalCount: 4 })
  const invite = await source.client.issueCode()
  await target.client.join(invite.code)
  source.store.setItem('leapGlobalQuizCountQueue', '{"pending":2}')
  const auth = await source.client.authenticateAdmin(adminPassword)
  for (const count of [100, 10, 0]) {
    await source.client.setTotalCount(`set-total ${count}`, auth.session)
    await target.client.sync()
    assert.equal(source.read().totalCount, count)
    assert.equal(target.read().totalCount, count)
    assert.deepEqual(source.read().usedIds, [1])
    assert.deepEqual(source.read().checkedIds, [2])
  }
  assert.equal(source.store.getItem('leapGlobalQuizCountQueue'), '{"pending":2}')
  assert.ok(!JSON.stringify(source.link()).includes(auth.session))
})

test('unlinked count commands preserve in-flight draws and do not create a group or alter global queues', async () => {
  const service = api()
  const source = browser(service, { ...defaultBrowserData(), totalCount: 20 })
  source.store.setItem('leapGlobalQuizCountQueue', '{"pending":3}')
  const auth = await source.client.authenticateAdmin(adminPassword)
  source.faults.pause = async (body) => {
    if (body.action === 'command') source.write({ ...source.read(), totalCount: 22 })
  }
  await source.client.setTotalCount('set-total 5', auth.session)
  assert.equal(source.read().totalCount, 7)
  assert.equal(source.received.at(-1).totalCount, 7)
  assert.equal(source.link(), null)
  assert.equal(source.store.getItem('leapGlobalQuizCountQueue'), '{"pending":3}')
  source.faults.pause = null
  await assert.rejects(source.client.setTotalCount('set-total 9', 'invalid'), /認証/)
  assert.equal(source.read().totalCount, 7)
})

test('a lost count-command response remains durable and retries once after admin expiry and later remote draws', async () => {
  const service = api()
  const source = browser(service, { ...defaultBrowserData(), totalCount: 20 })
  const target = browser(service)
  const invite = await source.client.issueCode()
  await target.client.join(invite.code)
  const auth = await source.client.authenticateAdmin(adminPassword)
  source.faults.action = 'sync'
  source.faults.after = true
  await assert.rejects(source.client.setTotalCount('set-total 5', auth.session))
  assert.equal(source.link().pending.patch.totalOverride.count, 5)
  assert.ok(!JSON.stringify(source.link()).includes(auth.session))
  await target.client.sync()
  target.write({ ...target.read(), totalCount: 7 })
  await target.client.sync()
  source.write({ ...source.read(), totalCount: 21 })
  service.redis.clock += 16 * 60 * 1000
  await source.create().sync()
  await target.client.sync()
  assert.equal(source.read().totalCount, 8)
  assert.equal(target.read().totalCount, 8)
  assert.equal(source.link().pending, null)
})

test('signed commands preserve local draws during authorization and server writes', async () => {
  const service = api()
  const source = browser(service, { ...defaultBrowserData(), totalCount: 20 })
  await source.client.issueCode()
  const auth = await source.client.authenticateAdmin(adminPassword)
  let increments = 0
  source.faults.pause = async (body) => {
    if ((body.action === 'command' || body.patch?.totalOverride) && increments < 2) {
      source.write({ ...source.read(), totalCount: source.read().totalCount + 1 })
      increments += 1
    }
  }
  await source.client.setTotalCount('set-total 10', auth.session)
  assert.equal(source.read().totalCount, 12)
  const check = await service.call({ action: 'read', deviceId: source.link().deviceId }, source.link().token)
  assert.equal(check.data.data.totalCount, 12)
})

test('count overrides reject missing or tampered grants and cannot be reused for a different count or sequence', async () => {
  const service = api()
  const link = await group(service, { ...defaultBrowserData(), totalCount: 10 })
  const auth = await service.admin({ action: 'authenticate', password: adminPassword })
  const authorization = await service.admin({ action: 'command', command: 'set-total 5', link: { token: link.token, deviceId: id(1), seq: 1 } }, auth.data.session)
  const patch = { ...diffBrowserData(defaultBrowserData(), defaultBrowserData()), totalOverride: { count: 5, grant: authorization.data.grant } }
  const sync = (seq, value = patch) => service.call({ action: 'sync', deviceId: id(1), seq, patch: value }, link.token)
  assert.equal((await sync(1, { ...patch, totalOverride: { ...patch.totalOverride, count: 6 } })).statusCode, 403)
  assert.equal((await sync(1, { ...patch, totalOverride: { count: 5, grant: '' } })).statusCode, 403)
  assert.equal((await sync(1)).data.data.totalCount, 5)
  assert.equal((await sync(1)).data.data.totalCount, 5)
  assert.equal((await sync(2)).statusCode, 403)
})

test('real global-count queue excludes admin corrections, including initial migration, reload and subsequent draws', async () => {
  for (const linked of [false, true]) {
    const service = api()
    const source = browser(service, { ...defaultBrowserData(), totalCount: 20 },
      { beforeRemoteApply: (data) => queueInitialGlobalQuizCount(data.totalCount) })
    const previous = globalThis.localStorage
    globalThis.localStorage = source.store
    try {
      if (linked) await source.client.issueCode()
      const auth = await source.client.authenticateAdmin(adminPassword)
      await source.client.setTotalCount('set-total 1000', auth.session)
      assert.equal(getPendingGlobalQuizCount(), 20) // Only the original, unmigrated study total.
      queueInitialGlobalQuizCount(source.read().totalCount) // Remount / reload.
      assert.equal(getPendingGlobalQuizCount(), 20)
      await source.client.setTotalCount('set-total 0', auth.session)
      assert.equal(getPendingGlobalQuizCount(), 20)
      source.write({ ...source.read(), totalCount: 1 })
      queueInitialGlobalQuizCount(0)
      queueGlobalQuizIncrement()
      if (linked) await source.client.sync()
      assert.equal(getPendingGlobalQuizCount(), 21)
    } finally {
      if (previous === undefined) delete globalThis.localStorage
      else globalThis.localStorage = previous
    }
  }
})
