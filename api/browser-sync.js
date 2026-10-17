import { createHash, randomBytes } from 'node:crypto'
import { Redis } from '@upstash/redis'
import { applyBrowserPatch, mergeJoiningData, validateBrowserData, validatePatch } from '../src/utils/browserData.js'

export const LINK_TTL_SECONDS = 180 * 24 * 60 * 60
export const CODE_TTL_SECONDS = 5 * 60
const digest = (value) => createHash('sha256').update(value).digest('hex')
const groupKey = (token) => `leaper:browser-sync:group:${digest(token)}`
const codeKey = (hash) => `leaper:browser-sync:code:${hash}`
const parse = (value) => typeof value === 'string' ? JSON.parse(value) : value

// Compare the entire stored document so concurrent devices cannot overwrite each other.
// Code consumption, membership, and retry receipt are committed in the same transaction.
export const compareAndSwapScript = `
  local current = redis.call('GET', KEYS[1])
  if not current then return {-1, ''} end
  if current ~= ARGV[1] then return {0, current} end
  if ARGV[4] ~= '' and redis.call('GET', KEYS[2]) ~= ARGV[4] then return {-2, ''} end
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  if ARGV[4] ~= '' then
    redis.call('DEL', KEYS[2])
    redis.call('SET', KEYS[3], ARGV[5], 'EX', ARGV[6])
  end
  return {1, ARGV[2]}
`

const rateLimitScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return count
`

class SyncError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function validated(validate, value) {
  try { return validate(value) } catch { throw new SyncError(400, '連携データの形式が正しくありません。') }
}

export function createBrowserSyncHandler(redis, { now = Date.now } = {}) {
  const cas = redis.createScript(compareAndSwapScript)
  const rateLimit = redis.createScript(rateLimitScript)
  const expired = () => new SyncError(410, '連携コードが無効か、有効期限が切れています。新しいコードを発行してください。')
  async function load(token) {
    const record = parse(await redis.get(groupKey(token)))
    if (!record) throw new SyncError(401, '連携情報の有効期限が切れています。一度解除して、もう一度連携してください。')
    return record
  }

  async function update(token, change, { invite, receiptKey, receipt } = {}) {
    let record = await load(token)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const next = change(record)
      if (next === record) return record
      next.revision = record.revision + 1
      const keys = [groupKey(token), ...(invite ? [codeKey(invite.hash), receiptKey] : [])]
      const result = await cas.eval(keys, [JSON.stringify(record), JSON.stringify(next), String(LINK_TTL_SECONDS),
        invite ? JSON.stringify(invite.value) : '', receipt ? JSON.stringify(receipt) : '', String(CODE_TTL_SECONDS)])
      if (Number(result[0]) === 1) return next
      if (Number(result[0]) === -2) throw expired()
      if (Number(result[0]) === -1) throw new SyncError(401, '連携情報が見つかりません。もう一度連携してください。')
      record = parse(result[1])
    }
    throw new SyncError(409, 'ほかのブラウザで更新中です。少し待って再試行してください。')
  }

  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Referrer-Policy', 'no-referrer')
    const send = (status, data) => response.status(status).json(data)
    try {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        return send(405, { error: 'Method not allowed' })
      }
      const headers = request.headers || {}
      if (!/^application\/json(?:;|$)/i.test(headers['content-type'] || '')) throw new SyncError(415, 'JSON形式で送信してください。')
      if (headers.origin) {
        const host = (headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim()
        let sameOrigin = false
        try { sameOrigin = new URL(headers.origin).host === host } catch { /* Invalid origin. */ }
        if (!sameOrigin) throw new SyncError(403, 'このサイトから連携してください。')
      }
      const body = request.body
      if (!body || typeof body !== 'object' || JSON.stringify(body).length > 100000) throw new SyncError(413, '連携データが大きすぎるか、形式が正しくありません。')
      const { action, deviceId } = body
      if (!['create', 'invite', 'join', 'read', 'sync'].includes(action) || !/^[a-f0-9]{32}$/.test(deviceId || '')) throw new SyncError(400, '連携リクエストが正しくありません。')
      if (['create', 'invite', 'join'].includes(action)) {
        // Vercel supplies this address. Store only its hash, never the address itself.
        const ip = headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown'
        const count = await rateLimit.eval([`leaper:browser-sync:limit:${digest(String(ip))}`], ['300'])
        if (Number(count) > 30) throw new SyncError(429, '操作が続いています。5分ほど待って再試行してください。')
      }

      if (action === 'create') {
        const data = validated(validateBrowserData, body.data)
        const token = randomBytes(32).toString('hex')
        const record = { revision: 1, data, clients: { [deviceId]: 0 }, inviteHash: null }
        if (!await redis.set(groupKey(token), JSON.stringify(record), { ex: LINK_TTL_SECONDS, nx: true })) throw new SyncError(409, '連携を作成できませんでした。再試行してください。')
        return send(200, { token, data })
      }

      if (action === 'join') {
        const code = typeof body.code === 'string' ? body.code.replace(/[\s-]/g, '').toUpperCase() : ''
        if (!/^[A-F0-9]{12}$/.test(code)) throw expired()
        const hash = digest(code)
        const receiptKey = `leaper:browser-sync:receipt:${hash}:${deviceId}`
        const previous = parse(await redis.get(receiptKey))
        if (previous) return send(200, { token: previous.token, data: (await load(previous.token)).data })
        const invite = parse(await redis.get(codeKey(hash)))
        if (!invite || invite.expiresAt <= now()) throw expired()
        const data = validated(validateBrowserData, body.data)
        const record = await update(invite.token, (current) => {
          if (current.inviteHash !== hash) throw expired()
          if (Object.keys(current.clients).length >= 64) throw new SyncError(409, 'この連携グループはブラウザ数の上限に達しています。')
          return { ...current, data: mergeJoiningData(current.data, data), clients: { ...current.clients, [deviceId]: 0 }, inviteHash: null }
        }, { invite: { hash, value: invite }, receiptKey, receipt: { token: invite.token } })
        return send(200, { token: invite.token, data: record.data })
      }

      const token = /^Bearer ([a-f0-9]{64})$/.exec(headers.authorization || '')?.[1]
      if (!token) throw new SyncError(401, 'ブラウザの連携が必要です。')
      if (['read', 'sync'].includes(action)) {
        const count = await rateLimit.eval([`leaper:browser-sync:traffic:${digest(token + deviceId)}`], ['60'])
        if (Number(count) > 120) throw new SyncError(429, '同期が続いています。1分ほど待って再試行してください。')
      }
      const authorize = (record) => {
        if (!Object.hasOwn(record.clients, deviceId)) throw new SyncError(401, 'このブラウザは連携されていません。')
      }
      if (action === 'invite') {
        const code = randomBytes(6).toString('hex').toUpperCase()
        const hash = digest(code)
        const expiresAt = now() + CODE_TTL_SECONDS * 1000
        const invite = { token, expiresAt }
        const current = await load(token)
        authorize(current)
        if (!await redis.set(codeKey(hash), JSON.stringify(invite), { ex: CODE_TTL_SECONDS, nx: true })) throw new SyncError(409, '新しいコードを発行し直してください。')
        await update(token, (record) => { authorize(record); return { ...record, inviteHash: hash } })
        return send(200, { code: code.match(/.{4}/g).join('-'), expiresAt })
      }
      if (action === 'read') {
        const record = await load(token)
        authorize(record)
        await redis.expire(groupKey(token), LINK_TTL_SECONDS)
        return send(200, { data: record.data })
      }
      const patch = validated(validatePatch, body.patch)
      if (!Number.isSafeInteger(body.seq) || body.seq < 1) throw new SyncError(400, '同期番号が正しくありません。')
      const record = await update(token, (current) => {
        authorize(current)
        if (body.seq <= current.clients[deviceId]) return current // Retry after a lost response.
        if (body.seq !== current.clients[deviceId] + 1) throw new SyncError(409, '同期の順序が一致しません。再試行してください。')
        const data = validated((value) => applyBrowserPatch(current.data, value), patch)
        return { ...current, data, clients: { ...current.clients, [deviceId]: body.seq } }
      })
      return send(200, { data: record.data })
    } catch (error) {
      return send(error instanceof SyncError ? error.status : 503,
        { error: error instanceof SyncError ? error.message : 'ブラウザ連携に接続できません。通信状況を確認して再試行してください。' })
    }
  }
}

let handler
export default function browserSyncHandler(request, response) {
  try {
    if (!handler) handler = createBrowserSyncHandler(Redis.fromEnv())
    return handler(request, response)
  } catch {
    response.setHeader('Cache-Control', 'no-store')
    return response.status(503).json({ error: 'ブラウザ連携を利用できません。時間をおいて再試行してください。' })
  }
}
