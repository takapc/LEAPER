import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { advanceSvlSession } from '../src/utils/svlData.js'

function actualHandler(path, name, state) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
  const start = source.indexOf(`  const ${name} =`)
  assert.ok(start >= 0)
  const handler = source.slice(start, source.indexOf('\n  }\n', start) + 4)
  runInContext(`${handler}\nthis.invoke = ${name}`, createContext(state))
  return state.invoke
}

test('restoring LEAP after a remote mode change displays a card without counting or marking a fresh draw', async () => {
  const state = {
    restoreOnly: true, usedWordIdsRef: { current: [] }, draws: 0, resets: 0,
    setImportedDataset() {}, getUsedWordIdsFromLocalStorage: () => [2], setUsedWordIds() {},
    setLoading() {}, setError() {}, setWords() {}, setFilteredWords() {},
    getLocalWordData: () => [{ id: 1 }, { id: 2 }], getFilteredWords: ({ wordList }) => wordList,
  }
  state.resetNavigation = () => { state.resets += 1 }
  state.showWord = (word) => { state.card = word }
  state.selectRandomWord = () => { state.draws += 1 }
  const load = actualHandler('../src/App.jsx', 'loadWordData', state)
  await load()
  await load() // React StrictMode may replay the mount effect.
  assert.equal(state.card.id, 1)
  assert.equal(state.draws, 0)
  assert.equal(state.resets, 2)
  assert.deepEqual(state.usedWordIdsRef.current, [2])
  state.restoreOnly = false
  await load()
  assert.equal(state.draws, 1)
})

test('restoring an SVL card does not migrate or increment counters; a subsequent explicit draw does', () => {
  const state = {
    sessionRef: { current: { history: [], index: -1, usedIds: [] } }, total: 12, global: 0, migrations: [], syncTimer: { current: null },
    advanceSvlSession: (session, words) => advanceSvlSession(session, words, () => 0),
    setSession() {}, setRevealed() {}, clearTimeout() {}, setTimeout: () => 1,
  }
  state.getTotalQuizCountFromLocalStorage = () => state.total
  state.saveTotalQuizCountToLocalStorage = (value) => { state.total = value }
  state.queueInitialGlobalQuizCount = (value) => state.migrations.push(value)
  state.queueGlobalQuizIncrement = () => { state.global += 1 }
  const next = actualHandler('../src/components/SvlQuiz.jsx', 'next', state)
  const words = [{ id: 1 }, { id: 2 }]
  next(words, { record: false })
  assert.equal(state.sessionRef.current.history.length, 1)
  assert.equal(state.total, 12)
  assert.equal(state.global, 0)
  assert.deepEqual(state.migrations, [])
  next(words)
  assert.equal(state.total, 13)
  assert.equal(state.global, 1)
  assert.deepEqual(state.migrations, [12])
})
