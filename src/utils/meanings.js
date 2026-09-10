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

export const PART_OF_SPEECH_LABELS = {
  noun: '名詞',
  'transitive-verb': '他動詞',
  'intransitive-verb': '自動詞',
  verb: '動詞',
  adjective: '形容詞',
  adverb: '副詞',
  preposition: '前置詞',
  conjunction: '接続詞',
  auxiliary: '助動詞',
  phrase: '熟語',
}

const partsByTag = Object.fromEntries(
  Object.entries(PART_OF_SPEECH_TAGS).map(([part, tag]) => [tag, part]),
)

const CIRCLED_SENSE_NUMBER = /[①-⑳]/g

// Usage notes may contain sense references and part-of-speech tags.
// Only markers outside brackets delimit entries (mixed-width parentheses occur in imports).
function topLevelMatches(text, pattern) {
  const depths = []
  let depth = 0
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    depths.push(depth)
    if ('（(［[〈「'.includes(char)) depth += 1
    if ('）)］]〉」'.includes(char)) depth = Math.max(0, depth - 1)
  }
  return [...text.matchAll(pattern)].filter((match) => depths[match.index] === 0)
}

function plainNumbers(text) {
  return text.replace(/([①-⑳])(?=[①-⑳])/g, '$1・')
    .replace(CIRCLED_SENSE_NUMBER, (number) => String(number.charCodeAt(0) - '①'.charCodeAt(0) + 1))
}

/** @typedef {{partOfSpeech: string, meaning: string}} Meaning */

function splitSenses(partOfSpeech, text) {
  const matches = topLevelMatches(text, CIRCLED_SENSE_NUMBER).filter((match) =>
    !/[第の]/.test(text[match.index - 1] ?? '') &&
    !text.slice(match.index + 1).startsWith('分の'),
  )
  if (!matches.length) return [{ partOfSpeech, meaning: plainNumbers(text.trim()) }]

  const prefix = text.slice(0, matches[0].index).trim()
  return matches.map((match, index) => {
    const start = match.index + match[0].length
    const end = matches[index + 1]?.index ?? text.length
    const sense = text.slice(start, end).trim()
    return {
      partOfSpeech,
      meaning: plainNumbers(prefix ? `${prefix}${sense}` : sense),
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
  for (const match of topLevelMatches(value, tags)) {
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
