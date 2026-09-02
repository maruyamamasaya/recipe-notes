# Database

この文書は、プロジェクトの**データ設計**を管理する。データベース製品と Schema は未決定であるため、以下は決定事項を記録するためのテンプレートとする。重要な判断理由は [DECISIONS.md](./DECISIONS.md) に記録する。

## Database Overview

- 採用するデータストア: **TBD**
- 用途とシステム上の責務: **TBD**
- データの所有境界: **TBD**
- 想定する整合性モデル: **TBD**

## Tables

具体的な Schema は要件とデータストアの決定後に追加する。

| Table / Collection | 責務 | 主な属性 | 所有者 | 備考 |
| --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD |

各テーブルについて、保持する事実を一つの責務として説明し、監査列や削除方式も必要に応じて記録する。

## Relationships

| From | To | Cardinality | 必須性 | 削除／更新時の挙動 |
| --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD |

## Primary Keys

| Table | Key | 型／生成方法 | 選定理由 |
| --- | --- | --- | --- |
| TBD | TBD | TBD | TBD |

## Foreign Keys

| Table.Column | References | On Update | On Delete | 備考 |
| --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD |

## Indexes

| Table | Columns | Type / Uniqueness | 対象クエリ | コスト／備考 |
| --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD |

## Constraints

| Table | Constraint | 保証するルール | アプリ側検証との関係 |
| --- | --- | --- | --- |
| TBD | TBD | TBD | TBD |

## Data Lifecycle

- 作成元と更新主体: **TBD**
- 保持期間: **TBD**
- 論理削除／物理削除: **TBD**
- エクスポート、訂正、削除要求への対応: **TBD**
- 個人情報・機密区分: **TBD**

## Migration Policy

- Schema 変更は、原則としてバージョン管理された migration で再現可能にする。
- migration ツール、命名規則、適用コマンド: **TBD**
- backward compatibility と段階的リリースの方針: **TBD**
- 適用前のバックアップ、検証、ロールバック／復旧手順: **TBD**
- 本番環境への適用責任者と承認フロー: **TBD**

## Authorization / RLS

- データ所有モデル: **TBD**
- ロールと操作権限: **TBD**
- Row Level Security の採否とポリシー: **TBD**
- 管理者／サービスアカウントの境界: **TBD**
- 認可テスト方針: **TBD**

UI の制御だけに依存せず、API および対応可能な場合はデータベースでも権限を強制する。

## Backup / Recovery

- バックアップ方式、頻度、保持期間: **TBD**
- RPO / RTO: **TBD**
- 復元手順と復元テスト頻度: **TBD**
- 障害・誤操作時の連絡と責任者: **TBD**

## 将来的なデータ量への考慮

- 初期および将来のレコード数・増加率: **TBD**
- 主な読み書きパターンとピーク負荷: **TBD**
- インデックス、アーカイブ、パーティショニングの判断基準: **TBD**
- 容量・性能の計測方法と見直し条件: **TBD**

予測だけを理由に複雑な分割や最適化を先行させず、計測可能な基準を決めてから導入する。
