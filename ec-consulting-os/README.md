# EC Consulting OS

ECコンサルティング業務をAIネイティブ化するシステム。

## 概要

AIが調査・集計・分析・仮説・施策案・資料・WBSまで準備し、
人間のコンサルタントは「判断」「顧客との対話」「優先順位決定」に集中する。

## クイックスタート

### 新規顧客を追加する
```
/client-context
```
顧客情報を入力すると `clients/{client_id}/` が自動生成されます。

### 月次分析を実行する
```
1. CSVを clients/{client}/data/raw/ に配置
2. /data-audit でデータ確認
3. /kpi-diagnosis で売上分解
4. /priority-actions で優先施策決定
5. /monthly-review で顧客向けレポート生成
```

## Skill一覧

詳細は `SKILL_BACKLOG.md` を参照。

| Phase | Skill | 用途 |
|-------|-------|------|
| 1 | client-context | 顧客情報整理 |
| 1 | data-audit | データ品質確認 |
| 1 | kpi-diagnosis | 売上分解・診断 |
| 1 | sku-analysis | 商品別分析 |
| 1 | priority-actions | 優先施策決定 |
| 1 | monthly-review | 月次レポート生成 |
| 2〜4 | その他27Skill | SKILL_BACKLOG.md参照 |

## ドキュメント

- `SYSTEM_ARCHITECTURE.md` — データフローと依存関係
- `OUTPUT_CATALOG.md` — 全アウトプット一覧
- `SKILL_BACKLOG.md` — Skill実装状況
- `OPEN_QUESTIONS.md` — 未解決事項
- `docs/` — 原則・指標定義・チャネルルール
