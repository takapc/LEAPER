import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceSvlSession, createSvlLoader, parseSvlCsv, readStudySettings, saveStudySettings, SVL_LEVELS } from '../src/utils/svlData.js'

const csv = '1,example,"[名]例"\n2,test,"[動]試す"'
const noStorage = () => { throw new Error('Storage blocked') }
const response = (text = csv) => ({ ok: true, text: async () => text })

test('CSV handles BOM, CRLF, quoted commas, escaped quotes and multiline meanings', () => {
  assert.deepEqual(parseSvlCsv('\uFEFF1,example,"[名]例, 見本\r\n""引用"""\r\n'), [
    { id: 1, word: 'example', meaning: '例, 見本\r\n"引用"' },
  ])
})

test('CSV rejects empty, malformed, duplicate or missing entries', () => {
  for (const value of ['', '1,word,"unfinished', '1,x,y\n1,z,a', '0,x,y', '1,,y', '1,x,', '1,x,y,z']) {
    assert.throws(() => parseSvlCsv(value))
  }
})

test('loader fetches only the chosen level, deduplicates and caches without storage', async () => {
  const urls = []
  const load = createSvlLoader(async (url) => { urls.push(url); return response() }, noStorage)
  const [a, b] = await Promise.all([load(12), load(12)])
  assert.equal(a, b)
  assert.equal(await load(12), a)
  assert.equal(urls.length, 1)
  assert.match(urls[0], /level-12\.csv$/)
  await assert.rejects(load(13))
  await assert.rejects(load('1'))
  assert.equal(SVL_LEVELS.length, 12)
})

test('all 12 levels map to their corresponding CSV URL', async () => {
  for (const level of SVL_LEVELS) {
    const load = createSvlLoader(async (url) => {
      assert.ok(url.endsWith(`level-${String(level).padStart(2, '0')}.csv`))
      return response()
    }, noStorage)
    await load(level)
  }
})

test('network and malformed-data failures are retryable and never cached', async () => {
  let calls = 0
  const load = createSvlLoader(async () => {
    calls += 1
    if (calls === 1) return { ok: false, status: 503 }
    if (calls === 2) return response('<html>Error</html>')
    return response()
  }, noStorage)
  await assert.rejects(load(1))
  await assert.rejects(load(1))
  assert.equal((await load(1)).length, 2)
  assert.equal(calls, 3)
})

test('valid session cache survives loader recreation; expired and corrupt caches refetch', async () => {
  const values = new Map()
  const storage = () => ({ getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) })
  await createSvlLoader(async () => response(), storage)(1)
  const offline = createSvlLoader(async () => { throw new Error('offline') }, storage)
  assert.equal((await offline(1)).length, 2)
  const key = [...values.keys()][0]
  for (const stale of ['broken', JSON.stringify({ savedAt: 0, csv }), JSON.stringify({ savedAt: Date.now(), csv: 'bad' })]) {
    values.set(key, stale)
    let fetched = false
    await createSvlLoader(async () => { fetched = true; return response() }, storage)(1)
    assert.equal(fetched, true)
  }
})

test('independent level requests retain the correct results when they resolve in reverse order', async () => {
  let finishFirst
  const load = createSvlLoader(async (url) => url.endsWith('01.csv')
    ? new Promise((resolve) => { finishFirst = resolve })
    : response('2,second,二つ目'), noStorage)
  const first = load(1)
  assert.equal((await load(2))[0].word, 'second')
  finishFirst(response())
  assert.equal((await first)[0].word, 'example')
})

test('draws exhaust a cycle; history navigation does not count another draw', () => {
  const words = parseSvlCsv(csv)
  let session = { history: [], index: -1, usedIds: [] }
  session = advanceSvlSession(session, words, () => 0)
  assert.equal(session.isNewDraw, true)
  session = advanceSvlSession(session, words, () => 0)
  assert.deepEqual(session.usedIds, [1, 2])
  const revisited = advanceSvlSession({ ...session, index: 0 }, words, () => 0)
  assert.equal(revisited.isNewDraw, false)
  assert.equal(revisited.history.length, 2)
  const next = advanceSvlSession(revisited, words, () => 0)
  assert.equal(next.history.length, 3)
  assert.deepEqual(next.usedIds, [1])
})

test('settings validate stored values and tolerate unavailable storage', () => {
  assert.deepEqual(readStudySettings(), { mode: 'leap', level: 1 })
  assert.doesNotThrow(() => saveStudySettings({ mode: 'svl', level: 12 }))
  const values = new Map([['leapUsedWordIds', '[1,2]']])
  global.localStorage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }
  try {
    saveStudySettings({ mode: 'svl', level: 12 })
    assert.deepEqual(readStudySettings(), { mode: 'svl', level: 12 })
    saveStudySettings({ mode: 'bad', level: 99 })
    assert.deepEqual(readStudySettings(), { mode: 'leap', level: 1 })
    assert.equal(values.get('leapUsedWordIds'), '[1,2]')
  } finally { delete global.localStorage }
})
