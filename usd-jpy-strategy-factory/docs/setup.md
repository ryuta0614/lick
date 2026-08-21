# setup.md — セットアップ手順

## 1. Python環境

```bash
cd usd-jpy-strategy-factory
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Python 3.12+ を推奨（`docs/assumptions.md` の環境制約を参照）。

## 2. 環境変数

```bash
cp .env.example .env
```

`.env` は絶対に Git へコミットしない（`.gitignore` 済み）。既定値は
`RUN_MODE=BACKTEST` / `ENABLE_LIVE_TRADING=false` であり、これを変更しない限り
発注は一切行われない。

## 3. データ

このコンテナ環境からは USDJPY のヒストリカルデータを取得できないため
（`docs/assumptions.md` #2）、ユーザー自身が用意した OHLCV CSV を
`data/` に配置する運用とする。フォーマット:

```csv
time,open,high,low,close,volume
2016-01-04 00:00:00,120.123,120.456,119.987,120.234,1523
...
```

## 4. Pine Script の取り込み

TradingView からエクスポートした（または自分で作成した）Pine Script を
`pine_inputs/` に保存する。このシステムは TradingView サイトを
スクレイピングしない（§4）。

## 5. テスト

```bash
pytest
```

## 6. 楽天MT4 実機環境（このコンテナでは未検証）

`src/mt4/compiler.py` / `terminal.py` は Windows + 楽天MT4 + MetaEditor が
インストールされた環境で `metaeditor.exe /compile:...` を呼び出す設計。
この開発コンテナには存在しないため、`CompileResult(status="NOT_AVAILABLE")`
を返す経路のみ自動テストされている。実機コンパイル・実機デモ運用は
ユーザー自身の Windows 環境で確認すること。詳細は `docs/rakuten_mt4.md`。
