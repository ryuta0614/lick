# EC Consulting OS — CLAUDE.md

## プロジェクト目的

ECコンサルタントが日々行う「データ取得・分析・課題発見・競合調査・施策立案・制作指示・実行管理・効果検証・顧客報告」を可能な限り自動化する。

AIが調査・集計・分析・仮説・施策案・資料・制作指示・WBSまで準備し、人間のコンサルタントは「判断」「顧客との対話」「優先順位決定」「最終意思決定」に集中する。

---

## 基本思想

業務は固定プロセスで処理する：

**INPUT → DATA CHECK → ANALYSIS → DIAGNOSIS → DECISION → ACTION → EXECUTION → VALIDATION → KNOWLEDGE**

---

## 判断原則

1. **売上だけを追わない** — 粗利・限界利益・在庫効率まで確認する
2. **ROASが高い＝良い施策とは判断しない** — 利益・在庫・商品戦略を統合して判断する
3. **数字を説明して終わらない** — 必ず「事実→原因→課題→施策→担当→期限→KPI」まで落とす
4. **施策を大量列挙しない** — 重要施策は最大5つ、優先順位は `Impact × Confidence × Speed ÷ Effort`
5. **事実と仮説を分離する** — FACT / INFERENCE / HYPOTHESIS / ACTION を明確に区別する
6. **捏造禁止** — データ不足の場合は「現時点で言えること＋追加で必要なデータ」を出す
7. **90日を基本単位とする** — 曖昧な表現（「強化する」「検討する」）は禁止
8. **人間承認を必ず残す操作** — 価格変更・広告予算変更・商品公開・顧客への送信・契約

---

## ファイル構造

```
ec-consulting-os/
├── CLAUDE.md               # このファイル（基本思想のみ）
├── docs/principles/        # コンサルティング原則
├── docs/metrics/           # 指標定義（Metric Dictionary）
├── docs/rules/             # 判断ルール
├── docs/channels/          # チャネル別ルール
├── schemas/                # データスキーマ定義
├── templates/              # アウトプットテンプレート
├── knowledge/              # 蓄積ナレッジ
├── clients/                # 顧客別データ・分析
├── .claude/skills/         # 各Skill定義
├── scripts/                # 自動化スクリプト
└── tests/                  # テストデータ・テストケース
```

詳細な手順はSkillsまたはdocsに記載する。このファイルには書かない。

---

## データの扱い

- 生データは `clients/{client}/data/raw/` に保存
- 加工済みデータは `clients/{client}/data/processed/` に保存
- 個人情報・価格・在庫などの機密データはGitにコミットしない（.gitignoreで除外）

---

## Skill利用方針

- 各Skillは「特定の反復業務を1つ完結させる」単位で設計する
- Skillは独立して動作し、他Skillへの依存は入出力インターフェースのみで行う
- Skillの完成条件は `SKILL_BACKLOG.md` の「完成条件チェックリスト」に従う

---

## 出力品質基準

すべての分析・提案は以下に答えられること：

- **So What?** — だから何が問題か
- **Why?** — なぜそうなっているか
- **What Next?** — 次に何をするか
- **Who?** — 誰がやるか
- **When?** — いつまでか
- **How Much Impact?** — どれくらい改善するか
