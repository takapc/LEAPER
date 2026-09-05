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

const CIRCLED_SENSE_NUMBER = /[①-⑳]/g

/** @typedef {{partOfSpeech: string, meaning: string}} Meaning */

function splitSenses(partOfSpeech, text) {
  const matches = [...text.matchAll(CIRCLED_SENSE_NUMBER)]
  if (!matches.length) return [{ partOfSpeech, meaning: text.trim() }]

  const prefix = text.slice(0, matches[0].index).trim()
  return matches.map((match, index) => {
    const start = match.index + match[0].length
    const end = matches[index + 1]?.index ?? text.length
    const sense = text.slice(start, end).trim()
    return {
      partOfSpeech,
      meaning: index === 0 && prefix ? `${prefix}${sense}` : sense,
    }
  }).filter(({ meaning }) => meaning)
}

function validatePartOfSpeech(partOfSpeech) {
  return partOfSpeech === '' || Object.hasOwn(PART_OF_SPEECH_TAGS, partOfSpeech)
}

/**
 * Normalize old strings and grouped arrays into one object per individual sense.
 * Circled sense numbers are structural markers and are not retained.
 */
export function normalizeMeanings(value) {
  if (Array.isArray(value)) {
    if (!value.length || value.some((entry) =>
      !entry || typeof entry.partOfSpeech !== 'string' ||
      !validatePartOfSpeech(entry.partOfSpeech) ||
      typeof entry.meaning !== 'string' || !entry.meaning.trim(),
    )) throw new Error('Invalid structured meanings')
    return value.flatMap(({ partOfSpeech, meaning }) =>
      splitSenses(partOfSpeech, meaning.trim()),
    )
  }

  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid meanings')

  const blocks = []
  const tags = /\[(自|他|名|形|前|副|接|助|動|熟)\]/g
  let partOfSpeech = ''
  let start = 0
  for (const match of value.matchAll(tags)) {
    const meaning = value.slice(start, match.index).trim()
    if (meaning) blocks.push({ partOfSpeech, meaning })
    partOfSpeech = partsByTag[match[1]]
    start = match.index + match[0].length
  }
  const meaning = value.slice(start).trim()
  if (meaning) blocks.push({ partOfSpeech, meaning })
  if (!blocks.length) throw new Error('Empty meanings')
  return blocks.flatMap(({ partOfSpeech: part, meaning: text }) => splitSenses(part, text))
}

/** Convert structured meanings to the compact tagged text used by existing displays. */
export function meaningsToText(value) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map(({ partOfSpeech, meaning }) => {
    const tag = PART_OF_SPEECH_TAGS[partOfSpeech]
    return tag ? `[${tag}] ${meaning}` : meaning
  }).join(' ')
}

export function getPartOfSpeechTags(meanings) {
  if (!Array.isArray(meanings)) return []
  return meanings.map(({ partOfSpeech }) => PART_OF_SPEECH_TAGS[partOfSpeech] ?? '')
}

export function normalizeWordMeanings(words) {
  if (!Array.isArray(words)) throw new Error('Word data must be an array')
  return words.map((word) => {
    const source = word.meanings ?? word.meaning
    const { meaning: _legacyMeaning, ...rest } = word
    return { ...rest, meanings: normalizeMeanings(source) }
  })
}
