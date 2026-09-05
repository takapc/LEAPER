import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeMeaning, normalizeWordMeanings, meaningToText, PART_OF_SPEECH_TAGS } from '../src/utils/meanings.js'
import { formatMeaning } from '../src/utils/quizLogic.js'
import { formatHeadwordMeaningForRelatedWord } from '../src/utils/relatedWordMeanings.js'

test('splits part-of-speech blocks without treating usage notes as tags', () => {
  const text = '[他] ①～を待つ [for] ②～を望む [名] 希望 [複数形]'
  const expected = [
    { partOfSpeech: 'transitive-verb', meaning: '①～を待つ [for] ②～を望む' },
    { partOfSpeech: 'noun', meaning: '希望 [複数形]' },
  ]
  assert.deepEqual(normalizeMeaning(text), expected)
  assert.equal(meaningToText(expected), text)
  assert.deepEqual(formatMeaning(expected), formatMeaning(text))
  assert.equal(formatHeadwordMeaningForRelatedWord(expected), formatHeadwordMeaningForRelatedWord(text))
})

test('normalizes both legacy imports and structured imports without changing other fields', () => {
  const legacy = [{ id: 1, word: 'example', meaning: '例', relatedWords: [] }]
  const normalized = normalizeWordMeanings(legacy)
  assert.deepEqual(normalized[0], { ...legacy[0], meaning: [{ partOfSpeech: '', meaning: '例' }] })
  assert.deepEqual(normalizeWordMeanings(normalized), normalized)
  assert.equal(legacy[0].meaning, '例')
  assert.equal(formatMeaning('ご利用ありがとうございました！')[0], 'ご利用ありがとうございました！')
})

test('rejects malformed structured meanings at import boundaries', () => {
  for (const value of [null, '', [], [{}], [{ partOfSpeech: 'noun', meaning: '' }],
    [{ partOfSpeech: 'invalid', meaning: '例' }]]) {
    assert.throws(() => normalizeMeaning(value))
  }
})

test('all 2300 bundled headwords follow the structured meaning contract', () => {
  const words = JSON.parse(readFileSync(new URL('../src/data/words.json', import.meta.url), 'utf8'))
  assert.equal(words.length, 2300)
  assert.equal(new Set(words.map(({ id }) => id)).size, 2300)
  for (const word of words) {
    assert.ok(Array.isArray(word.meaning) && word.meaning.length > 0, String(word.id))
    for (const entry of word.meaning) {
      assert.deepEqual(Object.keys(entry).sort(), ['meaning', 'partOfSpeech'], String(word.id))
      assert.ok(Object.hasOwn(PART_OF_SPEECH_TAGS, entry.partOfSpeech), String(word.id))
      assert.ok(typeof entry.meaning === 'string' && entry.meaning.trim(), String(word.id))
    }
  }
})
