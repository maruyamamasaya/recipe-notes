# Architecture

この文書は recipe-notes の初期技術設計を管理する。機能要件が未確定の箇所は、実装を先回りせず `TBD` とする。選定理由は [DECISIONS.md](./DECISIONS.md) に記録する。

## System Overview

```text
Browser
  │ HTTPS (公開キー + 利用者 JWT。RLS の対象)
  ▼
Vercel / Next.js App Router
  ├─ Server Components ─┐
  ├─ Server Actions     ├─ Supabase API ─ PostgreSQL (constraints + RLS)
  └─ Route Handlers ────┘              ├─ Auth
                                      └─ Storage (policies)
```

- 単一の Next.js アプリを Vercel に配置し、Supabase を Database / Auth / Storage として利用する。
- UI の読み取りは Server Components、UI に密接な mutation は Server Actions を既定とする。外部クライアント、webhook、ファイル応答など HTTP 境界が必要な場合だけ Route Handlers を使う。
- Client Components はブラウザ API、イベント、局所的な対話状態が必要な葉コンポーネントに限定する。
- 認可の最終境界は PostgreSQL の RLS と Storage policy とし、画面の非表示や Server Action の検査だけに依存しない。
- Edge Runtime は既定にしない。Node.js runtime を使い、実測上の必要性と依存互換性を確認した箇所だけ個別に検討する。

## Technology Stack

バージョンは 2026-09-02 時点の**採用系列**である。初期化時に公式リリースと互換表を再確認し、安定版の最新 patch/minor を lockfile に固定する（正確な package version は初期化 PR で記録する）。

| 領域 | 採用技術 | 採用系列／制約 |
| --- | --- | --- |
| Framework | Next.js App Router | 16.x stable（canary 不可） |
| UI runtime | React / React DOM | Next.js 16 が指定する 19.2 系を直接変更しない |
| Language | TypeScript | 5.9.x stable、`strict: true` |
| Runtime | Node.js | 24.x LTS、Vercel と Next.js のサポート範囲内 |
| Package manager | pnpm via Corepack | 10.x、`packageManager` を exact pin |
| Hosting | Vercel | Node.js runtime、GitHub integration |
| Backend / DB | Supabase / PostgreSQL | managed stable、project ごとに環境分離 |
| Supabase SDK | `@supabase/supabase-js`, `@supabase/ssr` | 初期化時の stable latest を exact lock |
| Styling | Tailwind CSS | 4.x stable |
| UI parts | shadcn/ui | 必要な部品のみ source として追加（初期依存にはしない） |
| Runtime validation | Zod | 4.x。入力境界が生じた時点で追加 |
| Unit / component test | Vitest + Testing Library | 初期化時の stable latest |
| E2E | Playwright | E2E 要件成立時に追加 |
| Source control | Git / GitHub | protected main branch + pull request |

Supabase platform と Vercel は managed service のためアプリ内で版を固定できない。CLI、SDK、Node.js、pnpm は設定と lockfile で再現性を確保する。

## Directory Structure

初期化後の候補。ルート直下に置き、機能がないうちに `features/` 等の抽象階層は作らない。

```text
.
├── src/
│   ├── app/                 # routes, layouts, Server Components
│   │   ├── api/             # 必要な Route Handlers のみ
│   │   └── (auth)/          # 必要になった時点の route group
│   ├── components/
│   │   └── ui/              # 採用した shadcn/ui source
│   └── lib/
│       ├── supabase/        # browser/server client factory
│       ├── actions/         # 共有する Server Actions（必要な場合）
│       └── validation/      # 共有する runtime schema
├── supabase/
│   ├── migrations/          # version-controlled SQL
│   ├── seed.sql             # 非機密な local test data
│   └── config.toml
├── tests/                   # route をまたぐ integration / E2E
├── public/
├── docs/
└── .env.example
```

route 固有の component、action、test は利用箇所の近くへ置く。`lib` は再利用が実在するものだけに使う。

## Data Access Responsibilities

現在の一覧取得と登録は Client Component から `src/lib/recipes/supabase-repository.ts` を介して行う。Anonymous Auth session が browser storage にある暫定構成のためで、正式ログイン時は SSR cookie と Server Component / Server Action へ移す。一覧はDB検索RPCで9件だけ取得し、登録はprivate Storageへ先行uploadした後、`security invoker` RPCの単一DB transactionで保存する。DB失敗時はupload済みobjectを削除する。

