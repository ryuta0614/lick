# ARCHITECTURE.md — USDJPY AI Strategy Factory

## 全体データフロー

```
pine_inputs/*.pine
      │  src/pine/parser.py       (構文解析 → RawPineStrategy)
      ▼
src/pine/analyzer.py              (指標・パラメータ・エントリー/エグジット条件抽出)
      │
      ▼
src/pine/anti_repaint.py          (SAFE / WARNING / DANGEROUS / REJECT 判定)
      │  REJECT はここで止める
      ▼
src/strategies/schema.py          (StrategySpec Pydantic モデルへ変換)
      │
      ▼
src/strategies/validator.py       (StrategySpec 自体の整合性検証)
      │
      ├──────────────┬─────────────────────┐
      ▼              ▼                     ▼
generators/       backtest/             (将来: 他通貨/他ブローカー生成器)
mql4_generator.py  runner.py
      │              │
      ▼              ▼
mql4/generated/*.mq4  backtest 結果 (metrics.py で指標算出)
      │              │
      ▼              ▼
mt4/compiler.py    backtest/walkforward.py, montecarlo.py, robustness.py
(MetaEditor CLI)       │
      │                ▼
      ▼           ranking/scorer.py (Strategy Score 0-100)
mt4/terminal.py         │
mt4/connection_monitor  ▼
      │           database/models.py, repository.py (SQLite, Repository Pattern)
      ▼                │
   DEMO 運用             ▼
      │           dashboard/ (Streamlit)
      ▼
   監視 → (将来) LIVE
```

## StrategySpec: 唯一の正規仕様

Pine と MQL4 は「バー確定タイミング / Bid-Ask / 注文価格 / スプレッド / Intrabar execution /
strategy.entry・exit / pyramiding / security() のリペイント特性 / timeframe 解釈 / stop・limit
の約定モデル / position management」が異なる。これらの差異を吸収するために、Pine Script を
直接 MQL4 へ翻訳することを禁止し、`src/strategies/schema.py` の `StrategySpec` を唯一の
正規表現（single source of truth）として扱う。

- `StrategySpec` は Pydantic モデルとして定義し、JSON Schema をそのまま
  `strategy_specs/<strategy_id>.json` として永続化する。
- Python バックテスト（`src/backtest/runner.py`）と MQL4 EA
  （`src/generators/mql4_generator.py` が生成するコード）は、共に StrategySpec のみを入力とする。
  どちらも Pine Script を直接参照しない。
- StrategySpec から人間向け説明・Pythonバックテスト・MQL4・テストケース（Golden Master）を
  機械的に生成できることを設計上の必須要件とする。

## モジュール責務

### `src/pine/`
- `parser.py`: Pine Script のテキストを走査し、`strategy()`/`indicator()` 宣言、
  `input.*` によるパラメータ、`ta.*` 系のテクニカル指標呼び出し、`strategy.entry` /
  `strategy.exit` / `strategy.close` 呼び出しを抽出し `RawPineStrategy` に格納する。
  正規表現ベースの軽量パーサー（フル AST パーサーではない）。TradingView サイトへの
  スクレイピングは行わない。ユーザーが `pine_inputs/` に配置したファイルのみを対象とする。
- `analyzer.py`: `RawPineStrategy` から StrategySpec に必要な情報（indicators, long/short
  entry condition, exit, position management, risk）を組み立てる。indicator 形式で
  エントリー/エグジットが明確に読み取れない場合は `NEEDS_REVIEW` を返し、AI が売買条件を
  勝手に発明しない。
- `anti_repaint.py`: repainting / lookahead bias / 不自然なバックテスト / overfitting /
  取引数不足のヒューリスティック検査を行い、`SAFE` / `WARNING` / `DANGEROUS` / `REJECT` の
  4段階評価を返す。`REJECT` は EA 生成対象から除外する。

### `src/strategies/`
- `schema.py`: `StrategySpec` Pydantic モデル（indicators, long_entry, short_entry, exit,
  position_management, risk, anti_repaint フラグなど）。
