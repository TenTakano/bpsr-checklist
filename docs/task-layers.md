# タスク定義のレイヤー構造

タスク定義は 2 層に分かれています。

- ミラーリングレイヤー（`src/data/upstreamTasks.json`）: upstream の `script.js` を `pnpm extract` でそのまま抽出した無加工の成果物です。id・粒度とも upstream に追従します。
- プロジェクトレイヤー（`src/data/projectTasks.ts`）: ミラーリングレイヤーの id（`upstreamIds`）をプロジェクト id へ再マッピングする層です。本家の分割粒度がゲームの実態と合わない場合、ここで複数の upstream タスクを 1 件に統合したり、逆に分割したりできます。アプリの他のレイヤー（進捗・taskOrder・hiddenTaskIds など）は upstream id ではなくプロジェクト id を参照します。

両者は `src/data/projectTasksResolver.ts` がマージし、アプリが実際に使う `Task[]`（`DAILY_TASKS` / `WEEKLY_TASKS`）を組み立てます。

## label / color / maxProgress / optional の導出ルール

`projectTasks.ts` のエントリで `label` / `color` / `maxProgress` / `optional` を明示しなかった場合、以下のルールで upstream 側から導出されます。

- `label` / `color` / `optional`: 先頭の `upstreamIds`（統合・分割時は代表とみなす upstream タスク）から継承します。
- `maxProgress`: `upstreamIds` に対応する upstream タスクの `maxProgress` の合計です。

これは、本家の変更（ラベル文言の調整や `maxProgress` の変化など）に自動で追従できるようにするための設計です。`projectTasks.ts` 側に値を書き写すと二重管理になり追従漏れの原因になるため、上書きが必要な場合のみ明示的に指定してください。

## resolver / スキーマが強制する不変条件

`src/data/projectTaskSchema.ts` と `src/data/projectTasksResolver.ts` は以下を強制しており、違反時は例外（テスト失敗）になります。

- プロジェクト id の一意性: `projectTasks.ts` 内で id が重複していないこと。
- daily/weekly を跨いだ統合の禁止: 1 つのプロジェクトタスクの `upstreamIds` が daily と weekly の両方のカテゴリにまたがっていないこと。
- 分割時の `maxProgress` 明示指定: 同じ upstream id を複数のプロジェクトタスクが参照する（＝分割する）場合は `maxProgress` の明示指定が必須。既定値の「`upstreamIds` の合計」をそのまま使うと、分割先それぞれが同じ upstream タスクの回数を丸ごと計上してしまい合計が過剰になるため。
- 参照整合性: `projectTasks.ts` の `upstreamIds` が指す id は `upstreamTasks.json` に実在すること。
- 未マッピング検出: `upstreamTasks.json` に存在する id が `projectTasks.ts` のどのエントリからも参照されていない場合、モジュール初期化時に例外を投げる。
