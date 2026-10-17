import { applyBrowserPatch, diffBrowserData, hasBrowserChanges, readBrowserData, SHARED_STORAGE_KEYS, validateBrowserData, writeBrowserData } from './browserData.js'
import { LOCAL_STUDY_CHANGE, REMOTE_STUDY_CHANGE } from './syncEvents.js'
import { queueInitialGlobalQuizCount } from './globalQuizCount.js'

export const BROWSER_LINK_KEY = 'leaperBrowserLink'
const JOIN_ATTEMPT_KEY = 'leaperBrowserJoinAttempt'
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const newId = () => globalThis.crypto.randomUUID().replaceAll('-', '')

export function createBrowserSyncClient({
  getStorage = () => globalThis.localStorage,
  getDocument = () => globalThis.document,
  fetchImpl = (...args) => fetch(...args),
  beforeRemoteApply = (data) => queueInitialGlobalQuizCount(data.totalCount),
  onRemoteData = (data) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(REMOTE_STUDY_CHANGE, { detail: data }))
  },
  lock = (run) => globalThis.navigator?.locks ? navigator.locks.request('leaper-browser-sync', run) : run(),
} = {}) {
  let status = { linked: false, state: 'idle', error: '', lastSync: null }
  let inFlight = null
  let timer
  let stopped = false
  const subscribers = new Set()
  const readJSON = (key) => {
    try { return JSON.parse(getStorage().getItem(key)) } catch { return null }
  }
  const readLink = () => {
    const link = readJSON(BROWSER_LINK_KEY)
    return link && /^[a-f0-9]{64}$/.test(link.token) && /^[a-f0-9]{32}$/.test(link.deviceId) ? link : null
  }
  const capture = () => {
    let cookie = ''
    try { cookie = getDocument()?.cookie || '' } catch { /* Cookie access may be blocked. */ }
    return readBrowserData(getStorage(), cookie)
  }
  const updateStatus = (next) => {
    status = { ...status, linked: Boolean(readLink()), ...next }
    for (const notify of subscribers) notify(status)
  }
  const saveLink = (link) => getStorage().setItem(BROWSER_LINK_KEY, JSON.stringify(link))
  const requireStorage = () => {
    const key = `leaper-sync-check-${newId()}`
    try { getStorage().setItem(key, '1'); getStorage().removeItem(key) } catch {
      throw new Error('このブラウザでデータを保存できません。ブラウザの保存設定を確認してください。')
    }
  }
  async function request(action, body, link) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetchImpl('/api/browser-sync', {
        method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(link ? { Authorization: `Bearer ${link.token}` } : {}) },
        body: JSON.stringify({ action, ...body }),
      })
      let data
      try { data = await response.json() } catch { throw new Error('ブラウザ連携を利用できません。時間をおいて再試行してください。') }
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '連携に失敗しました。再試行してください。')
      return data
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('通信できません。学習データはこのブラウザに残っています。再試行してください。')
      throw error
    } finally { clearTimeout(timeout) }
  }
  function applyRemote(remote, baseline, commit = () => {}) {
    const current = capture()
    const remaining = diffBrowserData(baseline, current)
    const next = applyBrowserPatch(remote, remaining)
    const changed = !equal(next, current)
    if (changed) {
      beforeRemoteApply(current)
      writeBrowserData(getStorage(), getDocument(), next)
    }
    try { commit() } catch (error) {
      if (changed) {
        try { writeBrowserData(getStorage(), getDocument(), current) } catch { /* Preserve the pending retry. */ }
      }
      throw error
    }
    if (changed) onRemoteData(next)
    return remaining
  }

  async function runSync() {
    requireStorage()
    for (let round = 0; round < 3; round += 1) {
      let link = readLink()
      if (!link) return
      updateStatus({ state: 'syncing', error: '' })
      if (!link.pending) {
        const snapshot = capture()
        const patch = diffBrowserData(link.base, snapshot)
        if (hasBrowserChanges(patch)) {
          link = { ...link, pending: { seq: link.seq + 1, patch, snapshot } }
          saveLink(link) // Persist the exact retry before issuing the write.
        }
      }
      const result = link.pending
        ? await request('sync', { deviceId: link.deviceId, seq: link.pending.seq, patch: link.pending.patch }, link)
        : await request('read', { deviceId: link.deviceId }, link)
      const remote = validateBrowserData(result.data)
      if (readLink()?.token !== link.token || readLink()?.deviceId !== link.deviceId) return // Disconnected or relinked during the request.
      const remaining = applyRemote(remote, link.pending?.snapshot || link.base, () => {
        saveLink({ ...link, base: remote, seq: link.pending?.seq || link.seq, pending: null })
      })
      updateStatus({ state: 'ready', error: '', lastSync: Date.now() })
      if (!hasBrowserChanges(remaining)) return
    }
  }

  const client = {
    getStatus: () => ({ ...status, linked: Boolean(readLink()) }),
    subscribe(notify) { subscribers.add(notify); return () => subscribers.delete(notify) },
    sync() {
      if (!readLink()) return Promise.resolve()
      if (!inFlight) {
        inFlight = Promise.resolve().then(() => lock(runSync)).catch((error) => {
          updateStatus({ state: 'error', error: error.message })
          throw error
        }).finally(() => { inFlight = null })
      }
      return inFlight
    },
    async issueCode() {
      requireStorage()
      if (!readLink()) {
        const snapshot = capture()
        const deviceId = newId()
        const result = await request('create', { deviceId, data: snapshot })
        const data = validateBrowserData(result.data)
        if (!/^[a-f0-9]{64}$/.test(result.token || '')) throw new Error('連携の応答が正しくありません。')
        saveLink({ token: result.token, deviceId, seq: 0, base: data, pending: null })
        updateStatus({ state: 'ready', error: '' })
      }
      await client.sync()
      const link = readLink()
      const result = await request('invite', { deviceId: link.deviceId }, link)
      if (!/^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/.test(result.code || '') || !Number.isFinite(result.expiresAt)) throw new Error('連携コードの応答が正しくありません。')
      return result
    },
    async join(code) {
      requireStorage()
      if (readLink()) throw new Error('別のグループにつなぐ場合は、先にこのブラウザの連携を解除してください。')
      const normalized = code.replace(/[\s-]/g, '').toUpperCase()
      if (!/^[A-F0-9]{12}$/.test(normalized)) throw new Error('12文字の連携コードを入力してください。')
      let attempt = readJSON(JOIN_ATTEMPT_KEY)
      if (attempt?.code !== normalized) {
        attempt = { code: normalized, deviceId: newId() }
        getStorage().setItem(JOIN_ATTEMPT_KEY, JSON.stringify(attempt))
      }
      const snapshot = capture()
      const result = await request('join', { code: normalized, deviceId: attempt.deviceId, data: snapshot })
      const data = validateBrowserData(result.data)
      if (!/^[a-f0-9]{64}$/.test(result.token || '')) throw new Error('連携の応答が正しくありません。')
      // Imported totals must never be migrated again into the anonymous global counter.
      beforeRemoteApply(snapshot)
      applyRemote(data, snapshot, () => {
        saveLink({ token: result.token, deviceId: attempt.deviceId, seq: 0, base: data, pending: null })
      })
      getStorage().removeItem(JOIN_ATTEMPT_KEY)
      updateStatus({ state: 'ready', error: '', lastSync: Date.now() })
      await client.sync()
    },
    disconnect() {
      clearTimeout(timer)
      getStorage().removeItem(BROWSER_LINK_KEY)
      getStorage().removeItem(JOIN_ATTEMPT_KEY)
      updateStatus({ state: 'idle', error: '', lastSync: null })
    },
    start() {
      if (typeof window === 'undefined') return () => {}
      stopped = false
      const sync = () => {
        if (!stopped && document.visibilityState !== 'hidden') client.sync().catch(() => {})
      }
      const schedule = () => { clearTimeout(timer); timer = setTimeout(sync, 1000) }
      const storage = (event) => {
        if (event.key === BROWSER_LINK_KEY || SHARED_STORAGE_KEYS.includes(event.key)) {
          updateStatus({})
          onRemoteData(capture())
          schedule()
        }
      }
      window.addEventListener(LOCAL_STUDY_CHANGE, schedule)
      window.addEventListener('online', sync)
      window.addEventListener('focus', sync)
      window.addEventListener('storage', storage)
      document.addEventListener('visibilitychange', sync)
      const interval = setInterval(sync, 30000)
      sync()
      return () => {
        stopped = true
        clearInterval(interval)
        clearTimeout(timer)
        window.removeEventListener(LOCAL_STUDY_CHANGE, schedule)
        window.removeEventListener('online', sync)
        window.removeEventListener('focus', sync)
        window.removeEventListener('storage', storage)
        document.removeEventListener('visibilitychange', sync)
      }
    },
  }
  return client
}

export const browserSyncClient = createBrowserSyncClient()
