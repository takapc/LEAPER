import { meaningToText } from './meanings.js'

const PART_OF_SPEECH_PREFIX = /^(?:\[[^\]]+\]\s*)+/
const CIRCLED_SENSE_NUMBER = /[①②③④⑤⑥⑦⑧⑨⑩]/g

function normalizeWord(word) {
  return typeof word === 'string' ? word.trim().toLowerCase() : ''
}

export function formatHeadwordMeaningForRelatedWord(meaning) {
  meaning = meaningToText(meaning)

  return meaning
    .replace(PART_OF_SPEECH_PREFIX, '')
    .replace(CIRCLED_SENSE_NUMBER, '／')
    .replace(/^\s*／\s*/, '')
    .replace(/\s*／\s*/g, '／')
    .replace(/\s+/g, ' ')
    .trim()
}

export function applyBundledHeadwordMeanings(words) {
  if (!Array.isArray(words)) return 0

  const headwordMeanings = new Map()
  for (const word of words) {
    const key = normalizeWord(word?.word)
    const meaning = formatHeadwordMeaningForRelatedWord(word?.meaning)
    if (key && meaning) headwordMeanings.set(key, meaning)
  }

  let updatedCount = 0
  for (const word of words) {
    if (!Array.isArray(word?.relatedWords)) continue

    for (const relatedWord of word.relatedWords) {
      const authoritativeMeaning = headwordMeanings.get(normalizeWord(relatedWord?.word))
      if (!authoritativeMeaning || authoritativeMeaning === relatedWord.meaning) continue

      // When the related spelling is itself a LEAP headword, prefer LEAP's own
      // learner-oriented Japanese gloss over a generic dictionary translation.
      relatedWord.meaning = authoritativeMeaning
      updatedCount += 1
    }
  }

  return updatedCount
}
