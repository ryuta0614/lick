#!/usr/bin/env python3
"""
EC Consulting OS — AI分析深化スクリプト
report_data.json の analysis セクションを Claude API で強化する。
使い方: python enrich_analysis.py <report_data.json のパス>
"""

import json
import os
import sys
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("❌ anthropic がインストールされていません。")
    print("   pip install anthropic")
    sys.exit(1)

# .env ファイルから環境変数を読み込む（python-dotenv 不要の軽量実装）
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    with open(_env_path, encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())


SYSTEM_PROMPT = """あなたはECコンサルタントです。
楽天市場の月次KPIデータを受け取り、以下の3点を日本語で出力してください。

出力形式：必ずJSON形式のみ。余分なテキスト不要。
{
  "facts": ["事実1", "事実2", ...],
  "hypotheses": ["仮説1（確認方法付き）", "仮説2", ...],
  "actions": [
    {
      "priority": "P0",
      "title": "施策タイトル",
      "deadline": "期限",
      "items": ["具体的アクション1", "アクション2", ...]
    }
  ]
}

## 出力ルール
- facts: データが確実に示す事実のみ。5〜8件。推測を含めない。
- hypotheses: 数字から読み取れる仮説。確認方法を「→ ～を確認」形式で含める。3〜5件。
- actions: 最大5施策。P0=今週中、P1=今月中、P2=来月。
  - Impact × Confidence × Speed ÷ Effort で優先順位付け
  - 担当・期限・具体的アクションを必ず含める
  - 「強化する」「検討する」などの曖昧表現禁止
"""


def build_user_message(data: dict) -> str:
    kpi = data["kpi"]
    skus = data["skus"]
    meta = data["meta"]

    lines = [
        f"## 顧客：{meta['client']}　期間：{meta['period']}　チャネル：{meta['channel']}",
        "",
        "## KPI（前月比）",
        f"- 売上：¥{kpi['cur']['sales']:,}（前月比{kpi['mom']['sales']:+.1f}%、¥{kpi['sales_diff']:+,}）",
        f"- 注文件数：{kpi['cur']['orders']}件（前月比{kpi['mom']['orders']:+.1f}%）",
        f"- 客単価：¥{kpi['cur']['aov']:,}（前月比{kpi['mom']['aov']:+.1f}%）",
        f"- アクセス：{kpi['cur']['access']:,}人（前月比{kpi['mom']['access']:+.1f}%、前年比{kpi.get('access_yoy_pct', 0):+.1f}%）",
        f"- CVR：{kpi['cur']['cvr']:.2f}%（前月比{kpi['mom']['cvr']:+.1f}%）",
        f"- TOP3商品集中度：{kpi['top3_share']}%",
        "",
        "## SKU別売上 TOP10（前月比付き）",
    ]

    for i, sku in enumerate(skus[:10], 1):
        mom_str = f"{sku['mom']:+.1f}%" if sku.get("mom") is not None else "新規"
        lines.append(
            f"  {i}. {sku['id']}（{sku['name']}）"
            f" ¥{sku['sales']:,} 構成比{sku['share']}% 前月比{mom_str} {sku['qty']}個 単価¥{sku['price']:,}"
        )

    return "\n".join(lines)


def enrich(json_path: str) -> None:
    path = Path(json_path)
    if not path.exists():
        print(f"❌ ファイルが見つかりません: {json_path}")
        sys.exit(1)

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ 環境変数 ANTHROPIC_API_KEY が設定されていません。")
        print("   set ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    user_msg = build_user_message(data)

    print("🤖 Claude APIで分析中...")

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text.strip()

    # JSONブロック抽出（```json ... ``` や JSON後の補足テキストにも対応）
    if raw.startswith("```"):
        lines = raw.splitlines()
        # 最初の ``` 行と最後の ``` 行を除去
        inner = "\n".join(lines[1:])
        end = inner.find("```")
        raw = inner[:end].strip() if end != -1 else inner.strip()

    # { ... } の範囲だけを抽出（JSON後に補足テキストが続く場合に対応）
    start = raw.find("{")
    if start != -1:
        depth = 0
        for i, ch in enumerate(raw[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    raw = raw[start:i + 1]
                    break

    try:
        enriched = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"❌ Claude の返答がJSONではありませんでした:\n{raw[:500]}")
        print(f"   エラー: {e}")
        sys.exit(1)

    # 必須キーの検証
    for key in ("facts", "hypotheses", "actions"):
        if key not in enriched:
            print(f"❌ Claude の返答に '{key}' がありません")
            sys.exit(1)

    data["analysis"] = enriched
    data["analysis"]["enriched_by"] = "claude-haiku-4-5-20251001"

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ 分析強化完了: {path}")
    print(f"   FACT: {len(enriched['facts'])}件")
    print(f"   仮説: {len(enriched['hypotheses'])}件")
    print(f"   施策: {len(enriched['actions'])}件")
    print(f"\n次のステップ:")
    print(f"  node generate_report_pptx.js \"{path}\"")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        base = r"C:\Users\ryuta\Downloads\ec_consulting_reports"
        default = f"{base}\\report_data.json"
        json_path = input(f"report_data.json のパス（Enter={default}）: ").strip() or default
    else:
        json_path = sys.argv[1]

    enrich(json_path)
