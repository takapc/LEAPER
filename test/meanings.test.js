import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getPartOfSpeechTags,
  meaningsToText,
  normalizeMeanings,
  normalizeWordMeanings,
  PART_OF_SPEECH_TAGS,
} from '../src/utils/meanings.js'
import { formatMeaning } from '../src/utils/quizLogic.js'
import { formatHeadwordMeaningForRelatedWord } from '../src/utils/relatedWordMeanings.js'

test('splits every numbered sense and does not treat usage notes as tags', () => {
  const text = '[他] ①～を待つ [for] ②～を望む [名] 希望 [複数形]'
  const expected = [
    { partOfSpeech: 'transitive-verb', meaning: '～を待つ [for]' },
    { partOfSpeech: 'transitive-verb', meaning: '～を望む' },
    { partOfSpeech: 'noun', meaning: '希望 [複数形]' },
  ]
  assert.deepEqual(normalizeMeanings(text), expected)
  assert.equal(meaningsToText(expected), '[他] ～を待つ [for] [他] ～を望む [名] 希望 [複数形]')
  assert.deepEqual(formatMeaning(expected), ['[他] ～を待つ [for]', '[他] ～を望む', '[名] 希望 [複数形]'])
  assert.equal(formatHeadwordMeaningForRelatedWord(expected), '～を待つ [for]／～を望む／希望 [複数形]')
})

test('normalizes both legacy imports and structured imports without changing other fields', () => {
  const legacy = [{ id: 1, word: 'example', meaning: '例', relatedWords: [] }]
  const normalized = normalizeWordMeanings(legacy)
  assert.deepEqual(normalized[0], {
    id: 1,
    word: 'example',
    meanings: [{ partOfSpeech: '', meaning: '例' }],
    relatedWords: [],
  })
  assert.deepEqual(normalizeWordMeanings(normalized), normalized)
  assert.equal(legacy[0].meaning, '例')
  assert.equal(formatMeaning('ご利用ありがとうございました！')[0], 'ご利用ありがとうございました！')
})

test('rejects malformed structured meanings at import boundaries', () => {
  for (const value of [null, '', [], [{}], [{ partOfSpeech: 'noun', meaning: '' }],
    [{ partOfSpeech: 'invalid', meaning: '例' }]]) {
    assert.throws(() => normalizeMeanings(value))
  }
})

test('returns one display tag per meaning so the hint preserves count and order', () => {
  assert.deepEqual(getPartOfSpeechTags([
    { partOfSpeech: 'intransitive-verb', meaning: '賛成する' },
    { partOfSpeech: 'intransitive-verb', meaning: '一致する' },
    { partOfSpeech: 'noun', meaning: '合意' },
    { partOfSpeech: '', meaning: '品詞なし' },
  ]), ['自', '自', '名', ''])
})

test('all 2300 bundled headwords follow the structured meaning contract', () => {
  const words = JSON.parse(readFileSync(new URL('../src/data/words.json', import.meta.url), 'utf8'))
  assert.equal(words.length, 2300)
  assert.equal(new Set(words.map(({ id }) => id)).size, 2300)
  for (const word of words) {
    assert.ok(!Object.hasOwn(word, 'meaning'), String(word.id))
    assert.ok(Array.isArray(word.meanings) && word.meanings.length > 0, String(word.id))
    for (const entry of word.meanings) {
      assert.deepEqual(Object.keys(entry).sort(), ['meaning', 'partOfSpeech'], String(word.id))
      assert.ok(Object.hasOwn(PART_OF_SPEECH_TAGS, entry.partOfSpeech), String(word.id))
      assert.ok(typeof entry.meaning === 'string' && entry.meaning.trim(), String(word.id))
      assert.ok(!/[①-⑳]/.test(entry.meaning), String(word.id))
    }
  }
})
