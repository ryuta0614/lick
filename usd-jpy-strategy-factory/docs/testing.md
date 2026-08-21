# testing.md — テスト方針

## 単体テスト（pytest）

```bash
pytest
```

Phase 1 でカバーする範囲:

- `tests/test_schema.py` — StrategySpec のバリデーション（必須フィールド、値域、往復シリアライズ）
- `tests/test_validator.py` — StrategySpec の整合性検証（symbol scope, danger_level, review_status,
  anti_repaint フラグ, pyramiding矛盾など）
- `tests/test_pine_parser.py` — Pine Script抽出（strategy宣言、input、ta.*呼び出し、
  crossover/crossunder、strategy.entry/exit）
- `tests/test_anti_repaint.py` — 危険パターン検出（lookahead_on, 負のオフセット,
  request.security, overfitting閾値, trade数分類）
- `tests/test_analyzer.py` — Pine → StrategySpec 変換（Golden Strategy 2種の正常系、
  NEEDS_REVIEWケース、REJECTケースでspecを生成しないこと）

今後の Phase で追加するテスト:

- `tests/test_mql4_generator.py` — StrategySpec → MQL4 の構文的妥当性（Phase 2）
- `tests/test_backtest_runner.py` / `test_metrics.py` — バックテストエンジン・指標計算（Phase 3）
- `tests/test_walkforward.py` / `test_montecarlo.py` / `test_robustness.py`（Phase 4）
- `tests/test_scorer.py` — Strategy Score / Reject 条件（Phase 4）

## Golden Master Test

`EMA20/50 Crossover` と `RSI Mean Reversion` を Golden Strategy として、
期待されるエントリー/エグジット・シグナルを固定し、Pine相当ロジック
（StrategySpec/Python実装）と MQL4生成コードの記述が一致することを確認する
（`tests/test_analyzer.py` が Python側の Golden Master、Phase 2で
`tests/test_mql4_generator.py` が MQL4側を追加する）。

## Pine ↔ MQL4 Validation（§34、最重要）

同一 USDJPY OHLCV データに対して、StrategySpec/Python実装と生成MQL4 EAの
Entry time / Entry direction / Exit time / Stop / Take Profit を比較し、
差異が許容範囲を超える場合 `MQL4_VALIDATION_FAILED` として本番利用禁止とする。

この開発コンテナでは実機MT4 Strategy Testerを実行できないため
（`docs/assumptions.md`）、Phase 1-3時点では「エントリー条件の記述が両実装で
同一であること」をソースレベルで近似検証するに留める。実機比較は
ユーザー環境（Phase 6）で実施すること。

## 危険コード検出の限界

`src/pine/anti_repaint.py` はヒューリスティック（既知パターンの正規表現マッチ）
であり、完全な静的解析ではない（`docs/assumptions.md` #5）。REJECT/DANGEROUS
判定は保守的に倒すが、検出漏れの可能性は残る。新しい危険パターンを発見した場合は
`_REGEX_FINDINGS` にパターンを追加し、対応するテストケースを
`tests/fixtures/pine/` に追加すること。
