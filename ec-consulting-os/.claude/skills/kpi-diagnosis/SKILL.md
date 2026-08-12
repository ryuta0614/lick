---
name: kpi-diagnosis
description: |
  売上・アクセス・CVR・客単価を分解し、問題の所在を特定して施策候補まで出力する。
  「売上 = アクセス × CVR × 客単価」の基本式に基づいてボトルネックを診断する。
---

# Skill: kpi-diagnosis

## Purpose
数字を読み上げるのではなく、**なぜその数字になったか**を分解し、
**どこに手を打つべきか**まで示す。

## Trigger
- 「今月の売上を分析して」
- 「売上が落ちている原因を調べて」
- 「KPIレポートを作って」
- monthly-reviewの前に自動実行

## Required Inputs
- metrics.json（metric-calculatorの出力）
- 対象期間（年月）

## Optional Inputs
- 前月・前年同月のmetrics.json
- 目標値（client.json）
- チャネル別データ

## Validation
- metrics.jsonにSALES, ACCESS, CVR, AOVが含まれているか
- 対象期間のデータが存在するか

## Analysis Steps
1. 売上を アクセス × CVR × 客単価 に分解
2. 前月比・前年比・目標比で各要素を評価
3. 最も大きく変化した要素を特定
4. 変化した要素の原因ツリーを展開（docs/principles/consulting-principles.md参照）
5. FACT / INFERENCE / HYPOTHESIS / ACTION に整理
6. 寄与度分析（売上変化のうち何%がアクセス変化によるものか等）

## Decision Rules
- 前月比で5%以上の変化がある要素を「要調査」とマークする
- アクセス・CVR・客単価のうち2つ以上が悪化している場合は「複合要因」と判定
- 前年比が確認できない場合は「季節性不明」と明記

## Output Contract
### 必須出力（kpi-report.md）

```markdown
# KPI診断レポート

## サマリー（3行以内）
{今月最も重要なことを3行で}

## 売上分解

| 要素 | 前月 | 今月 | 前月比 | 寄与度 |
|------|------|------|--------|--------|
| アクセス | | | | |
| CVR | | | | |
| 客単価 | | | | |
| 売上 | | | | |

## FACT
{データから確認できる事実のみ}

## INFERENCE
{事実から推測できること}

## HYPOTHESIS
{まだ検証できていない原因仮説}

## ACTION（優先順位順）
1. {アクション1：担当・期限付き}
2. {アクション2}
```

## Missing Data Behavior
- 前月データがない場合：前月比を「-」として前年比・目標比のみで判断
- チャネル別データがない場合：合計値で分析し「チャネル別データがあればより精度が上がる」と明記

## Human Review
- HYPOTHESISが多すぎる（3つ以上）場合は優先順位をつけて絞る
- ACTIONが「検討する」「強化する」などの曖昧表現になっていないか確認

## Example

### Input
```json
{
  "period": "2026-07",
  "SALES": 4500000,
  "ORDERS": 300,
  "AOV": 15000,
  "ACCESS": 30000,
  "CVR": 1.0,
  "prev_month": {
    "SALES": 5000000,
    "ACCESS": 35000,
    "CVR": 1.1,
    "AOV": 13000
  }
}
```

### Output（抜粋）
```
## サマリー
今月の売上は450万円（前月比-10%）。
主な要因はアクセス減（-14%）で、寄与度は約60%。
CVRも微減（-9%）しており複合要因。客単価は+15%と好調。

## FACT
- アクセス: 35,000→30,000（-14%）
- CVR: 1.1%→1.0%（-9%）
- 客単価: 13,000→15,000（+15%）

## HYPOTHESIS
- RPP広告の予算不足によりアクセスが減少した可能性
- 価格変更が客単価上昇とCVR低下の両方に影響した可能性
```

## Test
### 正常系
- metrics.jsonが揃っている場合 → 全項目を含むkpi-report.mdが出力される
- 前月比が5%以内の場合 → 「大きな変化なし」と明記した上でサマリーを生成

### 異常系
- metrics.jsonにCVRが欠損 → 「CVRデータ不足のため計算不可。ACCESS÷ORDERSで代替計算」と明記
