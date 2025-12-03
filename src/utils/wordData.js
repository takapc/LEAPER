/**
 * 単語データを取得・パースするユーティリティ関数
 */
import wordsJson from '../data/words.json'

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
    if (row.includes('<th') || row.toLowerCase().includes('no') && row.toLowerCase().includes('単語') && row.toLowerCase().includes('意味')) {
      return;
    }
    
    // <td>タグからデータを抽出
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let match;
    
    while ((match = cellRegex.exec(row)) !== null) {
      // HTMLタグを除去し、テキストのみを抽出
      let text = match[1]
        .replace(/<[^>]+>/g, '') // HTMLタグを除去
        .replace(/&nbsp;/g, ' ') // &nbsp;をスペースに変換
        .replace(/&amp;/g, '&') // &amp;を&に変換
        .replace(/&lt;/g, '<') // &lt;を<に変換
        .replace(/&gt;/g, '>') // &gt;を>に変換
        .replace(/&quot;/g, '"') // &quot;を"に変換
        .replace(/&#39;/g, "'") // &#39;を'に変換
        .replace(/\s+/g, ' ') // 連続する空白を1つに
        .trim();
      cells.push(text);
    }
    
    // データが3列（No, 単語, 意味）の場合
    if (cells.length >= 3) {
      const id = parseInt(cells[0], 10);
      const word = cells[1].trim();
      const meaning = cells[2].trim();
      
      // idが有効な数値で、wordとmeaningが空でない場合のみ追加
      if (!isNaN(id) && id > 0 && word && meaning) {
        words.push({ id, word, meaning });
      }
    }
  });
  
  // idでソート（念のため）
  words.sort((a, b) => a.id - b.id);
  
  return words;
}

/**
 * ローカルの JSON ファイルから単語データを取得
 * - CORS の影響を受けない安定した取得方法
 * - 必要に応じて words.json を更新することでデータを最新化する
 * @returns {Array<{id: number, word: string, meaning: string}>} - 単語データの配列
 */
export function getLocalWordData() {
  try {
    // 念のため id でソートしておく（words.json 側の順番が変わっても安定）
    const words = [...wordsJson].sort((a, b) => a.id - b.id)
    console.log(`ローカルJSONから単語データを読み込みました: ${words.length}語`)
    return words
  } catch (error) {
    console.error('ローカルJSONからの読み込みに失敗しました:', error)
    throw error
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

