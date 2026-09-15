import test from 'node:test'
import assert from 'node:assert/strict'
import { createRobotsTxt, createSitemapXml, getPublicSiteUrl } from '../api/site-indexing.js'

test('サイトマップは公開ホストのトップページだけを登録する', () => {
  const xml = createSitemapXml('https://leaper.example.jp')

  assert.match(xml, /<loc>https:\/\/leaper\.example\.jp\/<\/loc>/)
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
})

test('robots.txtは公開ホストに対応するサイトマップを案内する', () => {
  assert.equal(
    createRobotsTxt('https://leaper.example.jp'),
    'User-agent: *\nAllow: /\n\nSitemap: https://leaper.example.jp/sitemap.xml\n',
  )
})

test('転送ヘッダーから公開URLを作り、不正なホストは既定値へ戻す', () => {
  assert.equal(
    getPublicSiteUrl({ headers: { 'x-forwarded-host': 'leaper.example.jp', 'x-forwarded-proto': 'https' } }),
    'https://leaper.example.jp',
  )
  assert.equal(
    getPublicSiteUrl({ headers: { host: 'bad host' } }),
    'https://leaper-lake.vercel.app',
  )
})
