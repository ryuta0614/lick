#!/usr/bin/env python3
"""
楽天 商品別売上CSV → KPI診断 + SKU分析
EC Consulting OS - Phase 1 動作テスト
"""

import csv
import os
import sys
from pathlib import Path

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")


def load_rakuten_csv(csv_path: str) -> list[dict]:
    """楽天商品別売上CSVを読み込む（ヘッダー行を自動検出）"""
    rows = []
    header = None
    with open(csv_path, encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row:
                continue
            if row[0] in ["商品名", "商品名（商品管理番号）"]:
                header = row
                continue
            if header and len(row) >= len(header):
                rows.append(dict(zip(header, row)))
    return rows


def calculate_metrics(rows: list[dict]) -> dict:
    """主要KPIを計算する"""
    total_sales = 0
    total_qty = 0
    total_orders = 0
    sku_list = []

    for row in rows:
        try:
            sales = int(str(row.get("売上", "0")).replace(",", ""))
            qty = int(str(row.get("売上個数", "0")).replace(",", ""))
            orders = int(str(row.get("売上件数", "0")).replace(",", ""))
            avg_price = int(str(row.get("平均単価", "0")).replace(",", ""))
            name = row.get("商品名", "")[:30]
            sku_id = row.get("商品管理番号", "")

            total_sales += sales
            total_qty += qty
            total_orders += orders

            sku_list.append({
                "name": name,
                "sku_id": sku_id,
                "sales": sales,
                "qty": qty,
                "orders": orders,
                "avg_price": avg_price,
            })
        except (ValueError, TypeError):
            continue

    aov = total_sales // total_orders if total_orders > 0 else 0

    return {
        "total_sales": total_sales,
        "total_qty": total_qty,
        "total_orders": total_orders,
        "aov": aov,
        "sku_count": len(sku_list),
        "sku_list": sorted(sku_list, key=lambda x: x["sales"], reverse=True),
    }


def classify_sku(sku: dict, total_sales: int) -> str:
    """SKUを分類する"""
    share = sku["sales"] / total_sales * 100 if total_sales > 0 else 0
    if share >= 20:
        return "主力商品"
    elif share >= 10:
        return "成長候補"
    elif share >= 3:
        return "中堅商品"
    elif share >= 1:
        return "小規模商品"
    else:
        return "撤退候補"


def generate_report(metrics: dict, client_name: str, period: str) -> str:
    """KPI診断レポートを生成する"""
    skus = metrics["sku_list"]
    total_sales = metrics["total_sales"]

    # 売上構成比を計算
    for sku in skus:
        sku["share"] = sku["sales"] / total_sales * 100 if total_sales > 0 else 0
        sku["classification"] = classify_sku(sku, total_sales)

    report = f"""
================================================================================
  EC Consulting OS — KPI診断レポート
================================================================================
顧客：{client_name}
対象期間：{period}
チャネル：楽天市場

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【売上サマリー】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  売上合計     : ¥{total_sales:>12,}
  注文件数     : {metrics['total_orders']:>12,} 件
  販売個数     : {metrics['total_qty']:>12,} 個
  客単価(AOV)  : ¥{metrics['aov']:>12,}
  取扱SKU数    : {metrics['sku_count']:>12,} SKU

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【SKU別売上ランキング TOP10】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

    report += f"  {'順位':<4} {'SKU-ID':<15} {'売上':>10} {'構成比':>6} {'個数':>6} {'単価':>8} {'分類'}\n"
    report += "  " + "-" * 70 + "\n"

    for i, sku in enumerate(skus[:10], 1):
        report += (
            f"  {i:<4} {sku['sku_id']:<15} "
            f"¥{sku['sales']:>9,} {sku['share']:>5.1f}% "
            f"{sku['qty']:>6,} ¥{sku['avg_price']:>7,} "
            f"{sku['classification']}\n"
        )

    # 主力商品分析
    top3_sales = sum(s["sales"] for s in skus[:3])
    top3_share = top3_sales / total_sales * 100 if total_sales > 0 else 0

    report += f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【FACT（データから確認できる事実）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • TOP3商品で売上の {top3_share:.1f}% を占める（売上集中度: {'高' if top3_share > 60 else '中' if top3_share > 40 else '低'}）
  • 最高単価商品: ¥{max(skus, key=lambda x: x['avg_price'])['avg_price']:,}（{max(skus, key=lambda x: x['avg_price'])['sku_id']}）
  • 最多販売個数: {max(skus, key=lambda x: x['qty'])['qty']:,}個（{max(skus, key=lambda x: x['qty'])['sku_id']}）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【HYPOTHESIS（仮説・追加確認が必要な点）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • アクセスデータが未提供のため CVR を計算できていない
    → RMSのアクセス分析CSVを追加提供いただければCVR分析が可能
  • 前月・前年データが未提供のため前月比・前年比が計算できていない
    → 比較データがあれば成長率・寄与度分析が可能
  • 粗利率・原価が未設定のため限界利益を計算できていない
    → 粗利率を設定いただければ利益分析が可能

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【ACTION（次にやること）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  P1. アクセスデータを取得してCVR分析を実施
      → RMS > アクセス分析 > CSVダウンロード

  P1. 前月・前年データを取得して成長率を確認
      → 2026年6月・2025年7月のSalesList CSVをダウンロード

  P1. 主力TOP3商品（{skus[0]['sku_id']}, {skus[1]['sku_id'] if len(skus) > 1 else '-'}, {skus[2]['sku_id'] if len(skus) > 2 else '-'}）の
      在庫日数を確認して欠品リスクを評価

================================================================================
"""
    return report


def main():
    print("=" * 60)
    print("  EC Consulting OS — 楽天KPI診断")
    print("=" * 60)

    # CSVパス
    default_path = r"C:\Users\ryuta\Downloads\rakuten_sales.csv.csv"
    csv_path = input(f"\nCSVパスを入力（Enter = {default_path}）: ").strip()
    if not csv_path:
        csv_path = default_path

    if not Path(csv_path).exists():
        print(f"❌ ファイルが見つかりません: {csv_path}")
        sys.exit(1)

    client_name = input("顧客名（会社名）を入力: ").strip() or "サンプル顧客"
    period = input("対象期間（例: 2026年7月）: ").strip() or "2026年7月"

    print("\n📊 分析中...")
    rows = load_rakuten_csv(csv_path)

    if not rows:
        print("❌ データを読み込めませんでした。CSVファイルを確認してください。")
        sys.exit(1)

    print(f"   {len(rows)} SKUのデータを読み込みました")

    metrics = calculate_metrics(rows)
    report = generate_report(metrics, client_name, period)

    print(report)

    # レポートをファイルに保存
    output_dir = Path(csv_path).parent / "ec_consulting_reports"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"kpi_report_{period.replace('年', '').replace('月', '')}.txt"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"✅ レポートを保存しました: {output_path}")


if __name__ == "__main__":
    main()
