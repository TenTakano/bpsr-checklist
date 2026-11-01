# upstream 定期同期 workflow

`.github/workflows/upstream-sync.yml` は、upstream（[Teawase/blue-protocol-checklist](https://github.com/Teawase/blue-protocol-checklist)）のタスク定義の変更を日次で検知し、差分を Issue で知らせる GitHub Actions workflow です。取り込みは自動では行いません。

## 方針

プロジェクトレイヤー（プロジェクト id への読み替え、`EXCLUDED_UPSTREAM_IDS`、日本語ラベル）が厚くなるほど、upstream の変更を取り込むかどうか・どう取り込むかは使い方に依存する判断になり、機械的に決められない。そのため workflow は「変わったことに気づいて、何が変わったかを見せる」までにとどめ、取り込みは人が README の「タスク定義の更新」の手順で行う。

## 動作概要

1. **変更検知**: upstream の `script.js` にパス限定した最新コミットSHAを GitHub API で取得し、`src/data/upstreamTasks.json` の `upstreamCommit` と比較する。一致すれば終了する
2. **重複防止**: `upstreamCommit` は人が取り込むまで進まないので、同じ SHA を毎日検知する。その SHA（先頭 7 文字）をタイトルに含む open な `upstream-sync` Issue があれば終了する
3. **抽出**: upstream の `script.js` をダウンロードし、runner 上で `pnpm extract` を実行する（コミットはしない）
4. **差分**: `scripts/diff-upstream-tasks.sh` で、取り込み済みの `upstreamTasks.json` との差分を upstream id 単位（追加・削除・変更）で出す。差分がなければ終了する（タスクと無関係な upstream コミット）
5. **通知**: `upstream-sync` ラベルの open Issue がなければ起票し、あればタイトルを最新の SHA に書き換えてコメントを足す
6. **失敗時**: SHA の取得・ダウンロード・抽出などが失敗したら、`upstream-sync-failure` ラベルの Issue を起票する（open なものがあればコメントを足す）

## Issue の形

ほかの仕組み（定時で Issue を拾う routine など）から読めるよう、形を固定している。

- ラベル: `upstream-sync`
- タイトル: `[upstream-sync] 本家のタスク定義が変わりました (<SHA の先頭 7 文字>)`
- 本文・コメント: upstream コミットの URL と、`json` のコードブロックに入った差分 `{"added": [...], "removed": [...], "changed": [{"id", "before", "after"}]}`。upstream 由来のラベル文字列を含むので、コードブロックを抜けられないようバッククォートを取り除いている

取り込んで `upstreamCommit` が進んだら、Issue は手で close する。

## リポジトリ設定

- PR を作らないので、**Settings > Actions > General > Workflow permissions** の「Allow GitHub Actions to create and approve pull requests」は不要（以前の PR 作成型の workflow のために有効にしていたなら、無効に戻してよい）
- `ANTHROPIC_API_KEY` シークレットは使わない
