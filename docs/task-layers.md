# タスク定義のレイヤー構造

タスク定義は 2 層に分かれています。

- ミラーリングレイヤー（`src/data/upstreamTasks.json`）: upstream の `script.js` を `pnpm extract` でそのまま抽出した無加工の成果物です。id・粒度とも upstream に追従します。
- プロジェクトレイヤー（`src/data/projectTasks.ts`）: ミラーリングレイヤーの id（`upstreamIds`）をプロジェクト id へ再マッピングする層です。本家の分割粒度がゲームの実態と合わない場合、ここで複数の upstream タスクを 1 件に統合したり、逆に分割したりできます。アプリの他のレイヤー（進捗・taskOrder・hiddenTaskIds など）は upstream id ではなくプロジェクト id を参照します。

アプリが実際に使う `ProjectTask[]`（`PROJECT_TASKS_BY_RESET_CYCLE`、`ResetCycle` をキーとする `Record`）は `src/data/projectTasksResolver.ts` の `resolveProjectTasks()` がプロジェクトレイヤー単独から組み立てます。ミラーリングレイヤーとの突き合わせ（`upstreamIds` の参照整合性・resetCycle 一致など）は本番実行時には行われず、テスト専用の検証です（詳細は後述）。

## 型構成（UpstreamTask / ProjectTask）

`src/data/projectTaskSchema.ts` は以下の型を提供します。

- `UpstreamTask`: upstream タスク 1 件の生の形（`id` / `label` / `color` / `maxProgress` / `optional` の 5 フィールド）。`src/data/taskSchema.ts` の `Task` のエイリアスです。
- `ProjectTask`: `resolveProjectTasks()` が組み立てる、アプリが実際に消費するタスクの形。`UpstreamTask` に `resetCycle`（`ResetCycle`）を加えたものです。
- `ProjectTaskDefinition`: `projectTasks.ts` の各エントリが満たすべき形。`id` / `upstreamIds` / `label` / `color` / `maxProgress` / `optional` / `resetCycle` の 7 フィールドです。

`ResetCycle`（`src/data/resetCycle.ts`）は現状 `'daily' | 'weekly'` の 2 値です。monthly や隔週などの周期を追加する際はこの型・`RESET_CYCLES` 配列・`ResetCycleSchema` を拡張します。

## 表示セクションと resetCycle の分離

UI 上の表示セクション（デイリー/ウィークリーどちらに表示するか）の決定は、`resetCycle` フィールドを直接参照するコードパスと分離し、`projectTasksResolver.ts` 内の `sectionOf(definition)` 導出関数に集約しています。#91 時点では `sectionOf` は `resetCycle` の値をそのまま返しますが、将来 `resetCycle`（リセットタイミング）と表示セクションが乖離するケース（例: #108 で guild_dance/guild_hunt のように upstream 側は weekly のまま `RESET_CYCLE_OVERRIDE_IDS` で `resetCycle: daily` に override したうえで、特定の曜日にのみ表示したいという要求）が発生しても、この関数の内部実装のみを変更すれば済む構造にするためです。

## 独自タスク（upstream に存在しないタスク）

`projectTasks.ts` のエントリは `upstreamIds` を空配列にすることで、upstream 側に対応するタスクを持たない「プロジェクト独自タスク」（例: 日本版のみに存在するタスク）として定義できます。

独自タスクのエントリでは、upstream から値を導出できないため以下 5 フィールドすべての明示指定が必須です。

- `label`
- `color`
- `maxProgress`
- `optional`
- `resetCycle`（`'daily' | 'weekly'`）: このエントリを daily/weekly のどちらに分類するかを指定します。upstream 由来タスクのように `upstreamIds` から解決できないため、独自タスクでは明示が必須です。

## 全フィールド明示必須（フォールバックなし）

`projectTasks.ts` は `label` / `color` / `maxProgress` / `optional` / `resetCycle` の source of truth であり、すべてのエントリ（upstream 由来・独自タスクの両方）でこの 5 フィールド全てを明示指定します。`upstreamIds` が非空のエントリでも、本家と同じ値を使う場合は upstream 側の値をコピーして書きます。

resolver（`projectTasksResolver.ts`）はフォールバック計算を一切行いません。ProjectTask の構築は `projectTasks.ts` の明示値をそのまま使う一本の処理で、独自タスク/upstream 由来タスクで分岐しません。ミラーリングレイヤー（`upstreamTasks.json`）は値のフォールバック元ではなく、参照整合性（`upstreamIds` の実在確認）と resetCycle 一致（後述）の検証専用です。この検証は `resolveProjectTasks()` には含まれず、`projectTasks.test.ts` が `validateProjectTaskDefinitions()` を呼び出すことでテスト時にのみ実行されます。

本家の変更（ラベル文言の調整や `maxProgress` の変化など）にアプリの表示が自動で追従することは意図していません。アプリの表示は `projectTasks.ts` に明示された値のみで決まり、upstream 側の更新を取り込むかどうかは `projectTasks.ts` を編集する側が都度判断します。

## resetCycle 一致検証と明示的な override

`upstreamIds` が非空のエントリについて、明示された `resetCycle` は `upstreamIds` から解決される周期（daily/weekly）と一致している必要があります。不一致の場合は検証エラーになります。

