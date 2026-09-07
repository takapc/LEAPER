import { pickRandomUnusedWord } from './quizLogic.js'

export const SVL_SOURCE = 'https://github.com/kim0051/word-levels-db/tree/master/level-csv'
export const SVL_LEVELS = Array.from({ length: 12 }, (_, index) => index + 1)
export const levelLabel = (level) => `LV${String(level).padStart(2, '0')}`
const cacheVersion = 'svl-csv-v1'

export function parseSvlCsv(csv) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const input = csv.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"'
        i += 1
      }
      else quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      row.push(field)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      field = ''
      if (char === '\r' && input[i + 1] === '\n') i += 1
    } else field += char
  }
  if (quoted) throw new Error('CSVの引用符が閉じていません。')
  row.push(field)
  if (row.some((value) => value.trim())) rows.push(row)
  const ids = new Set()
  const words = rows.map((columns) => {
    const [rawId, rawWord, rawMeaning] = columns
    const id = Number(rawId)
    const word = rawWord?.trim()
    const meaning = rawMeaning?.replace(/\[(?:名|動|自|他|形|副|前|接|助|冠|代|間|数|熟)\]/g, '').trim()
    if (columns.length !== 3 || !Number.isSafeInteger(id) || id <= 0 || ids.has(id) || !word || !meaning) {
      throw new Error('CSVに不正な単語データがあります。')
    }
    ids.add(id)
    return { id, word, meaning }
  })
  if (!words.length) throw new Error('単語データが空です。')
  return words
}

export function createSvlLoader(fetchImpl = (...args) => fetch(...args), getStorage = () => sessionStorage) {
  const memory = new Map()
  const pending = new Map()
  return async (level) => {
    if (!SVL_LEVELS.includes(level)) throw new Error('レベルはLV01〜LV12から選択してください。')
    if (memory.has(level)) return memory.get(level)
    if (pending.has(level)) return pending.get(level)
    const key = `${cacheVersion}:${level}`
    const request = (async () => {
      try {
        const cached = JSON.parse(getStorage().getItem(key))
        if (cached && Date.now() - cached.savedAt < 86400000 && typeof cached.csv === 'string') {
          const words = parseSvlCsv(cached.csv)
          memory.set(level, words)
          return words
        }
      } catch { /* Storage may be unavailable or contain an obsolete cache. */ }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      try {
        const response = await fetchImpl(`https://raw.githubusercontent.com/kim0051/word-levels-db/master/level-csv/level-${String(level).padStart(2, '0')}.csv`, { signal: controller.signal })
        if (!response.ok) throw new Error(`CSVの取得に失敗しました (${response.status})。`)
        const csv = await response.text()
        const words = parseSvlCsv(csv)
        memory.set(level, words)
        try { getStorage().setItem(key, JSON.stringify({ savedAt: Date.now(), csv })) } catch { /* Memory caching still works. */ }
        return words
      } finally { clearTimeout(timer) }
    })()
    pending.set(level, request)
    try { return await request } finally { pending.delete(level) }
  }
}

export const loadSvlLevel = createSvlLoader()

export function advanceSvlSession(session, words, random = Math.random) {
  if (session.index < session.history.length - 1) {
    return { ...session, index: session.index + 1, isNewDraw: false }
  }
  let usedIds = session.usedIds
  let word = pickRandomUnusedWord(words, usedIds, random)
  if (!word) {
    usedIds = []
    word = pickRandomUnusedWord(words, usedIds, random)
  }
  if (!word) return { ...session, isNewDraw: false }
  return { history: [...session.history, word], index: session.history.length, usedIds: [...usedIds, word.id], isNewDraw: true }
}

export function readStudySettings() {
  try {
    const value = JSON.parse(localStorage.getItem('leaperStudySettings'))
    return { mode: value?.mode === 'svl' ? 'svl' : 'leap', level: SVL_LEVELS.includes(value?.level) ? value.level : 1 }
  } catch { return { mode: 'leap', level: 1 } }
}

export function saveStudySettings(settings) {
  try { localStorage.setItem('leaperStudySettings', JSON.stringify(settings)) } catch { /* Settings remain usable in memory. */ }
}
