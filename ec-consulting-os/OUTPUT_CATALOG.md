# Output Catalog

各Skillが生成するアウトプットの一覧。

---

| Output名 | 生成Skill | 利用者 | 利用タイミング | 主なInput | 主なAnalysis | 次に利用するSkill |
|----------|-----------|--------|---------------|-----------|-------------|-----------------|
| client.json | client-context(01) | 全Skill | 契約開始時 / 更新時 | インタビューメモ | 顧客情報構造化 | data-audit |
| data-audit-report.md | data-audit(02) | コンサルタント | データ受領時 | CSVリスト | データ品質チェック | data-normalizer |
| processed CSV | data-normalizer(03) | metric-calculator | データ受領後 | 生CSV | 形式統一・クレンジング | metric-calculator |
| metrics.json | metric-calculator(04) | 全分析Skill | 毎月データ更新後 | processed CSV | KPI計算 | kpi-diagnosis, sku-analysis等 |
| kpi-report.md | kpi-diagnosis(05) | コンサルタント / 顧客 | 月次 | metrics.json | 売上=アクセス×CVR×客単価分解 | priority-actions, monthly-review |
| gap-report.md | growth-gap-analysis(06) | コンサルタント | 月次 | metrics.json / 目標 | 目標差・必要成長率 | sales-growth-plan |
| sku-report.md | sku-analysis(07) | コンサルタント | 月次 | SKU別CSV | SKU分類・成長/撤退判断 | priority-actions, inventory-analysis |
| profit-report.md | profit-analysis(08) | コンサルタント | 月次 | metrics.json / 広告CSV | 限界利益計算・施策評価 | priority-actions, ad-analysis |
| inventory-report.md | inventory-analysis(09) | コンサルタント / 物流 | 週次 / 月次 | 在庫CSV | 在庫分類・施策接続 | priority-actions, promotion-plan |
| ad-report.md | ad-analysis(10) | コンサルタント / 広告担当 | 週次 / 月次 | 広告CSV | 広告判断（増額/継続/改善/停止） | priority-actions, ad-brief |
| seo-report.md | seo-analysis(11) | コンサルタント / SEO担当 | 月次 | 検索データCSV | キーワード・順位分析 | lp-improvement |
| competitor-report.md | competitor-analysis(12) | コンサルタント | 月次 | 競合調査データ | Gap分析・対抗施策 | priority-actions |
| voc-report.md | review-voc-analysis(13) | コンサルタント / クリエイター | 月次 | レビューCSV | インサイト抽出・マーケ資産化 | creative-brief, lp-improvement |
| crm-report.md | crm-analysis(14) | コンサルタント | 月次 | 購買履歴CSV | 新規/既存/リピート分析 | crm-plan, promotion-plan |
| actions.json | priority-actions(15) | 全Skill / コンサルタント | 月次 | 各分析レポート | 優先施策決定（最大5つ） | 90day-plan, wbs-generator, meeting-prep |
| growth-plan.md | sales-growth-plan(16) | コンサルタント / 顧客 | 月次 | gap-report / actions | 売上達成施策立案 | 90day-plan |
| profit-plan.md | profit-growth-plan(17) | コンサルタント / 顧客 | 月次 | profit-report / actions | 利益改善施策立案 | 90day-plan |
| promotion-plan.md | promotion-plan(18) | 運用担当 | 月次 | カレンダー / 在庫 | 月間販促設計 | wbs-generator |
| 90day-plan.md | 90day-plan(19) | コンサルタント / 顧客 | 四半期 | actions / growth-plan | 90日実行計画 | wbs-generator |
| channel-strategy.md | channel-strategy(20) | コンサルタント / 顧客 | 四半期 | 各チャネルデータ | チャネル役割整理 | 90day-plan |
| wbs.csv | wbs-generator(21) | 全担当者 | 施策確定後 | actions / 90day-plan | WBS変換 | 進捗管理 |
| lp-improvement.md | lp-improvement(22) | クリエイター / 運用担当 | 施策確定後 | LP現状 / voc-report | 改善指示生成 | creative-brief |
| creative-brief.md | creative-brief(23) | クリエイター / 外注 | 制作依頼時 | lp-improvement / voc | 制作指示書生成 | 制作実行 |
| ad-brief.md | ad-brief(24) | 広告担当 | 広告施策確定後 | ad-report / growth-plan | 広告運用指示 | 広告実行 |
| crm-plan.md | crm-plan(25) | CRM担当 | 月次 | crm-report / promotion | CRM施策設計 | メール配信等 |
| weekly-report.md | weekly-review(26) | コンサルタント | 週次 | 週次データ | 週次結果→来週施策 | 次週の実行 |
| monthly-report.md | monthly-review(27) | コンサルタント / 顧客 | 月次 | 全分析 | 月次総括 | meeting-prep |
| meeting-deck.md | meeting-prep(28) | コンサルタント | MTG前日 | monthly-report / actions | MTG資料生成 | MTG実施 |
| minutes.md | meeting-minutes(29) | コンサルタント | MTG後 | MTGメモ | 議事録・TODO・CRM情報 | wbs-generator |
| exec-report.md | executive-review(30) | 経営者 / 顧客経営層 | 月次 / 四半期 | 全分析 | 経営視点サマリー | 経営判断 |
| case.json | case-capture(31) | 全コンサルタント | 施策完了後 | 施策結果 | 事例DB化 | case-search |
| 検索結果 | case-search(32) | コンサルタント | 施策立案時 | 検索クエリ | 過去事例検索 | priority-actions |
| decision-pattern.md | human-feedback-capture(33) | 全コンサルタント | 人間修正時 | 修正前後の差分 | ルール化・一般化 | knowledge/decision-patterns/ |
