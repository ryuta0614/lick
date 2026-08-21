# PROJECT_PLAN.md — USDJPY AI Strategy Factory

## 目的

TradingView の Pine Script 戦略を取り込み、売買ロジックを解析・標準化し、楽天証券の楽天MT4で動作する
MQL4 EA へ変換し、バックテスト・検証（Walk Forward / Monte Carlo / Robustness）・ランキング・デモ運用
まで一気通貫で行う「USDJPY Strategy Factory」を構築する。

**本番資金の自動売買は Phase 1〜Phase 7 の全検証条件を満たすまで一切有効化しない。**
`RUN_MODE=LIVE` かつ `ENABLE_LIVE_TRADING=true` の両方が揃わない限り、EA・管理システムのどこからも
発注は行われない設計とする（詳細は `docs/architecture.md` §Live Safety を参照）。

## スコープ（初期）

- Broker: 楽天証券 楽天MT4
- Symbol: USDJPY のみ
- Asset: FX
- 将来的な他通貨・他ブローカー拡張を見据えた設計（StrategySpec はシンボル非依存）

## 中核設計思想

Pine Script → MQL4 の直接翻訳は行わない。必ず次の中間層を経由する：

```
Pine Script → StrategySpec (JSON, 正規仕様) → MQL4 EA
                                   ↘ Python Backtest Engine
```

StrategySpec が唯一の正規仕様（Single Source of Truth）であり、Python バックテストと MQL4 EA は
共に StrategySpec から生成される「同じロジックの2つの実装」として扱う。両者の乖離は
Pine↔MQL4 Validation（§34）で継続的に検査する。

## Phase 構成と完了条件

| Phase | 内容 | 完了条件 |
|---|---|---|
| 1 | StrategySpec 基盤 + Pine 解析 + 危険検出 | Pine Script → StrategySpec JSON が動く |
| 2 | MQL4 Generator | StrategySpec → EA (.mq4) が生成され、構文的に妥当 |
| 3 | Backtest Engine | USDJPY OHLCV でバックテストを実行し結果を DB 保存できる |
| 4 | Quant Validation | OOS / Walk Forward / Monte Carlo / Robustness / Strategy Score |
| 5 | Dashboard | Streamlit で戦略一覧・比較ができる |
| 6 | 楽天MT4 デモ運用 | デモ口座で最低4週間のフォワードテスト（config可変） |
| 7 | LIVE 準備 | 全検証 PASS 時のみ LIVE eligible。本番発注はこのリポジトリでは有効化しない |

各 Phase 完了時に以下を報告する: Completed / Changed files / Tests / Known issues / Next step。
未解決事項は黙って進めず `KNOWN ISSUE` として `docs/assumptions.md` またはコミットメッセージ内に記録する。

## 最初の Golden Strategy

1. **EMA20/EMA50 Crossover**（トレンドフォロー） — USDJPY H1
2. **RSI Mean Reversion**（逆張り） — 性質の異なる2戦略でパイプラインを検証

## 非目標

- 「バックテストで一番儲かるEA」を作ることではない。
- 再現可能・検証可能・壊れにくい・未来データを使わない・過剰最適化しない・リスク管理された
  Strategy Factory を作ることが目的。
- AI に裁量的な売買判断（「上がりそうだから買う」）をさせない。AI の役割は Pine 解析・
  StrategySpec 生成・コードレビュー・戦略分類・危険コード検出・レポート生成に限定する。

## 環境上の制約（この開発セッションにおける既知の制約）

このリポジトリはクラウドの隔離コンテナ上で開発されている。以下は実機がないため、
インターフェースと契約（I/F）は実装するが、実際の外部接続はできない：

- 楽天MT4ターミナル本体、MetaEditor（コンパイラ）には接続できない。
  `src/mt4/compiler.py` / `terminal.py` は CLI 呼び出しのラッパーとして実装し、
  実行不可の場合は `NOT_AVAILABLE` を返す設計にする。
- USDJPY 10年分のヒストリカルデータはこの環境から取得できない。
  `data/` にユーザー自身が用意した OHLCV CSV を配置する運用とし、
  バックテストエンジンはそのデータフォーマットに対して単体テスト・golden master test で検証する。

詳細は `docs/assumptions.md` を参照。
