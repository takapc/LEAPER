export const PART_OF_SPEECH_TAGS = {
  'intransitive-verb': '自',
  'transitive-verb': '他',
  noun: '名',
  adjective: '形',
  preposition: '前',
  adverb: '副',
  conjunction: '接',
  auxiliary: '助',
  verb: '動',
  phrase: '熟',
}

const partsByTag = Object.fromEntries(
  Object.entries(PART_OF_SPEECH_TAGS).map(([part, tag]) => [tag, part]),
)

/** @typedef {{partOfSpeech: string, meaning: string}} Mean */

/** Convert legacy text at import boundaries; untagged text uses an empty part of speech. */
export function normalizeMeaning(value) {
  if (Array.isArray(value)) {
    if (!value.length || value.some((entry) =>
      !entry || typeof entry.partOfSpeech !== 'string' ||
      (entry.partOfSpeech !== '' && !Object.hasOwn(PART_OF_SPEECH_TAGS, entry.partOfSpeech)) ||
      typeof entry.meaning !== 'string' || !entry.meaning.trim(),
    )) throw new Error('Invalid structured meaning')
    return value.map(({ partOfSpeech, meaning }) => ({ partOfSpeech, meaning }))
  }

  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid meaning')

  const entries = []
  const tags = /\[(自|他|名|形|前|副|接|助|動|熟)\]/g
  let partOfSpeech = ''
  let start = 0
  for (const match of value.matchAll(tags)) {
    const meaning = value.slice(start, match.index).trim()
    if (meaning) entries.push({ partOfSpeech, meaning })
    partOfSpeech = partsByTag[match[1]]
    start = match.index + match[0].length
  }
  const meaning = value.slice(start).trim()
  if (meaning) entries.push({ partOfSpeech, meaning })
  if (!entries.length) throw new Error('Empty meaning')
  return entries
}

/** Preserve the existing presentation while storing part of speech separately. */
export function meaningToText(value) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map(({ partOfSpeech, meaning }) => {
    const tag = PART_OF_SPEECH_TAGS[partOfSpeech]
    return tag ? `[${tag}] ${meaning}` : meaning
  }).join(' ')
}

export function normalizeWordMeanings(words) {
  if (!Array.isArray(words)) throw new Error('Word data must be an array')
  return words.map((word) => ({ ...word, meaning: normalizeMeaning(word.meaning) }))
}
