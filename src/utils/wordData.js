/**
 * 単語データを取得・パースするユーティリティ関数
 */

/**
 * HTMLテーブルから単語データを抽出
 * @param {string} html - HTML文字列
 * @returns {Array<{id: number, word: string, meaning: string}>} - 単語データの配列
 */
export function parseWordDataFromHTML(html) {
  const words = [];
  
  // テーブル行を抽出するための正規表現
  // <tr>タグ内のデータを抽出
  const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(tableRowRegex) || [];
  
  rows.forEach((row, index) => {
    // ヘッダー行をスキップ
    if (row.includes('<th') || row.includes('No')) {
      return;
    }
    
    // <td>タグからデータを抽出
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let match;
    
    while ((match = cellRegex.exec(row)) !== null) {
      // HTMLタグを除去し、テキストのみを抽出
      const text = match[1]
        .replace(/<[^>]+>/g, '') // HTMLタグを除去
        .replace(/&nbsp;/g, ' ') // &nbsp;をスペースに変換
        .trim();
      cells.push(text);
    }
    
    // データが3列（No, 単語, 意味）の場合
    if (cells.length >= 3) {
      const id = parseInt(cells[0], 10);
      const word = cells[1].trim();
      const meaning = cells[2].trim();
      
      if (id && word && meaning) {
        words.push({ id, word, meaning });
      }
    }
  });
  
  return words;
}

/**
 * 指定されたURLから単語データを取得
 * @param {string} url - データを取得するURL
 * @returns {Promise<Array>} - 単語データの配列
 */
export async function fetchWordData(url) {
  try {
    // CORSの問題を回避するため、プロキシを使用するか、
    // またはローカルにデータを保存する方法を検討
    // ここでは直接取得を試みます
    const response = await fetch(url, {
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    return parseWordDataFromHTML(html);
  } catch (error) {
    console.error('データの取得に失敗しました:', error);
    // フォールバック: サンプルデータを返す
    return getSampleWordData();
  }
}

/**
 * サンプル単語データ（フォールバック用）
 */
function getSampleWordData() {
  return [
    { id: 1, word: 'agree', meaning: '[自] ①賛成する ②（主語の中で）意見が一致する ③（with ～）（気候，食べ物が）（～に）合う' },
    { id: 2, word: 'oppose', meaning: '[他] ～に反対する' },
    { id: 3, word: 'advise', meaning: '[他] ～に忠告する' },
    { id: 4, word: 'tip', meaning: '[名] ①助言，ヒント ②チップ ③（足や山などの）先，先端（いずれも〈可算〉）' },
    { id: 5, word: 'discuss', meaning: '[他] ①～について話し合う，議論する ②～を話題に出す' },
  ];
}

/**
 * 単語データをローカルストレージに保存
 */
export function saveWordDataToLocalStorage(words) {
  try {
    localStorage.setItem('leapWordData', JSON.stringify(words));
    localStorage.setItem('leapWordDataTimestamp', Date.now().toString());
  } catch (error) {
    console.error('ローカルストレージへの保存に失敗しました:', error);
  }
}

/**
 * ローカルストレージから単語データを取得
 */
export function getWordDataFromLocalStorage() {
  try {
    const data = localStorage.getItem('leapWordData');
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('ローカルストレージからの読み込みに失敗しました:', error);
  }
  return null;
}