- `validator.py`: StrategySpec の整合性チェック（必須フィールド、値域、矛盾するフラグの検出）。

### `src/generators/mql4_generator.py`
StrategySpec → `.mq4` ソースを生成する。`OnInit`/`OnDeinit`/`OnTick` を必須実装し、
MagicNumber・USDJPY限定チェック・timeframeチェック・New Bar判定・Spreadチェック・
Lot計算・SL/TP・OrderSend/Modify/Close・エラーハンドリング・ロギングを組み込む。
共通の `RiskEngine.mqh` / `Indicators.mqh` / `Logger.mqh`（`mql4/shared/`）を `#include` する。

### `src/backtest/`
- `runner.py`: StrategySpec を pandas OHLCV に対して再生し、シグナル・約定・損益を計算する
  “Reference Python Backtester”。スプレッド・スリッページ・スワップ・約定遅延をモデル化。
- `metrics.py`: Net Profit, PF, Win Rate, Sharpe, Sortino, Calmar, MaxDD 等の指標計算。
- `walkforward.py`: ローリング Training/Test による Walk Forward Efficiency 算出。
- `montecarlo.py`: トレード結果のブートストラップ再サンプリングによる Monte Carlo（既定 10,000 回）。
- `robustness.py`: 主要パラメータの近傍摂動によるパラメータ・プラトー評価。

### `src/ranking/scorer.py`
Strategy Score（0-100点、§21 の配点）と Reject 条件（§22）を実装する。

### `src/database/`
SQLite + SQLAlchemy。`models.py` にテーブル定義、`repository.py` に Repository Pattern
（将来 PostgreSQL 等へ差し替え可能なインターフェース）。

### `src/mt4/`
- `compiler.py`: MetaEditor CLI (`metaeditor.exe /compile`) のラッパー。Windows/Wine 環境が
  無い場合は `CompileResult(status="NOT_AVAILABLE")` を返す（この開発コンテナでは常にこの経路）。
- `terminal.py`: MT4 ターミナルのプロセス監視・起動インターフェース（同上の制約）。
- `connection_monitor.py`: 接続状態・取引許可・市場オープン・シンボル利用可否・気配更新・
  スプレッド・口座状態を監視し、異常時は新規発注を禁止するロジック（EA側 RiskEngine と
  対になる管理側の実装）。

### `src/dashboard/`
Streamlit ダッシュボード（Best strategies / Equity curve / Drawdown / 比較画面）。

## Live Safety（本番売買禁止機構）

- `RunMode`: `BACKTEST` | `DEMO` | `LIVE`。既定値は `BACKTEST`。
- 環境変数 `ENABLE_LIVE_TRADING`（既定 `false`）。
- 発注ゲートは **`RUN_MODE=LIVE` かつ `ENABLE_LIVE_TRADING=true` の両方**が揃った場合のみ通過する。
  Python 側（`config/default.yaml` 経由）・MQL4 側（`RiskEngine.mqh` の `IsLiveTradingAllowed()`）の
  両方に同一ゲートを実装し、片方だけの設定変更では発注できないようにする。
- MQL4 側では楽天MT4の資格情報（口座番号・パスワード）をソースコードへ埋め込まない。
  ログイン操作の自動化も行わない（土曜切断からの復帰は手動ログイン＋接続確認を要求する）。

## 拡張性

- `StrategySpec.symbol` / `timeframe` はフィールドとして保持しているため、将来的に
  USDJPY 以外の通貨ペアへ拡張する際も schema 変更は不要。ただし Phase 1 では
  `validator.py` が `symbol == "USDJPY"` をハード要求する（§1 のスコープ限定）。
- `Repository Pattern` により DB を SQLite → PostgreSQL に差し替え可能。
- `Portfolio Engine`（§26）は複数 StrategySpec のトレードリターン相関を計算する
  将来インターフェースとして `src/backtest/` 配下に追加予定（Phase 4 以降）。
