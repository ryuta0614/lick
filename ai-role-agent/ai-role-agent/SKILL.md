---
name: ai-role-agent
description: |
  業務依頼の内容を自動分析し、最適な専門家役割（複数可）に振り分けてCLI上で回答するエージェントスキル。
  対応役割: ECレポート自動化エンジニア、EC提案書生成ディレクター、TTS運営自動化スペシャリスト、
  AI業務改善PM、財務・PLシミュレーションエンジニア、社内ナレッジRAG / SOP設計者。

  ユーザーが「AIに業務を依頼したい」「役割を自動で選んで回答してほしい」「CLIで使いたい」
  「EC・財務・TikTok・RAG・業務改善などの専門的な依頼をしたい」と言った場合にこのスキルを使う。
  Claude Codeのターミナル上での実行を前提とする。
---

# AI役割ルーターエージェント

## 概要

ユーザーの業務依頼を自動分析し、最適な専門家役割（複数可）を選定。
選ばれた役割のシステムプロンプトを統合してClaudeに与え、専門的な回答をストリーミングで返すCLIツール。

---

## ディレクトリ構成

```
ai-role-agent/
├── SKILL.md          # このファイル
├── agent.py          # メインCLIエントリーポイント
├── router.py         # 依頼→役割マッピングロジック（Claude APIで自動判定）
└── roles/            # 各役割のシステムプロンプト
    ├── ec_report.md      # ECレポート自動化エンジニア
    ├── ec_proposal.md    # EC提案書生成ディレクター
    ├── tts_ops.md        # TTS運営自動化スペシャリスト
    ├── ai_pm.md          # AI業務改善PM
    ├── finance_pl.md     # 財務・PLシミュレーションエンジニア
    └── rag_sop.md        # 社内ナレッジRAG / SOP設計者
```

---

## セットアップ

```bash
pip install anthropic
export ANTHROPIC_API_KEY=your_api_key_here
```

---

## 使い方

### インタラクティブモード（対話式）
```bash
python agent.py
```

### 引数モード（ワンライナー）
```bash
python agent.py "楽天の先月売上レポートと来月の広告予算提案を作りたい"
```

---

## 動作フロー

```
1. ユーザーが依頼を入力
       ↓
2. router.py が Claude API で役割を自動判定（複数可）
       ↓
3. 選ばれた役割の roles/*.md を読み込みシステムプロンプトを構築
       ↓
4. Claude API にストリーミングで問い合わせ
       ↓
5. ターミナルに回答をリアルタイム出力
```

---

## 役割の自動判定ルール

| キーワード例 | 判定される役割 |
|---|---|
| 売上レポート・在庫・広告データ集計 | ec_report |
| 提案書・施策立案・競合分析・CVR改善 | ec_proposal |
| TikTok Shop・ライブ配信・TTS | tts_ops |
| AI導入・業務改善・PoC・ROI試算 | ai_pm |
| P/L・シミュレーション・収益予測・財務 | finance_pl |
| RAG・SOP・ナレッジベース・手順書 | rag_sop |

複数のキーワードが混在する場合は複数役割が選ばれ、統合回答が生成される。

---

## 役割プロンプトのカスタマイズ

`roles/` 配下のMarkdownファイルを直接編集することで、各役割の振る舞いを調整できる。
新しい役割を追加する場合は：
1. `roles/` に新しい `.md` ファイルを追加
2. `agent.py` の `ROLE_FILES` と `ROLE_NAMES` に追記
3. `router.py` の `ROUTER_SYSTEM_PROMPT` の役割一覧に追記
