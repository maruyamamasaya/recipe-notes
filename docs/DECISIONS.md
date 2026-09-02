# Decision Log

この文書は、重要な技術判断と**なぜその判断をしたか**を追跡するためのログである。プロダクト要件そのものは [PROJECT.md](./PROJECT.md)、現在の技術構造は [ARCHITECTURE.md](./ARCHITECTURE.md)、データ設計は [DATABASE.md](./DATABASE.md) に記録する。

## 運用方法

- Architecture、データモデル、認証、主要ライブラリ、外部サービス、互換性に影響する判断を記録する。
- 判断ごとに連番を付け、原則として一度確定した記録を上書きしない。変更時は新しい Decision から置換対象を参照する。
- Status は `Proposed`、`Accepted`、`Rejected`、`Superseded`、`Deprecated` のいずれかを使用する。
- 未決定の内容を Accepted として記録しない。
- 関連する Issue、PR、設計文書がある場合はリンクする。

## Decision Index

| ID | Title | Date | Status | Supersedes |
| --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD |

## Decision Template

以下を複製して新しい Decision を追加する。

### DEC-XXX: Title

- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Rejected | Superseded | Deprecated
- **Related:** TBD
- **Supersedes:** None / DEC-XXX

#### Context

判断が必要になった背景、解決する問題、制約、前提を記載する。

#### Decision

採用または不採用とした内容を、曖昧さがない形で記載する。

#### Alternatives

- 選択肢 A: 概要、利点、欠点
- 選択肢 B: 概要、利点、欠点

#### Reason

要件と制約に照らし、なぜこの選択肢が適切かを記載する。

#### Consequences

- Positive: 得られる効果
- Negative: 受け入れる欠点やコスト
- Follow-up: 移行、検証、見直し条件などの後続作業
