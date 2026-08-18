# タスク定義のレイヤー構造

タスク定義は 2 層に分かれています。

- ミラーリングレイヤー（`src/data/upstreamTasks.json`）: upstream の `script.js` を `pnpm extract` でそのまま抽出した無加工の成果物です。id・粒度とも upstream に追従します。
- プロジェクトレイヤー（`src/data/projectTasks.ts`）: ミラーリングレイヤーの id（`upstreamIds`）をプロジェクト id へ再マッピングする層です。本家の分割粒度がゲームの実態と合わない場合、ここで複数の upstream タスクを 1 件に統合したり、逆に分割したりできます。アプリの他のレイヤー（進捗・taskOrder・hiddenTaskIds など）は upstream id ではなくプロジェクト id を参照します。

両者は `src/data/projectTasksResolver.ts` がマージし、アプリが実際に使う `Task[]`（`DAILY_TASKS` / `WEEKLY_TASKS`）を組み立てます。

## 独自タスク（upstream に存在しないタスク）

`projectTasks.ts` のエントリは `upstreamIds` を空配列にすることで、upstream 側に対応するタスクを持たない「プロジェクト独自タスク」（例: 日本版のみに存在するタスク）として定義できます。

独自タスクのエントリでは、upstream から値を導出できないため以下 4 フィールドすべての明示指定が必須です。

- `label`
- `color`
- `maxProgress`
- `category`（`'daily' | 'weekly'`）: このエントリを daily/weekly のどちらに分類するかを指定します。
  - upstream 由来タスクは `upstreamIds` から解決されるカテゴリを使うため `category` を明示できません（指定すると検証エラーになります）。
  - この非対称な扱いは、upstream 由来タスクの表示カテゴリを上書きする機能自体が Issue #91 で未確定のため、現時点では持ち込まないという判断によるものです。

`optional` は独自タスクでも省略可能で、省略時は `false` になります（upstream 由来タスクのように継承元がないため）。

`category` という名前は既存の `TaskCategory` 型（`src/data/taskLookup.ts`）の語彙に合わせたものです。Issue #91 でリセット周期を扱う設計が入る際、このフィールドはその設計へ統合・改名される可能性があります。

## label / color / maxProgress / optional の導出ルール

`projectTasks.ts` は `label` / `color` / `maxProgress` / `optional` の source of truth です。`upstreamIds` が非空（upstream 由来）のエントリでも全件で明示指定し、本家と同じ値を使う場合でも upstream 側の値をコピーして書きます。

明示を省略した場合のみ、フォールバックとして以下のルールで upstream 側から導出されます（独自タスクの導出ルールは前節を参照）。

- `label` / `color` / `optional`: 先頭の `upstreamIds`（統合・分割時は代表とみなす upstream タスク）から継承します。
- `maxProgress`: `upstreamIds` に対応する upstream タスクの `maxProgress` の合計です。

このフォールバックは upstream 由来のデータをスキーマ上許容するために残していますが、本家の変更（ラベル文言の調整や `maxProgress` の変化など）にアプリの表示が自動で追従することは意図していません。アプリの表示は `projectTasks.ts` に明示された値のみで決まり、upstream 側の更新を取り込むかどうかは `projectTasks.ts` を編集する側が都度判断します。

## resolver / スキーマが強制する不変条件

`src/data/projectTaskSchema.ts` と `src/data/projectTasksResolver.ts` は以下を強制しており、違反時は例外（テスト失敗）になります。

- プロジェクト id の一意性: `projectTasks.ts` 内で id が重複していないこと。プロジェクト id は upstream の `daily_` / `weekly_` プレフィックスを持たないため、daily/weekly 間の衝突は id 体系ではなくこの重複検査のみが担保している。将来 upstream 側に id が追加され既存のプロジェクト id と衝突した場合は、この検査がモジュール初期化時の例外として検出する（手動での識別子の付け替えが必要になる）。
- daily/weekly を跨いだ統合の禁止: 1 つのプロジェクトタスクの `upstreamIds` が daily と weekly の両方のカテゴリにまたがっていないこと。
- 分割時の `maxProgress` 明示指定: 同じ upstream id を複数のプロジェクトタスクが参照する（＝分割する）場合は `maxProgress` の明示指定が必須。既定値の「`upstreamIds` の合計」をそのまま使うと、分割先それぞれが同じ upstream タスクの回数を丸ごと計上してしまい合計が過剰になるため。
- 参照整合性: `projectTasks.ts` の `upstreamIds` が指す id は `upstreamTasks.json` に実在すること。
- 未マッピング検出: `upstreamTasks.json` に存在する id が `projectTasks.ts` のどのエントリからも参照されておらず、かつ `EXCLUDED_UPSTREAM_IDS`（`projectTasks.ts`）にも含まれていない場合、モジュール初期化時に例外を投げる。
- 除外機構: `EXCLUDED_UPSTREAM_IDS` は「プロジェクトタスクとして意図的に出さない」upstream id の集合。未マッピング検出の対象から除外される。`EXCLUDED_UPSTREAM_IDS` の id が `projectTasks.ts` の何らかの `upstreamIds` と重複している場合、および `EXCLUDED_UPSTREAM_IDS` の id が `upstreamTasks.json` に実在しない場合は、それぞれモジュール初期化時に例外を投げる。
- 独自タスクの必須フィールド: `upstreamIds` が空のエントリは `label` / `color` / `maxProgress` / `category` の 4 フィールドすべての明示指定が必須。いずれか欠けている場合は検証エラーになる。
- 独自タスクと `category` の排他性: `upstreamIds` が非空のエントリで `category` を指定すると検証エラーになる（upstream 由来タスクの表示カテゴリ上書きは Issue #91 に送られており、本レイヤーでは扱わない）。
