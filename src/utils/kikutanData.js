import { defaultFilters, validateFilters } from './browserData.js'

export const KIKUTAN_PREFIX = 'leaper:kikutan-super:'
export const KIKUTAN_POS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'determiner', 'auxiliary', 'other']
const verbTypes = ['transitive', 'intransitive', 'both']
const keysAre = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))

export function validateKikutanData(data) {
  if (!Array.isArray(data) || !data.length) throw new Error('単語データは空でない配列にしてください。')
  const numbers = new Set()
  for (const row of data) {
    if (!keysAre(row, ['number', 'word', 'meanings']) || !Number.isSafeInteger(row.number) || row.number < 1 ||
      typeof row.word !== 'string' || !row.word.trim() || !Array.isArray(row.meanings) || !row.meanings.length) {
      throw new Error(`No.${row?.number ?? '?'}: 単語の形式が不正です。`)
    }
    if (numbers.has(row.number)) throw new Error(`No.${row.number}: 番号が重複しています。`)
    numbers.add(row.number)
    for (const sense of row.meanings) {
      if (!keysAre(sense, ['pos', 'verbType', 'meaning']) ||
        !(sense.pos === null || KIKUTAN_POS.includes(sense.pos)) ||
        !(sense.verbType === null || (sense.pos === 'verb' && verbTypes.includes(sense.verbType))) ||
        typeof sense.meaning !== 'string' || !sense.meaning.trim()) {
        throw new Error(`No.${row.number}: 品詞・語義の形式が不正です。`)
      }
    }
  }
  return data
}

// Reject changes to existing numbers, even when only a translation has changed.
export function mergeKikutanData(existing, incoming) {
  if (existing.length) validateKikutanData(existing)
  validateKikutanData(incoming)
  const merged = new Map(existing.map((row) => [row.number, row]))
  for (const row of incoming) {
    const previous = merged.get(row.number)
    const same = previous && previous.word === row.word && previous.meanings.length === row.meanings.length &&
      previous.meanings.every((sense, index) => ['pos', 'verbType', 'meaning'].every((key) => sense[key] === row.meanings[index][key]))
    if (previous && !same) throw new Error(`No.${row.number}: 既存データと異なるため、上書きしませんでした。`)
    merged.set(row.number, row)
  }
  return [...merged.values()].sort((a, b) => a.number - b.number)
}

export function adaptKikutanData(data) {
  return validateKikutanData(data).map(({ number, word, meanings }) => ({
    id: number, word, relatedWords: [],
    meanings: meanings.map(({ pos, verbType, meaning }) => {
      const specific = verbType === 'transitive' ? 'transitive-verb' : verbType === 'intransitive' ? 'intransitive-verb' : 'verb'
      return { partOfSpeech: pos === 'verb' ? specific : pos ?? '', meaning, verbType,
        filterParts: pos === 'verb'
          ? ['verb', ...(verbType === 'both' ? ['transitive-verb', 'intransitive-verb'] : specific === 'verb' ? [] : [specific])]
          : pos ? [pos] : [],
      }
    }),
  })).sort((a, b) => a.id - b.id)
}

export function validateKikutanFilters(value) {
  // Reuse tag validation, without LEAP's fixed Part / ID constraints.
  validateFilters({ ...value, selectedParts: [], range: null, checkedPoolIds: [] })
  if (!Array.isArray(value.selectedParts) || value.selectedParts.length || !Array.isArray(value.checkedPoolIds) ||
    !value.checkedPoolIds.every((id) => Number.isSafeInteger(id) && id > 0) ||
    (value.range !== null && (!Number.isSafeInteger(value.range?.start) || !Number.isSafeInteger(value.range?.end) ||
      value.range.start < 1 || value.range.end < value.range.start))) throw new Error('Invalid Kikutan filters')
  return value
}

export function createKikutanStore(getStorage = () => localStorage) {
  const read = (key, fallback) => {
    try { return JSON.parse(getStorage().getItem(KIKUTAN_PREFIX + key)) ?? fallback } catch { return fallback }
  }
  const write = (key, value) => { getStorage().setItem(KIKUTAN_PREFIX + key, JSON.stringify(value)) }
  const safeWrite = (key, value) => { try { write(key, value) } catch { /* Keep the active session usable. */ } }
  const ids = (key) => {
    const value = read(key, [])
    return Array.isArray(value) ? [...new Set(value.filter((id) => Number.isSafeInteger(id) && id > 0))] : []
  }
  return {
    readData() {
      const value = read('data', [])
      if (value.length === 0) return []
      return validateKikutanData(value)
    },
    importData(incoming) {
      const merged = mergeKikutanData(this.readData(), incoming)
      write('data', merged) // Failure must not be presented as a successful persistent import.
      return merged
    },
    getUsedWordIdsFromLocalStorage: () => ids('used'),
    saveUsedWordIdsToLocalStorage: (value) => safeWrite('used', value),
    clearUsedWordIdsFromLocalStorage: () => safeWrite('used', []),
    getCheckedWordIdsFromCookie: () => ids('checked'),
    saveCheckedWordIdsToCookie: (value) => safeWrite('checked', value),
    getTotalQuizCountFromLocalStorage: () => {
      const value = read('total', 0)
      return Number.isSafeInteger(value) && value >= 0 ? value : 0
    },
    saveTotalQuizCountToLocalStorage: (value) => safeWrite('total', value),
    readFilterPreferences: () => {
      try { return validateKikutanFilters(read('filters', defaultFilters())) } catch { return defaultFilters() }
    },
    validateFilters: validateKikutanFilters,
    FILTER_PREFERENCES_KEY: KIKUTAN_PREFIX + 'filters',
  }
}


export function inspectKikutanData(data, start, end, baseline = null) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) throw new Error('Invalid target range')
  const numbers = Array.isArray(data) ? data.map((row) => row?.number) : []
  const duplicates = [...new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i))]
  const present = new Set(numbers)
  const missing = Array.from({ length: end - start + 1 }, (_, i) => start + i).filter((n) => !present.has(n))
  const sorted = numbers.every((n, i) => i === 0 || numbers[i - 1] < n)
  const report = { target: { start, end }, count: numbers.length, missing, duplicates, sorted, schemaValid: false, baselineValid: baseline ? false : null }
  try {
    validateKikutanData(data)
    report.schemaValid = true
    if (baseline) {
      mergeKikutanData(baseline, data)
      if (baseline.some((row) => !present.has(row.number))) throw new Error('既存番号が削除されています。')
      report.baselineValid = true
    }
  } catch (err) { report.error = err.message }
  return report
}
