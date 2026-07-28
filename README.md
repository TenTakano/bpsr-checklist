# BPSR Checklist

Blue Protocol: Star Resonance のデイリー/ウィークリータスク管理ツール。

複数キャラクターの進捗を一覧表示で同時に管理できることを主眼としています。

タスク定義は [Teawase/blue-protocol-checklist](https://github.com/Teawase/blue-protocol-checklist)（MIT License）を参照元としています。

## 開発

Node.js は `^22.13.0 || >=24` が必要です。パッケージマネージャは pnpm を使用します。

```sh
pnpm install
pnpm dev
```

### スクリプト

| コマンド            | 内容                               |
| ------------------- | ---------------------------------- |
| `pnpm dev`          | 開発サーバーを起動                 |
| `pnpm build`        | 本番用ビルド（`dist/` に出力）     |
| `pnpm preview`      | ビルド成果物をローカルでプレビュー |
| `pnpm lint`         | ESLint によるチェック              |
| `pnpm format`       | Prettier によるフォーマット        |
| `pnpm format:check` | Prettier のフォーマットチェック    |
| `pnpm test`         | Vitest によるテスト実行            |

## ライセンス

MIT
