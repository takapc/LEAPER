import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterWordsBySelectedParts,
  filterWordsByPartOfSpeech,
  filterWordsByTags,
  filterWordsByCriteria,
  formatMeaning,
  PART_RANGES,
  pickRandomUnusedWord,
  searchEnglishWords,
} from '../src/utils/quizLogic.js'
import {
  getTotalQuizCountFromLocalStorage,
  saveTotalQuizCountToLocalStorage,
} from '../src/utils/learningStats.js'
import { normalizeWordMeanings } from '../src/utils/meanings.js'

test('formatMeaning renders one line for every structured sense', () => {
  assert.deepEqual(formatMeaning([
    { partOfSpeech: 'intransitive-verb', meaning: '賛成する' },
    { partOfSpeech: 'intransitive-verb', meaning: '意見が一致する' },
  ]), ['[自] 賛成する', '[自] 意見が一致する'])
})

test('part-of-speech tags require every selected part, across different senses', () => {
  const words = [
    { id: 1, meanings: [{ partOfSpeech: 'noun' }, { partOfSpeech: 'transitive-verb' }] },
    { id: 2, meanings: [{ partOfSpeech: 'adjective' }] },
    { id: 3, meanings: [{ partOfSpeech: 'noun' }] },
  ]

  assert.deepEqual(
    filterWordsByPartOfSpeech(words, ['noun', 'transitive-verb']).map(({ id }) => id),
    [1],
  )
  assert.deepEqual(filterWordsByPartOfSpeech(words, ['transitive-verb', 'adjective']), [])
  assert.deepEqual(filterWordsByPartOfSpeech(words, ['noun']).map(({ id }) => id), [1, 3])
  assert.deepEqual(filterWordsByPartOfSpeech(words, []).map(({ id }) => id), [1, 2, 3])
})

test('filterWordsByCriteria intersects number range, mistake marks and part of speech', () => {
  const words = [
    { id: 100, meanings: [{ partOfSpeech: 'noun' }] },
    { id: 200, meanings: [{ partOfSpeech: 'noun' }, { partOfSpeech: 'transitive-verb' }] },
    { id: 300, meanings: [{ partOfSpeech: 'noun' }] },
    { id: 400, meanings: [{ partOfSpeech: 'transitive-verb' }] },
  ]

  assert.deepEqual(
    filterWordsByCriteria(words, {
      isRangeActive: true,
      startRange: 150,
      endRange: 350,
      isCheckedOnlyActive: true,
      checkedWordIds: [100, 200, 400],
      selectedTags: ['transitive-verb'],
    }).map(({ id }) => id),
    [200],
  )
})

test('polysemy includes two senses of the same part of speech and untagged imported senses', () => {
  const words = normalizeWordMeanings([
    { id: 1, meaning: '[名] ①助言 ②先端' },
    { id: 2, meaning: '[名] 記録 [他] 記録する' },
    { id: 3, meaning: '[名] 単独の意味' },
    { id: 4, meaning: '①意味その一 ②意味その二' },
  ])
  assert.deepEqual(filterWordsByTags(words, ['polysemous']).map(({ id }) => id), [1, 2, 4])
  assert.deepEqual(filterWordsByTags(words, ['noun', 'polysemous']).map(({ id }) => id), [1, 2])
  assert.deepEqual(filterWordsByTags(words, ['noun', 'transitive-verb', 'polysemous']).map(({ id }) => id), [2])
  assert.deepEqual(filterWordsByTags(words, ['adjective', 'polysemous']), [])
  assert.equal(filterWordsByTags(words, []), words)
})

test('tags reject absent meanings and unknown tags without mutating words or selection', () => {
  const words = Object.freeze([
    Object.freeze({ id: 1 }),
    Object.freeze({ id: 2, meanings: [] }),
    Object.freeze({ id: 3, meanings: [{ partOfSpeech: 'noun' }] }),
  ])
  const tags = Object.freeze(['noun', 'polysemous'])
  assert.deepEqual(filterWordsByTags(words, tags), [])
  assert.deepEqual(filterWordsByTags(words, ['unknown']), [])
  assert.deepEqual(filterWordsByTags([], ['polysemous']), [])
  assert.deepEqual(tags, ['noun', 'polysemous'])
})

test('all tags intersect Part unions, detailed ranges, and mistake marks', () => {
  const meanings = [{ partOfSpeech: 'noun' }, { partOfSpeech: 'transitive-verb' }]
  const words = [
    { id: 100, meanings },
    { id: 200, meanings: [{ partOfSpeech: 'noun' }] },
    { id: 500, meanings },
    { id: 1100, meanings },
    { id: 1200, meanings },
  ]
  const selectedTags = ['noun', 'transitive-verb', 'polysemous']
  assert.deepEqual(filterWordsByCriteria(words, {
    selectedParts: ['part1', 'part3'], selectedTags,
    isCheckedOnlyActive: true, checkedWordIds: [100, 200, 500, 1100],
  }).map(({ id }) => id), [100, 1100])
  assert.deepEqual(filterWordsByCriteria(words, {
    isRangeActive: true, startRange: 200, endRange: 1100, selectedTags,
    isCheckedOnlyActive: true, checkedWordIds: [100, 200, 1100, 1200],
  }).map(({ id }) => id), [1100])
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
