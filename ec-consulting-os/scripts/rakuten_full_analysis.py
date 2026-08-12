#!/usr/bin/env python3
"""
楽天 フル分析スクリプト
- 売上 + 前月比 + アクセス + CVR を統合分析
- report_data.json を出力 → generate_report_pptx.js で読み込む
EC Consulting OS - Phase 1
"""

import csv
import json
import sys
from pathlib import Path


def detect_encoding(path: str) -> str:
    for enc in ["utf-8-sig", "cp932", "utf-8"]:
        try:
            with open(path, encoding=enc) as f:
                f.read(1024)
            return enc
        except UnicodeDecodeError:
            continue
    return "cp932"


def load_csv_auto(path: str) -> list[list]:
    enc = detect_encoding(path)
    rows = []
    with open(path, encoding=enc) as f:
        for row in csv.reader(f):
            if row:
                rows.append(row)
    return rows


def load_sales_csv(path: str) -> tuple[dict, list[dict]]:
    """商品別売上CSV → (店舗合計, SKUリスト)"""
    rows = load_csv_auto(path)
    header = None
    skus = []
    for row in rows:
        if row[0] in ["商品名", "商品名（商品管理番号）", "商品ID"]:
            header = row
            continue
        if header and len(row) >= 4:
            try:
                skus.append({
                    "name": row[0][:25],
                    "sku_id": row[1] if len(row) > 1 else "",
                    "avg_price": int(str(row[3]).replace(",", "")),
                    "qty": int(str(row[4]).replace(",", "")),
                    "sales": int(str(row[5]).replace(",", "")),
                    "orders": int(str(row[6]).replace(",", "")) if len(row) > 6 else 0,
                })
            except (ValueError, IndexError):
                continue

    total = {
        "sales": sum(s["sales"] for s in skus),
        "qty": sum(s["qty"] for s in skus),
        "orders": sum(s["orders"] for s in skus),
    }
    total["aov"] = total["sales"] // total["orders"] if total["orders"] > 0 else 0
    return total, sorted(skus, key=lambda x: x["sales"], reverse=True)


def load_store_analysis(path: str) -> dict:
    """店舗全体分析CSV → アクセス・前月比データ"""
    rows = load_csv_auto(path)
    result = {}
    header = None
    for row in rows:
        if "ページ名" in row[0] or "アクセス人数" in row[0]:
            header = row
            continue
        if header and row[0] == "店舗全体":
            try:
                result["access"] = int(str(row[1]).replace(",", ""))
                result["access_yoy_diff"] = int(str(row[2]).replace(",", ""))
                result["access_yoy_pct"] = float(row[3])
                result["access_mom_diff"] = int(str(row[4]).replace(",", ""))
                result["access_mom_pct"] = float(row[5])
            except (ValueError, IndexError):
                pass
    return result


def pct_str(val: float) -> str:
    sign = "+" if val >= 0 else ""
    return f"{sign}{val:.1f}%"


