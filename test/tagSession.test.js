import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import * as quizLogic from '../src/utils/quizLogic.js'

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n')

// Run the real filter and navigation handlers with deterministic draws and storage boundaries.
function session() {
  const words = [
    { id: 100, meanings: [{ partOfSpeech: 'noun' }, { partOfSpeech: 'noun' }] },
    { id: 200, meanings: [{ partOfSpeech: 'noun' }, { partOfSpeech: 'transitive-verb' }] },
    { id: 300, meanings: [{ partOfSpeech: 'adjective' }] },
    { id: 500, meanings: [{ partOfSpeech: 'noun' }, { partOfSpeech: 'transitive-verb' }] },
  ]
  const state = {
    ...quizLogic, words, filteredWords: words, selectedTags: [], selectedParts: [],
    appliedRange: { start: '', end: '' }, startRange: '', endRange: '', isRangeActive: false,
    isCheckedOnlyActive: false, checkedWordIds: [], checkedOnlyWordIds: [],
    filterError: '', error: null, partRanges: quizLogic.PART_RANGES,
    currentWord: words[2], wordHistory: [words[2]], historyIndex: 0,
    usedWordIdsRef: { current: [300] }, usedWordIds: [300], draws: 0, notices: [],
    pickRandomUnusedWord: (pool, used) => quizLogic.pickRandomUnusedWord(pool, used, () => 0),
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
  }
  for (const key of ['filteredWords', 'selectedTags', 'selectedParts', 'appliedRange', 'startRange',
    'endRange', 'isRangeActive', 'isCheckedOnlyActive', 'checkedOnlyWordIds', 'filterError', 'error',
    'currentWord', 'showAnswer', 'usedWordIds']) {
    state[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value) => { state[key] = value }
  }
  state.setNavigation = (update) => {
    const next = typeof update === 'function'
      ? update({ history: state.wordHistory, index: state.historyIndex })
      : update
    state.wordHistory = next.history
    state.historyIndex = next.index
    state.canGoPrevious = next.index > 0
  }
  state.saveUsedWordIdsToLocalStorage = () => {}
  state.incrementTotalQuizCount = () => { state.draws += 1 }
  state.toast = (notice) => state.notices.push(notice)
  const context = createContext(state)
  for (const name of ['getFilteredWords', 'useFilteredWords', 'toggleTag', 'togglePart', 'applyRange',
    'resetRange', 'resetNavigation', 'showWord', 'selectRandomWord', 'handlePrevious', 'handleNext']) {
    const start = source.indexOf(`  const ${name} =`)
    assert.ok(start >= 0, `${name} exists`)
    const handler = source.slice(start, source.indexOf('\n  }\n', start) + 4)
    runInContext(`${handler}\nthis.${name} = ${name}`, context)
  }
  return state
}

const ids = (words) => Array.from(words, ({ id }) => id)

test('tag changes reset navigation to the intersection; history movement does not count draws', () => {
  const s = session()
  s.toggleTag('noun')
  s.toggleTag('polysemous')
  s.toggleTag('transitive-verb')
  assert.deepEqual(ids(s.filteredWords), [200, 500])
  assert.deepEqual(ids(s.wordHistory), [500])
  assert.equal(s.canGoPrevious, false)
  assert.equal(s.draws, 3)
  s.handleNext()
  assert.equal(s.currentWord.id, 200)
  assert.equal(s.draws, 4)
  s.handlePrevious()
  s.handleNext()
  assert.equal(s.currentWord.id, 200)
  assert.equal(s.draws, 4)
})

test('an empty tag combination preserves selection, card, navigation, progress and count', () => {
  const s = session()
  s.toggleTag('noun')
  s.toggleTag('polysemous')
  const { selectedTags, filteredWords, currentWord, wordHistory, historyIndex, draws } = s
  const used = [...s.usedWordIdsRef.current]
  s.toggleTag('adjective')
  assert.match(s.filterError, /すべて満たす単語.*ありません/)
  for (const [key, value] of Object.entries({ selectedTags, filteredWords, currentWord, wordHistory, historyIndex, draws })) {
    assert.equal(s[key], value, key)
  }
  assert.deepEqual([...s.usedWordIdsRef.current], used)
  s.toggleTag('polysemous')
  assert.equal(s.filterError, '')
  assert.deepEqual(Array.from(s.selectedTags), ['noun'])
})

test('draft numeric inputs do not replace Part selection or the last applied range', () => {
  const s = session()
  s.togglePart('part1')
  s.startRange = '500'
  s.endRange = '500'
  s.toggleTag('polysemous')
  assert.deepEqual(ids(s.filteredWords), [100, 200])
  s.applyRange()
  assert.deepEqual(ids(s.filteredWords), [500])
  assert.deepEqual(Array.from(s.selectedParts), [])
  const card = s.currentWord
  const draws = s.draws
  s.startRange = '300'
  s.endRange = '300'
  s.applyRange()
  assert.match(s.filterError, /一致する単語がありません/)
  assert.equal(s.currentWord, card)
  assert.equal(s.draws, draws)
  assert.equal(s.appliedRange.start, '500')
  s.toggleTag('noun')
  assert.deepEqual(ids(s.filteredWords), [500])
})

test('clearing tags retains range and the stable mistake-filter pool', () => {
  const s = session()
  s.isCheckedOnlyActive = true
  s.checkedWordIds = [100]
  s.checkedOnlyWordIds = [100, 200, 500]
  s.togglePart('part1')
  s.toggleTag('transitive-verb')
  s.toggleTag('polysemous')
  assert.deepEqual(ids(s.filteredWords), [200])
  s.toggleTag()
  assert.deepEqual(ids(s.filteredWords), [100, 200])
  assert.equal(s.isCheckedOnlyActive, true)
  assert.deepEqual(Array.from(s.selectedParts), ['part1'])
  s.resetRange()
  assert.deepEqual(ids(s.filteredWords), [100, 200, 500])
})

test('invalid numeric order keeps the quiz usable; the thank-you shortcut clears tags', () => {
  const s = session()
  s.toggleTag('polysemous')
  s.startRange = '200'
  s.endRange = '100'
  s.applyRange()
  assert.match(s.filterError, /開始No./)
  assert.equal(s.error, null)
  s.startRange = '2009'
  s.endRange = '213'
  s.applyRange()
  assert.deepEqual(Array.from(s.selectedTags), [])
  assert.equal(s.currentWord.id, 2009213)
  assert.equal(s.filterError, '')
})

test('three-sense tag resets history on success and preserves state when no word matches', () => {
  const s = session()
  s.words = s.words.map((word) => word.id === 200
    ? { ...word, meanings: [...word.meanings, { partOfSpeech: 'noun' }] }
    : word)
  s.togglePart('part1')
  s.toggleTag('three-or-more-meanings')
  assert.deepEqual(ids(s.filteredWords), [200])
  assert.deepEqual(ids(s.wordHistory), [200])
  assert.equal(s.canGoPrevious, false)
  s.toggleTag('polysemous')
  assert.deepEqual(ids(s.filteredWords), [200])
  s.toggleTag('three-or-more-meanings')
  assert.deepEqual(ids(s.filteredWords), [100, 200])

  const empty = session()
  empty.toggleTag('polysemous')
  const { currentWord, filteredWords, selectedTags, wordHistory, draws } = empty
  empty.toggleTag('three-or-more-meanings')
  assert.match(empty.filterError, /すべて満たす単語.*ありません/)
  for (const [key, value] of Object.entries({ currentWord, filteredWords, selectedTags, wordHistory, draws })) {
    assert.equal(empty[key], value, key)
  }
})
