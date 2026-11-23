import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { applyBrowserPatch, defaultBrowserData, diffBrowserData, readBrowserData, validatePatch } from '../src/utils/browserData.js'
import { readStudySettings } from '../src/utils/svlData.js'

const reactions = JSON.parse(readFileSync(new URL('../src/data/inorganicReactions.json', import.meta.url)))
const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function tallySide(side) {
  const totals = new Map()
  const add = (element, count) => totals.set(element, (totals.get(element) ?? 0) + count)

  for (const term of side.split(' + ')) {
    const [, coefficientText, formula, chargeMagnitude, chargeSign] =
      /^(\d*)(.+?)(?:([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻]))?$/.exec(term.replace(/[↑↓]/g, ''))
    const coefficient = Number(coefficientText || 1)
    if (chargeSign) {
      const magnitude = Number([...chargeMagnitude].map((digit) => superscripts.indexOf(digit)).join('') || 1)
      add('charge', coefficient * magnitude * (chargeSign === '⁺' ? 1 : -1))
    }

    for (const part of formula.split('·')) {
      const [, multiplierText, molecule] = /^(\d*)(.*)$/.exec(part)
      const multiplier = coefficient * Number(multiplierText || 1)
      const tokens = [...molecule.matchAll(/([A-Z][a-z]?|[()[\]])(\d*)/g)]
      assert.equal(tokens.map(([token]) => token).join(''), molecule, term)
      const groups = [{ atoms: [], opening: '' }]

      for (const [, symbol, countText] of tokens) {
        const count = Number(countText || 1)
        if (symbol === '(' || symbol === '[') {
          groups.push({ atoms: [], opening: symbol })
        } else if (symbol === ')' || symbol === ']') {
          const group = groups.pop()
          assert.equal(group.opening, symbol === ')' ? '(' : '[', term)
          groups.at(-1).atoms.push(...group.atoms.map(([element, n]) => [element, n * count]))
        } else {
          groups.at(-1).atoms.push([symbol, count])
        }
      }

      assert.equal(groups.length, 1, term)
      for (const [element, count] of groups[0].atoms) add(element, count * multiplier)
    }
  }

  return [...totals].filter(([, count]) => count !== 0).sort()
}

test('反応式100選のNo.1〜99を収録し、No.11は3問に分ける', () => {
  assert.equal(reactions.length, 101)
  assert.deepEqual([...new Set(reactions.map(({ sourceNo }) => sourceNo))], Array.from({ length: 99 }, (_, index) => index + 1))
  assert.equal(reactions.filter(({ sourceNo }) => sourceNo === 11).length, 3)
  assert.ok(reactions.every(({ prompt, observation, equations }) => prompt && observation && equations.length))
})

test('すべての解答で原子数と電荷が反応の前後で一致する', () => {
  for (const { sourceNo, equations } of reactions) {
    for (const equation of equations) {
      const sides = equation.split(/ [→⇌] /)
      assert.equal(sides.length, 2, equation)
      assert.deepEqual(tallySide(sides[0]), tallySide(sides[1]), `No.${sourceNo}: ${equation}`)
    }
  }
})

test('無機化学モードを保存済み設定とブラウザ同期で認識できる', () => {
  const settings = { mode: 'inorganic', level: 2 }
  const storage = { getItem: (key) => key === 'leaperStudySettings' ? JSON.stringify(settings) : null }
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try {
    assert.deepEqual(readStudySettings(), settings)
    const local = readBrowserData(storage)
    assert.deepEqual(local.settings.study, settings)
    const original = defaultBrowserData()
    const patch = validatePatch(diffBrowserData(original, local))
    assert.deepEqual(applyBrowserPatch(original, patch), local)
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else delete globalThis.localStorage
  }
})
