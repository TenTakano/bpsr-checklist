# upstream 定期同期 workflow

`.github/workflows/upstream-sync.yml` は、upstream（[Teawase/blue-protocol-checklist](https://github.com/Teawase/blue-protocol-checklist)）のタスクデータ更新を日次で自動検知し、`pnpm extract` で正規化したうえで自動PRを作成する GitHub Actions workflow です。

## 動作概要

1. **変更検知**: upstream の `script.js` にパス限定した最新コミットSHAを GitHub API で取得し、`src/data/upstreamTasks.json` の `upstreamCommit` と比較する。一致すれば何もせず終了する（タスクと無関係な upstream コミットでは動かないため、空PRは発生しない）
2. **抽出**: 差分があれば upstream の `script.js` をダウンロードし、`pnpm extract` で `src/data/upstreamTasks.json` を再生成する
3. **実差分チェック**: `upstreamCommit` の値だけが変わり `src/data/upstreamTasks.json` の実体（タスク定義）に差分が生じなかった場合（タスクと無関係な upstream コミットで `script.js` 自体は変わったが抽出結果が変化しないケース）は、以降の LLMステップ・品質ゲート・PR作成をすべてスキップして終了する（意味のない空PRを防ぐ）
4. **LLMステップ（任意）**: 上記の実差分チェックを通過し、かつ `ANTHROPIC_API_KEY` シークレットが設定されている場合のみ、claude-code-action が以下を行う
   - 新規・変更タスクの日本語訳を `src/data/labels.ja.json` に追記
   - id 改名（同一タスクの改名か別タスクの新設か）の判断
   - PR 本文用の変更要約の生成
   - シークレット未設定時はこのステップをスキップし、機械的な抽出結果のみで PR を作成する（新規タスクは対訳未登録でも英語ラベルにフォールバック表示されるため、アプリは壊れない）
5. **変更パス検証**: LLMステップの実行有無にかかわらず、`git status --porcelain` で変更ファイルが `src/data/upstreamTasks.json` と `src/data/labels.ja.json` のみであることを検証し、逸脱があれば（upstream のタスク文字列経由のプロンプトインジェクション等の疑いとして）workflow を失敗させる
6. **品質ゲート**: PR作成前に `pnpm lint` / `pnpm format:check` / `pnpm test` / `pnpm build` をこの workflow 内で実行し、すべて通過した場合のみ PR を作成する
7. **PR作成**: 固定ブランチ `upstream_sync` に対して `peter-evans/create-pull-request` で Open な PR を作成・更新する（自動マージはしない。必ず人間がレビューする）
8. **失敗時**: ダウンロード失敗・抽出失敗・品質ゲート失敗などが発生した場合、PRは作成せず `upstream-sync-failure` ラベル付きの Issue を起票する。同ラベルの open Issue が既にあれば新規起票せずコメントを追記する（日次実行による重複起票の防止）

## 必要なリポジトリ設定（手動操作）

- **Settings > Actions > General > Workflow permissions** で「Allow GitHub Actions to create and approve pull requests」を有効化する（Actions が PR を作成するために必須）
  - この設定はリポジトリ全体に効き、PR の作成だけでなく `GITHUB_TOKEN` による PR の approve も同時に許可する点に注意する。レビュー必須の保護ルールを Actions 経由で迂回できる状態になり得るため、リスクを許容できない場合はこの workflow 専用に fine-grained PAT や GitHub App トークンを発行し、`peter-evans/create-pull-request` の `token` にそれを渡す運用に切り替えることを検討する
- （任意）`ANTHROPIC_API_KEY` シークレットを登録すると、対訳追記・id改名判断・要約生成が有効になる。未登録でも機械的な PR 作成は動作する

## 注意点

- 進捗（達成状況）はブラウザの localStorage にタスク id をキーとして保存されており、id 改名時にそれを引き継ぐ移行機構はアプリに存在しない。LLMステップが id 改名を検出した場合も、判断結果は PR 本文への注記に留まる（データ移行コードは自動生成しない）
- ブランチ命名規約 `{Issue番号}_{snake_case}` の例外として、この workflow は固定ブランチ `upstream_sync`（日付なし）を繰り返し使う。Issue単位の開発ブランチではなく自動更新される専用ブランチのため
- 初回の実動作（cron・PR作成・Issue起票）はローカルから検証できないため、マージ後に `workflow_dispatch` で手動実行して確認する
