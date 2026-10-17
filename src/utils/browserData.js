import { PART_RANGES, WORD_TAG_LABELS } from './quizLogic.js'

export const FILTER_PREFERENCES_KEY = 'leaperFilterPreferences'
export const SHARED_STORAGE_KEYS = ['leaperStudySettings', FILTER_PREFERENCES_KEY, 'leapUsedWordIds', 'leapCheckedWordIds', 'leapTotalQuizCount']

export function defaultFilters() {
  return { selectedParts: [], range: null, selectedTags: [], checkedOnly: false, checkedPoolIds: [], hint: false }
}

export function defaultBrowserData() {
  return { version: 1, settings: { study: { mode: 'leap', level: 1 }, filters: defaultFilters() }, usedIds: [], checkedIds: [], totalCount: 0 }
}

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const safeCount = (value) => Number.isSafeInteger(value) && value >= 0
const idsValid = (ids) => Array.isArray(ids) && ids.length <= 2300 && ids.every((id) => Number.isInteger(id) && id >= 1 && id <= 2300)
const canonicalIds = (ids) => [...new Set(ids)].sort((a, b) => a - b)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function validateFilters(value) {
  if (!object(value) || !Array.isArray(value.selectedParts) || value.selectedParts.length > 5 ||
    !value.selectedParts.every((part) => Object.hasOwn(PART_RANGES, part)) ||
    !Array.isArray(value.selectedTags) || value.selectedTags.length > Object.keys(WORD_TAG_LABELS).length ||
    !value.selectedTags.every((tag) => Object.hasOwn(WORD_TAG_LABELS, tag)) ||
    typeof value.checkedOnly !== 'boolean' || typeof value.hint !== 'boolean' ||
    (value.checkedPoolIds !== undefined && !idsValid(value.checkedPoolIds))) throw new Error('Invalid filters')
  const range = value.range
  if (range !== null && (!object(range) || !Number.isInteger(range.start) || !Number.isInteger(range.end) ||
    range.start < 1 || range.end > 2300 || range.start > range.end || value.selectedParts.length > 0)) throw new Error('Invalid range')
  return {
    selectedParts: [...new Set(value.selectedParts)].sort(),
    range: range === null ? null : { start: range.start, end: range.end },
    selectedTags: [...new Set(value.selectedTags)].sort(), checkedOnly: value.checkedOnly,
    checkedPoolIds: canonicalIds(value.checkedPoolIds || []), hint: value.hint,
  }
}

function validateStudy(value) {
  if (!object(value) || !['leap', 'svl'].includes(value.mode) || !Number.isInteger(value.level) || value.level < 1 || value.level > 12) throw new Error('Invalid study settings')
  return { mode: value.mode, level: value.level }
}

export function validateBrowserData(value) {
  if (!object(value) || value.version !== 1 || !object(value.settings) || !idsValid(value.usedIds) ||
    !idsValid(value.checkedIds) || !safeCount(value.totalCount)) throw new Error('Invalid browser data')
  return { version: 1, settings: { study: validateStudy(value.settings.study), filters: validateFilters(value.settings.filters) },
    usedIds: canonicalIds(value.usedIds), checkedIds: canonicalIds(value.checkedIds), totalCount: value.totalCount }
}

export function validatePatch(value) {
  if (!object(value) || !object(value.settings) || !safeCount(value.totalDelta)) throw new Error('Invalid change')
  const patch = { settings: {}, totalDelta: value.totalDelta }
  if (Object.hasOwn(value.settings, 'study')) patch.settings.study = validateStudy(value.settings.study)
  if (Object.hasOwn(value.settings, 'filters')) patch.settings.filters = validateFilters(value.settings.filters)
  for (const key of ['used', 'checked']) {
    if (!object(value[key]) || !idsValid(value[key].add) || !idsValid(value[key].remove)) throw new Error('Invalid word changes')
    patch[key] = { add: canonicalIds(value[key].add), remove: canonicalIds(value[key].remove) }
  }
  return patch
}

