import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const words = JSON.parse(
  readFileSync(new URL('../src/data/words.json', import.meta.url), 'utf8'),
)

test('every bundled word has a valid relatedWords collection', () => {
  const validTypes = new Set(['word-family', 'synonym', 'antonym'])
  const validPartsOfSpeech = new Set([
    'noun',
    'transitive-verb',
    'intransitive-verb',
    'verb',
    'adjective',
    'adverb',
    'preposition',
    'conjunction',
    'auxiliary',
    'phrase',
  ])

  for (const word of words) {
    assert.ok(Array.isArray(word.relatedWords), `${word.word} is missing relatedWords`)

    const seen = new Set()
    for (const relatedWord of word.relatedWords) {
      assert.equal(typeof relatedWord.word, 'string')
      assert.ok(relatedWord.word.length > 0)
      assert.equal(typeof relatedWord.meaning, 'string')
      assert.ok(relatedWord.meaning.length > 0)
      assert.ok(validTypes.has(relatedWord.type))
      assert.ok(Array.isArray(relatedWord.partsOfSpeech))
      assert.ok(relatedWord.partsOfSpeech.length > 0)
      for (const partOfSpeech of relatedWord.partsOfSpeech) {
        assert.ok(validPartsOfSpeech.has(partOfSpeech))
      }
      assert.notEqual(relatedWord.word.toLowerCase(), word.word.toLowerCase())
      assert.ok(!seen.has(relatedWord.word.toLowerCase()))
      seen.add(relatedWord.word.toLowerCase())
    }
  }
})

test('the bundled dataset contains every requested relation type', () => {
  const types = new Set(words.flatMap((word) => word.relatedWords.map((item) => item.type)))

  assert.deepEqual(types, new Set(['word-family', 'synonym', 'antonym']))
})
