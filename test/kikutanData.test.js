import test from 'node:test'
import assert from 'node:assert/strict'
import { adaptKikutanData, createKikutanStore, getKikutanWeekRanges, inspectKikutanData, mergeKikutanData, validateKikutanData, validateKikutanFilters } from '../src/utils/kikutanData.js'
import { defaultFilters, readBrowserData, validateBrowserData } from '../src/utils/browserData.js'
import { filterWordsByCriteria, formatMeaning, pickRandomUnusedWord } from '../src/utils/quizLogic.js'
import { readStudySettings, saveStudySettings } from '../src/utils/svlData.js'

// Synthetic data only: book data must stay outside the repository and build.
const row = (number, pos = 'noun', verbType = null) => ({ number, word: `fixture-${number}`, meanings: [{ pos, verbType, meaning: 'テスト用語義' }] })
const memory = () => {
  const entries = new Map()
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }
}

test('strict source contract rejects duplicates, bad types, empty senses and extra fields', () => {
  for (const invalid of [[], [row(0)], [row(1), row(1)], [{ ...row(1), word: '' }],
    [{ ...row(1), meanings: [] }], [row(1, 'noun', 'transitive')], [row(1, 'guess')],
    [{ ...row(1), extra: true }], [{ ...row(1), meanings: [{ pos: null, meaning: 'x' }] }]]) {
    assert.throws(() => validateKikutanData(invalid))
  }
  assert.doesNotThrow(() => validateKikutanData([row(1, null)]))
})

test('all senses and explicit verb types survive adaptation, display and tag intersections', () => {
  const mixed = { ...row(3), meanings: [...row(3).meanings, ...row(3, 'verb', 'both').meanings] }
  const words = adaptKikutanData([row(1, null), mixed, row(7, 'verb', 'transitive')])
  assert.equal(words[1].meanings[1].verbType, 'both')
  assert.deepEqual(filterWordsByCriteria(words, { selectedTags: ['noun', 'verb'] }).map((w) => w.id), [3])
  assert.deepEqual(filterWordsByCriteria(words, { selectedTags: ['intransitive-verb'] }).map((w) => w.id), [3])
  assert.deepEqual(filterWordsByCriteria(words, { selectedTags: ['transitive-verb'] }).map((w) => w.id), [3, 7])
  assert.deepEqual(formatMeaning(words[1].meanings), ['[名] テスト用語義', '[自・他] テスト用語義'])
  assert.equal(words[0].meanings[0].partOfSpeech, '')
})

test('additions preserve all saved progress, reject overwrites atomically, and support gaps and 1100 words', () => {
  const storage = memory()
  storage.setItem('leapUsedWordIds', '[1]')
  storage.setItem('leapCheckedWordIds', '[2]')
  storage.setItem('leapTotalQuizCount', '88')
  const before = readBrowserData(storage)
  let store = createKikutanStore(() => storage)
  store.importData([row(1), row(3)])
  store.saveUsedWordIdsToLocalStorage([1])
  store.saveCheckedWordIdsToCookie([3])
  store.saveTotalQuizCountToLocalStorage(5)
  const preferences = { ...defaultFilters(), range: { start: 1, end: 1100 } }
  storage.setItem(store.FILTER_PREFERENCES_KEY, JSON.stringify(preferences))
  store.importData(Array.from({ length: 1097 }, (_, i) => row(i + 4)))
  store = createKikutanStore(() => storage)
  assert.equal(store.readData().length, 1099)
  assert.deepEqual(store.getUsedWordIdsFromLocalStorage(), [1])
  assert.deepEqual(store.getCheckedWordIdsFromCookie(), [3])
  assert.equal(store.getTotalQuizCountFromLocalStorage(), 5)
  assert.deepEqual(store.readFilterPreferences(), preferences)
  assert.deepEqual(readBrowserData(storage), before)
  const previous = store.readData()
  assert.throws(() => store.importData([{ ...row(1), word: 'conflict' }, row(1101)]))
  assert.deepEqual(store.readData(), previous)
  const words = adaptKikutanData(previous)
  const pool = filterWordsByCriteria(words, { isRangeActive: true, startRange: 2, endRange: 3, isCheckedOnlyActive: true, checkedWordIds: [3] })
  assert.equal(pickRandomUnusedWord(pool, [], () => 0).id, 3)
  assert.deepEqual(mergeKikutanData([row(3)], [row(1), row(3)]).map((w) => w.number), [1, 3])
})

test('mode persists without moving private progress into browser sync data', () => {
  const previous = globalThis.localStorage
  try {
    globalThis.localStorage = memory()
    saveStudySettings({ mode: 'kikutan-super', level: 2 })
    assert.deepEqual(readStudySettings(), { mode: 'kikutan-super', level: 2 })
    assert.doesNotThrow(() => validateBrowserData(readBrowserData(globalThis.localStorage)))
  } finally { globalThis.localStorage = previous }
})

