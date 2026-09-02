# recipe-notes

料理のレシピをメモする Web アプリケーションのプロジェクトです。詳細なプロダクト要件は [docs/PROJECT.md](./docs/PROJECT.md) で管理します。

## 現在のステータス

**UI プロトタイプ実装済み** — レシピ一覧、検索、ページ送り、新規レシピ登録をブラウザ上で試せます。永続化と認証は今後 Supabase に接続します。

## 開発開始方法

依存関係を `pnpm install` でインストールし、`pnpm dev` を実行してください。詳しい検証コマンドは [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) に記録しています。

開発に参加する際は、先に [AGENTS.md](./AGENTS.md) と関連する設計文書を確認してください。

## 主要ディレクトリ

```text
.
├── AGENTS.md   # AI エージェント向けの恒久的な開発ルール
├── docs/       # 仕様、設計、開発手順、判断記録
└── README.md   # プロジェクトへの入口
```

アプリケーション本体のディレクトリ構成案は [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) を参照してください。

## ドキュメント

- [AGENTS.md](./AGENTS.md) — AI がどのように調査、実装、検証、報告するか
- [docs/PROJECT.md](./docs/PROJECT.md) — 何を作るか（目的、利用者、要件、スコープ）
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — どのような技術構造で作るか
- [docs/DATABASE.md](./docs/DATABASE.md) — データをどのように設計・運用するか
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開発、検証、migration、デプロイの手順
- [docs/DECISIONS.md](./docs/DECISIONS.md) — 重要な判断とその理由

各文書の責務を分け、詳細を README に重複させない方針です。未決定事項は `TBD` として明示します。
