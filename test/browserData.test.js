import test from 'node:test'
import assert from 'node:assert/strict'
import { applyBrowserPatch, defaultBrowserData, defaultFilters, diffBrowserData, hasBrowserChanges, mergeJoiningData, readBrowserData, readFilterPreferences, SHARED_STORAGE_KEYS, validateBrowserData, validatePatch, writeBrowserData } from '../src/utils/browserData.js'

function storage() {
  const values = new Map()
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}

test('joining preserves source settings, unions progress and marks, and takes the larger initial count', () => {
  const source = defaultBrowserData()
  source.usedIds = [1, 2]
  source.checkedIds = [5]
  source.totalCount = 30
  source.settings.filters.selectedTags = ['three-or-more-meanings']
  const other = defaultBrowserData()
  other.usedIds = [2, 3]
  other.checkedIds = [4, 5]
  other.totalCount = 12
  const result = mergeJoiningData(source, other)
  assert.deepEqual(result.usedIds, [1, 2, 3])
  assert.deepEqual(result.checkedIds, [4, 5])
  assert.equal(result.totalCount, 30)
  assert.deepEqual(result.settings, source.settings)
  assert.deepEqual(source.usedIds, [1, 2])
})

test('concurrent changes apply deltas without losing other devices additions or counting remote totals twice', () => {
  const base = defaultBrowserData()
  base.usedIds = [1, 2]
  base.checkedIds = [1, 5]
  base.totalCount = 10
  const local = structuredClone(base)
  local.usedIds = [1, 2, 3]
  local.checkedIds = [5, 6]
  local.totalCount = 12
  local.settings.filters.hint = true
  const remote = structuredClone(base)
  remote.usedIds.push(4)
  remote.checkedIds.push(7)
  remote.totalCount = 13
  const patch = diffBrowserData(base, local)
  const result = applyBrowserPatch(remote, validatePatch(patch))
  assert.deepEqual(result.usedIds, [1, 2, 3, 4])
  assert.deepEqual(result.checkedIds, [5, 6, 7])
  assert.equal(result.totalCount, 15)
  assert.equal(result.settings.filters.hint, true)
  assert.equal(hasBrowserChanges(diffBrowserData(result, structuredClone(result))), false)
})

test('shared data rejects invalid IDs, ranges, tags, counters and malformed changes', () => {
  for (const modify of [
    (data) => { data.usedIds = [0] }, (data) => { data.checkedIds = [2301] },
    (data) => { data.totalCount = -1 }, (data) => { data.totalCount = 1.5 },
    (data) => { data.settings.study.level = 13 }, (data) => { data.settings.study.mode = 'unknown' },
    (data) => { data.settings.filters.selectedTags = ['unknown'] },
    (data) => { data.settings.filters.range = { start: 10, end: 1 } },
    (data) => { data.settings.filters.selectedParts = ['part1']; data.settings.filters.range = { start: 1, end: 2 } },
  ]) {
    const data = defaultBrowserData()
    modify(data)
    assert.throws(() => validateBrowserData(data))
  }
  const patch = diffBrowserData(defaultBrowserData(), defaultBrowserData())
  assert.throws(() => validatePatch({ ...patch, totalDelta: -1 }))
  assert.throws(() => validatePatch({ ...patch, checked: { add: [1], remove: null } }))
  assert.throws(() => applyBrowserPatch({ ...defaultBrowserData(), totalCount: Number.MAX_SAFE_INTEGER }, { ...patch, totalDelta: 1 }))
})

test('storage migration reads legacy marks and preserves global sync queues and unrelated data', () => {
  const store = storage()
  store.setItem('leapGlobalQuizCountQueue', '{"pending":3}')
  store.setItem('other-app', 'keep')
  store.setItem('leaperImportedUsedWordIds', '[999]')
  store.setItem('leaperImportedCheckedWordIds', '[998]')
  const data = readBrowserData(store, 'leapCheckedWordIds=%5B2%2C1%5D')
  assert.deepEqual(data.checkedIds, [1, 2])
  assert.deepEqual(data.usedIds, [])
  data.settings.filters = { ...defaultFilters(), selectedParts: ['part1'], selectedTags: ['noun'], checkedOnly: true, checkedPoolIds: [1, 2] }
  data.totalCount = 12
  const document = { cookie: '' }
  writeBrowserData(store, document, data)
  assert.deepEqual(readBrowserData(store), data)
  assert.equal(store.getItem('leapGlobalQuizCountQueue'), '{"pending":3}')
  assert.equal(store.getItem('other-app'), 'keep')
  assert.equal(store.getItem('leaperImportedUsedWordIds'), '[999]')
  assert.equal(store.getItem('leaperImportedCheckedWordIds'), '[998]')
  assert.match(document.cookie, /leapCheckedWordIds=/)
  assert.deepEqual(readFilterPreferences({ getItem() { throw new Error('blocked') } }), defaultFilters())
})

test('failed storage writes roll back and blocked cookies do not lose marks', () => {
  const store = storage()
  const data = defaultBrowserData()
  writeBrowserData(store, null, data)
  const before = [...store.values]
  const set = store.setItem
  let failed = false
  store.setItem = (key, value) => {
    if (key === SHARED_STORAGE_KEYS[2] && !failed) { failed = true; throw new Error('quota') }
    set(key, value)
  }
  assert.throws(() => writeBrowserData(store, null, { ...data, totalCount: 20 }))
  assert.deepEqual([...store.values], before)
  data.checkedIds = [1, 2]
  writeBrowserData(store, { set cookie(_value) { throw new Error('blocked') } }, data)
  assert.deepEqual(readBrowserData(store).checkedIds, [1, 2])
})
