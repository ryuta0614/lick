# rakuten_mt4.md — 楽天MT4接続・運用上の注意

## スコープ

初期段階の対象は **楽天証券 楽天MT4 / USDJPY / FX** のみ（§1）。

## 資格情報

- 口座番号・パスワード等の資格情報はソースコード・リポジトリへ一切保存しない。
- `.env`（Git管理外）または実行環境のシークレットストアで管理する。
- ログイン操作・パスワード発行そのものを自動化しない（§12）。

## 土曜日ログアウト対応（§12）

楽天MT4は毎週土曜日にログイン状態が切断される可能性がある。システム側のフローは:

```
MT4 disconnected
  -> trading disabled
  -> user notification
  -> manual login (人間が実施)
  -> connection verification
  -> trading enabled
```

`src/mt4/connection_monitor.py` がこのステートマシンを実装する。切断検知時は
新規注文を禁止し、ユーザーへ通知（ログ記録。実際の通知チャネルはPhase 6で
ユーザー環境に合わせて実装する）。復帰は人間の手動ログイン後、接続確認が
成功して初めて `trading enabled` へ遷移する。

## 接続監視項目

- MT4 connection
- trade permission
- market open
- symbol available (USDJPY)
- quotes updating
- spread（`RiskEngine` の `MaxSpreadPips` と連動）
- account state

異常検知時はログ（`logs/`）に記録し、新規注文を禁止する。

## この開発コンテナでの制約

このリポジトリはクラウドの隔離コンテナで開発されており、楽天MT4端末・MetaEditorへの
実接続はできない（`docs/assumptions.md` #1）。`src/mt4/compiler.py` / `terminal.py` /
`connection_monitor.py` はインターフェースとして実装し、実行不可の場合は例外を投げず
`NOT_AVAILABLE` 系の結果を返す。実機での動作確認は Phase 6 でユーザー自身の
Windows + 楽天MT4環境にて行うこと。

## デモ運用の最低期間

Phase 6 のデモ運用は最低4週間（`config/default.yaml` の `demo.min_weeks_before_live_review`、
既定値変更可）継続し、この期間を満たさない限り LIVE 準備（Phase 7）の対象にしない。
