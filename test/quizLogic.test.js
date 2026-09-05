import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterWordsBySelectedParts,
  formatMeaning,
  PART_RANGES,
  pickRandomUnusedWord,
  searchEnglishWords,
} from '../src/utils/quizLogic.js'
import {
  getTotalQuizCountFromLocalStorage,
  saveTotalQuizCountToLocalStorage,
} from '../src/utils/learningStats.js'

test('formatMeaning renders one line for every structured sense', () => {
  assert.deepEqual(formatMeaning([
    { partOfSpeech: 'intransitive-verb', meaning: '賛成する' },
    { partOfSpeech: 'intransitive-verb', meaning: '意見が一致する' },
  ]), ['[自] 賛成する', '[自] 意見が一致する'])
})

test('filterWordsBySelectedParts returns a union of non-adjacent parts', () => {
  const words = [
    { id: 100 },
    { id: 500 },
    { id: 1100 },
  ]

  assert.deepEqual(
    filterWordsBySelectedParts(words, ['part1', 'part3'], PART_RANGES).map(({ id }) => id),
    [100, 1100],
  )
})

test('pickRandomUnusedWord excludes every used id', () => {
  const words = [{ id: 1 }, { id: 2 }, { id: 3 }]
  assert.equal(pickRandomUnusedWord(words, [1, 2], () => 0).id, 3)
  assert.equal(pickRandomUnusedWord(words, [1, 2, 3], () => 0), null)
})

test('pickRandomUnusedWord accepts an injected random source', () => {
  const words = [{ id: 1 }, { id: 2 }, { id: 3 }]
  assert.equal(pickRandomUnusedWord(words, [], () => 0.99).id, 3)
})

test('total quiz count is persisted independently from quiz history', () => {
  const values = new Map([['leapUsedWordIds', '[1,2,3]']])
  global.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }

  saveTotalQuizCountToLocalStorage(42)
  localStorage.removeItem('leapUsedWordIds')

  assert.equal(getTotalQuizCountFromLocalStorage(), 42)
  delete global.localStorage
})

test('searchEnglishWords searches English spellings case-insensitively', () => {
  const words = [
    { id: 1, word: 'agree' },
    { id: 2, word: 'disagree' },
    { id: 3, word: 'agreement' },
  ]

  assert.deepEqual(searchEnglishWords(words, 'AGR').map(({ id }) => id), [1, 3, 2])
})

test('searchEnglishWords does not search Japanese meanings', () => {
  const words = [{ id: 1, word: 'agree', meaning: '賛成する' }]
  assert.deepEqual(searchEnglishWords(words, '賛成'), [])
})
