import { meaningsToText } from './meanings.js'

export const PART_RANGES = {
  part1: { start: 1, end: 400, label: 'Part 1' },
  part2: { start: 401, end: 1000, label: 'Part 2' },
  part3: { start: 1001, end: 1400, label: 'Part 3' },
  part4: { start: 1401, end: 2000, label: 'Part 4' },
  partExtra: { start: 2001, end: 2300, label: '＋α' },
}

export function formatMeaning(meanings) {
  const meaning = meaningsToText(meanings)
  if (!meaning) return ['']

  const posLookahead = /(?=\[(?:自|他|名|形|前|副|接|助|動|熟)\])/
  const hasPosTag = /\[(?:自|他|名|形|前|副|接|助|動|熟)\]/.test(meaning)

  if (!hasPosTag) {
    const parts = meaning.split(/([①②③④⑤⑥⑦⑧⑨⑩])/)
    const lines = []
    let currentLine = ''

    for (const part of parts) {
      if (/[①②③④⑤⑥⑦⑧⑨⑩]/.test(part)) {
        if (currentLine.trim()) lines.push(currentLine.trim())
        currentLine = part
      } else {
        currentLine += part
      }
    }

    if (currentLine.trim()) lines.push(currentLine.trim())
    return lines.length > 0 ? lines : [meaning]
  }

  const lines = []
  meaning
    .split(posLookahead)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const circleParts = segment.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/)
      if (circleParts.length === 1) {
        lines.push(segment)
        return
      }

      const firstLine = `${circleParts[0]}${circleParts[1]}`.trim()
      if (firstLine) lines.push(firstLine)
      for (let index = 2; index < circleParts.length; index += 1) {
        const line = circleParts[index].trim()
        if (line) lines.push(line)
      }
    })

  return lines.length > 0 ? lines : [meaning]
}

export function filterWordsBySelectedParts(words, selectedParts, partRanges = PART_RANGES) {
  if (selectedParts.length === 0) return words

  return words.filter((word) =>
    selectedParts.some((partKey) => {
      const part = partRanges[partKey]
      return part && word.id >= part.start && word.id <= part.end
    }),
  )
}

export function searchEnglishWords(words, query, limit = 10) {
  const normalizedQuery = query.trim().toLocaleLowerCase('en')
  if (!normalizedQuery || !/[a-z]/.test(normalizedQuery)) return []

  return words
    .filter((word) => word.word.toLocaleLowerCase('en').includes(normalizedQuery))
    .sort((a, b) => {
      const aWord = a.word.toLocaleLowerCase('en')
      const bWord = b.word.toLocaleLowerCase('en')
      const aStartsWith = aWord.startsWith(normalizedQuery)
      const bStartsWith = bWord.startsWith(normalizedQuery)
      if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1
      return aWord.localeCompare(bWord, 'en')
    })
    .slice(0, limit)
}

export function pickRandomUnusedWord(words, usedIds, random = Math.random) {
  const usedIdSet = new Set(usedIds)
  const availableWords = words.filter((word) => !usedIdSet.has(word.id))
  if (availableWords.length === 0) return null

  return availableWords[Math.floor(random() * availableWords.length)]
}
