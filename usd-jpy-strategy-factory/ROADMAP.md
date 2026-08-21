# ROADMAP.md — USDJPY AI Strategy Factory

進捗管理用。各 Phase 完了時にチェックし、Completed / Changed files / Tests / Known issues /
Next step をコミットメッセージまたは本ファイルの更新で報告する。

- [ ] **Phase 1 — StrategySpec 基盤**
  - [ ] `src/strategies/schema.py`（StrategySpec Pydantic モデル）
  - [ ] `src/strategies/validator.py`
  - [ ] `src/pine/parser.py`
  - [ ] `src/pine/analyzer.py`
  - [ ] `src/pine/anti_repaint.py`
  - [ ] Golden Strategy #1: EMA20/50 Crossover の `.pine` サンプルと変換
  - [ ] Golden Strategy #2: RSI Mean Reversion の `.pine` サンプルと変換
  - [ ] pytest によるユニットテスト
  - 完了条件: Pine Script → StrategySpec JSON が動く

- [ ] **Phase 2 — MQL4 Generator**
  - [ ] `mql4/shared/RiskEngine.mqh` / `Indicators.mqh` / `Logger.mqh`
  - [ ] `src/generators/mql4_generator.py`
  - [ ] 生成 EA の構文チェック（静的チェック。実機コンパイルはこの環境では不可）
  - 完了条件: StrategySpec → EA が生成される（実機コンパイルは Phase 6 以降 / ユーザー環境で確認）

- [ ] **Phase 3 — Backtest Engine**
  - [ ] `src/backtest/runner.py`（コスト・スリッページ・スワップ考慮）
  - [ ] `src/backtest/metrics.py`
  - [ ] Buy&Hold / Random Entry / Always Long / Always Short / Simple EMA Cross ベンチマーク
  - [ ] `src/database/models.py` / `repository.py`
  - 完了条件: サンプル OHLCV でバックテストを実行し結果を DB へ保存できる

- [ ] **Phase 4 — Quant Validation**
  - [ ] In-Sample / Out-of-Sample split（config化）
  - [ ] `src/backtest/walkforward.py`（WFE 算出）
  - [ ] `src/backtest/montecarlo.py`（10,000 simulations）
  - [ ] `src/backtest/robustness.py`（パラメータ近傍評価）
  - [ ] `src/ranking/scorer.py`（Strategy Score, Reject 条件）
  - 完了条件: 上記すべてが CLI から実行可能

- [ ] **Phase 5 — Dashboard**
  - [ ] `src/dashboard/` Streamlit アプリ（Dashboard / Strategy Detail / Comparison）
  - 完了条件: 戦略の一覧・比較ができる

- [ ] **Phase 6 — 楽天MT4 デモ運用**
  - [ ] `src/mt4/compiler.py` / `terminal.py` / `connection_monitor.py`
  - [ ] 土曜ログアウト対応フロー
  - 完了条件: デモ口座で最低4週間のフォワードテスト（この開発コンテナでは実機接続不可 — I/F実装のみ）

- [ ] **Phase 7 — LIVE 準備**
  - [ ] Backtest/OOS/WalkForward/MonteCarlo/MQL4 validation/Demo/Risk config の PASS 判定集約
  - [ ] LIVE eligibility レポート
  - 完了条件: 全項目 PASS の場合のみ "LIVE eligible" と表示。**本番発注はこのリポジトリでは有効化しない。**

## 現在のステータス

Phase 1 実装中。詳細は各コミットメッセージおよび `docs/assumptions.md` を参照。
