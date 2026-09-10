import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { filterWordsByCriteria, PART_RANGES } from '../src/utils/quizLogic.js'

// Exercise the actual App handlers without adding a DOM or React test dependency.
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const handler = (name) => {
  const start = source.indexOf(`  const ${name} =`)
  assert.ok(start >= 0)
  return source.slice(start, source.indexOf('\n  }\n', start) + 4)
}

function session(ids = [100, 200]) {
  const state = {
    words: [100, 200, 500].map((id) => ({ id, meanings: [{ partOfSpeech: 'noun' }] })),
    selectedParts: [], isRangeActive: false, startRange: '', endRange: '',
    selectedPartOfSpeech: [], isCheckedOnlyActive: false,
    checkedWordIds: ids, checkedOnlyWordIds: [], partRanges: PART_RANGES,
    filterWordsByCriteria, draws: 0, notices: [], saved: [],
  }
  for (const key of ['checkedWordIds', 'checkedOnlyWordIds', 'isCheckedOnlyActive']) {
    state[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value) => { state[key] = value }
  }
  state.saveCheckedWordIdsToCookie = (ids) => { state.saved = [...ids] }
  state.toast = (notice) => state.notices.push(notice)
  state.useFilteredWords = (words) => {
    state.filteredWords = words
    state.currentWord = words[0]
    state.draws += 1
  }
  const context = createContext(state)
  for (const name of ['getFilteredWords', 'toggleCurrentWordChecked', 'toggleCheckedOnly']) {
    runInContext(`${handler(name)}\nthis.${name} = ${name}`, context)
  }
  return state
}

test('unmarking preserves the current card and pool until off, then re-enabling uses saved marks', () => {
  const s = session()
  s.toggleCheckedOnly()
  const card = s.currentWord
  const pool = s.filteredWords
  s.toggleCurrentWordChecked()
  assert.equal(s.currentWord, card)
  assert.equal(s.filteredWords, pool)
  assert.equal(s.draws, 1)
  assert.deepEqual(s.saved, [200])
  assert.deepEqual(s.getFilteredWords().map((w) => w.id), [100, 200])
  s.toggleCheckedOnly()
  assert.equal(s.isCheckedOnlyActive, false)
  s.toggleCheckedOnly()
  assert.deepEqual(s.filteredWords.map((w) => w.id), [200])
})

test('unmarking the last word does not exit the filter or draw another card', () => {
  const s = session([100])
  s.toggleCheckedOnly()
  s.toggleCurrentWordChecked()
  assert.equal(s.isCheckedOnlyActive, true)
  assert.equal(s.draws, 1)
  assert.deepEqual(s.getFilteredWords().map((w) => w.id), [100])
  s.toggleCheckedOnly()
  s.toggleCheckedOnly()
  assert.equal(s.isCheckedOnlyActive, false)
  assert.equal(s.notices.length, 1)
})

test('number, Part and speech filtering retain unmarked session words; rechecking is saved', () => {
  const s = session()
  s.toggleCheckedOnly()
  s.toggleCurrentWordChecked()
  for (const criteria of [
    { rangeActive: true, rangeStart: 100, rangeEnd: 100 },
    { activeParts: ['part1'], partOfSpeech: ['noun'] },
  ]) {
    assert.ok(s.getFilteredWords(criteria).some((w) => w.id === 100))
  }
  assert.deepEqual(s.getFilteredWords({ partOfSpeech: ['adjective'] }), [])
  s.toggleCurrentWordChecked()
  assert.deepEqual(s.saved, [200, 100])
  assert.equal(s.draws, 1)
  s.toggleCheckedOnly()
  s.toggleCheckedOnly()
  assert.deepEqual(s.filteredWords.map((w) => w.id), [100, 200])
})
