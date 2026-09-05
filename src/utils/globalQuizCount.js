const QUEUE_KEY = 'leapGlobalQuizCountQueue'
const MIGRATED_KEY = 'leapGlobalQuizCountMigrated'
const MAX_BATCH_INCREMENT = 5000

let syncInProgress = null

function emptyQueue() {
  return { pending: 0, inFlight: null, migrationQueued: false }
}

function readQueue() {
  try {
    const value = JSON.parse(localStorage.getItem(QUEUE_KEY))
    if (!value || !Number.isSafeInteger(value.pending) || value.pending < 0) return emptyQueue()
    return {
      pending: value.pending,
      inFlight: value.inFlight ?? null,
      migrationQueued: Boolean(value.migrationQueued),
    }
  } catch {
    return emptyQueue()
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch (error) {
    console.error('共有累計語数キューの保存に失敗しました:', error)
  }
}

function isMigrated() {
  try {
    return localStorage.getItem(MIGRATED_KEY) === 'true'
  } catch {
    return false
  }
}

function markMigrated() {
  try {
    localStorage.setItem(MIGRATED_KEY, 'true')
  } catch (error) {
    console.error('共有累計語数の移行状態を保存できませんでした:', error)
  }
}

function createBatchId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replaceAll('-', '')
  return `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`
}

export function queueInitialGlobalQuizCount(count) {
  if (isMigrated()) return
  const queue = readQueue()
  if (queue.migrationQueued || queue.inFlight?.includesMigration) return

  const safeCount = Number.isSafeInteger(count) && count > 0 ? count : 0
  if (safeCount === 0) {
    markMigrated()
    return
  }

  queue.pending += safeCount
  queue.migrationQueued = true
  writeQueue(queue)
}

export function queueGlobalQuizIncrement() {
  const queue = readQueue()
  queue.pending += 1
  writeQueue(queue)
}

export function getPendingGlobalQuizCount() {
  return readQueue().pending
}

function prepareBatch() {
  const queue = readQueue()
  if (queue.inFlight) return queue.inFlight
  if (queue.pending === 0) return null

  const increment = Math.min(queue.pending, MAX_BATCH_INCREMENT)
  const batch = {
    id: createBatchId(),
    increment,
    includesMigration: queue.migrationQueued,
  }
  queue.pending -= increment
  queue.inFlight = batch
  if (batch.includesMigration) queue.migrationQueued = false
  writeQueue(queue)
  return batch
}

function completeBatch(batch) {
  const queue = readQueue()
  if (queue.inFlight?.id !== batch.id) return
  queue.inFlight = null
  writeQueue(queue)
  if (batch.includesMigration) markMigrated()
}

async function requestGlobalQuizCount(fetchImpl) {
  const batch = prepareBatch()
  const response = await fetchImpl('/api/global-quiz-count', batch ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId: batch.id, increment: batch.increment }),
  } : undefined)

  if (!response.ok) throw new Error(`Global count request failed: ${response.status}`)
  const data = await response.json()
  if (!Number.isSafeInteger(data.count) || data.count < 0) {
    throw new Error('Global count response was invalid')
  }
  if (batch) completeBatch(batch)
  return data.count
}

export function syncGlobalQuizCount(fetchImpl = fetch) {
  if (!syncInProgress) {
    syncInProgress = requestGlobalQuizCount(fetchImpl).finally(() => {
      syncInProgress = null
    })
  }
  return syncInProgress
}