`upstreamIds` に存在しない id（upstream に実在しない id）が含まれる要素は、一致判定から除外されます。存在しない upstreamId の検出は resolver 側の参照整合性チェック（後述）の責務であり、resetCycle 一致検証では「不一致」として誤検出しません。

この一致検証は、upstream 由来の周期を既定値として扱い、プロジェクト層での上書きは `projectTasks.ts` に明示宣言されたものだけ許可する形で設計されています。上書きの宣言は `src/data/projectTasks.ts` の `RESET_CYCLE_OVERRIDE_IDS`（プロジェクト id の配列、`EXCLUDED_UPSTREAM_IDS` と同じ「明示的な例外リスト」の idiom）に対象のプロジェクト id を追加することで行います。このリストに含まれる id は、`upstreamIds` から解決される周期と `resetCycle` が食い違っていても検証エラーになりません。リストに含まれない id の不一致は、これまで通り検証エラーとして検出されます（upstream-sync bot による resetCycle の誤記混入を引き続き検出するため）。

`#108`（曜日限定デイリータスク対応）で weekly 由来のタスクを daily として扱いたくなった場合も、この override 機構（対象 id を `RESET_CYCLE_OVERRIDE_IDS` に追加する）で対応できる設計です。

## resolver / スキーマが強制する不変条件

`src/data/projectTaskSchema.ts` と `src/data/projectTasksResolver.ts` は以下を強制しています。検証はランタイム（モジュール初期化時）では実行されず、`src/data/projectTasks.test.ts` が実データ（`PROJECT_TASKS` / `EXCLUDED_UPSTREAM_IDS` / `RESET_CYCLE_OVERRIDE_IDS` / `upstreamTasks.json`）に対して該当関数（`validateProjectTaskDefinitions` / `findExcludedIdsOverlappingProjectTasks` / `findNonexistentExcludedUpstreamIds` / `findUnmappedUpstreamIds`）を呼び出すことで検証され、違反時はテストが失敗します。

- プロジェクト id の一意性: `projectTasks.ts` 内で id が重複していないこと。プロジェクト id は upstream の `daily_` / `weekly_` プレフィックスを持たないため、daily/weekly 間の衝突は id 体系ではなくこの重複検査のみが担保している。将来 upstream 側に id が追加され既存のプロジェクト id と衝突した場合は、この検査がテスト失敗として検出する（手動での識別子の付け替えが必要になる）。
- daily/weekly を跨いだ統合の禁止: 1 つのプロジェクトタスクの `upstreamIds` が daily と weekly の両方のカテゴリにまたがっていないこと。
- resetCycle 一致検証（override 付き）: `upstreamIds` が非空のエントリの `resetCycle` は、`RESET_CYCLE_OVERRIDE_IDS` に含まれない限り `upstreamIds` から解決される周期と一致していること（前節参照）。
- 参照整合性: `projectTasks.ts` の `upstreamIds` が指す id は `upstreamTasks.json` に実在すること。この検証は `validateProjectTaskDefinitions()` の冒頭・スキーマ検証より前に行われるため、参照整合性違反と resetCycle 不一致の両方に該当するエントリでは参照整合性エラーが先に報告される。
- 未マッピング検出: `upstreamTasks.json` に存在する id が `projectTasks.ts` のどのエントリからも参照されておらず、かつ `EXCLUDED_UPSTREAM_IDS`（`projectTasks.ts`）にも含まれていない場合、テストが失敗する。
- 除外機構: `EXCLUDED_UPSTREAM_IDS` は「プロジェクトタスクとして意図的に出さない」upstream id の集合。未マッピング検出の対象から除外される。`EXCLUDED_UPSTREAM_IDS` の id が `projectTasks.ts` の何らかの `upstreamIds` と重複している場合、および `EXCLUDED_UPSTREAM_IDS` の id が `upstreamTasks.json` に実在しない場合は、それぞれテストが失敗する。
- 独自タスクの必須フィールド: `upstreamIds` が空のエントリは `label` / `color` / `maxProgress` / `optional` / `resetCycle` の 5 フィールドすべての明示指定が必須。いずれか欠けている場合は検証エラー（テスト失敗）になる。

## #108（曜日限定デイリータスク対応）との接続点

- resetCycle と表示セクションの分離については前節「表示セクションと resetCycle の分離」を参照。
- `hiddenTaskIds` は「配列をフィルタせずメンバーシップ判定のみ行う」パターンを採用しています（`src/components/MatrixView.tsx` の `hiddenTaskIdSet`/`visibleTaskEntries` 周辺のコメント参照）。これは並べ替え（`resolveTaskOrder` の index）を、非表示タスクの有無に関わらず taskOrder 全体に対して一貫させるための設計です。#108 で追加される曜日フィルタ（`availableWeekdays` によるタスクの出し分け）も、この「フィルタで配列から除去するのではなく、メンバーシップ判定で表示/非表示を切り替える」パターンに従うべきです。`MatrixView.tsx`/`SummaryPanel.tsx`/`TaskVisibility.tsx` への前段での配列フィルタ挿入は行わない設計であることに注意してください。
