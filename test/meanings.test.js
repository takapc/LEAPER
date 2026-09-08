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

test('system No.540 has two complete countable noun senses', () => {
  const words = JSON.parse(readFileSync(new URL('../src/data/words.json', import.meta.url), 'utf8'))
  const word = words.find(({ id }) => id === 540)
  assert.equal(word.word, 'system')
  assert.deepEqual(formatMeaning(word.meanings), [
    '[名] 制度，組織〈可算〉',
    '[名] 体系〈可算〉',
  ])
  assert.deepEqual(getPartOfSpeechTags(word.meanings), ['名', '名'])
})

test('keeps sense references and POS tags inside notes in a single displayed sense', () => {
  const meanings = normalizeMeanings('[他] ①調べる ②確かめる（※②は[自]も可）')
  assert.equal(meanings.length, 2)
  assert.equal(meanings[1].meaning, '確かめる（※2は[自]も可）')
  assert.deepEqual(formatMeaning(meanings), ['[他] 調べる', '[他] 確かめる（※2は[自]も可）'])
  assert.deepEqual(normalizeMeanings(meanings), meanings)
  const sharedNote = normalizeMeanings('[名] ①例 ②実例（①②ともに〈可算〉)')
  assert.equal(sharedNote.length, 2)
  assert.equal(sharedNote[1].meaning, '実例（1・2ともに〈可算〉)')
})

test('preserves numerical content and shared usage prefixes', () => {
  for (const [source, expected] of [
    ['[名] ①④分の① ②地域', ['4分の1', '地域']],
    ['[形] ①第①の ②初期の', ['第1の', '初期の']],
    ['[名] ①（①つ①つの）文 ②判決', ['（1つ1つの）文', '判決']],
    ['[名] 手足 (の①本)', ['手足 (の1本)']],
    ['[自] （to ～）①貢献する ②一因となる', ['（to ～）貢献する', '（to ～）一因となる']],
  ]) {
    assert.deepEqual(normalizeMeanings(source).map(({ meaning }) => meaning), expected)
  }
})

test('all bundled senses have balanced notes and survive normalization and display', () => {
  const words = JSON.parse(readFileSync(new URL('../src/data/words.json', import.meta.url), 'utf8'))
  const pairs = { '（': ')', '(': ')', '［': ']', '[': ']', '〈': '〉', '「': '」' }
  for (const word of words) {
    const label = `${word.id}: ${word.word}`
    assert.deepEqual(normalizeMeanings(word.meanings), word.meanings, label)
    assert.equal(formatMeaning(word.meanings).length, word.meanings.length, label)
    for (const { meaning } of word.meanings) {
      const stack = []
      for (const char of meaning.replaceAll('）', ')').replaceAll('］', ']')) {
        if (pairs[char]) stack.push(pairs[char])
        else if (')]〉」'.includes(char)) assert.equal(stack.pop(), char, `${label}: ${meaning}`)
      }
      assert.equal(stack.length, 0, `${label}: ${meaning}`)
      assert.ok(!/^(ともに|いずれも|は$|の$|つ$)/.test(meaning), label)
    }
  }
})

test('repaired numerical meanings and countability notes retain the correct scope', () => {
  const words = JSON.parse(readFileSync(new URL('../src/data/words.json', import.meta.url), 'utf8'))
  const byId = (id) => words.find((word) => word.id === id).meanings
  assert.equal(byId(273)[0].meaning, '4分の1，15分，25セント')
  assert.equal(byId(299).length, 5)
  assert.equal(byId(345).length, 3)
  assert.equal(byId(184).length, 3)
  for (const id of [449, 483, 534, 919, 1018, 1033, 1888]) {
    assert.ok(byId(id).every(({ meaning }) => /〈(?:不)?可算〉$/.test(meaning)), String(id))
  }
  assert.deepEqual(byId(1102).map(({ meaning }) => meaning), ['経営，運営〈不可算〉', '行政〈不可算〉', '政権'])
})
