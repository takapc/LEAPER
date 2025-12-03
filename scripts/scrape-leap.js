// LEAP 改訂版 単語一覧をスクレイピングして JSON に保存するスクリプト
// 実行方法: npm install (一度だけ) → npm run scrape:leap

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 取得元 URL
const SOURCE_URL = 'https://ukaru-eigo.com/leap-modified-list/'

/**
 * HTMLテーブルから単語データを抽出
 * - src/utils/wordData.js の parseWordDataFromHTML と同じロジック
 * @param {string} html - HTML文字列
 * @returns {Array<{id: number, word: string, meaning: string}>}
 */
function parseWordDataFromHTML(html) {
  const words = []

  // テーブル行を抽出するための正規表現（<tr> ～ </tr>）
  const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi
  const rows = html.match(tableRowRegex) || []

  rows.forEach((row) => {
    // ヘッダー行をスキップ
    if (
      row.includes('<th') ||
      (row.toLowerCase().includes('no') &&
        row.toLowerCase().includes('単語') &&
        row.toLowerCase().includes('意味'))
    ) {
      return
    }

    // <td>タグからデータを抽出
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    const cells = []
    let match

    while ((match = cellRegex.exec(row)) !== null) {
      // HTMLタグやエンティティを除去してテキストのみを取り出す
      let text = match[1]
        .replace(/<[^>]+>/g, '') // HTMLタグを除去
        .replace(/&nbsp;/g, ' ') // &nbsp; をスペースに変換
        .replace(/&amp;/g, '&') // &amp; を & に変換
        .replace(/&lt;/g, '<') // &lt; を < に変換
        .replace(/&gt;/g, '>') // &gt; を > に変換
        .replace(/&quot;/g, '"') // &quot; を " に変換
        .replace(/&#39;/g, "'") // &#39; を ' に変換
        .replace(/\s+/g, ' ') // 連続する空白を 1 つに
        .trim()
      cells.push(text)
    }

    // データが3列（No, 単語, 意味）の場合
    if (cells.length >= 3) {
      const id = parseInt(cells[0], 10)
      const word = cells[1].trim()
      const meaning = cells[2].trim()

      // idが有効な数値で、wordとmeaningが空でない場合のみ追加
      if (!isNaN(id) && id > 0 && word && meaning) {
        words.push({ id, word, meaning })
      }
    }
  })

  // idでソート（念のため）
  words.sort((a, b) => a.id - b.id)

  return words
}

async function main() {
  try {
    console.log(`Fetching: ${SOURCE_URL}`)
    const res = await fetch(SOURCE_URL)
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }

    const html = await res.text()
    const words = parseWordDataFromHTML(html)

    console.log(`抽出した単語数: ${words.length} 語`)

    if (words.length < 2000) {
      console.warn('⚠ 想定より単語数が少ないようです。HTML 構造が変わっていないか確認してください。')
    }

    const outPath = path.resolve(__dirname, '../src/data/words.json')
    await fs.promises.writeFile(outPath, JSON.stringify(words, null, 2), 'utf8')

    console.log(`保存完了: ${outPath}`)
  } catch (error) {
    console.error('スクレイピング中にエラーが発生しました:', error)
    process.exitCode = 1
  }
}

main()


