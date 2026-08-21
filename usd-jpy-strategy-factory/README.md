# USDJPY AI Strategy Factory

TradingView の Pine Script 戦略を取り込み、売買ロジックを解析・標準化し、楽天証券の楽天MT4で
動作する MQL4 EA へ変換し、バックテスト・評価・ランキング・デモ運用まで一気通貫で行う
Strategy Factory。

対象は初期段階では **楽天証券 楽天MT4 / USDJPY / FX** のみ。将来的に他通貨・他ブローカーへ
拡張可能な設計にしている。

> **本番資金の自動売買は行いません。** Phase 1〜7 の検証条件をすべて満たすまで LIVE 発注機能は
> 無効化されています。詳細は `PROJECT_PLAN.md` と `ARCHITECTURE.md` の Live Safety 節を参照。

## ドキュメント

- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) — 目的・スコープ・Phase構成
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — 全体設計・データフロー・モジュール責務
- [`ROADMAP.md`](./ROADMAP.md) — Phase毎の進捗チェックリスト
- [`docs/assumptions.md`](./docs/assumptions.md) — 開発上の仮定・既知の制約
- [`docs/setup.md`](./docs/setup.md) — セットアップ手順
- [`docs/strategy_spec.md`](./docs/strategy_spec.md) — StrategySpec 仕様
- [`docs/rakuten_mt4.md`](./docs/rakuten_mt4.md) — 楽天MT4接続・運用上の注意
- [`docs/testing.md`](./docs/testing.md) — テスト方針

## セットアップ

```bash
cd usd-jpy-strategy-factory
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## CLI

```bash
python app.py import pine_inputs/ema_cross.pine
python app.py analyze ema_cross_001
python app.py convert ema_cross_001
python app.py compile ema_cross_001
python app.py backtest ema_cross_001
python app.py walkforward ema_cross_001
python app.py montecarlo ema_cross_001
python app.py evaluate ema_cross_001
python app.py rank
python app.py dashboard

# 一括実行
python app.py pipeline pine_inputs/ema_cross.pine
```

## テスト

```bash
pytest
```

## 安全設計の要点

- `RunMode`: `BACKTEST` (既定) / `DEMO` / `LIVE`
- `.env` の `ENABLE_LIVE_TRADING`（既定 `false`）と `RUN_MODE=LIVE` の **両方**が揃わない限り
  発注は一切行われない（Python 側・MQL4 側の両方でゲート実装）。
- 資格情報（口座番号・パスワード等）はソースコードに保存しない。`.env` / `logs/` / `data/private/`
  は `.gitignore` 対象。
- 危険コード検出（repainting / lookahead bias 等）で `REJECT` と判定された戦略は EA 生成対象から
  自動的に除外される。
