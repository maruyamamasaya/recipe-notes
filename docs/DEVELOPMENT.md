# Development

この文書は、初期化後に人間と AI が同じ手順で開発できるよう、確定した方針と予定する command contract を管理する。**現時点では設計のみで `package.json` 等は未作成**のため、下記コマンドは初期化 PR で実際に実行してから確定する。

## Requirements

- Node.js 24.x LTS（`.nvmrc` または `.node-version` で pin 予定）
- pnpm 10.x（Corepack を利用し `package.json#packageManager` に exact version を pin 予定）
- Git、Supabase CLI、Docker-compatible runtime（local Supabase を使う作業のみ）
- GitHub / Vercel / Supabase の各 account（remote/preview 作業のみ）

Next.js 16、Vercel、Supabase CLI の互換性を初期化時に公式情報で再確認する。major upgrade は自動適用せず、release note、migration guide、CI を確認する。

## Planned Local Setup

1. repository を clone する。
2. Corepack を有効化し、pin 済み pnpm で `pnpm install --frozen-lockfile` を実行する。
3. `.env.example` を `.env.local` にコピーし、local/preview の値を入力する。
4. DB 作業では Supabase CLI で local stack を起動し、migration + non-secret seed を適用する。
5. `pnpm dev` で Next.js development server を起動する（既定 `http://localhost:3000`）。

初回 scaffold は create-next-app の stable release を用い、TypeScript、ESLint、Tailwind、App Router、`src/` directory を明示選択する。generator の既定値を無批判に受け入れず diff を review する。

## Environment Variables

初期化時に値なしの `.env.example` を追加する。Supabase の key naming transition を考慮し、dashboard / 公式 SDK が提示する名称をその時点で確定する。

| Name (planned) | Scope | Secret | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | No | RLS を前提とする公開 key |
| `SUPABASE_SERVICE_ROLE_KEY` | privileged server only | **Yes** | RLS bypass が不可欠な限定処理。必要になるまで設定しない |

- `.env*` の実値、Vercel token、database password を commit しない。ログ、test fixture、screenshot にも含めない。
- public key は秘密ではないが権限ではない。RLS を必須とし、許可範囲を最小化する。
- server secret を読む module は `server-only` とし、client import graph から隔離する。

## Planned Script Contract

初期化 PR で以下の npm scripts を実装・検証する。現時点では未定義なので、まだ実行できない。

| Command | Responsibility |
| --- | --- |
| `pnpm dev` | local Next.js server |
| `pnpm lint` | ESLint（Next.js / TypeScript rules） |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit/component tests |
| `pnpm test:coverage` | 必要時の coverage report（数値だけを品質目標にしない） |
| `pnpm build` | production Next.js build |

E2E 採用後だけ `pnpm test:e2e` を追加する。format tool は初期化時に ESLint との責務重複を評価し、採用する場合は独立した `format:check` とする。

## Database Workflow (planned)

Supabase CLI の stable version を devDependency または CI tool version として pin し、初期化時に実コマンドを検証する。想定する流れは以下。

1. local stack を開始する。
2. timestamped migration を作成し、SQL を review する。
3. local DB を reset して migration が空の DB から再現できることを確認する。
4. schema diff、generated TypeScript types、RLS positive/negative tests を確認する。
5. preview/staging へ適用後に production を承認制で適用する。

remote DB を直接 dashboard で変更しない。緊急変更も migration に取り込み、履歴との drift を解消する。具体的な CLI command は scaffold 後に実行確認して追記する。

## GitHub / CI / Deployment

- feature branch → pull request → required CI (`lint`, `typecheck`, `test`, `build`) → review → protected main の順とする。
- lockfile を commit し、CI は frozen install。Dependabot または Renovate は初期化後に一方だけ検討する。
- Vercel Preview で UI / server behavior を確認し、production environment は main からのみ deploy する。
- migration と application の順序を release note に明記する。失敗時は Vercel の直前 deployment へ戻し、DB は destructive rollback より forward-fix を基本にする。

## Testing Strategy

- Unit: pure function、validation、permission decision。外部 SDK を全面 mock して実装詳細を固定しすぎない。
- Component: browser interaction がある Client Component のみ。
- Integration: local PostgreSQL/Supabase で constraints、migration、RLS、Auth boundary。
- E2E: 初期主要 journey が確定後、Playwright で少数の critical path。
- Security: owner/non-owner/anonymous/privileged の matrix を policy ごとに検証する。

## Current Verification Status

この変更は Markdown の設計更新のみで、application、dependency、script はまだ存在しない。そのため lint、typecheck、test、build は未実施であり、初期化 PR の完了条件とする。
