# Decision Log

## 運用方法

Accepted decision は上書きせず、変更時は新しい ID から supersede する。プロダクト要件は [PROJECT.md](./PROJECT.md)、現在形の構造は [ARCHITECTURE.md](./ARCHITECTURE.md)、DB 方針は [DATABASE.md](./DATABASE.md) を参照する。

## Decision Index

| ID | Title | Date | Status | Supersedes |
| --- | --- | --- | --- | --- |
| DEC-001 | Next.js / Vercel の単一 Web application | 2026-09-02 | Accepted | None |
| DEC-002 | Supabase を backend platform とする | 2026-09-02 | Accepted | None |
| DEC-003 | Server-first data access と RLS | 2026-09-02 | Accepted | None |
| DEC-004 | pnpm 10 と Node.js 24 LTS | 2026-09-02 | Accepted | None |
| DEC-005 | 最小 UI / validation / test stack | 2026-09-02 | Accepted | None |
| DEC-006 | Anonymous Auth による暫定所有モデル | 2026-09-02 | Accepted | None |

## DEC-001: Next.js / Vercel の単一 Web application

- **Date:** 2026-09-02
- **Status:** Accepted

### Context

TypeScript で標準的かつ AI でも追跡しやすい Web stack、server rendering、form mutation、GitHub 連携 deployment が必要である。

### Decision

Next.js 16 stable の App Router、React 19.2、TypeScript 5.9 を採用し、Vercel の Node.js runtime に単一 application として配置する。Server Components を既定、Server Actions を UI mutation、Route Handlers を HTTP endpoint が必要な用途に限定する。canary / experimental API は採用しない。

### Alternatives

- Pages Router: 成熟しているが、新規開発で server-first App Router の利点と公式の主経路を外すため不採用。
- Remix / React Router framework、Nuxt、SvelteKit: 有力だが、指定方針、Vercel 統合、チームの TypeScript/React 一貫性に対する追加価値がない。
- 別 backend (NestJS 等): 独立 scaling や複雑な API 境界が未要求で、deployment と認可経路を増やすため不採用。

### Consequences

- server/client boundary と cache/revalidation を意識する必要がある。
- Next.js major upgrade は migration guide と Vercel compatibility を確認する。
- Node runtime 以外は必要性を測定してから別 decision とする。

## DEC-002: Supabase を backend platform とする

- **Date:** 2026-09-02
- **Status:** Accepted

### Context

relational integrity、authentication、file storage を小規模な運用負担で提供し、独自認証を避けたい。

### Decision

Supabase managed PostgreSQL、Auth、Storage を採用する。`@supabase/supabase-js` と SSR cookie integration には `@supabase/ssr` の stable release を使い、schema は Supabase CLI migration で管理する。

### Alternatives

- Vercel Postgres/Neon + Auth.js + object storage: 各製品を選べるが認証・policy・運用面が分散する。
- Firebase: BaaS として成熟しているが、relational constraint / SQL / RLS を中心とする要件に PostgreSQL が適する。
- Prisma/Drizzle: 型付き query builder として有力だが Supabase SDK と migration で開始可能であり、初期の二重 schema/tooling を避ける。複雑な server-only query が実証された時に再評価する。

### Consequences

- platform lock-in（Auth/RLS/Storage policy）を受け入れる一方、PostgreSQL schema と migration は portable に保つ。
- production/preview の project 分離、backup plan、region は運用要件確定後に決める。

## DEC-003: Server-first data access と RLS

- **Date:** 2026-09-02
- **Status:** Accepted

### Context

Supabase は browser direct access も可能だが、全処理を browser に置くと業務責務と秘密情報の境界が曖昧になる。一方、server だけの認可では DB への別経路を防げない。

### Decision

read は Server Components、UI mutation は Server Actions を既定とし、利用者 JWT の server client も RLS 下で操作する。Browser Client は Auth/Realtime 等に限定する。認可は server の use-case check と PostgreSQL RLS / Storage policy の両方で強制する。service role は browser に渡さず、必要になるまで導入しない。

### Alternatives

- browser から全面的に CRUD: 単純だが入力境界、業務規則、情報露出を管理しづらい。
- service role 経由の専用 API のみ: RLS の防御を失い、全 endpoint で認可漏れの影響が大きい。
- GraphQL layer: 現在必要な query complexity がなく、依存と契約管理を増やす。

### Consequences

- request ごとの cookie client と、owner/non-owner の RLS integration test が必要になる。
- 二重検査は UX の早い失敗と DB の最終防御という異なる責務を持つ。

## DEC-004: pnpm 10 と Node.js 24 LTS

- **Date:** 2026-09-02
- **Status:** Accepted

### Context

再現性、install 効率、Vercel/Next.js compatibility、長期サポートを両立する runtime と package manager が必要である。

### Decision

Node.js 24 LTS と pnpm 10 stable を採用する。Corepack、`packageManager`、runtime version file、lockfile で exact toolchain を固定する。dependency は stable の必要最小限とし、初期化時点の patch version を記録する。

### Alternatives

- npm: bundled で最小準備だが、pnpm の厳格な依存解決と効率を選ぶ。
- Yarn / Bun: 有力だが本プロジェクトで pnpm を上回る要件がなく、Bun runtime まで変える理由もない。
- Node.js odd-numbered/current release: LTS ではなく保守期間が短いため不採用。

### Consequences

- contributor/CI/Vercel の tool version を同期する必要がある。
- pnpm の major と Node LTS の更新は互換確認を伴う明示的 PR とする。

## DEC-005: 最小 UI / validation / test stack

- **Date:** 2026-09-02
- **Status:** Accepted

### Context

標準的で accessible な UI と runtime validation、継続的な検証が必要だが、主要機能確定前の依存追加は避けたい。

### Decision

Tailwind CSS 4 を styling 基盤とする。shadcn/ui は必要 component のみ追加し、初期一括導入しない。外部入力 schema が生じた時に Zod 4、unit/component test に Vitest + Testing Library を導入する。E2E journey が確定した時に Playwright を追加する。品質 gate は lint/typecheck/test/build とする。

### Alternatives

- CSS Modules only: 依存は少ないが、標準化された utility workflow と component source の共有を優先する。
- Material UI / Chakra UI 等の全面 component suite: 高機能だが初期 bundle、theme abstraction、依存範囲が要件に対して大きい。
- Jest: 成熟しているが、ESM/Vite 系 TypeScript workflow の軽さから Vitest を選ぶ。
- Cypress: 有力だが multi-browser と Vercel/Next.js の標準候補として Playwright を優先する。

### Consequences

- shadcn/ui source は自分たちのコードとして review/update する。
- library は「採用方針」と「今すぐ install」を区別し、用途が発生する PR で追加する。
- coverage 数値だけでなく重要な boundary と failure path を優先する。

## DEC-006: Anonymous Auth による暫定所有モデル

- **Date:** 2026-09-02
- **Status:** Accepted

ログインUIなしで `anon` roleへ無条件writeを許可せず永続化するため、Supabase Anonymous Sign-insを使う。`recipes.user_id = auth.uid()` とStorage先頭folderを所有境界とし、service role / `SECURITY DEFINER` は使わない。再読み込みではsessionを維持できるが、browser data消去時の復旧・別端末同期はできない。正式Auth時にidentity linking、SSR cookie、Server-first readへ移行する。