def build_json(client_name: str, period: str, cur_total: dict, prev_total: dict,
               cur_skus: list, prev_skus: list, store: dict) -> dict:
    """分析結果をJSON形式にまとめる"""

    def mom(cur, prev):
        if prev == 0:
            return 0.0
        return (cur - prev) / prev * 100

    access = store.get("access", 0)
    prev_access_val = access - store.get("access_mom_diff", 0) if "access_mom_diff" in store else 0

    cvr = round(cur_total["orders"] / access * 100, 2) if access > 0 else 0
    prev_cvr = round(prev_total["orders"] / prev_access_val * 100, 2) if prev_access_val > 0 else 0

    sales_mom = mom(cur_total["sales"], prev_total["sales"])
    orders_mom = mom(cur_total["orders"], prev_total["orders"])
    aov_mom = mom(cur_total["aov"], prev_total["aov"])
    access_mom = store.get("access_mom_pct", 0.0)
    cvr_mom = mom(cvr, prev_cvr) if prev_cvr else 0.0

    sales_diff = cur_total["sales"] - prev_total["sales"]
    top3_share = sum(s["sales"] for s in cur_skus[:3]) / cur_total["sales"] * 100 if cur_total["sales"] else 0

    prev_sku_map = {s["sku_id"]: s for s in prev_skus}
    skus_out = []
    for sku in cur_skus[:10]:
        prev = prev_sku_map.get(sku["sku_id"], {})
        sku_mom = mom(sku["sales"], prev.get("sales", 0)) if prev else None
        skus_out.append({
            "id":      sku["sku_id"],
            "name":    sku["name"],
            "sales":   sku["sales"],
            "share":   round(sku["sales"] / cur_total["sales"] * 100, 1) if cur_total["sales"] else 0,
            "mom":     round(sku_mom, 1) if sku_mom is not None else None,
            "qty":     sku["qty"],
            "price":   sku["avg_price"],
            "is_new":  not bool(prev),
        })

    # FACT（データから自動生成）
    facts = [
        f"アクセスが前月比{pct_str(access_mom)}（{store.get('access_mom_diff', 0):+,}人）・前年比{pct_str(store.get('access_yoy_pct', 0))}",
        f"売上が前月比{pct_str(sales_mom)}（¥{sales_diff:+,}）",
        f"客単価 ¥{cur_total['aov']:,}（前月比{pct_str(aov_mom)}）",
        f"TOP3商品で売上の{top3_share:.1f}%を占める（集中度：{'高' if top3_share > 60 else '中' if top3_share > 40 else '低'}）",
    ]
    # 急成長・急落SKUを自動抽出
    for sku in skus_out:
        if sku["mom"] and sku["mom"] >= 50:
            facts.append(f"{sku['id']}（{sku['name']}）が前月比+{sku['mom']:.1f}%と急成長")
        elif sku["mom"] and sku["mom"] <= -50:
            facts.append(f"{sku['id']}（{sku['name']}）が前月比{sku['mom']:.1f}%と急落")

    # HYPOTHESIS（パターンベース自動生成）
    hypotheses = []
    if access_mom < -10:
        hypotheses.append(f"アクセスが{pct_str(access_mom)}と急減 → RPP広告予算の変化・モールイベント有無・SEO順位変化を確認")
    if aov_mom > 0 and sales_mom < 0:
        hypotheses.append("客単価は改善しているためCVR・商品構成の悪化ではなく、集客不足が主因の可能性")
    if cvr_mom < -5:
        hypotheses.append(f"CVRが{pct_str(cvr_mom)}と低下 → 商品ページの訴求力・競合価格との乖離を確認")

    # ACTION（パターンベース）
    actions = []
    if access_mom < -10:
        actions.append({
            "priority": "P0",
            "title": "アクセス急減の原因特定",
            "deadline": "今週中",
            "items": [
                "RPP広告のインプレッション・CPC変化を確認",
                "検索キーワード順位の変化を RMS で確認",
                f"前月イベント有無（マラソン等）を確認",
            ],
        })
    actions.append({
        "priority": "P1",
        "title": f"主力TOP3の在庫リスク確認",
        "deadline": "今週中",
        "items": [
            f"{skus_out[0]['id'] if skus_out else '-'}・{skus_out[1]['id'] if len(skus_out)>1 else '-'}・{skus_out[2]['id'] if len(skus_out)>2 else '-'} の在庫日数を確認",
            "欠品リスクがあれば即座に広告を抑制",
        ],
    })

    return {
        "meta": {
            "client": client_name,
            "period": period,
            "channel": "楽天市場",
            "generated_by": "EC Consulting OS - rakuten_full_analysis.py",
        },
        "kpi": {
            "cur": {
                "sales":   cur_total["sales"],
                "orders":  cur_total["orders"],
                "aov":     cur_total["aov"],
                "access":  access,
                "cvr":     cvr,
            },
            "prv": {
                "sales":   prev_total["sales"],
                "orders":  prev_total["orders"],
                "aov":     prev_total["aov"],
                "access":  prev_access_val,
                "cvr":     prev_cvr,
            },
            "mom": {
                "sales":   round(sales_mom, 1),
                "orders":  round(orders_mom, 1),
                "aov":     round(aov_mom, 1),
                "access":  round(access_mom, 1),
                "cvr":     round(cvr_mom, 1),
            },
            "access_yoy_pct": store.get("access_yoy_pct", 0.0),
            "sales_diff":     sales_diff,
            "top3_share":     round(top3_share, 1),
        },
        "skus": skus_out,
        "analysis": {
            "facts":       facts,
            "hypotheses":  hypotheses,
            "actions":     actions,
        },
    }


