# BPSR Checklist

Blue Protocol: Star Resonance のデイリー/ウィークリータスク管理ツール。

複数キャラクターの進捗を一覧表示で同時に管理できることを主眼としています。

タスク定義は [Teawase/blue-protocol-checklist](https://github.com/Teawase/blue-protocol-checklist)（MIT License）を参照元としています。

## タスク定義の更新

`src/data/upstreamTasks.json` は `pnpm extract` で手動生成する成果物です。upstream 側のタスク定義（`script.js`）が更新されたら、以下の手順で再生成してコミットしてください。

```sh
pnpm extract -- /path/to/script.js --upstream-commit <sha>
```

- 第一引数には upstream の `script.js` のローカルパスを指定します（`--` は省略可能です。pnpm が付与した場合も無視されます）。
- `--upstream-commit` は省略可能です。指定した場合、生成される JSON の `upstreamCommit` に反映されます。
- 出力先は常に `src/data/upstreamTasks.json` で、無条件に上書きされます。

表示用の日本語ラベルは `src/data/labels.ja.json` でローカル管理しています。

### upstream 追従時の日本語ラベル更新

upstream のタスクが追加・削除された際の手順:

1. `pnpm extract` で `src/data/upstreamTasks.json` を再生成
2. `src/data/labels.ja.json` も追従して更新

注意点:

- タスク id の追加・削除を怠ると `src/data/taskLabel.test.ts` のテストが失敗します
- id が変わらずラベル文言のみが変更された場合、このテストでは検出されません

## レイヤー構造

タスク定義は 2 層に分かれています。

- ミラーリングレイヤー（`src/data/upstreamTasks.json`）: upstream の `script.js` を `pnpm extract` でそのまま抽出した無加工の成果物です。id・粒度とも upstream に追従します。
- プロジェクトレイヤー（`src/data/projectTasks.ts`）: ミラーリングレイヤーの id（`upstreamIds`）をプロジェクト id へ再マッピングする層です。本家の分割粒度がゲームの実態と合わない場合、ここで複数の upstream タスクを 1 件に統合したり、逆に分割したりできます。アプリの他のレイヤー（進捗・taskOrder・hiddenTaskIds など）は upstream id ではなくプロジェクト id を参照します。

両者は `src/data/projectTasksResolver.ts` がマージし、アプリが実際に使う `Task[]`（`DAILY_TASKS` / `WEEKLY_TASKS`）を組み立てます。

upstream 追従で `src/data/upstreamTasks.json` に新規タスクが増えた場合、`src/data/projectTasks.ts` にも対応するエントリ（既定では恒等マッピング `{ id: <本家 id>, upstreamIds: [<本家 id>] }`）を追加してください。追加を怠ると、`src/data/projectTasksResolver.ts` のモジュール初期化時に未マッピングの upstream id を検出して例外を投げるため、`pnpm test` が失敗します。削除された場合は同様に `resolveProjectTasks` が存在しない `upstreamIds` を検出して例外を投げます。

## 開発

Node.js は `^22.13.0 || >=24` が必要です。パッケージマネージャは pnpm を使用します。

```sh
pnpm install
pnpm dev
```

### スクリプト

| コマンド            | 内容                                                                                |
| ------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`          | 開発サーバーを起動                                                                  |
| `pnpm build`        | 本番用ビルド（`dist/` に出力）                                                      |
| `pnpm preview`      | ビルド成果物をローカルでプレビュー                                                  |
| `pnpm lint`         | ESLint によるチェック                                                               |
| `pnpm format`       | Prettier によるフォーマット                                                         |
| `pnpm format:check` | Prettier のフォーマットチェック                                                     |
| `pnpm test`         | Vitest によるテスト実行                                                             |
| `pnpm extract`      | upstream の `script.js` からタスク定義を抽出し `src/data/upstreamTasks.json` を生成 |

## ライセンス

MIT
