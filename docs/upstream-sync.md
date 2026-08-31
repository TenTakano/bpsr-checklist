# upstream 定期同期 workflow

`.github/workflows/upstream-sync.yml` は、upstream（[Teawase/blue-protocol-checklist](https://github.com/Teawase/blue-protocol-checklist)）のタスクデータ更新を日次で自動検知し、`pnpm extract` で正規化したうえで自動PRを作成する GitHub Actions workflow です。

## 動作概要

1. **変更検知**: upstream の `script.js` にパス限定した最新コミットSHAを GitHub API で取得し、`src/data/upstreamTasks.json` の `upstreamCommit` と比較する。一致すれば何もせず終了する（タスクと無関係な upstream コミットでは動かないため、空PRは発生しない）
2. **抽出**: 差分があれば upstream の `script.js` をダウンロードし、`pnpm extract` で `src/data/upstreamTasks.json` を再生成する
3. **実差分チェック**: `upstreamCommit` の値だけが変わり `src/data/upstreamTasks.json` の実体（タスク定義）に差分が生じなかった場合（タスクと無関係な upstream コミットで `script.js` 自体は変わったが抽出結果が変化しないケース）は、以降の LLMステップ・品質ゲート・PR作成をすべてスキップして終了する（意味のない空PRを防ぐ）
4. **LLMステップ（任意）**: 上記の実差分チェックを通過し、かつ `ANTHROPIC_API_KEY` シークレットが設定されている場合のみ、claude-code-action が以下を行う
   - 本家に新規タスクが追加された場合、`src/data/projectTasks.ts` の `PROJECT_TASKS` にプロジェクトタスクの
     エントリを追加する。`ProjectTaskDefinitionSchema`（`src/data/projectTaskSchema.ts`）は
     `strictObject` でフォールバックを持たないため、`id`/`upstreamIds`/`label`/`color`/`maxProgress`/
     `optional`/`category` の 7 フィールドすべての明示指定が必須（詳細は
     [`task-layers.md`](./task-layers.md) を参照）。さらに `src/data/labels.ja.json` にプロジェクト id
     をキーとして日本語訳を追記する
   - 本家の id が変わったタスクについて、同一タスクの改名か別タスクの新設かを判断する。改名と判断した
     場合は該当プロジェクトタスクの `upstreamIds` を更新する（プロジェクト id・`labels.ja.json` のキーは
     変更しない）。新設と判断した場合は新規追加として扱う
   - 本家から削除されたタスクに対応するプロジェクトタスクのエントリと `labels.ja.json` の該当キーを削除する
   - PR 本文用の変更要約の生成
   - シークレット未設定時はこのステップをスキップし、機械的な抽出結果のみで PR を作成する。新規タスクが
     あってもプロジェクトレイヤーへのエントリ追加が行われないため、後述の品質ゲート（`pnpm test`）で
     `src/data/projectTasks.test.ts` の未マッピング検出テスト（`findUnmappedUpstreamIds`）が失敗し、
     PR は作成されず失敗 Issue が起票される
5. **内容検証**: LLMステップの実行有無にかかわらず、変更パス検証の前に `src/data/labels.ja.json` と `src/data/projectTasks.ts` の内容そのものを機械的に検証する（LLMステップが upstream 由来のタスク文字列を経由したプロンプトインジェクションで書き換えられていないかのチェック）
   - `labels.ja.json` は**データ**なので、フラットな文字列マップであること、キーが既知のプロジェクト id（`pnpm exec tsx scripts/list-project-ids.ts` で列挙される id 一覧に含まれること）であること、値の長さ、値への制御文字混入の有無を検証する
   - `projectTasks.ts` は**実行される TypeScript**であり、内容の値検証だけでは不十分（任意のコードを書き込まれると `pnpm test` / `pnpm build` で実行され、マージされれば GitHub Pages に配信されてしまう）。そのため LLM に `Edit` を許可する代わりに、`scripts/validate-project-tasks.ts` が TypeScript Compiler API でファイルを AST として静的解析し、「リテラルのみの定義ファイル」であることを機械的に検証する: トップレベル文が type-only import と `PROJECT_TASKS` / `EXCLUDED_UPSTREAM_IDS` の export のみで構成されていること、それぞれの初期化子が配列・オブジェクト・文字列・数値・真偽値のリテラル（および型注釈・`satisfies` 式）だけで組み立てられていることを検証し、関数呼び出し・識別子参照・テンプレートリテラル・`as` 式などが含まれていれば失敗させる
   - いずれかの検証に失敗した場合、workflow をプロンプトインジェクション等の疑いとして失敗させる
6. **変更パス検証**: `git status --porcelain` で変更ファイルが `src/data/upstreamTasks.json` / `src/data/labels.ja.json` / `src/data/projectTasks.ts` のみであることを検証し、逸脱があれば（upstream のタスク文字列経由のプロンプトインジェクション等の疑いとして）workflow を失敗させる
7. **品質ゲート**: PR作成前に `pnpm lint` / `pnpm format:check` / `pnpm test` / `pnpm build` をこの workflow 内で実行し、すべて通過した場合のみ PR を作成する
8. **PR作成**: 固定ブランチ `upstream_sync` に対して `peter-evans/create-pull-request` で Open な PR を作成・更新する（自動マージはしない。必ず人間がレビューする）
9. **失敗時**: ダウンロード失敗・抽出失敗・品質ゲート失敗などが発生した場合、PRは作成せず `upstream-sync-failure` ラベル付きの Issue を起票する。同ラベルの open Issue が既にあれば新規起票せずコメントを追記する（日次実行による重複起票の防止）

## 必要なリポジトリ設定（手動操作）

- **Settings > Actions > General > Workflow permissions** で「Allow GitHub Actions to create and approve pull requests」を有効化する（Actions が PR を作成するために必須）
  - この設定はリポジトリ全体に効き、PR の作成だけでなく `GITHUB_TOKEN` による PR の approve も同時に許可する点に注意する。レビュー必須の保護ルールを Actions 経由で迂回できる状態になり得るため、リスクを許容できない場合はこの workflow 専用に fine-grained PAT や GitHub App トークンを発行し、`peter-evans/create-pull-request` の `token` にそれを渡す運用に切り替えることを検討する
- （任意）`ANTHROPIC_API_KEY` シークレットを登録すると、対訳追記・id改名判断・要約生成が有効になる。未登録でも機械的な PR 作成は動作する

## 注意点

- タスク定義は 2 層（詳細は [`task-layers.md`](./task-layers.md) を参照）で、進捗（達成状況）はブラウザの
  localStorage にプロジェクト id（`src/data/projectTasks.ts` の `id`。本家 id ではない）をキーとして保存
  されている
  - **本家 id の改名**は `projectTasks.ts` の `upstreamIds` 更新で吸収され、プロジェクト id・
    `labels.ja.json` のキーを変更しない限り既存ユーザーの進捗は保持される。LLMステップの
    `id_renames_detected` 出力はこの「本家 id の改名を検出したか」を表す
  - 一方、**プロジェクト id 自体の変更**を引き継ぐ移行機構はアプリに存在せず、進捗が失われる。
    LLMステップはプロジェクト id・`labels.ja.json` のキーを変更しないという制約下で動作するため
    通常は発生しないが、`projectTasks.ts` の差分にプロジェクト id の変更が含まれていないか、
    PRレビュー時に必ず確認すること
  - 本家に新規タスクが追加されたのに `projectTasks.ts` へのエントリ追加が行われなかった場合
    （例: `ANTHROPIC_API_KEY` 未設定でLLMステップがスキップされたケース）、
    `src/data/projectTasks.test.ts` の未マッピング検出テスト（`findUnmappedUpstreamIds`）の失敗に
    より `pnpm test` が失敗し、`publish` ジョブに進まず `upstream-sync-failure` ラベルの Issue が
    起票される。これはタスクの取りこぼしを防ぐための意図した安全側の挙動であり、Issue 起票後は
    手動で `projectTasks.ts` へのエントリ追加が必要になる
- ブランチ命名規約 `{Issue番号}_{snake_case}` の例外として、この workflow は固定ブランチ `upstream_sync`（日付なし）を繰り返し使う。Issue単位の開発ブランチではなく自動更新される専用ブランチのため
- 初回の実動作（cron・PR作成・Issue起票）はローカルから検証できないため、マージ後に `workflow_dispatch` で手動実行して確認する
