---
name: monthly-review
description: |
  月次の分析結果を統合し、顧客向け月次レビューレポートを作成する。
  数字の読み上げではなく「事実→原因→施策→担当→期限」まで落とした報告書を生成する。
---

# Skill: monthly-review

## Purpose
顧客MTGで使える月次レポートを自動生成する。
「そのアウトプットを受け取った人が次に何をすればいいか迷わない」品質を目指す。

## Trigger
- 「月次レポートを作って」
- 「月次レビューを作成して」
- 毎月末に自動実行推奨

## Required Inputs
- metrics.json（当月・前月）
- kpi-report.md
- actions.json（priority-actionsの出力）

## Optional Inputs
- profit-report.md
- sku-report.md
- ad-report.md
- inventory-report.md
- 前月のactions.json（前回決定事項の進捗確認用）

## Validation
- metrics.jsonの当月データが存在するか
- kpi-report.mdが存在するか
- actions.jsonが存在するか

## Analysis Steps
1. 前回決定事項の進捗を確認（前月のactions.jsonと照合）
2. KPIサマリーを生成（目標比・前月比・前年比）
3. 今月最大の変化を1〜3つ抽出
4. 売上分解（アクセス×CVR×客単価）と寄与度を計算
5. FACT / INFERENCE / HYPOTHESIS を整理
6. 来月の優先施策（actions.jsonから転記）
7. 顧客に決めてもらうことを明示
8. リスクを記載

## Decision Rules
- 「検討する」「強化する」などの曖昧表現を検出した場合は置き換えを促す
- 施策は最大5つ（actions.jsonの上位5つをそのまま使用）
- 顧客に決めてもらうことは1〜3つに絞る

## Output Contract
### 必須出力（monthly-report.md）
templates/monthly-review.md のフォーマットに準拠。

必須セクション：
1. 前月決定事項の進捗
2. KPIサマリー
3. 最大の変化（最大3つ）
4. 売上分解と寄与度
5. FACT / INFERENCE / HYPOTHESIS
6. 来月の優先施策（最大5つ・担当・期限付き）
7. 顧客に決めてもらうこと
8. リスク

## Missing Data Behavior
- 前月データがない場合 → 前月比を「-」とし前年比・目標比のみで作成
- 利益データがない場合 → 売上・アクセス・CVR・客単価のみで作成し「利益データが提供されれば粗利分析を追加可能」と明記

## Human Review
- 「顧客に決めてもらうこと」が具体的かつ決裁可能な形式になっているか
- リスクが過大・過小でないか
- 担当・期限が現実的か

## Example

### Output（抜粋）
```markdown
# 月次レビューレポート
**対象月：** 2026年7月

## 0. 前月決定事項の進捗
| 施策 | 担当 | 期限 | 状況 | 結果 |
| RPP広告増額 | 田中 | 7/15 | ✅完了 | CVR+5% |

## 2. 今月最大の変化
### 変化1：アクセスが前月比-14%と大幅低下
- 事実：アクセス35,000→30,000（-14%）
- 原因：RPP予算を6月末に削減したため検索流入が減少
- 影響：売上-45万円の寄与度60%を占める

## 6. 来月の優先施策
| 優先度 | 施策 | 担当 | 期限 | KPI |
| P0 | RPP予算を月30万→50万に増額 | 田中 | 8/5 | CVR 1.2%以上 |
```

## Test
### 正常系
- 全データが揃っている → 全セクションが含まれたmonthly-report.mdが生成
- 前月比-20%以上の変化がある → 「最大の変化」セクションが詳細に展開される

### 異常系
- actions.jsonが存在しない → 「priority-actionsを先に実行してください」と出力