def main():
    print("=" * 70)
    print("  EC Consulting OS — 楽天フル分析（売上 + アクセス + 前月比）")
    print("=" * 70)

    base = r"C:\Users\ryuta\Downloads"
    sales_cur  = input(f"\n7月売上CSV（Enter={base}\\rakuten_sales.csv.csv）: ").strip() or f"{base}\\rakuten_sales.csv.csv"
    sales_prev = input(f"6月売上CSV（Enter={base}\\202606_Item_SalesList (1).csv）: ").strip() or f"{base}\\202606_Item_SalesList (1).csv"
    store_csv  = input(f"店舗全体分析CSV（Enter={base}\\20260701_20260731_店舗全体分析（一覧）.csv）: ").strip() or f"{base}\\20260701_20260731_店舗全体分析（一覧）.csv"
    client_name = input("顧客名: ").strip() or "株式会社マクロジ"
    period      = input("対象期間（例: 2026年7月）: ").strip() or "2026年7月"

    print("\n📊 分析中...")

    cur_total, cur_skus   = load_sales_csv(sales_cur)
    prev_total, prev_skus = load_sales_csv(sales_prev)
    store                 = load_store_analysis(store_csv)

    def mom(cur, prev):
        return (cur - prev) / prev * 100 if prev else 0.0

    sales_mom  = mom(cur_total["sales"],  prev_total["sales"])
    orders_mom = mom(cur_total["orders"], prev_total["orders"])
    aov_mom    = mom(cur_total["aov"],    prev_total["aov"])
    access     = store.get("access", 0)
    prev_access = access - store.get("access_mom_diff", 0) if "access_mom_diff" in store else 0
    cvr      = cur_total["orders"] / access * 100 if access > 0 else None
    prev_cvr = prev_total["orders"] / prev_access * 100 if prev_access > 0 else None
    cvr_mom  = mom(cvr, prev_cvr) if cvr and prev_cvr else None
    sales_diff = cur_total["sales"] - prev_total["sales"]

    # テキストレポート出力
    report = f"""
{'='*70}
  EC Consulting OS — KPI診断レポート
{'='*70}
顧客：{client_name}　対象期間：{period}　チャネル：楽天市場

{'━'*70}
【売上サマリー】
{'━'*70}
  指標          今月              前月            前月比
  売上      ¥{cur_total['sales']:>10,}    ¥{prev_total['sales']:>10,}    {pct_str(sales_mom):>8}
  注文件数  {cur_total['orders']:>10,}件   {prev_total['orders']:>10,}件  {pct_str(orders_mom):>8}
  客単価    ¥{cur_total['aov']:>10,}    ¥{prev_total['aov']:>10,}    {pct_str(aov_mom):>8}
  アクセス  {access:>10,}人   {prev_access:>10,}人  {pct_str(store.get('access_mom_pct', 0)):>8}  ※前年比{pct_str(store.get('access_yoy_pct', 0))}
  CVR       {'N/A' if cvr is None else f'{cvr:>10.2f}%'}   {'N/A' if prev_cvr is None else f'{prev_cvr:>10.2f}%'}   {'N/A' if cvr_mom is None else pct_str(cvr_mom):>8}
"""

    prev_sku_map = {s["sku_id"]: s for s in prev_skus}
    report += f"\n{'━'*70}\n【SKU別売上 TOP10】\n{'━'*70}\n  順位  SKU-ID          今月売上    構成比    個数    単価\n  {'-'*60}"
    for i, sku in enumerate(cur_skus[:10], 1):
        share = sku["sales"] / cur_total["sales"] * 100
        prev  = prev_sku_map.get(sku["sku_id"], {})
        mom_str = pct_str(mom(sku["sales"], prev.get("sales", 0))) if prev else "  新規"
        report += f"\n  {i:<4}  {sku['sku_id']:<15} ¥{sku['sales']:>9,} {share:>5.1f}%  {sku['qty']:>5}個  ¥{sku['avg_price']:>7,}  {mom_str}"

    print(report)

    # --- JSON出力 ---
    out_dir = Path(sales_cur).parent / "ec_consulting_reports"
    out_dir.mkdir(exist_ok=True)

    report_json = build_json(client_name, period, cur_total, prev_total, cur_skus, prev_skus, store)
    json_path = out_dir / "report_data.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report_json, f, ensure_ascii=False, indent=2)
    print(f"\n✅ JSON出力: {json_path}")

    safe_period = period.replace('年','').replace('月','').replace('/','').replace('\\','')
    txt_path = out_dir / f"full_report_{safe_period}.txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"✅ テキストレポート: {txt_path}")

    print(f"\n次のステップ:")
    print(f"  node generate_report_pptx.js \"{json_path}\"")


if __name__ == "__main__":
    main()
