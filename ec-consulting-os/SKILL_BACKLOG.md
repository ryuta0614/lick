# Skill Backlog

## 凡例

- **Status:** `draft` / `in_progress` / `done` / `tested`
- **Priority:** P0（最優先）〜 P3（後回し）

---

## PHASE 1 — ECコンサルティング基本ループ

| ID | Skill | Purpose | Key Inputs | Key Outputs | Dependency | Priority | Phase | Status |
|----|-------|---------|------------|-------------|------------|----------|-------|--------|
| 01 | client-context | 顧客情報・目標・契約範囲・商品・利益・体制を整理 | インタビューメモ / 既存資料 | client.json / context.md | なし | P0 | 1 | draft |
| 02 | data-audit | 提供データの有無・欠損・期間・粒度・信頼性を確認 | CSVリスト / データサンプル | data-audit-report.md | 01 | P0 | 1 | draft |
| 03 | data-normalizer | CSV・Excel等のデータを共通形式へ変換 | 生CSV | processed CSV | 02 | P1 | 1 | draft |
| 04 | metric-calculator | 主要KPIを統一定義で計算 | processed CSV | metrics.json | 03 | P0 | 1 | draft |
| 05 | kpi-diagnosis | 売上・アクセス・CVR・客単価を分解 | metrics.json | kpi-report.md | 04 | P0 | 1 | draft |
| 06 | growth-gap-analysis | 目標との差と必要成長率を算出 | metrics.json / targets | gap-report.md | 04, 05 | P1 | 1 | draft |
| 07 | sku-analysis | 商品・SKU単位で分析・分類 | SKU別CSV | sku-report.md | 04 | P0 | 1 | draft |
| 08 | profit-analysis | 粗利・広告・値引・送料等を考慮した利益分析 | metrics.json / ad CSV | profit-report.md | 04 | P0 | 1 | draft |
| 09 | inventory-analysis | 在庫状態を分類し施策へ接続 | 在庫CSV | inventory-report.md | 04 | P0 | 1 | draft |
| 10 | ad-analysis | 広告を増額・維持・改善・停止まで判断 | 広告CSV | ad-report.md | 04, 08 | P0 | 1 | draft |
| 11 | seo-analysis | 検索キーワード・順位等を分析 | 検索データCSV | seo-report.md | 04 | P1 | 1 | draft |
| 12 | competitor-analysis | 競合との差を施策へ変換 | 競合調査データ | competitor-report.md | 05 | P1 | 1 | draft |
| 13 | review-voc-analysis | レビューから顧客インサイトを抽出 | レビューCSV / テキスト | voc-report.md | なし | P1 | 1 | draft |
| 14 | crm-analysis | 新規・既存・リピートを分析 | 購買履歴CSV | crm-report.md | 04 | P1 | 1 | draft |
| 15 | priority-actions | 課題から優先施策を決定（最大5つ） | 各分析レポート | actions.json | 05〜14 | P0 | 1 | draft |

---

## PHASE 2 — 戦略立案

| ID | Skill | Purpose | Key Inputs | Key Outputs | Dependency | Priority | Phase | Status |
|----|-------|---------|------------|-------------|------------|----------|-------|--------|
| 16 | sales-growth-plan | 売上目標達成施策を組み立てる | gap-report / actions | growth-plan.md | 06, 15 | P0 | 2 | draft |
| 17 | profit-growth-plan | 利益改善施策を組み立てる | profit-report / actions | profit-plan.md | 08, 15 | P0 | 2 | draft |
| 18 | promotion-plan | 月間販促計画を作成 | カレンダー / 在庫 / 予算 | promotion-plan.md | 09, 15 | P1 | 2 | draft |
| 19 | 90day-plan | 90日実行計画を作成 | actions / growth-plan | 90day-plan.md | 15, 16 | P0 | 2 | draft |
| 20 | channel-strategy | チャネル別役割を整理 | 各チャネルデータ | channel-strategy.md | 05〜14 | P1 | 2 | draft |

---

## PHASE 3 — 実行支援

| ID | Skill | Purpose | Key Inputs | Key Outputs | Dependency | Priority | Phase | Status |
|----|-------|---------|------------|-------------|------------|----------|-------|--------|
| 21 | wbs-generator | 施策を実行WBS化 | actions / 90day-plan | wbs.csv | 15, 19 | P0 | 3 | draft |
| 22 | lp-improvement | 商品ページ改善案を作成 | 現状LP / voc-report | lp-improvement.md | 13 | P1 | 3 | draft |
| 23 | creative-brief | デザイン制作指示書を作成 | lp-improvement / voc | creative-brief.md | 13, 22 | P1 | 3 | draft |
| 24 | ad-brief | 広告運用指示を作成 | ad-report / growth-plan | ad-brief.md | 10, 16 | P1 | 3 | draft |
| 25 | crm-plan | CRM施策・配信計画を作成 | crm-report / promotion | crm-plan.md | 14, 18 | P2 | 3 | draft |

---

## PHASE 4 — レポーティング・ナレッジ

| ID | Skill | Purpose | Key Inputs | Key Outputs | Dependency | Priority | Phase | Status |
|----|-------|---------|------------|-------------|------------|----------|-------|--------|
| 26 | weekly-review | 週次結果→原因→翌週施策 | 週次データ | weekly-report.md | 04, 05 | P1 | 4 | draft |
| 27 | monthly-review | 月次結果→原因→翌月施策 | 月次データ / 全分析 | monthly-report.md | 05〜15 | P0 | 1 | draft |
| 28 | meeting-prep | 顧客MTG資料を準備 | monthly-report / actions | meeting-deck.md | 27 | P0 | 4 | draft |
| 29 | meeting-minutes | 議事録→TODO→CRM情報を整理 | MTGメモ | minutes.md | なし | P0 | 4 | draft |
| 30 | executive-review | 現在地/ボトルネック/改革/90日/STOP-START-DECISION | 全分析 | exec-report.md | 05〜19 | P1 | 4 | draft |
| 31 | case-capture | 成功・失敗施策をDB化 | 施策結果 / 人間メモ | case.json | なし | P1 | 4 | draft |
| 32 | case-search | 過去事例を検索 | 検索クエリ | 関連case一覧 | 31 | P1 | 4 | draft |
| 33 | human-feedback-capture | 人間による修正を判断ルール化 | 修正前後の差分 | decision-pattern.md | なし | P0 | 4 | draft |

---

## 完成条件チェックリスト（全Skillに適用）

- [ ] SKILL.mdが存在する
- [ ] Triggerが明確
- [ ] Required Inputsの定義がある
- [ ] Output Contractの定義がある
- [ ] 判断基準（Decision Rules）がある
- [ ] 欠損データ処理（Missing Data Behavior）がある
- [ ] サンプル入力がある
- [ ] サンプル出力がある
- [ ] テストデータがある
- [ ] テストを実行した
- [ ] 意図した結果が出る
- [ ] 他Skillと重複していない
- [ ] README.mdへ登録した
