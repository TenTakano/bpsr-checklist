# タスク定義のレイヤー構造

タスク定義は 2 層に分かれています。

- ミラーリングレイヤー（`src/data/upstreamTasks.json`）: upstream の `script.js` を `pnpm extract` でそのまま抽出した無加工の成果物です。id・粒度とも upstream に追従します。
- プロジェクトレイヤー（`src/data/projectTasks.ts`）: ミラーリングレイヤーの id（`upstreamIds`）をプロジェクト id へ再マッピングする層です。本家の分割粒度がゲームの実態と合わない場合、ここで複数の upstream タスクを 1 件に統合したり、逆に分割したりできます。アプリの他のレイヤー（進捗・taskOrder・hiddenTaskIds など）は upstream id ではなくプロジェクト id を参照します。

両者は `src/data/projectTasksResolver.ts` がマージし、アプリが実際に使う `Task[]`（`DAILY_TASKS` / `WEEKLY_TASKS`）を組み立てます。

## 独自タスク（upstream に存在しないタスク）

`projectTasks.ts` のエントリは `upstreamIds` を空配列にすることで、upstream 側に対応するタスクを持たない「プロジェクト独自タスク」（例: 日本版のみに存在するタスク）として定義できます。

独自タスクのエントリでは、upstream から値を導出できないため以下 5 フィールドすべての明示指定が必須です。

- `label`
- `color`
- `maxProgress`
- `optional`
- `category`（`'daily' | 'weekly'`）: このエントリを daily/weekly のどちらに分類するかを指定します。upstream 由来タスクのように `upstreamIds` から解決できないため、独自タスクでは明示が必須です。

`category` という名前は既存の `TaskCategory` 型（`src/data/taskLookup.ts`）の語彙に合わせたものです。Issue #91 でリセット周期を扱う設計が入る際、このフィールドはその設計へ統合・改名される可能性があります。

## 全フィールド明示必須（フォールバックなし）

`projectTasks.ts` は `label` / `color` / `maxProgress` / `optional` / `category` の source of truth であり、すべてのエントリ（upstream 由来・独自タスクの両方）でこの 5 フィールド全てを明示指定します。`upstreamIds` が非空のエントリでも、本家と同じ値を使う場合は upstream 側の値をコピーして書きます。

resolver（`projectTasksResolver.ts`）はフォールバック計算を一切行いません。Task の構築は `projectTasks.ts` の明示値をそのまま使う一本の処理で、独自タスク/upstream 由来タスクで分岐しません。ミラーリングレイヤー（`upstreamTasks.json`）は値のフォールバック元ではなく、参照整合性（`upstreamIds` の実在確認）とカテゴリ一致（後述）の検証専用です。

本家の変更（ラベル文言の調整や `maxProgress` の変化など）にアプリの表示が自動で追従することは意図していません。アプリの表示は `projectTasks.ts` に明示された値のみで決まり、upstream 側の更新を取り込むかどうかは `projectTasks.ts` を編集する側が都度判断します。

## category 一致検証

`upstreamIds` が非空のエントリについて、明示された `category` は `upstreamIds` から解決されるカテゴリ（daily/weekly）と一致している必要があります。不一致の場合は検証エラーになります。

`upstreamIds` に存在しない id（upstream に実在しない id）が含まれる要素は、一致判定から除外されます。存在しない upstreamId の検出は resolver 側の参照整合性チェック（後述）の責務であり、category 一致検証では「不一致」として誤検出しません。

## resolver / スキーマが強制する不変条件

`src/data/projectTaskSchema.ts` と `src/data/projectTasksResolver.ts` は以下を強制しており、違反時は例外（テスト失敗）になります。

- プロジェクト id の一意性: `projectTasks.ts` 内で id が重複していないこと。プロジェクト id は upstream の `daily_` / `weekly_` プレフィックスを持たないため、daily/weekly 間の衝突は id 体系ではなくこの重複検査のみが担保している。将来 upstream 側に id が追加され既存のプロジェクト id と衝突した場合は、この検査がモジュール初期化時の例外として検出する（手動での識別子の付け替えが必要になる）。
- daily/weekly を跨いだ統合の禁止: 1 つのプロジェクトタスクの `upstreamIds` が daily と weekly の両方のカテゴリにまたがっていないこと。
- category 一致検証: `upstreamIds` が非空のエントリの `category` は、`upstreamIds` から解決されるカテゴリと一致していること（前節参照）。
- 参照整合性: `projectTasks.ts` の `upstreamIds` が指す id は `upstreamTasks.json` に実在すること。この検証は `resolveProjectTasks()` の冒頭・スキーマ検証より前に行われるため、参照整合性違反と category 不一致の両方に該当するエントリでは参照整合性エラーが先に報告される。
- 未マッピング検出: `upstreamTasks.json` に存在する id が `projectTasks.ts` のどのエントリからも参照されておらず、かつ `EXCLUDED_UPSTREAM_IDS`（`projectTasks.ts`）にも含まれていない場合、モジュール初期化時に例外を投げる。
- 除外機構: `EXCLUDED_UPSTREAM_IDS` は「プロジェクトタスクとして意図的に出さない」upstream id の集合。未マッピング検出の対象から除外される。`EXCLUDED_UPSTREAM_IDS` の id が `projectTasks.ts` の何らかの `upstreamIds` と重複している場合、および `EXCLUDED_UPSTREAM_IDS` の id が `upstreamTasks.json` に実在しない場合は、それぞれモジュール初期化時に例外を投げる。
- 独自タスクの必須フィールド: `upstreamIds` が空のエントリは `label` / `color` / `maxProgress` / `optional` / `category` の 5 フィールドすべての明示指定が必須。いずれか欠けている場合は検証エラーになる。
