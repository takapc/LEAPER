import test from 'node:test'
import assert from 'node:assert/strict'
import { createGlobalQuizCountHandler } from '../api/global-quiz-count.js'
import {
  getPendingGlobalQuizCount,
  queueGlobalQuizIncrement,
  queueInitialGlobalQuizCount,
  syncGlobalQuizCount,
} from '../src/utils/globalQuizCount.js'

function installLocalStorage() {
  const values = new Map()
  global.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  return values
}

test('queues the existing local total once and keeps new increments pending', async () => {
  const values = installLocalStorage()
  queueInitialGlobalQuizCount(12)
  queueInitialGlobalQuizCount(12)
  queueGlobalQuizIncrement()
  assert.equal(getPendingGlobalQuizCount(), 13)

  const calls = []
  const count = await syncGlobalQuizCount(async (_url, options) => {
    calls.push(JSON.parse(options.body))
    return { ok: true, json: async () => ({ count: 113 }) }
  })

  assert.equal(count, 113)
  assert.equal(calls[0].increment, 13)
  assert.equal(getPendingGlobalQuizCount(), 0)
  assert.equal(values.get('leapGlobalQuizCountMigrated'), 'true')
  delete global.localStorage
})

test('keeps a failed batch for an idempotent retry', async () => {
  installLocalStorage()
  queueGlobalQuizIncrement()
  let firstBatch
  await assert.rejects(syncGlobalQuizCount(async (_url, options) => {
    firstBatch = JSON.parse(options.body)
    return { ok: false, status: 503 }
  }))

  let retriedBatch
  await syncGlobalQuizCount(async (_url, options) => {
    retriedBatch = JSON.parse(options.body)
    return { ok: true, json: async () => ({ count: 1 }) }
  })
  assert.deepEqual(retriedBatch, firstBatch)
  delete global.localStorage
})

test('API validates batches and returns the atomically updated count', async () => {
  const evalCalls = []
  const redis = {
    get: async () => null,
    createScript: () => ({
      eval: async (keys, args) => {
        evalCalls.push({ keys, args })
        return 42
      },
    }),
  }
  const handler = createGlobalQuizCountHandler(redis)
  const makeResponse = () => ({
    headers: {},
    setHeader(key, value) { this.headers[key] = value },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  })

  const invalidResponse = makeResponse()
  await handler({ method: 'POST', body: { batchId: 'short', increment: 1 } }, invalidResponse)
  assert.equal(invalidResponse.statusCode, 400)

  const response = makeResponse()
  await handler({ method: 'POST', body: { batchId: '1234567890abcdef', increment: 3 } }, response)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { count: 42 })
  assert.equal(evalCalls[0].args[0], '3')
})
