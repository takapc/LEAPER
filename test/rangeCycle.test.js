import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import * as quizLogic from '../src/utils/quizLogic.js'

const words = JSON.parse(readFileSync(new URL('../src/data/words.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// Exercise the actual draw handler, including its state and storage updates.
function session(wordList, usedIds) {
  const state = {
    ...quizLogic,
    pickRandomUnusedWord: (pool, ids) => quizLogic.pickRandomUnusedWord(pool, ids, () => 0),
    filteredWords: wordList,
    usedWordIdsRef: { current: [...usedIds] },
    usedWordIds: [...usedIds],
    storedIds: [...usedIds],
    draws: 0,
    notices: [],
    wordHistory: [],
    historyIndex: -1,
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
  }
  state.setUsedWordIds = (ids) => { state.usedWordIds = [...ids] }
  state.saveUsedWordIdsToLocalStorage = (ids) => { state.storedIds = [...ids] }
  state.clearUsedWordIdsFromLocalStorage = () => { state.storedIds = [] }
  state.incrementTotalQuizCount = () => { state.draws += 1 }
  state.toast = (notice) => state.notices.push(notice)
  state.setCurrentWord = (word) => { state.currentWord = word }
  state.setShowAnswer = (value) => { state.showAnswer = value }
  state.setNavigation = (update) => {
    const navigation = typeof update === 'function'
      ? update({ history: state.wordHistory, index: state.historyIndex })
      : update
    state.wordHistory = navigation.history
    state.historyIndex = navigation.index
    state.canGoPrevious = state.historyIndex > 0
  }
  const context = createContext(state)
  for (const name of ['showWord', 'selectRandomWord', 'handlePrevious', 'handleNext']) {
    const start = source.indexOf(`  const ${name} =`)
    assert.ok(start >= 0, `${name} handler exists`)
    const handler = source.slice(start, source.indexOf('\n  }\n', start) + 4)
    runInContext(`${handler}\nthis.${name} = ${name}`, context)
  }
  return state
}

function assertUsedIds(s, expected) {
  assert.deepEqual(Array.from(s.usedWordIdsRef.current), expected)
  assert.deepEqual(s.usedWordIds, expected)
  assert.deepEqual(s.storedIds, expected)
}

test('resetUsedWordIdsForWords preserves the input and IDs outside the exact pool', () => {
  const usedIds = [1, 100, 200, 400, 500]
  assert.deepEqual(quizLogic.resetUsedWordIdsForWords(usedIds, [{ id: 100 }, { id: 400 }]), [1, 200, 500])
  assert.deepEqual(quizLogic.resetUsedWordIdsForWords(usedIds, []), usedIds)
  assert.deepEqual(usedIds, [1, 100, 200, 400, 500])
})

test('finishing Part 1 after 2000 draws preserves every used ID outside Part 1', () => {
  const usedIds = Array.from({ length: 2000 }, (_, index) => index + 1)
  const part1 = quizLogic.filterWordsByCriteria(words, { selectedParts: ['part1'] })
  const s = session(part1, usedIds)

  s.selectRandomWord()

  const outsideIds = usedIds.filter((id) => id > 400)
  assertUsedIds(s, [...outsideIds, 1])
  assert.equal(s.currentWord.id, 1)
  assert.equal(s.draws, 1)
  assert.equal(s.notices.length, 1)
  assert.equal(usedIds.length, 2000)

  s.handleNext()
  assertUsedIds(s, [...outsideIds, 1, 2])
  assert.equal(s.draws, 2)
  s.handlePrevious()
  assert.equal(s.currentWord.id, 1)
  s.handleNext()
  assert.equal(s.currentWord.id, 2)
  assert.equal(s.draws, 2)
  assertUsedIds(s, [...outsideIds, 1, 2])
})

test('a numeric range resets only after its final unused word has been drawn', () => {
  const range = quizLogic.filterWordsByCriteria(words, {
    isRangeActive: true, startRange: 100, endRange: 102,
  })
  const s = session(range, [1, 99, 100, 101, 103, 2000])

  s.selectRandomWord()
  assert.equal(s.currentWord.id, 102)
  assertUsedIds(s, [1, 99, 100, 101, 103, 2000, 102])
  assert.equal(s.notices.length, 0)

  s.handleNext()
  assert.equal(s.currentWord.id, 100)
  assertUsedIds(s, [1, 99, 103, 2000, 100])
  assert.equal(s.notices.length, 1)
  assert.equal(s.draws, 2)
})

test('finishing non-adjacent Parts preserves the Parts between them and the extra range', () => {
  const usedIds = words.map(({ id }) => id)
  const selected = quizLogic.filterWordsByCriteria(words, { selectedParts: ['part1', 'part3'] })
  const s = session(selected, usedIds)

  s.selectRandomWord()

  const selectedIds = new Set(selected.map(({ id }) => id))
  assertUsedIds(s, [...usedIds.filter((id) => !selectedIds.has(id)), 1])
  assert.equal(s.draws, 1)
})

test('mistake and part-of-speech filters reset only words in their active intersection', () => {
  const wordList = [
    { id: 100, meanings: [{ partOfSpeech: 'noun' }] },
    { id: 200, meanings: [{ partOfSpeech: 'transitive-verb' }] },
    { id: 300, meanings: [{ partOfSpeech: 'noun' }] },
    { id: 500, meanings: [{ partOfSpeech: 'noun' }] },
  ]
  const selected = quizLogic.filterWordsByCriteria(wordList, {
    selectedParts: ['part1'],
    isCheckedOnlyActive: true, checkedWordIds: [100, 200, 500],
    selectedPartOfSpeech: ['noun'],
  })
  const s = session(selected, [100, 200, 300, 500])

  s.selectRandomWord()

  assertUsedIds(s, [200, 300, 500, 100])
  assert.equal(s.currentWord.id, 100)
  assert.equal(s.draws, 1)
})

test('finishing the full dataset starts a new full-range cycle', () => {
  const s = session(words, words.map(({ id }) => id))

  s.selectRandomWord()

  assertUsedIds(s, [1])
  assert.equal(s.currentWord.id, 1)
  assert.equal(s.notices.length, 1)
  assert.equal(s.draws, 1)
})

test('an empty pool does not reset history or count a draw', () => {
  const s = session([], [1, 400, 2000])

  s.selectRandomWord()

  assertUsedIds(s, [1, 400, 2000])
  assert.equal(s.notices.length, 0)
  assert.equal(s.draws, 0)
})
