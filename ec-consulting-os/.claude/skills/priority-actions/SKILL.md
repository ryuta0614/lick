---
name: priority-actions
description: |
  複数の分析レポートを統合し、今やるべき施策を最大5つに絞って優先順位付けする。
  施策を大量列挙しない。担当・期限・KPIまで明確にして出力する。
---

# Skill: priority-actions

## Purpose
「やった方がいいこと」ではなく「今やるべきこと」を決める。
全分析結果を統合して、最大5つの優先施策に絞る。

## Trigger
- 「優先施策を決めて」
- 「何から手をつければいい？」
- monthly-reviewの前に自動実行

## Required Inputs
- kpi-report.md（05の出力）
- 少なくとも1つ以上の分析レポート（sku/profit/ad/inventory等）

## Optional Inputs
- gap-report.md
- competitor-report.md
- voc-report.md
- 前回のactions.json（継続施策の確認用）

## Validation
- kpi-report.mdが存在するか
- ACTIONセクションが含まれているか

## Analysis Steps
1. 全分析レポートのACTIONセクションを収集
2. 重複・類似施策をマージ
3. 各施策を Impact × Confidence × Speed ÷ Effort でスコアリング
4. P0（在庫欠品・クレーム関連）を最優先に昇格
5. 上位5つを選定
6. 各施策に担当・期限・期待KPIを付与
7. 残りの施策はバックログへ格納

## Decision Rules
- 施策は最大5つ。6つ目以降は無条件でバックログへ
- 在庫欠品リスクは自動P0
- 顧客クレーム関連は自動P0
- 前回アクションで「継続中」のものは新規カウントしない

## Output Contract
### 必須出力（actions.json + actions.md）

actions.md（人間向け）:
```markdown
# 優先施策リスト

**対象期間：** {period}
**作成日：** {created_at}

## P0：今週中に着手

### 施策1：{title}
- **背景：** {background}
- **担当：** {owner}
- **期限：** {deadline}
- **成果物：** {deliverable}
- **KPI：** {kpi}
- **期待インパクト：** {expected_impact}

## P1：今月中に着手

...

## バックログ（今月は着手しない）
- {action_x}：{reason_for_backlog}
```

## Missing Data Behavior
- 分析レポートが1つしかない場合 → 「利用可能なレポートのみから判断。他の分析実施後に再評価推奨」と明記
- 担当者が不明 → 「担当：TBD（要確認）」と記載

## Human Review
- 5つに絞られた施策が「本当に今やるべきこと」かを確認
- 期待インパクトが過大・過小でないか確認
- 担当者のキャパシティと照合する

## Test
### 正常系
- 10個のアクション候補 → 5つ選定されてバックログに5つ格納される
- P0条件（在庫欠品）がある → 必ずP0に入る

### 異常系
- アクション候補が3つ以下 → 3つ全てを出力し「追加分析を推奨」と明記
