import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'
import { parseAdminCommand } from '../src/utils/adminCommand.js'
import { issueAdminSession, issueCountGrant, passwordMatches, verifyAdminSession } from '../server/adminAuth.js'

const rateLimitScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return count
`

export function createAdminHandler({ getRedis = () => Redis.fromEnv(), getPassword = () => process.env.ADMIN_PASSWORD, now = Date.now } = {}) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Referrer-Policy', 'no-referrer')
    const send = (status, data) => response.status(status).json(data)
    try {
      if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return send(405, { error: 'Method not allowed' }) }
      const headers = request.headers || {}
      if (!/^application\/json(?:;|$)/i.test(headers['content-type'] || '')) return send(415, { error: 'JSON形式で送信してください。' })
      if (headers.origin) {
        let sameOrigin = false
        try { sameOrigin = new URL(headers.origin).host === (headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim() } catch { /* Invalid origin. */ }
        if (!sameOrigin) return send(403, { error: 'このサイトから操作してください。' })
      }
      const body = request.body
      if (!body || typeof body !== 'object' || JSON.stringify(body).length > 4096 || !['authenticate', 'command'].includes(body.action)) {
        return send(400, { error: '管理者リクエストが正しくありません。' })
      }
      const password = getPassword()
      if (!password) return send(503, { error: '管理者パスワードが設定されていません。' })
      const ip = headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown'
      const hash = createHash('sha256').update(String(ip)).digest('hex')
      const authenticating = body.action === 'authenticate'
      const count = await getRedis().createScript(rateLimitScript).eval(
        [`leaper:admin:limit:${body.action}:${hash}`], [authenticating ? '900' : '60'])
      if (Number(count) > (authenticating ? 10 : 30)) return send(429, { error: authenticating ? '認証の試行が続いています。15分ほど待って再試行してください。' : '操作が続いています。1分ほど待って再試行してください。' })
      if (authenticating) {
        if (!passwordMatches(body.password, password)) return send(401, { error: 'パスワードが違います。' })
        return send(200, issueAdminSession(password, now()))
      }
      const session = /^Bearer (.+)$/.exec(headers.authorization || '')?.[1]
      if (!verifyAdminSession(session, password, now())) return send(401, { error: '管理者モードの有効期限が切れました。もう一度認証してください。' })
      let command
      try { command = parseAdminCommand(body.command) } catch (error) { return send(400, { error: error.message }) }
      if (body.link !== undefined) {
        const link = body.link
        if (!link || !/^[a-f0-9]{64}$/.test(link.token || '') || !/^[a-f0-9]{32}$/.test(link.deviceId || '') || !Number.isSafeInteger(link.seq) || link.seq < 1) {
          return send(400, { error: 'ブラウザの連携情報が正しくありません。' })
        }
        return send(200, { ...command, grant: issueCountGrant(password, { ...link, count: command.count }) })
      }
      return send(200, command)
    } catch {
      return send(503, { error: '管理者モードに接続できません。通信状況を確認して再試行してください。' })
    }
  }
}

export default createAdminHandler()
