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
 * 指定されたURLから単語データを取得
 * @param {string} url - データを取得するURL
 * @returns {Promise<Array>} - 単語データの配列
 */
export async function fetchWordData(url) {
  try {
    // まずViteのプロキシ経由で取得を試みる（開発環境）
    const proxyUrls = [
      '/api/proxy', // Viteプロキシ（開発環境）
      url, // 直接取得
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, // CORSプロキシ
    ];

    let lastError = null;
    
    for (const fetchUrl of proxyUrls) {
      try {
        const response = await fetch(fetchUrl, {
          mode: 'cors',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        const words = parseWordDataFromHTML(html);
        
        // データが取得できた場合（最低限の単語数がある場合）
        if (words.length > 100) {
          console.log(`単語データを取得しました: ${words.length}語`);
          return words;
        } else {
          console.warn(`取得したデータが少なすぎます: ${words.length}語`);
        }
      } catch (error) {
        lastError = error;
        console.warn(`取得方法 ${fetchUrl} での取得に失敗:`, error);
        // 次の方法を試す
        continue;
      }
    }
    
    // すべての方法で失敗した場合
    throw lastError || new Error('すべての取得方法が失敗しました');
  } catch (error) {
    console.error('データの取得に失敗しました:', error);
    throw error;
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

