# System Architecture

## データフロー全体図

```
【INPUT】
顧客から提供されるデータ
├── 売上CSV（RMS / セラーセントラル / TikTok Shop管理画面）
├── 広告CSV
├── 在庫CSV
├── アクセスログ
├── レビューデータ
└── 顧客コンテキスト（インタビュー / 契約書）

        ↓ Skill: client-context（01）
        ↓ Skill: data-audit（02）
        ↓ Skill: data-normalizer（03）

【PROCESSED DATA】
clients/{client}/data/processed/
├── sales.csv（標準化された売上データ）
├── ads.csv（標準化された広告データ）
├── inventory.csv（標準化された在庫データ）
└── reviews.csv（標準化されたレビューデータ）

        ↓ Skill: metric-calculator（04）

【METRICS】
clients/{client}/analysis/metrics.json
（全Skillが参照する基準指標）

        ↓ 各分析Skill（05〜14）が並列実行可能

【DIAGNOSIS】（分析レポート群）
clients/{client}/analysis/
├── kpi-report.md（05: kpi-diagnosis）
├── gap-report.md（06: growth-gap-analysis）
├── sku-report.md（07: sku-analysis）
├── profit-report.md（08: profit-analysis）
├── inventory-report.md（09: inventory-analysis）
├── ad-report.md（10: ad-analysis）
├── seo-report.md（11: seo-analysis）
├── competitor-report.md（12: competitor-analysis）
├── voc-report.md（13: review-voc-analysis）
└── crm-report.md（14: crm-analysis）

        ↓ Skill: priority-actions（15）

【DECISION】
clients/{client}/analysis/actions.json
（優先施策リスト・最大5つ）

        ↓ 各戦略Skill（16〜20）

【STRATEGY】
clients/{client}/plans/
├── growth-plan.md（16: sales-growth-plan）
├── profit-plan.md（17: profit-growth-plan）
├── promotion-plan.md（18: promotion-plan）
├── 90day-plan.md（19: 90day-plan）
└── channel-strategy.md（20: channel-strategy）

        ↓ 各実行支援Skill（21〜25）

【EXECUTION】
clients/{client}/plans/
├── wbs.csv（21: wbs-generator）
├── lp-improvement.md（22: lp-improvement）
├── creative-brief.md（23: creative-brief）
├── ad-brief.md（24: ad-brief）
└── crm-plan.md（25: crm-plan）

        ↓ 実行後 → 結果データ収集 → 翌月のINPUTへ

【REPORTING】
clients/{client}/reports/
├── weekly/（26: weekly-review）
├── monthly/（27: monthly-review）
├── meeting-prep/（28: meeting-prep）
└── meeting-minutes/（29: meeting-minutes）

        ↓ Skill: case-capture（31）

【KNOWLEDGE】
knowledge/
├── cases/（成功・失敗事例DB）
├── decision-patterns/（判断パターン）
└── best-practices/（ベストプラクティス）
```

---

## Skill依存関係マップ

```
01 client-context
└─→ 02 data-audit
    └─→ 03 data-normalizer
        └─→ 04 metric-calculator
            ├─→ 05 kpi-diagnosis ──────────┐
            ├─→ 06 growth-gap-analysis      │
            ├─→ 07 sku-analysis             │
            ├─→ 08 profit-analysis          ├─→ 15 priority-actions
            ├─→ 09 inventory-analysis       │    └─→ 16 sales-growth-plan
            ├─→ 10 ad-analysis              │         └─→ 19 90day-plan
            ├─→ 11 seo-analysis             │              └─→ 21 wbs-generator
            ├─→ 12 competitor-analysis      │
            ├─→ 13 review-voc-analysis ─────┤
            └─→ 14 crm-analysis ────────────┘
```

---

## チャネル別処理ルール

```
CORE ANALYSIS（共通）
├── metric-calculator（共通KPI計算）
├── kpi-diagnosis（共通分解ロジック）
└── profit-analysis（共通利益計算）

+ CHANNEL RULES（チャネル固有）
├── docs/channels/rakuten.md
├── docs/channels/amazon.md
├── docs/channels/tiktok-shop.md
└── docs/channels/yahoo-shopping.md
```

---

## データ保存ルール

| データ種別 | 保存場所 | Git管理 |
|-----------|----------|---------|
| 生データ（CSV） | clients/{client}/data/raw/ | ❌ .gitignoreで除外 |
| 加工済みデータ | clients/{client}/data/processed/ | ❌ .gitignoreで除外 |
| 分析レポート | clients/{client}/analysis/ | ✅ |
| 実行計画 | clients/{client}/plans/ | ✅ |
| レポート | clients/{client}/reports/ | ✅ |
| ナレッジDB | knowledge/ | ✅ |
| Skill定義 | .claude/skills/ | ✅ |

---

## 自動化レベル定義

| Level | 定義 | 人間の役割 |
|-------|------|-----------|
| L1 | AIが下書きを作る | 人間が修正・完成させる |
| L2 | AIが分析して提案する | 人間が承認する |
| L3 | AIが実行準備まで行う | 人間が承認してから実行 |
| L4 | AIが自動実行する | 人間は結果のみ確認 |

**L4禁止操作：** 価格変更 / 広告予算変更 / 商品公開 / 顧客への送信 / 契約 / 外部システムへの重要変更
