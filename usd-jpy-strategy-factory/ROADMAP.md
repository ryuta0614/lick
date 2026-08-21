# ROADMAP.md — USDJPY AI Strategy Factory

進捗管理用。各 Phase 完了時にチェックし、Completed / Changed files / Tests / Known issues /
Next step をコミットメッセージまたは本ファイルの更新で報告する。

- [x] **Phase 1 — StrategySpec 基盤**
  - [x] `src/strategies/schema.py`（StrategySpec Pydantic モデル）
  - [x] `src/strategies/validator.py`
  - [x] `src/pine/parser.py`
  - [x] `src/pine/analyzer.py`
  - [x] `src/pine/anti_repaint.py`
  - [x] Golden Strategy #1: EMA20/50 Crossover の `.pine` サンプルと変換
  - [x] Golden Strategy #2: RSI Mean Reversion の `.pine` サンプルと変換
  - [x] pytest によるユニットテスト（25件）
  - 完了条件: Pine Script → StrategySpec JSON が動く -- 達成済み

- [x] **Phase 2 — MQL4 Generator**
  - [x] `mql4/shared/RiskEngine.mqh` / `Indicators.mqh` / `Logger.mqh`
  - [x] `src/generators/mql4_generator.py`
  - [x] 生成 EA の構文チェック（静的チェック=波括弧・丸括弧の対応検証。実機コンパイルはこの環境では不可）
  - [x] Golden Strategy 2種の生成EA（`mql4/generated/*.mq4`）と `strategy_specs/*.json`
  - 完了条件: StrategySpec → EA が生成される -- 達成済み（実機コンパイルはユーザー環境で確認要、docs/rakuten_mt4.md参照）

- [x] **Phase 3 — Backtest Engine**
  - [x] `src/backtest/runner.py`（コスト・スリッページ・スワップ考慮、スプレッドStress Test）
  - [x] `src/backtest/metrics.py`（§15 全指標）
  - [x] Buy&Hold / Random Entry / Always Long / Always Short / Simple EMA Cross ベンチマーク
  - [x] `src/database/models.py` / `repository.py`（SQLite, Repository Pattern）
  - [x] pytest によるユニットテスト（indicators/runner/metrics/benchmarks/repository）
  - 完了条件: サンプル OHLCV でバックテストを実行し結果を DB へ保存できる -- 達成済み
    （実データは `docs/assumptions.md` の制約により合成データで検証。ユーザーは
    実USDJPY CSVを `data/` に配置して同じ経路で実行可能）

- [x] **Phase 4 — Quant Validation**
  - [x] In-Sample / Out-of-Sample split（`src/backtest/sample_split.py`、config化）
  - [x] `src/backtest/walkforward.py`（WFE 算出。パラメータ再最適化なしの簡易版、docs/assumptions.md参照）
  - [x] `src/backtest/montecarlo.py`（既定10,000 simulations、ベクトル化実装）
  - [x] `src/backtest/robustness.py`（パラメータ近傍評価、Parameter Plateau判定）
  - [x] `src/ranking/scorer.py`（Strategy Score §21, Reject 条件 §22）
  - [x] pytest によるユニットテスト（sample_split/walkforward/montecarlo/robustness/scorer）
  - 完了条件: 上記すべてが実行可能 -- 達成済み
  - 完了条件: 上記すべてが CLI から実行可能

- [x] **CLI — `app.py`（§31）**
  - [x] `import` / `analyze` / `convert` / `compile` / `backtest` / `walkforward` / `montecarlo` /
        `evaluate` / `rank` / `dashboard` / `pipeline`（一括実行）
  - [x] `--synthetic` フラグ（このコンテナに実USDJPYデータが無いための実行可能なデモ経路。
        `docs/assumptions.md` #2参照。実データは `--data <csv>` で指定）
  - [x] 実行のたびに `RUN_MODE`/`ENABLE_LIVE_TRADING` のLive Safetyゲート状態を表示
  - 完了条件: `python app.py pipeline pine_inputs/ema_cross.pine --synthetic` が
    Import→Analyze→Convert→Compile→Backtest→WalkForward→MonteCarlo→Evaluateまで
    通しで実行できる -- 達成済み

- [x] **Phase 5 — Dashboard**
  - [x] `src/dashboard/` Streamlit アプリ（Dashboard / Strategy Detail / Comparison）
  - [x] `src/dashboard/queries.py`（DB問い合わせをUIから分離しユニットテスト可能に）
  - [x] `streamlit.testing.v1.AppTest` による3ページ全ての実行時検証（例外なし）
  - 完了条件: 戦略の一覧・比較ができる -- 達成済み（ブラウザでの目視確認はこの開発コンテナでは
    実施不可。`docs/assumptions.md` #3参照。AppTestによる実行時検証で代替）

- [x] **Phase 6 — 楽天MT4 デモ運用（インターフェースのみ）**
  - [x] `src/mt4/compiler.py` / `terminal.py` / `connection_monitor.py`
  - [x] 土曜ログアウト対応フロー（`ConnectionMonitor` ステートマシン）
  - 完了条件: デモ口座で最低4週間のフォワードテスト（この開発コンテナでは実機接続不可 — I/F実装のみ。
    実機接続・実デモ運用はユーザーのWindows環境で実施）

- [ ] **Phase 7 — LIVE 準備**
  - [ ] Backtest/OOS/WalkForward/MonteCarlo/MQL4 validation/Demo/Risk config の PASS 判定集約
  - [ ] LIVE eligibility レポート
  - 完了条件: 全項目 PASS の場合のみ "LIVE eligible" と表示。**本番発注はこのリポジトリでは有効化しない。**

## 現在のステータス

Phase 1〜6 完了（Phase 6は実機接続不可のためインターフェースのみ）。Phase 7（LIVE準備）は本番発注を有効化しない方針のため、このリポジトリでは意図的に未実装。詳細は各コミットメッセージ
および `docs/assumptions.md` を参照。
