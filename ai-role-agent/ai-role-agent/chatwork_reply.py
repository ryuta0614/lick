#!/usr/bin/env python3
"""
Chatwork売上レポート返信自動作成ツール

1. CSVを読み込んで売上を集計
2. AIが返信文を作成
3. Chatworkに送信（確認あり）
"""

import anthropic
import csv
import os
import sys
import json
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime


def load_csv(csv_path: str) -> list[dict]:
    """CSVファイルを読み込む"""
    rows = []
    with open(csv_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def summarize_csv(rows: list[dict]) -> str:
    """CSVデータをテキストに変換してAIに渡す"""
    if not rows:
        return "データなし"
    headers = list(rows[0].keys())
    lines = [",".join(headers)]
    for row in rows[:50]:  # 最大50行
        lines.append(",".join(str(row.get(h, "")) for h in headers))
    return "\n".join(lines)


def generate_reply(csv_summary: str, client_question: str, platform: str) -> str:
    """AIが返信文を生成"""
    client = anthropic.Anthropic()

    system_prompt = f"""あなたはECコンサルタントです。
クライアントからの質問に対して、売上データをもとに丁寧でわかりやすい返信文を作成してください。

【返信のルール】
- 丁寧なビジネス敬語で書く
- 数字は具体的に記載する
- 前月比・前年比があれば必ず含める
- 簡潔に（300文字以内）
- プラットフォーム: {platform}"""

    user_content = f"""【クライアントからの質問】
{client_question}

【売上データ（CSV）】
{csv_summary}

上記データをもとに返信文を作成してください。"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )

    return response.content[0].text.strip()


def send_chatwork(api_token: str, room_id: str, message: str) -> bool:
    """Chatworkにメッセージを送信"""
    url = f"https://api.chatwork.com/v2/rooms/{room_id}/messages"
    data = urllib.parse.urlencode({"body": message}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"X-ChatWorkToken": api_token},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as res:
            return res.status == 200
    except Exception as e:
        print(f"送信エラー: {e}")
        return False


def main():
    print("=" * 60)
    print("  Chatwork 売上レポート返信自動作成ツール")
    print("=" * 60)

    # APIキー確認
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        print("\n❌ ANTHROPIC_API_KEY が設定されていません")
        print("   set ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    chatwork_token = os.environ.get("CHATWORK_API_TOKEN")
    if not chatwork_token:
        chatwork_token = input("\nChatwork APIトークンを入力: ").strip()

    room_id = os.environ.get("CHATWORK_ROOM_ID")
    if not room_id:
        room_id = input("Chatwork ルームID を入力: ").strip()

    # CSVファイル
    print("\n📂 CSVファイルのパスを入力してください:")
    print("   例: C:\\Users\\ryuta\\Downloads\\rakuten_sales.csv")
    csv_path = input(">>> ").strip().strip('"')

    if not Path(csv_path).exists():
        print(f"❌ ファイルが見つかりません: {csv_path}")
        sys.exit(1)

    # プラットフォーム選択
    print("\nプラットフォームを選択:")
    print("  1. 楽天")
    print("  2. Amazon")
    print("  3. 両方")
    choice = input(">>> ").strip()
    platform_map = {"1": "楽天", "2": "Amazon", "3": "楽天・Amazon"}
    platform = platform_map.get(choice, "楽天・Amazon")

    # クライアントの質問
    print("\nクライアントからの質問を入力:")
    print("  例: 先月の売上どうでしたか？")
    client_question = input(">>> ").strip()
    if not client_question:
        client_question = "先月の売上はどうでしたか？"

    print("\n📊 CSVを読み込み中...")
    rows = load_csv(csv_path)
    print(f"   {len(rows)}件のデータを読み込みました")

    csv_summary = summarize_csv(rows)

    print("\n🤖 AIが返信文を作成中...")
    reply = generate_reply(csv_summary, client_question, platform)

    print("\n" + "=" * 60)
    print("【作成された返信文】")
    print("=" * 60)
    print(reply)
    print("=" * 60)

    confirm = input("\nこの内容でChatworkに送信しますか？ (y/n): ").strip().lower()
    if confirm == "y":
        print("\n📨 送信中...")
        success = send_chatwork(chatwork_token, room_id, reply)
        if success:
            print("✅ 送信完了！")
        else:
            print("❌ 送信失敗。APIトークンとルームIDを確認してください。")
    else:
        print("\n送信をキャンセルしました。返信文をコピーして手動で送信してください。")


if __name__ == "__main__":
    main()
