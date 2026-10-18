import test from 'node:test'
import assert from 'node:assert/strict'
import { createAdminHandler } from '../api/admin.js'
import { parseAdminCommand } from '../src/utils/adminCommand.js'
import { ADMIN_SESSION_MS, issueAdminSession, issueCountGrant, passwordMatches, verifyAdminSession, verifyCountGrant } from '../server/adminAuth.js'

const password = 'test-only-admin-password'
const now = 1800000000000

test('admin commands accept only a nonnegative safe integer count', () => {
  for (const count of [0, 12345, Number.MAX_SAFE_INTEGER]) assert.deepEqual(parseAdminCommand(` set-total ${count} `), { count })
  for (const command of ['', 'reset', 'set-total', 'set-total -1', 'set-total 1.5', 'set-total 1e3', 'set-total 01', 'set-total Infinity', 'set-total 9007199254740992', 'set-total 2 extra', null]) {
    assert.throws(() => parseAdminCommand(command), /0以上の整数/)
  }
})

test('admin sessions expire, detect tampering and are invalidated by password rotation', () => {
  assert.equal(passwordMatches(password, password), true)
  assert.equal(passwordMatches('wrong', password), false)
  assert.equal(passwordMatches('', ''), false)
  const { session, expiresAt } = issueAdminSession(password, now)
  assert.equal(expiresAt, now + ADMIN_SESSION_MS)
  assert.equal(verifyAdminSession(session, password, now), true)
  assert.equal(verifyAdminSession(session, password, expiresAt), false)
  assert.equal(verifyAdminSession(`${session}x`, password, now), false)
  assert.equal(verifyAdminSession(session, 'changed', now), false)
  const fields = { token: 'a'.repeat(64), deviceId: 'b'.repeat(32), seq: 1, count: 12 }
  const grant = issueCountGrant(password, fields)
  assert.equal(verifyCountGrant(grant, fields, password), true)
  for (const change of [{ count: 13 }, { seq: 2 }, { token: 'c'.repeat(64) }, { deviceId: 'd'.repeat(32) }]) {
    assert.equal(verifyCountGrant(grant, { ...fields, ...change }, password), false)
  }
})

function api(config = {}) {
  let clock = now
  const limits = new Map()
  const handler = createAdminHandler({
    getPassword: () => password, now: () => clock,
    getRedis: () => ({ createScript: () => ({ eval: async ([key], [seconds]) => {
      const entry = limits.get(key)
      const value = entry && entry.until > clock ? entry.value + 1 : 1
      limits.set(key, { value, until: value === 1 ? clock + Number(seconds) * 1000 : entry.until })
      return value
    } }) }), ...config,
  })
  return { advance: (ms) => { clock += ms }, call: async (body, token, extra = {}) => {
    const response = { headers: {}, status(code) { this.statusCode = code; return this }, setHeader(key, value) { this.headers[key] = value }, json(data) { this.data = data; return this } }
    await handler({ method: 'POST', body, headers: { 'content-type': 'application/json', host: 'leaper.test', origin: 'https://leaper.test',
      ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...extra }, response)
    return response
  } }
}

test('admin API requires server configuration and authentication for every command', async () => {
  assert.equal((await api({ getPassword: () => '' }).call({ action: 'authenticate', password })).statusCode, 503)
  const service = api()
  assert.equal((await service.call({ action: 'authenticate', password: 'wrong' })).statusCode, 401)
  assert.equal((await service.call({ action: 'command', command: 'set-total 7' })).statusCode, 401)
  const auth = await service.call({ action: 'authenticate', password })
  assert.equal(auth.statusCode, 200)
  assert.equal(auth.headers['Cache-Control'], 'no-store')
  const response = await service.call({ action: 'command', command: 'set-total 7' }, auth.data.session)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.data, { count: 7 })
  assert.equal((await service.call({ action: 'command', command: 'set-total -1' }, auth.data.session)).statusCode, 400)
  assert.equal((await service.call({ action: 'command', command: 'set-total 2', link: {} }, auth.data.session)).statusCode, 400)
  service.advance(ADMIN_SESSION_MS)
  assert.equal((await service.call({ action: 'command', command: 'set-total 2' }, auth.data.session)).statusCode, 401)
})

test('admin API rejects foreign origins, oversized bodies and unsupported methods and limits password attempts', async () => {
  const service = api()
  assert.equal((await service.call({}, null, { method: 'GET' })).statusCode, 405)
  assert.equal((await service.call({}, null, { headers: { 'content-type': 'text/plain' } })).statusCode, 415)
  assert.equal((await service.call({}, null, { headers: { 'content-type': 'application/json', host: 'leaper.test', origin: 'https://foreign.test' } })).statusCode, 403)
  assert.equal((await service.call({ action: 'authenticate', password: 'x'.repeat(4096) })).statusCode, 400)
  for (let index = 0; index < 10; index += 1) assert.equal((await service.call({ action: 'authenticate', password: 'wrong' })).statusCode, 401)
  assert.equal((await service.call({ action: 'authenticate', password })).statusCode, 429)
  service.advance(ADMIN_SESSION_MS)
  assert.equal((await service.call({ action: 'authenticate', password })).statusCode, 200)
})