test('blocked storage degrades safely; failed imports are surfaced', () => {
  const store = createKikutanStore(() => { throw new Error('blocked') })
  assert.deepEqual(store.readData(), [])
  assert.deepEqual(store.getUsedWordIdsFromLocalStorage(), [])
  assert.doesNotThrow(() => store.saveCheckedWordIdsToCookie([1]))
  assert.throws(() => store.importData([row(1)]), /blocked/)
  assert.doesNotThrow(() => validateKikutanFilters({ ...defaultFilters(), range: { start: 1, end: 5000 } }))
})

test('Weeks follow book numbers across boundaries and omit empty Weeks, including partial future additions', () => {
  assert.deepEqual(getKikutanWeekRanges([]), {})
  const data = [row(672), row(113), row(1), row(112), row(224), row(225)]
  const ranges = getKikutanWeekRanges(data)
  assert.deepEqual(ranges, {
    week1: { start: 1, end: 112, label: 'Week 1' },
    week2: { start: 113, end: 224, label: 'Week 2' },
    week3: { start: 225, end: 336, label: 'Week 3' },
    week6: { start: 561, end: 672, label: 'Week 6' },
  })
  assert.deepEqual(getKikutanWeekRanges([...data, row(1100)]).week10, { start: 1009, end: 1100, label: 'Week 10' })
  assert.deepEqual(getKikutanWeekRanges([row(449)]), { week5: { start: 449, end: 449, label: 'Week 5' } })
})

test('non-adjacent Weeks compose with tags and mistakes and safely exclude unregistered numbers', () => {
  const data = [row(1), row(112, 'verb'), row(113), row(224), row(225), row(336, 'verb')]
  const words = adaptKikutanData(data)
  const criteria = { partRanges: getKikutanWeekRanges(data), selectedParts: ['week1', 'week3'] }
  const ids = (pool) => pool.map(({ id }) => id)
  assert.deepEqual(ids(filterWordsByCriteria(words, criteria)), [1, 112, 225, 336])
  assert.deepEqual(ids(filterWordsByCriteria(words, { ...criteria, selectedTags: ['verb'] })), [112, 336])
  assert.deepEqual(ids(filterWordsByCriteria(words, { ...criteria, isCheckedOnlyActive: true, checkedWordIds: [1, 113, 225] })), [1, 225])
  assert.deepEqual(filterWordsByCriteria(words, { ...criteria, selectedParts: ['week4'] }), [])
})

test('Week preferences survive reloads and imports without touching LEAP progress or filters', () => {
  const storage = memory()
  const leapFilters = { ...defaultFilters(), selectedParts: ['part2'] }
  storage.setItem('leaperFilterPreferences', JSON.stringify(leapFilters))
  storage.setItem('leapUsedWordIds', '[113]')
  const leapBefore = readBrowserData(storage)
  let store = createKikutanStore(() => storage)
  store.importData([row(1), row(113)])
  const preferences = { ...defaultFilters(), selectedParts: ['week1', 'week2'] }
  storage.setItem(store.FILTER_PREFERENCES_KEY, JSON.stringify(preferences))
  store.saveUsedWordIdsToLocalStorage([1])
  store.saveCheckedWordIdsToCookie([113])
  store.saveTotalQuizCountToLocalStorage(5)
  store.importData([row(225)])
  store = createKikutanStore(() => storage)
  assert.deepEqual(store.readFilterPreferences(), preferences)
  assert.deepEqual(store.getUsedWordIdsFromLocalStorage(), [1])
  assert.deepEqual(store.getCheckedWordIdsFromCookie(), [113])
  assert.equal(store.getTotalQuizCountFromLocalStorage(), 5)
  assert.deepEqual(readBrowserData(storage), leapBefore)
  storage.setItem(store.FILTER_PREFERENCES_KEY, JSON.stringify({ ...preferences, selectedParts: ['week1', 'week10'] }))
  assert.deepEqual(store.readFilterPreferences().selectedParts, ['week1'])
})

test('Week filter validation supports more than five Weeks and rejects LEAP keys or simultaneous numeric ranges', () => {
  const preferences = { ...defaultFilters(), selectedParts: Array.from({ length: 10 }, (_, i) => `week${i + 1}`) }
  assert.doesNotThrow(() => validateKikutanFilters(preferences))
  for (const key of ['part1', 'week0', 'week01', 'week-1', 'week1.5', 'week9007199254740992', 1]) {
    assert.throws(() => validateKikutanFilters({ ...defaultFilters(), selectedParts: [key] }))
  }
  assert.throws(() => validateKikutanFilters({ ...preferences, range: { start: 1, end: 112 } }))
})


test('completeness report detects gaps, ordering, duplicates and baseline deletion', () => {
  const report = inspectKikutanData([row(3), row(1), row(1)], 1, 3)
  assert.deepEqual(report.missing, [2])
  assert.deepEqual(report.duplicates, [1])
  assert.equal(report.sorted, false)
  assert.equal(report.schemaValid, false)
  const valid = inspectKikutanData([row(1), row(2), row(3)], 1, 3)
  assert.equal(valid.schemaValid, true)
  assert.deepEqual(valid.missing, [])
  assert.equal(inspectKikutanData([row(1), row(2), row(3)], 1, 3, [row(4)]).baselineValid, false)
})
