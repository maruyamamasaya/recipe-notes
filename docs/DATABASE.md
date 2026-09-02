# Database

## Database Overview

- Supabase managed PostgreSQL を system of record とする。Auth は `auth` schema、アプリデータは原則 `public` schema、画像等は Supabase Storage を使う。
- 具体的なレシピ要件、共有モデル、削除要件が未確定のため、table schema はまだ確定しない。推測による migration は作らない。
- 通常の read/write は利用者 JWT を引き継いだ Supabase client と RLS の下で行う。service role は例外的な管理処理だけに限定する。
- transaction 内で整合する strong consistency を基本とし、複数 table 更新は database function / transaction が本当に必要なユースケースで検討する。

## Schema Design Rules

- Primary key は原則 `uuid`（生成方法は Supabase の現行推奨を migration 作成時に確認）。外部公開 ID と内部 ID を分ける必要性は要件に基づき判断する。
- 所有データには `owner_id uuid not null references auth.users(id)` 相当の FK を置く。削除時挙動はデータ lifecycle を決めてから明示し、暗黙の cascade を使わない。
- `not null`、`unique`、`check`、FK を DB に置き、アプリ validation と二重に防御する。大小関係、空文字、許容状態なども可能なら check で表現する。
- index は query / RLS predicate / FK の実行計画に基づく。`owner_id` 等の policy 列を候補にし、利用しない先行 index は作らない。unique constraint と重複する index を作らない。
- relational entity、検索・join・constraint 対象を JSONB にまとめない。外部由来の可変 metadata 等、構造の柔軟性が価値を持つ場合だけ JSONB とし、schema validation と必要な index を検討する。
- timestamp は timezone-aware (`timestamptz`) を基本とする。`created_at` / `updated_at` の意味と更新主体を table ごとに定義する。
- `public` schema の table は作成と同じ migration で RLS を有効化し、policy ができるまで default deny とする。

## Candidate Domain Model (not accepted)

プロダクト要件確定後に検討する候補であり、table 名・列・cardinality は **TBD**。

| Concept | Possible responsibility | Open questions |
| --- | --- | --- |
| Recipe | レシピ本体と所有者 | private/shared/public、論理削除、versioning |
| Ingredient | 材料の構造化表現 | quantity/unit の型、並び順、自由記述 |
| Step | 手順と並び順 | rich text、画像、同時工程 |
| Tag | 分類 | 利用者固有か共有か、正規化 |
| Recipe image | Storage object との関連 | 上限、variant、孤児 object の回収 |

## RLS / Authorization Policy

- 全 exposed table で RLS を有効化し、anonymous / authenticated の操作を明示的に許可する。policy がない状態を安全な初期値とする。
- 所有モデルなら `owner_id = auth.uid()` を基本 predicate とし、`SELECT`、`INSERT` (`with check`)、`UPDATE`、`DELETE` を操作別に設計する。
- shared/public data は「ログイン済みなら全件可」ではなく membership / visibility 等の明示データから判定する。複雑化した場合も performance と recursion を検証する。
- Storage も bucket policy を設定し、DB row の認可と object の認可を対応させる。DB rollback 後の孤児 file を扱える lifecycle を設計する。
- policy test は anonymous、owner、別利用者、必要なら管理者を用意し、許可ケースだけでなく拒否ケースを CI で実行する。
- SECURITY DEFINER function と service role は RLS bypass を生むため原則避ける。必要時は search path、実行権限、入力検証、監査を個別 review する。

## Migration Policy

- Supabase CLI が生成・適用する timestamped SQL を `supabase/migrations/` に commit し、schema の唯一の変更経路とする。
- migration は空 DB への全適用と既存 DB からの upgrade の両方を local/preview で検証する。generated DB types は schema と同じ PR で更新する。
- 本番の破壊的変更は expand → backfill → switch reads/writes → contract に分ける。table/column drop、型変更、大量 backfill は backup、lock、所要時間、復旧方法を事前 review する。
- 適用済み migration を書き換えない。失敗時は transaction rollback が可能なら利用し、公開後は原則 corrective migration / forward-fix とする。
- dashboard から production schema を手変更しない。drift check を CI または release checklist に含める。

## Backup / Recovery and Lifecycle

- Supabase plan ごとの backup / PITR の可用性、保持期間、復元単位を production 契約前に確認する。
- RPO / RTO、論理削除、account deletion、export、画像削除、監査保持はプロダクト・法的要件の確定まで `TBD`。
- backup があることを復元可能性とみなさず、production 開始前に別環境への restore 手順と責任者を決めて訓練する。
- 容量、slow query、index usage、connection 使用量を計測し、根拠なく partitioning、read replica、外部 search engine を導入しない。

## Schema Acceptance Checklist

各 domain migration では PK、FK と削除挙動、unique/check/not-null、query に対応する index、RLS 全操作、positive/negative policy test、データ保持・復旧、generated types を確認する。