export function diffBrowserData(base, next) {
  const patch = { settings: {}, totalDelta: Math.max(0, next.totalCount - base.totalCount) }
  for (const key of ['study', 'filters']) if (!same(base.settings[key], next.settings[key])) patch.settings[key] = next.settings[key]
  for (const [key, field] of [['used', 'usedIds'], ['checked', 'checkedIds']]) {
    const before = new Set(base[field])
    const after = new Set(next[field])
    patch[key] = { add: next[field].filter((id) => !before.has(id)), remove: base[field].filter((id) => !after.has(id)) }
  }
  return patch
}

export function hasBrowserChanges(patch) {
  return patch.totalDelta > 0 || Object.keys(patch.settings).length > 0 ||
    ['used', 'checked'].some((key) => patch[key].add.length > 0 || patch[key].remove.length > 0)
}

export function applyBrowserPatch(data, patch) {
  const next = { ...data, settings: { ...data.settings, ...patch.settings }, totalCount: data.totalCount + patch.totalDelta }
  for (const [key, field] of [['used', 'usedIds'], ['checked', 'checkedIds']]) {
    const removed = new Set(patch[key].remove)
    next[field] = canonicalIds([...data[field].filter((id) => !removed.has(id)), ...patch[key].add])
  }
  return validateBrowserData(next)
}

export function mergeJoiningData(source, joining) {
  return validateBrowserData({ ...source, usedIds: canonicalIds([...source.usedIds, ...joining.usedIds]),
    checkedIds: canonicalIds([...source.checkedIds, ...joining.checkedIds]), totalCount: Math.max(source.totalCount, joining.totalCount) })
}

function json(storage, key, fallback) {
  try { return JSON.parse(storage.getItem(key)) ?? fallback } catch { return fallback }
}

export function readFilterPreferences(storage) {
  try { return validateFilters(json(storage || globalThis.localStorage, FILTER_PREFERENCES_KEY, defaultFilters())) } catch { return defaultFilters() }
}

export function readBrowserData(storage, cookie = '') {
  const data = defaultBrowserData()
  try { data.settings.study = validateStudy(json(storage, 'leaperStudySettings', data.settings.study)) } catch { /* Keep defaults. */ }
  data.settings.filters = readFilterPreferences(storage)
  for (const [field, key] of [['usedIds', 'leapUsedWordIds'], ['checkedIds', 'leapCheckedWordIds']]) {
    let value = json(storage, key, null)
    if (value === null && field === 'checkedIds') {
      try { value = JSON.parse(decodeURIComponent(cookie.split('; ').find((entry) => entry.startsWith('leapCheckedWordIds='))?.split('=').slice(1).join('=') || '[]')) } catch { value = [] }
    }
    data[field] = Array.isArray(value) ? canonicalIds(value.filter((id) => Number.isInteger(id) && id >= 1 && id <= 2300)) : []
  }
  try { const count = Number(storage.getItem('leapTotalQuizCount')); if (safeCount(count)) data.totalCount = count } catch { /* Keep zero. */ }
  return data
}

export function writeBrowserData(storage, cookieDocument, value) {
  const data = validateBrowserData(value)
  const values = [data.settings.study, data.settings.filters, data.usedIds, data.checkedIds, data.totalCount]
  const previous = SHARED_STORAGE_KEYS.map((key) => storage.getItem(key))
  try {
    SHARED_STORAGE_KEYS.forEach((key, index) => storage.setItem(key, JSON.stringify(values[index])))
  } catch (error) {
    SHARED_STORAGE_KEYS.forEach((key, index) => {
      try { if (previous[index] === null) storage.removeItem(key); else storage.setItem(key, previous[index]) } catch { /* Best-effort rollback. */ }
    })
    throw error
  }
  if (cookieDocument) {
    try { cookieDocument.cookie = `leapCheckedWordIds=${encodeURIComponent(JSON.stringify(data.checkedIds))}; Max-Age=31536000; Path=/; SameSite=Lax` } catch { /* localStorage is authoritative. */ }
  }
}
