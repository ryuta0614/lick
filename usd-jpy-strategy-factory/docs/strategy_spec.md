# strategy_spec.md — StrategySpec 仕様

`StrategySpec`（`src/strategies/schema.py`）は Pine Script と MQL4 の橋渡しをする
唯一の正規仕様（single source of truth）。設計思想は `ARCHITECTURE.md` を参照。

## フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `strategy_id` | `str` (`^[a-z0-9_]+$`) | 一意なID |
| `name` | `str` | 表示名 |
| `symbol` | `str` | 既定 `USDJPY`。Phase 1 では validator が USDJPY 以外を拒否 |
| `timeframe` | `1m/5m/15m/30m/1h/4h/1d` | 評価時間足 |
| `indicators` | `IndicatorSpec[]` | 使用テクニカル指標（type, period, source, params） |
| `long_entry` / `short_entry` | `EntryRule?` | エントリー条件（`condition` は人間可読な説明文、`execution` は約定モデル） |
| `exit` | `ExitRule` | `stop_loss_pips` / `take_profit_pips` / `trailing_stop_pips` |
| `position_management` | `PositionManagement` | `max_positions`, `pyramiding`, `reverse_on_opposite_signal` |
| `risk` | `RiskSpec` | `position_sizing`（現状 `fixed_lot` のみ）, `fixed_lot` |
| `anti_repaint` | `bool` | 危険検出（`src/pine/anti_repaint.py`）を通過したか |
| `danger_level` | `SAFE/WARNING/DANGEROUS/REJECT` | §6 の4段階評価 |
| `review_status` | `OK/NEEDS_REVIEW` | 曖昧な条件を人間がレビューする必要があるか（§7） |
| `source` | `PineSourceMeta?` | 変換元Pineのファイル・バージョン・kind |
| `version` | `int` | StrategySpec自体のバージョン（将来のマイグレーション用） |

## 例

```json
{
  "strategy_id": "ema_cross_001",
  "name": "EMA20/50 Crossover",
  "symbol": "USDJPY",
  "timeframe": "1h",
  "indicators": [
    {"type": "EMA", "period": 20, "source": "close", "params": {}},
    {"type": "EMA", "period": 50, "source": "close", "params": {}}
  ],
  "long_entry": {"condition": "EMA20 crosses above EMA50", "execution": "next_bar_market"},
  "short_entry": {"condition": "EMA20 crosses below EMA50", "execution": "next_bar_market"},
  "exit": {"stop_loss_pips": 20, "take_profit_pips": 40},
  "position_management": {"max_positions": 1, "pyramiding": false, "reverse_on_opposite_signal": true},
  "risk": {"position_sizing": "fixed_lot", "fixed_lot": 0.01},
  "anti_repaint": true,
  "danger_level": "SAFE",
  "review_status": "OK"
}
```

## 生成物

このJSONから機械的に生成できるもの：

- 人間向け説明: `long_entry.condition` / `short_entry.condition` の文字列表現をそのまま利用
- Python バックテスト: `src/backtest/runner.py`
- MQL4 EA: `src/generators/mql4_generator.py`
- テストケース: Golden Master Test（`tests/`）が同一StrategySpecに対するPython実装と
  MQL4生成コードのロジック整合性を検証する

## 整合性検証

`src/strategies/validator.py::validate_spec()` が構造的な整合性（必須フィールド、
値域、矛盾するフラグ）を検証する。パフォーマンスベースの Reject 条件
（Profit Factor / DD / Trade数など、§22）は `src/ranking/scorer.py` が別途担当する。
