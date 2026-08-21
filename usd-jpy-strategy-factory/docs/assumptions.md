# assumptions.md — 開発上の仮定と既知の制約

開発指示書は「追加質問がなくても合理的な仮定を置いて進めてよい」としているため、以下の仮定を
置いて実装を進めた。将来これらを変更する場合は本ファイルを更新すること。

## 環境制約（重要）

1. **楽天MT4 / MetaEditor には接続できない。** このコンテナには Windows/Wine も MT4 端末も
   存在しない。`src/mt4/compiler.py` と `terminal.py` は MetaEditor CLI (`metaeditor.exe /compile`)
   を `subprocess` で呼び出すインターフェースとして実装するが、実行環境に存在しない場合は
   例外を投げず `CompileResult(status="NOT_AVAILABLE", detail=...)` を返す。実機コンパイルの検証は
   ユーザー自身の Windows + 楽天MT4 環境で行う必要がある。
2. **USDJPY の10年分ヒストリカルデータをこの環境から取得できない。** 外部ブローカー/データベンダー
   API への契約・認証情報が無く、また `pine_inputs` 同様「勝手にスクレイピングしない」方針を
   データ取得にも準用した。`data/` 配下にユーザーが用意した OHLCV CSV
   （列: `time,open,high,low,close,volume`）を配置する運用とし、`src/backtest/runner.py` は
   その CSV 形式に対して動作する。テストでは合成（deterministic だが十分な長さの）OHLCV
   フィクスチャを用いる。
3. **Streamlit dashboard はこの環境でブラウザ確認できない。** `streamlit run` コマンドは実装するが、
   UI の実機確認はユーザー環境で行う。ユニットテストはデータ取得・集計ロジック部分に対して行う。

## 設計上の仮定

4. **Pine Script パーサーはフル AST パーサーではなく、正規表現/トークンベースの抽出器とする。**
   TradingView Pine v5 の主要構文（`strategy()`, `indicator()`, `input.*`, `ta.*`, `strategy.entry`,
   `strategy.exit`, `strategy.close`, `plot`, `if`/`crossover`/`crossunder`）を対象とする。
   複雑な独自関数・ライブラリ import・多重ネストしたロジックは `NEEDS_REVIEW` として
   人間のレビューに委ねる（AIが売買条件を勝手に発明しないため）。
5. **危険戦略検出（SAFE/WARNING/DANGEROUS/REJECT）はヒューリスティックベース。** 完全な
   静的解析ではなく、既知の危険パターン（`lookahead_on`, 未来オフセット, `request.security`
   の不適切な使用等）の検出とスコアリングの組み合わせとする。将来的に精度向上の余地がある
   ことを明記する。
6. **StrategySpec の `timeframe` は Pine の `timeframe.period` が明示されない場合、チャートの
   デフォルト（指示書に従い USDJPY H1 を Golden Strategy の既定値）とする。**
7. **Lot計算（position sizing）は初期実装では `fixed_lot` のみをサポートする。** リスクベースの
   ロット計算（%リスク等）は `risk.position_sizing` の拡張ポイントとして schema に用意するが、
   Phase 1 の実装は `fixed_lot` を前提とする。
8. **RiskEngine の初期パラメータは保守的な既定値とする**（例: MaxSpreadPips=3.0, MaxPositions=1,
   MaxDailyLoss=2%, MaxDrawdown=10%, TradingStartHour=0, TradingEndHour=23, FridayClose=true）。
   すべて `config/default.yaml` から変更可能。
9. **データベースは SQLite（`data/strategy_factory.db`）を初期採用**し、`src/database/repository.py`
   は Repository Pattern でラップして将来 PostgreSQL 化できるようにする。
10. **CLI フレームワークは `click` を使用する。** 指示書 §31 のサブコマンド構成に従う。
11. **秒 / Symbol 拡張性:** `StrategySpec.symbol` はフィールドとして自由に保持できるが、
    `validator.py` は Phase 1 の間 `symbol == "USDJPY"` を強制する（§1 のスコープ限定を
    コードレベルでも保証するため）。
12. **バックテストのコストパラメータ（spread/slippage/swap/commission）はプレースホルダ。**
    `config/default.yaml` の `backtest.costs` および `src/backtest/costs.py::CostConfig` の
    既定値は楽天MT4の実測値ではなく一般的なUSDJPYの実勢に基づく仮定値。実運用判断の前に
    実測値へ差し替えること。
13. **口座通貨はJPYと仮定する。** `CostConfig.pip_value_per_lot()` は
    `pip_size * lot_units` をそのまま口座通貨（JPY）建ての1pipあたり価値として扱う
    （USDJPYはJPY建て口座では実際にこの関係が成り立つ）。他通貨ペアへ拡張する際は
    円換算レートの考慮が必要になる。
14. **SL/TPが同一バー内で両方ヒットした場合、ストップロスが先に約定したとみなす**
    （保守的なバイアス。`src/backtest/runner.py::check_stop_take` 参照）。実際の順序は
    バー内の値動きパスに依存するため不確定であり、楽観的な結果を避けるための仮定。
15. **エントリー価格モデル:** ロングは "next bar open + slippage"、ショートは
    "next bar open - slippage" で約定するとし、スプレッドコストは往復分をまとめて
    決済時にpips単位で差し引く簡略モデルを採用する（`src/backtest/runner.py::close_trade`）。
    Bid/Ask個別のティックデータではなくOHLC四本値からの近似である。
16. **ベンチマーク戦略（§16）の定義:** `always_long` / `always_short` は対象戦略と同じ
    SL/TP・ロットサイズを使い「常時同方向にポジションを取り直す」ことでエントリータイミングの
    寄与を分離する設計とした。`random_entry` は対象戦略とおおよそ同じ取引回数になるよう
    エントリー確率を校正する。`buy_and_hold` はSL/TPなしで単一ポジションを保有し続ける。

## 既知の課題（KNOWN ISSUE）

- MQL4 実機コンパイル・実機バックテスト（Strategy Tester 上での検証）は未検証。
  `src/mt4/compiler.py` はインターフェースのみで、CI 上では `NOT_AVAILABLE` 経路のみテストされる。
- Pine↔MQL4 Validation（§34）は Python 側 Reference Backtester と生成 MQL4 EA の実際の
  MT4 Strategy Tester 実行結果を比較する必要があるが、後者を実機で実行できないため、
  Phase 1-3 の時点では「エントリー条件ロジックの記述が両実装で同一であること」を
  ソースレベルの Golden Master Test で近似検証するに留める。実機比較は Phase 6 のユーザー環境で
  実施する。
- 楽天MT4のスプレッド・スワップの実測値は未取得のため、`config/default.yaml` の値は
  一般的なUSDJPYの実勢値を仮定したプレースホルダである。実運用前に実測値へ差し替えること。
