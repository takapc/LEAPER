import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyBundledHeadwordMeanings,
  formatHeadwordMeaningForRelatedWord,
} from '../src/utils/relatedWordMeanings.js'

test('formats LEAP headword meanings for related-word display', () => {
  assert.equal(
    formatHeadwordMeaningForRelatedWord('[名] ①贈り物 ②才能，天分'),
    '贈り物／才能，天分',
  )
})

test('prefers LEAP meanings for related words that are bundled headwords', () => {
  const words = [
    {
      id: 1,
      word: 'agree',
      meaning: '[自] ①賛成する ②意見が一致する',
      relatedWords: [
        { word: 'match', meaning: '試合', type: 'synonym', partsOfSpeech: ['verb'] },
        { word: 'accord', meaning: '一致する', type: 'synonym', partsOfSpeech: ['verb'] },
      ],
    },
    {
      id: 2,
      word: 'match',
      meaning: '[他] ①～と調和する ②～に匹敵する',
      relatedWords: [],
    },
  ]

  const updatedCount = applyBundledHeadwordMeanings(words)

  assert.equal(updatedCount, 1)
  assert.equal(words[0].relatedWords[0].meaning, '～と調和する／～に匹敵する')
  assert.equal(words[0].relatedWords[1].meaning, '一致する')
})

test('matches bundled headwords case-insensitively', () => {
  const words = [
    {
      id: 1,
      word: 'Example',
      meaning: '[名] ①例 ②手本',
      relatedWords: [],
    },
    {
      id: 2,
      word: 'sample',
      meaning: '[名] 見本',
      relatedWords: [
        { word: 'EXAMPLE', meaning: '模範', type: 'synonym', partsOfSpeech: ['noun'] },
      ],
    },
  ]

  applyBundledHeadwordMeanings(words)

  assert.equal(words[1].relatedWords[0].meaning, '例／手本')
})
