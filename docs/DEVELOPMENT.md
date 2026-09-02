# Development

この文書は、人間と AI が同じ手順で**開発、検証、デプロイする方法**を管理する。現在はアプリケーションと技術スタックが未決定のため、存在しないコマンドは記載しない。決定後は実際に動作確認したコマンドへ `TBD` を置き換える。

## Requirements

- 必要な OS／ツール／ランタイム: **TBD**
- 対応バージョン: **TBD**
- パッケージマネージャー: **TBD**

## Local Setup

1. リポジトリを取得する。
2. 依存関係の導入手順: **TBD**
3. 環境変数を準備する: **TBD**
4. 必要なローカルサービスを準備する: **TBD**

## Environment Variables

必要な環境変数は未決定。

| Name | Required | Scope | Description | Secret |
| --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD |

- 秘密値を Git にコミットしない。
- サンプルファイルの形式と秘密情報の管理方法: **TBD**

## Development Server

- 起動コマンド: **TBD**
- URL／ポート: **TBD**
- 停止方法: **TBD**

## Lint

- コマンド: **TBD**
- 対象と設定ファイル: **TBD**

## Typecheck

- コマンド: **TBD**
- 対象と設定ファイル: **TBD**

## Test

- 全テスト実行コマンド: **TBD**
- 単体／統合／E2E テストの区分: **TBD**
- テストデータと外部依存の扱い: **TBD**

## Build

- コマンド: **TBD**
- 成果物と出力先: **TBD**
- 必要な環境変数: **TBD**

## Database Migration

- migration 作成コマンド: **TBD**
- ローカル適用／確認コマンド: **TBD**
- 本番適用と復旧手順: **TBD**

データベース固有の設計と方針は [DATABASE.md](./DATABASE.md) を参照する。

## Deployment

- 対象環境と責任者: **TBD**
- デプロイコマンド／手順: **TBD**
- リリース前後の確認: **TBD**
- ロールバック手順: **TBD**

## Troubleshooting

確認済みの事象と解決方法のみを追記する。

| Symptom | Cause | Resolution | Last Verified |
| --- | --- | --- | --- |
| TBD | TBD | TBD | TBD |
