import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceInorganicSession, readInorganicSession, saveInorganicSession, selectInorganicOrder } from '../src/utils/inorganicSession.js'

function memoryStorage(entries = []) {
  const values = new Map(entries)
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('資料順とランダムの進捗を別々に保持し、再読み込みしても復元する', () => {
  const storage = memoryStorage([['leaper:inorganic:position', '2']])
  let session = readInorganicSession(4, storage)
  assert.equal(session.orderedPosition, 2)
  session = selectInorganicOrder(session, 'random', 4, () => 0)
  session = advanceInorganicSession(session, 4)
  const random = session.random
  session = selectInorganicOrder(session, 'source', 4)
  assert.equal(session.orderedPosition, 2)
  session = advanceInorganicSession(session, 4)
  session = advanceInorganicSession(session, 4)
  assert.equal(session.orderedPosition, 0)
  session = selectInorganicOrder(session, 'random', 4)
  assert.equal(session.random, random)
  saveInorganicSession(session, storage)
  assert.deepEqual(readInorganicSession(4, storage), session)
})

test('ランダムで全問が一度ずつ出題され、周回の境目も連続しない', () => {
  const count = 5
  let session = selectInorganicOrder(readInorganicSession(count, memoryStorage()), 'random', count, () => 0.99)
  const first = []
  const second = []
  for (const cycle of [first, second]) {
    for (let i = 0; i < count; i += 1) {
      cycle.push(session.random.order[session.random.position])
      session = advanceInorganicSession(session, count, () => 0)
    }
  }
  assert.deepEqual(first, [0, 1, 2, 3, 4])
  assert.deepEqual([...new Set(second)].sort(), first)
  assert.notEqual(first.at(-1), second[0])
  // With this shuffle the unadjusted first draw of the next cycle is card 1.
  const previous = selectInorganicOrder(readInorganicSession(count, memoryStorage()), 'random', count, () => 0.99)
  previous.random = { order: [0, 2, 3, 4, 1], position: count - 1 }
  const next = advanceInorganicSession(previous, count, () => 0)
  assert.notEqual(next.random.order[0], 1)
})

test('無効なランダム履歴から資料順へ戻り、保存できないときも使える', () => {
  const storage = memoryStorage()
  saveInorganicSession({ order: 'random', orderedPosition: 1, random: { order: [0, 0], position: 0 } }, storage)
  assert.deepEqual(readInorganicSession(2, storage), { order: 'source', orderedPosition: 1, random: null })
  const unavailable = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  const fallback = readInorganicSession(2, unavailable)
  assert.equal(fallback.orderedPosition, 0)
  assert.doesNotThrow(() => saveInorganicSession(fallback, unavailable))
})
