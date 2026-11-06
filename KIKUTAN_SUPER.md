# キクタンSuper

設定の学習モードから「キクタンSuper」を選択し、手元の `kikutan-super.json` を読み込む。
書籍データはソース、public、dist に置かず、公開リポジトリや公開ビルドに収録しない。
利用者のブラウザーの localStorage にのみ保存する。元のJSONは別途保管する。
ブラウザーのデータ消去により、取り込んだ単語と学習履歴は失われる。

## データ契約

ルートは配列。単語は `number`（正の整数）、`word`（空でない文字列）、`meanings`（空でない配列）のみ。
各語義は `pos`、`verbType`、`meaning` のみを持つ。
`pos` は noun / verb / adjective / adverb / pronoun / preposition / conjunction / interjection / determiner / auxiliary / other / null。
`verbType` は transitive / intransitive / both / null。動詞以外では null。
読み取れない語義を推測して登録せず、JSONと分離した検証レポートに記録する。

学習時にだけ `number` を既存の `id` に、`pos` を `partOfSpeech` に変換する。
全語義を個別に表示し、複数品詞はそれぞれのフィルタに該当する。
動詞フィルタは自他の区別を問わずすべての動詞に該当する。
`both` が明示された語義は自動詞・他動詞の両方に該当する。
不明な品詞を特定の品詞に分類しない。
関連語・派生語は生成しない。

## No.113以降の追加

1. 写真から同じ契約で追加分のJSONを作る。語義番号ごとに分け、写真との照合結果は別レポートに残す。
2. 累積ファイルを作る場合、既存番号・語義を保持して昇順に統合する。
3. 次のコマンドで対象範囲、重複、欠落、型、昇順を検証する。END は追加後の対象上限に置き換える。

```sh
node scripts/validate-kikutan.js /private/kikutan-super.json 1 END
```

既存の累積ファイルとの比較は、末尾にそのパスを渡す。
番号の削除、見出し語・語義・品詞の変更を検出して失敗させる。
変更が必要な場合は写真と旧版を照合して別途レビューし、上書き禁止を迂回して既存データを消さない。

```sh
node scripts/validate-kikutan.js /private/new.json 1 END /private/old.json
npm run check
```

4. アプリの「キクタンSuperのJSONを追加」で追加分または累積JSONを選ぶ。
   新しい番号のみ追加され、同一内容の既存番号は重複しない。
   既存番号と異なる内容が1件でもあれば、全体の取り込みを中止する。
5. 語数、番号上限、長い訳、品詞、範囲指定、間違い復習、再読み込み後の履歴を確認する。

件数や番号上限はデータから取得する。欠落番号を埋める仮データは不要。
追加だけなら本体コードの変更は不要。履歴は番号をキーとするため、番号を振り直さない。

## 保存と再利用

`leaper:kikutan-super:` に続く data / used / checked / total / filters を保存キーに使う。
既存の LEAP / SVL / インポート単語の保存キーは書き換えない。
キクタンの履歴・データは既存のブラウザー間同期に含めない。学習モードの選択だけは既存設定として保存・同期する。
学習画面は App.jsx を再利用し、データと保存処理のみ差し替える。
正誤の扱いは既存LEAPと同じ自己申告の間違いマーク方式。自動採点や回答ごとの正答率集計は追加していない。
