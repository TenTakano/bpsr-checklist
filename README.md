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
