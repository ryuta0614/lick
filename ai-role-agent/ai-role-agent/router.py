"""
ルーターモジュール
依頼内容を分析し、適切な役割（複数可）を返す
"""

import anthropic
import json
import re

ROUTER_SYSTEM_PROMPT = """あなたは業務依頼の内容を分析し、最適な専門家役割を選ぶルーターです。

以下の6つの役割から、依頼に最も適切なものを1つ以上選んでください。
複数の役割が必要な場合は複数選択してください（最大3つまで）。

役割一覧:
- ec_report    : ECレポート自動化エンジニア（売上・在庫・広告データの集計・レポート化）
- ec_proposal  : EC提案書生成ディレクター（EC戦略・商品ページ・広告施策の提案書作成）
- tts_ops      : TTS運営自動化スペシャリスト（TikTok Shop運営・自動化・コンテンツ管理）
- ai_pm        : AI業務改善PM（AI導入計画・業務フロー改善・ROI試算・プロジェクト管理）
- finance_pl   : 財務・PLシミュレーションエンジニア（P/Lモデル・シナリオ分析・収益予測）
- rag_sop      : 社内ナレッジRAG / SOP設計者（ナレッジベース設計・SOP作成・RAG構築）

以下のJSON形式のみで回答してください（他のテキストは一切含めないこと）:
{
  "roles": ["role_key1", "role_key2"],
  "reasoning": "選定理由を1〜2文で説明"
}"""


def route_request(user_request: str) -> tuple[list[str], str]:
    """
    依頼内容を分析して適切な役割リストと判定理由を返す

    Returns:
        (roles, reasoning): 役割キーのリストと判定理由
    """
    client = anthropic.Anthropic()

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        system=ROUTER_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"以下の依頼に対して適切な役割を選んでください:\n\n{user_request}",
            }
        ],
    )

    raw = response.content[0].text.strip()

    # JSONをパース（コードブロックがあれば除去）
    clean = re.sub(r"```(?:json)?|```", "", raw).strip()
    result = json.loads(clean)

    roles = result.get("roles", ["ai_pm"])
    reasoning = result.get("reasoning", "内容から判定しました")

    # 存在しない役割キーを除外
    valid_keys = {"ec_report", "ec_proposal", "tts_ops", "ai_pm", "finance_pl", "rag_sop"}
    roles = [r for r in roles if r in valid_keys]

    # フォールバック
    if not roles:
        roles = ["ai_pm"]
        reasoning = "判定できなかったため、AI業務改善PMがデフォルトで対応します"

    return roles, reasoning
