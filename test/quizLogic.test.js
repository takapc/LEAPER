import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterWordsBySelectedParts,
  formatMeaning,
  PART_RANGES,
  pickRandomUnusedWord,
} from '../src/utils/quizLogic.js'

test('formatMeaning keeps the first numbered meaning with its part of speech', () => {
  assert.deepEqual(formatMeaning('[自] ①賛成する ②意見が一致する'), ['[自] ①賛成する', '②意見が一致する'])
})

test('filterWordsBySelectedParts returns a union of non-adjacent parts', () => {
  const words = [
    { id: 100 },
    { id: 500 },
    { id: 1100 },
  ]

  assert.deepEqual(
    filterWordsBySelectedParts(words, ['part1', 'part3'], PART_RANGES).map(({ id }) => id),
    [100, 1100],
  )
})

test('pickRandomUnusedWord excludes every used id', () => {
  const words = [{ id: 1 }, { id: 2 }, { id: 3 }]
  assert.equal(pickRandomUnusedWord(words, [1, 2], () => 0).id, 3)
  assert.equal(pickRandomUnusedWord(words, [1, 2, 3], () => 0), null)
})

test('pickRandomUnusedWord accepts an injected random source', () => {
  const words = [{ id: 1 }, { id: 2 }, { id: 3 }]
  assert.equal(pickRandomUnusedWord(words, [], () => 0.99).id, 3)
})
