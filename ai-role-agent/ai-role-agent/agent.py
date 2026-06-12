#!/usr/bin/env python3
"""
AI役割ルーターエージェント
依頼内容を自動判定し、適切な役割のエージェントが協調して回答するCLIツール
"""

import anthropic
import sys
import os
from pathlib import Path
from router import route_request

ROLES_DIR = Path(__file__).parent / "roles"

ROLE_FILES = {
    "ec_report":   "ec_report.md",
    "ec_proposal": "ec_proposal.md",
    "tts_ops":     "tts_ops.md",
    "ai_pm":       "ai_pm.md",
    "finance_pl":  "finance_pl.md",
    "rag_sop":     "rag_sop.md",
}

ROLE_NAMES = {
    "ec_report":   "ECレポート自動化エンジニア",
    "ec_proposal": "EC提案書生成ディレクター",
    "tts_ops":     "TTS運営自動化スペシャリスト",
    "ai_pm":       "AI業務改善PM",
    "finance_pl":  "財務・PLシミュレーションエンジニア",
    "rag_sop":     "社内ナレッジRAG / SOP設計者",
}


def load_role_prompt(role_key: str) -> str:
    path = ROLES_DIR / ROLE_FILES[role_key]
    return path.read_text(encoding="utf-8")


def build_system_prompt(roles: list[str]) -> str:
    """選ばれた役割のプロンプトを結合してシステムプロンプトを構築"""
    if len(roles) == 1:
        header = f"あなたは以下の専門家として回答してください。\n\n"
    else:
        names = "・".join(ROLE_NAMES[r] for r in roles)
        header = (
            f"あなたは以下の複数の専門家が協調したチームとして回答してください。\n"
            f"担当役割: {names}\n"
            f"各専門家の視点を統合し、一つの統合された回答を提供してください。\n\n"
            f"---\n\n"
        )

    role_sections = []
    for role in roles:
        role_sections.append(load_role_prompt(role))

    return header + "\n\n---\n\n".join(role_sections)


def stream_response(system_prompt: str, user_request: str) -> None:
    """Anthropic APIをストリーミングで呼び出し、逐次出力"""
    client = anthropic.Anthropic()

    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_request}],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
    print()  # 最後に改行


def print_separator(char="─", width=60):
    print(char * width)


def main():
    print_separator("═")
    print("  🤖 AI役割ルーターエージェント")
    print_separator("═")

    # 引数またはインタラクティブ入力で依頼を受け付け
    if len(sys.argv) > 1:
        user_request = " ".join(sys.argv[1:])
        print(f"\n📝 依頼: {user_request}\n")
    else:
        print("\n📝 依頼内容を入力してください（Enterで送信）:")
        print("   例: 楽天の先月売上レポートと来月の広告予算提案を作りたい")
        print()
        user_request = input(">>> ").strip()
        if not user_request:
            print("依頼内容が空です。終了します。")
            sys.exit(1)

    print_separator()

    # ルーティング（役割の自動判定）
    print("\n🔍 依頼内容を分析中...")
    roles, reasoning = route_request(user_request)

    print(f"\n✅ 担当役割を決定しました:")
    for role in roles:
        print(f"   • {ROLE_NAMES[role]}")
    print(f"\n💡 判定理由: {reasoning}")
    print_separator()

    # システムプロンプト構築
    system_prompt = build_system_prompt(roles)

    # 回答生成（ストリーミング）
    print("\n📣 回答:\n")
    stream_response(system_prompt, user_request)

    print_separator("═")
    print("  ✨ 完了")
    print_separator("═")


if __name__ == "__main__":
    main()
