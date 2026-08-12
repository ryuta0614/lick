---
name: client-context
description: |
  顧客情報・目標・契約範囲・商品・ターゲット・利益・体制を整理し、
  全Skillが参照する標準顧客コンテキスト（client.json）を作成する。
  新規顧客開始時・情報更新時に使用する。
---

# Skill: client-context

## Purpose
顧客の基本情報を構造化し、全Skillの分析精度を高める。
「誰のために・何のために・どんな制約の中で」コンサルティングするかを明確にする。

## Trigger
- 新規顧客の契約開始時
- 顧客情報が変更された時（商品追加・目標変更・チャネル追加等）
- 「顧客情報を整理して」「コンテキストを更新して」という依頼

## Required Inputs
- 顧客名・会社名
- 取り扱いチャネル（楽天/Amazon/TikTok Shop等）
- 月次売上目標
- 主力商品・カテゴリ

## Optional Inputs
- 粗利率・目標限界利益率
- 競合情報
- 体制（担当者・決裁者）
- 過去の施策・失敗経験
- 在庫閾値・広告目標ROAS

## Validation
- client_idがディレクトリ名と一致しているか
- channelsが許可リスト内か（rakuten/amazon/yahoo/tiktok_shop/own_ec/other）
- monthly_sales targetが数値か

## Analysis Steps
1. インプットを `schemas/client.schema.json` に照合
2. 不足項目をリストアップ（OPEN_QUESTIONS）
3. client.json を生成
4. context.md（人間向け要約）を生成
5. 不足データがある場合は「現時点で設定した仮値」と「要確認項目」を明記

## Decision Rules
- 粗利率・目標ROASが不明な場合はデフォルト値（docs/rules/profit-rules.md）を使用し、仮値と明記する
- 在庫閾値が不明な場合は docs/rules/inventory-rules.md のデフォルト値を使用

## Output Contract
### 必須出力
- `clients/{client_id}/context/client.json`（スキーマ準拠）
- `clients/{client_id}/context/context.md`（人間向けサマリー）

### context.md の必須項目
- 顧客概要
- チャネル一覧と役割
- 月次目標（売上・粗利）
- 主力商品TOP5
- 体制（担当者・決裁者）
- 重要な制約・NG事項
- OPEN_QUESTIONS（不足情報）

## Missing Data Behavior
データが不足している場合：
1. 分析を止めない
2. 仮値を設定して進める（「仮：」と明記）
3. OPEN_QUESTIONS.md に追記する

## Human Review
- 目標数値の妥当性を確認（高すぎ・低すぎ）
- NG事項・制約が抜けていないか確認
- 決裁者情報が正確か確認

## Example

### Input
```
顧客名：株式会社ほにゃらら
チャネル：楽天市場、Amazon
主力商品：美容液（5,000円）、クリーム（3,000円）
月次売上目標：楽天500万、Amazon300万
粗利率：40%
担当者：田中様
```

### Output（client.json 抜粋）
```json
{
  "client_id": "honyarara",
  "company_name": "株式会社ほにゃらら",
  "channels": ["rakuten", "amazon"],
  "targets": {
    "monthly_sales": 8000000,
    "gross_margin_min": 40
  },
  "config": {
    "target_roas": 400,
    "dead_stock_days": 180
  }
}
```

## Test
### 正常系
- 必須項目が揃っている場合 → client.json と context.md が生成される
- オプション項目が一部ない場合 → デフォルト値で補完・OPEN_QUESTIONSに記載

### 異常系
- channelsに不正値 → エラーメッセージ＋許可リストを表示
- 売上目標が0または負値 → 警告を出して確認を促す
