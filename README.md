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

### upstream 追従時の更新手順

upstream のタスクが追加・削除された際の手順:

1. `pnpm extract` で `src/data/upstreamTasks.json` を再生成
2. `src/data/projectTasks.ts` のマッピングを追従して更新する
   - 追加された upstream id にはエントリを追加する。プロジェクトタスクとして表示する場合は既定で `{ id: <本家 id から daily_ / weekly_ を除いた id>, upstreamIds: [<本家 id>] }` を追加する
   - 意図的にプロジェクトタスクとして出さない upstream id は `EXCLUDED_UPSTREAM_IDS` に追記する（`PROJECT_TASKS` にはエントリを追加しない）
   - 削除された upstream id を参照しているエントリ（`PROJECT_TASKS` / `EXCLUDED_UPSTREAM_IDS` いずれも）は除去する
3. `src/data/labels.ja.json` も追従して更新する。新規プロジェクトタスクの id をキーとして追加し、削除されたプロジェクトタスクの id のキーを除去する。`EXCLUDED_UPSTREAM_IDS` に含めた id は `PROJECT_TASKS` に存在しないため、対応するキーを `labels.ja.json` に置かない

注意点:

- タスク id の追加・削除を怠ると `src/data/taskLabel.test.ts` のテストが失敗します
- id が変わらずラベル文言のみが変更された場合、このテストでは検出されません
- `projectTasks.ts` へのエントリ追加漏れ・除去漏れがあると、`src/data/projectTasksResolver.ts` のモジュール初期化時に未マッピングの upstream id や存在しない `upstreamIds` を検出して例外を投げるため、`pnpm test` が失敗します
- タスク定義がミラーリングレイヤーとプロジェクトレイヤーに分かれている設計の詳細は [docs/task-layers.md](docs/task-layers.md) を参照してください

### upstream に無いタスクを追加する場合

日本版のみに存在するタスクなど、upstream（`script.js`）に対応するタスクがない独自タスクは `src/data/projectTasks.ts` の `PROJECT_TASKS` に `upstreamIds: []` のエントリとして追加できます。手順:

1. `PROJECT_TASKS` に `upstreamIds: []` のエントリを追加し、`label` / `color` / `maxProgress` / `category`（`'daily' | 'weekly'`）の 4 フィールドをすべて明示指定する
2. `src/data/labels.ja.json` に追加した id をキーとして追記する（追加を怠ると `src/data/taskLabel.test.ts` が失敗する）

独自タスクの必須フィールドの詳細は [docs/task-layers.md](docs/task-layers.md) を参照してください。

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
