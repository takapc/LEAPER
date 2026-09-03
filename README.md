# LEAP 英単語クイズ

LEAP改訂版の英単語2,300語を、ブラウザで繰り返し学習するためのフラッシュカード型Webアプリケーションです。
バックエンドは使用せず、同梱したJSONデータから出題します。

## 主な機能

- 全2,300語から、出題済みの単語を除外してランダム出題
- 「英語 → 日本語」のフラッシュカード
- カードのタップによる答えの表示・非表示
- カード右下のボタンから、語族・類義語・対義語と意味を一覧表示
- 英単語のスペル検索と、検索結果から選んだ単語のカード表示
- 前の問題・次の問題への移動
- Part単位の複数選択、または単語番号による詳細な範囲指定
- 現在の出題範囲における学習進捗の表示
- 履歴を削除しても残る、これまでに出題した累計語数の表示
- 間違えた問題のマークと、Part・詳細範囲に重ねて使えるオン／オフ式の絞り込み
- 3秒ごとに問題を進める自動再生
- ブラウザのSpeech Synthesis APIを利用した英単語の読み上げ
- JSONファイル、JSONテキスト、HTMLテーブルからの単語データのインポート

## 必要な環境

- Node.js 18以上
- npm

## セットアップ

```bash
npm install
npm run dev
```

開発サーバー起動後、表示されたURL（通常は `http://localhost:5173`）をブラウザで開いてください。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Vite開発サーバーを起動 |
| `npm run build` | 本番用ファイルを`dist/`へビルド |
| `npm run preview` | 本番ビルドをローカルで確認 |
| `npm test` | Node.js標準テストランナーで単体テストを実行 |
| `npm run check` | 単体テストと本番ビルドを続けて実行 |
| `npm run scrape:leap` | データ元から単語を取得して`words.json`を更新 |

## 出題範囲

| 選択肢 | 単語番号 |
| --- | ---: |
| Part 1 | 1–400 |
| Part 2 | 401–1000 |
| Part 3 | 1001–1400 |
| Part 4 | 1401–2000 |
| ＋α | 2001–2300 |

複数のPartを選択した場合は、選択したPartだけを組み合わせて出題します。詳細範囲タブでは開始番号と終了番号を直接指定できます。

## データとブラウザ保存

### 標準データ

`src/data/words.json`にLEAP改訂版の全2,300語を同梱しています。アプリ起動時はこのデータを読み込みます。
各項目の形式は次のとおりです。

```json
{
  "id": 1,
  "word": "agree",
  "meaning": "[自] ①賛成する ②意見が一致する",
  "relatedWords": [
    {
      "word": "match",
      "meaning": "[他] ①～と調和する ②～に匹敵する",
      "type": "synonym"
    }
  ]
}
```

`relatedWords[].type`には、`word-family`（語族）、`synonym`（類義語）、`antonym`（対義語）のいずれかを指定します。

### 学習状態

- 出題済みの単語IDは`localStorage`に保存され、ページを再読み込みしても引き継がれます。
- これまでに出題した累計語数は出題済みIDとは別に`localStorage`へ保存され、「履歴を削除」後も引き継がれます。
- 「間違えた問題」の単語IDは有効期間1年のCookieに保存されます。
- 「履歴を削除」は出題済みIDと画面内の前後移動履歴をクリアします。
- 前後移動履歴そのものはメモリ上だけに保持されるため、ページの再読み込みで消えます。

### データのインポート

画面下部の「データをインポート」から、次のデータを読み込めます。

1. JSONファイル
2. JSON形式のテキスト
3. `No. / 単語 / 意味`の3列を持つHTMLテーブル

インポートしたデータは現在の画面へ即時反映され、`localStorage`にも保存されます。ただし、現行実装では次回起動時に標準の`words.json`を読み込むため、インポート済みデータは自動復元されません。

## アーキテクチャ

```text
index.html
└── src/main.jsx                React / Chakra UIの初期化
    └── src/App.jsx             画面状態とクイズセッション
        ├── components/         関連語、インポート、発音、範囲選択UI
        ├── utils/quizLogic.js  意味整形、Part抽出、ランダム選択
        ├── utils/wordData.js   データ読込とブラウザ保存
        └── data/words.json     標準の2,300語

scripts/scrape-leap.js          開発者向けデータ更新スクリプト
test/                           純粋なクイズロジックの単体テスト
```

バックエンドやデータベースはなく、Viteで生成した静的ファイルだけで動作します。

## 技術スタック

- React 18
- Chakra UI 2 / Emotion / Framer Motion
- Vite 5
- JavaScript / JSX
- Node.js標準テストランナー
- Web Storage API / Cookie
- Web Speech API

## 単語データの更新

```bash
npm run scrape:leap
npm run check
```

スクレイピングスクリプトは「受かる英語 - LEAP 改訂版 単語一覧」からHTMLを取得し、`src/data/words.json`を上書きします。データ元のHTML構造が変わる可能性があるため、更新後は件数と差分を必ず確認してください。

## ライセンス・データ出典

このプロジェクトは教育目的で作成されています。単語データの出典は「受かる英語 - LEAP 改訂版 単語一覧」です。
関連語の語彙関係は、Princeton WordNetを基にOpen English WordNetチームがCC BY 4.0で提供するOpen English WordNetを参照しています。LEAPに未収録の関連語の日本語表現にはJapanese Wordnet 2.0（CC BY 4.0）を参照しています。
