import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_SESSION_MS = 15 * 60 * 1000
const digest = (value) => createHash('sha256').update(value).digest()
const equal = (left, right) => timingSafeEqual(digest(left), digest(right))
const sign = (password, value) => createHmac('sha256', password).update(value).digest('base64url')

export function passwordMatches(actual, expected) {
  return typeof actual === 'string' && actual.length <= 1024 && Boolean(expected) && equal(actual, expected)
}

export function issueAdminSession(password, now = Date.now()) {
  const expiresAt = now + ADMIN_SESSION_MS
  const value = `admin-session:${expiresAt}`
  return { session: `${expiresAt}.${sign(password, value)}`, expiresAt }
}

export function verifyAdminSession(session, password, now = Date.now()) {
  if (!password || typeof session !== 'string') return false
  const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(session)
  return Boolean(match && Number(match[1]) > now && Number(match[1]) <= now + ADMIN_SESSION_MS &&
    equal(match[2], sign(password, `admin-session:${match[1]}`)))
}

// A persisted grant authorizes only one count at one device sequence. Unlike the
// short-lived admin session, it can safely survive an offline retry or reload.
export function issueCountGrant(password, { token, deviceId, seq, count }) {
  return sign(password, JSON.stringify(['set-total', token, deviceId, seq, count]))
}

export function verifyCountGrant(grant, fields, password = process.env.ADMIN_PASSWORD) {
  return Boolean(password && typeof grant === 'string' && equal(grant, issueCountGrant(password, fields)))
}
