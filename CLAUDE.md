# CLAUDE.md

このリポジトリで作業する Claude Code セッションが従う運用ルールです。

## プロジェクト概要

- Blue Protocol: Star Resonance のデイリー/ウィークリータスク管理ツール
- 静的SPA（React + Vite）。GitHub Pages 配信、localStorage ベース、サーバなし
- タスク定義は [Teawase/blue-protocol-checklist](https://github.com/Teawase/blue-protocol-checklist)（MIT License）を参照元とする

## 開発コマンド

- パッケージマネージャは pnpm を使用する
- PR を出す前に以下を全て通過させること
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test`
  - `pnpm build`

## PR サイズ

- 1 PR の変更差分は **300行程度を目安** とする。意味的な分割が難しい場合でも **500行程度を上限** とする（生成物 `pnpm-lock.yaml` は行数に数えない）
- レビュー負荷とリスクを抑えることが目的。上限を超えそうな場合は実装前に分割を設計する
- 1つの Issue が大きい場合は、意味的なまとまり（例: データ層 → ロジック層 → UI 層）でスタックPRに分割する
  - 分割した各 PR のタイトルに Issue 番号を付け、本文で「Part n/m」を明示する
  - Issue の close（`Closes #N`）は最後の PR にのみ書き、途中の PR は `Refs #N` とする
- 各 PR は単体で lint / format:check / test / build が通る状態を保つ（スタックの途中でも壊さない）

## マージ戦略とスタックPR運用

- このリポジトリは **squash マージのみ** を使用する
- PR は Issue ごとに最大 1 つ、レビューしやすいサイズに保つ
- ブランチ命名: `{Issue番号}_{snake_case}`（Issue に紐づかない場合は番号なし）
- 未マージ PR に依存する変更は、そのブランチをベースにしたスタック PR にする

### 前段 PR マージ後のリベース手順

前段の PR が squash マージされたら、後続のスタックブランチは必ず最新の `origin/master` に積み直す。

1. `git fetch origin --prune`
2. `git rebase --onto origin/master <旧ベースブランチの分岐点> <対象ブランチ>`
   - squash マージにより前段のコミットは master に別 SHA で入っているため、patch-identical なコミットは自動でスキップされる
   - 旧ベースの分岐点が不明な場合は `git merge-base` で特定する
3. コンフリクトが出たら解消して続行する（マージ済み前段の内容は master 側を正とする）
4. lint / format:check / test / build を再実行して全通過を確認する
5. `git push --force-with-lease` で更新する（`--force` は使わない）

### 補足

- GitHub は前段ブランチ削除時にスタック PR のベースを自動で master に付け替えるが、付け替わっていない場合は `gh pr edit <番号> --base master` で修正する
- リベース後もマージ済み前段のコミットが PR の diff に残って見える場合は、rebase の積み直しに失敗している。diff が自 Issue の変更のみになっていることを確認する