| 境界 | 責務 | 禁止／注意 |
| --- | --- | --- |
| Browser Client | Auth イベント、Realtime、ブラウザから必要な限定 read/write。公開 URL と publishable key を使用 | service role、任意 SQL、RLS 回避を持たせない。browser access 自体を既定にしない |
| Server Client | Server Component / Action / Handler ごとに cookie ベースの利用者 client を生成し、RLS 下で query | module-global client や利用者間 session の共有をしない |
| Server Components | 初期表示と read。秘密値や不要なデータを client bundle に渡さない | mutation と対話状態を埋め込まない |
| Server Actions | UI 起点 mutation。認証確認、Zod 検証、業務規則、RLS 下の DB 操作、必要な再検証 | public endpoint と同様に未信頼入力として扱う。呼べること自体を認可とみなさない |
| Route Handlers | webhook、外部 API、OAuth callback、HTTP 固有の応答 | 同一 UI のためだけに Server Action と二重実装しない |
| Privileged server client | webhook や管理処理など RLS bypass が不可欠な用途だけ。専用 server-only module に隔離 | 通常の利用者操作に使わず、browser import 可能な module に置かない |
| PostgreSQL / Storage | FK / unique / check と RLS / policy による整合性・認可の最終強制 | `public` schema の table を RLS 無効で公開しない |

Supabase SSR の cookie 更新に必要な request proxy/middleware は公式方式に従い、token の検証には検証済み user/claims を使う。session cookie の存在だけを本人確認に使わない。

## Authentication / Authorization

- ログインUI導入までの暫定方式としてSupabase Anonymous Sign-Inを正式に利用する。browserへはpublishable keyだけを渡し、匿名利用者もAuth発行JWTの`authenticated` roleとしてowner RLSを適用する。各環境でAnonymous Sign-Insを有効化する必要があり、無効時はUIで設定不足として診断する。service role keyをbrowserへ公開しない。
- 認証は Supabase Auth を第一選択とし、独自 password 保存を実装しない。初期 provider はプロダクト要件確定まで `TBD`。
- 認証（誰か）と認可（何を行えるか）を分離する。各所有データは `auth.uid()` と owner column を対応させ、操作別 RLS policy を作る。
- server でも利用者を検証し、DB でも RLS を強制する多層防御とする。管理者 role が必要かは `TBD`。
- Storage bucket は既定 private。object path と metadata に基づく policy、content type、size を検証し、署名 URL は短時間にする。

## Validation and Error Handling

- TypeScript はコンパイル時保証であり、FormData、JSON、URL parameter、webhook、DB response 等の境界では runtime validation を行う。
- 単純なフォームは platform API で十分な場合もある。複数箇所で共有する schema や coercion が必要になった時点で Zod を追加する。
- 利用者には安全で行動可能なエラーを返し、内部原因は server log に correlation context と共に残す。token、cookie、鍵、不要な個人情報は記録しない。
- 予期可能な validation / authorization / conflict と、予期しない障害を区別する。例外を空の成功値へ変換しない。

## UI Policy

- Tailwind CSS 4 を採用し、少量の global design tokens と utility を基本にする。
- shadcn/ui は runtime component library ではなく、必要な accessible component の source を選択的に所有する方法として評価・採用する。初期化だけを理由に全 component を追加しない。
- Server Components を既定とし、`"use client"` の境界を小さく保つ。アクセシビリティは native semantics、keyboard 操作、focus、contrast をテストする。

## Quality and Observability

- 必須 gate は `lint`、`typecheck`、`test`、`build`。純粋な業務ロジックと validation は Vitest、DOM interaction がある場合だけ Testing Library を使う。
- DB integration test は local Supabase に migration を適用して実施し、特に owner A が owner B の read/write をできない RLS negative test を含める。
- Playwright は重要な認証・レシピ操作の E2E が定義された段階で追加する。現段階では依存を増やさない。
- 初期監視は Vercel Logs、Supabase Logs、構造化 application logging。Sentry、OpenTelemetry、analytics は SLO と運用担当が決まってから検討する。

## Deployment and Security

- `development`、`preview`、`production` は別 Supabase project（少なくとも production を完全分離）とし、Vercel environment ごとに変数を設定する。
- `NEXT_PUBLIC_SUPABASE_URL` と publishable key のみ browser 公開可能。secret/service-role key は `NEXT_PUBLIC_` を付けず Vercel secrets に保存する。
- `.env.local` は Git 対象外、`.env.example` は値なしの契約だけを保持する。GitHub secret scanning と dependency update を有効化する。
- Preview は pull request 単位、production は protected branch からデプロイする。migration はアプリ deploy と分離し、後方互換な expand/contract を優先する。
- CSP 等の security headers、rate limit、abuse protection は公開機能と脅威モデル確定時に設計する。Next.js / Vercel / Supabase の security advisory を追跡する。

## Open Questions

- レシピの具体的な所有・共有・公開モデル、Auth provider、管理者権限
- 画像の形式、上限、変換、削除 lifecycle
- 対応 locale、検索要件、データ量、可用性・性能目標、RPO / RTO
- preview 用 Supabase project の費用と migration promotion の運用責任者
