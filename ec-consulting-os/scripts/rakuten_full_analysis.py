#!/usr/bin/env python3
"""
楽天 フル分析スクリプト
- 売上 + 前月比 + アクセス + CVR を統合分析
EC Consulting OS - Phase 1
"""

import csv
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


def main():
    print("=" * 70)
    print("  EC Consulting OS — 楽天フル分析（売上 + アクセス + 前月比）")
    print("=" * 70)

    # ファイルパス設定
    base = r"C:\Users\ryuta\Downloads"
    sales_cur  = input(f"\n7月売上CSV（Enter={base}\\rakuten_sales.csv.csv）: ").strip() or f"{base}\\rakuten_sales.csv.csv"
    sales_prev = input(f"6月売上CSV（Enter={base}\\202606_Item_SalesList (1).csv）: ").strip() or f"{base}\\202606_Item_SalesList (1).csv"
    store_csv  = input(f"店舗全体分析CSV（Enter={base}\\20260701_20260731_店舗全体分析（一覧）.csv）: ").strip() or f"{base}\\20260701_20260731_店舗全体分析（一覧）.csv"

    client_name = input("顧客名: ").strip() or "株式会社マクロジ"

    print("\n📊 分析中...")

    # データ読み込み
    cur_total, cur_skus   = load_sales_csv(sales_cur)
    prev_total, prev_skus = load_sales_csv(sales_prev)
    store                 = load_store_analysis(store_csv)

    # 前月比計算
    def mom(cur, prev):
        if prev == 0:
            return 0.0
        return (cur - prev) / prev * 100

    sales_mom  = mom(cur_total["sales"],  prev_total["sales"])
    orders_mom = mom(cur_total["orders"], prev_total["orders"])
    aov_mom    = mom(cur_total["aov"],    prev_total["aov"])

    # CVR計算
    access = store.get("access", 0)
    cvr = cur_total["orders"] / access * 100 if access > 0 else None

    # 前月CVR（アクセス前月比から逆算）
    prev_access = access - store.get("access_mom_diff", 0) if "access_mom_diff" in store else None
    prev_cvr = prev_total["orders"] / prev_access * 100 if prev_access and prev_access > 0 else None
    cvr_mom = mom(cvr, prev_cvr) if cvr and prev_cvr else None

    # 寄与度計算（売上変化 = アクセス変化 + CVR変化 + 客単価変化）
    sales_diff = cur_total["sales"] - prev_total["sales"]

    report = f"""
{'='*70}
  EC Consulting OS — KPI診断レポート
{'='*70}
顧客：{client_name}　対象期間：2026年7月　チャネル：楽天市場

{'━'*70}
【売上サマリー】
{'━'*70}
  指標          今月              前月            前月比
  売上      ¥{cur_total['sales']:>10,}    ¥{prev_total['sales']:>10,}    {pct_str(sales_mom):>8}
  注文件数  {cur_total['orders']:>10,}件   {prev_total['orders']:>10,}件  {pct_str(orders_mom):>8}
  客単価    ¥{cur_total['aov']:>10,}    ¥{prev_total['aov']:>10,}    {pct_str(aov_mom):>8}
  アクセス  {access:>10,}人   {prev_access:>10,}人  {pct_str(store.get('access_mom_pct', 0)):>8}  ※前年比{pct_str(store.get('access_yoy_pct', 0))}
  CVR       {'N/A' if cvr is None else f'{cvr:>10.2f}%'}   {'N/A' if prev_cvr is None else f'{prev_cvr:>10.2f}%'}   {'N/A' if cvr_mom is None else pct_str(cvr_mom):>8}

{'━'*70}
【売上分解：売上 = アクセス × CVR × 客単価】
{'━'*70}"""

    if sales_diff != 0 and prev_access:
        access_contribution = (store.get("access_mom_diff", 0) / prev_access) * prev_cvr / 100 * prev_total["aov"] if prev_cvr else 0
        report += f"""
  売上変化：¥{sales_diff:+,}
  ├ アクセス変化（{pct_str(store.get('access_mom_pct',0))}）の寄与：約¥{int(access_contribution):+,}
  ├ CVR変化の寄与：{'計算中（要詳細データ）' if cvr_mom is None else f'約¥{int(sales_diff - access_contribution):+,}'}
  └ 客単価変化（{pct_str(aov_mom)}）：{'プラス寄与' if aov_mom > 0 else 'マイナス寄与'}
"""

    report += f"""
{'━'*70}
【SKU別売上 TOP10】
{'━'*70}
  順位  SKU-ID          今月売上    構成比    個数    単価
  {'-'*60}"""

    prev_sku_map = {s["sku_id"]: s for s in prev_skus}
    for i, sku in enumerate(cur_skus[:10], 1):
        share = sku["sales"] / cur_total["sales"] * 100
        prev = prev_sku_map.get(sku["sku_id"], {})
        mom_str = pct_str(mom(sku["sales"], prev.get("sales", 0))) if prev else "  新規"
        report += f"\n  {i:<4}  {sku['sku_id']:<15} ¥{sku['sales']:>9,} {share:>5.1f}%  {sku['qty']:>5}個  ¥{sku['avg_price']:>7,}  {mom_str}"

    report += f"""

{'━'*70}
【FACT（データから確認できる事実）】
{'━'*70}
  • アクセスが前月比{pct_str(store.get('access_mom_pct',0))}・前年比{pct_str(store.get('access_yoy_pct',0))}と大幅減少
  • 売上は前月比{pct_str(sales_mom)}（¥{sales_diff:+,}）
  • 客単価は前月比{pct_str(aov_mom)}（{'改善' if aov_mom > 0 else '悪化'}）
  • TOP3商品で売上の{sum(s['sales'] for s in cur_skus[:3])/cur_total['sales']*100:.1f}%を占める

{'━'*70}
【HYPOTHESIS（仮説）】
{'━'*70}
  • アクセスが前月比-21%と急減しており、これが売上低下の主因と推測
    → RPP広告予算の変化・モールイベント有無・SEO順位変化を確認
  • 客単価が改善しているため、CVRまたは商品構成は悪化していない可能性

{'━'*70}
【ACTION（優先施策）】
{'━'*70}
  P0. アクセス急減の原因特定（今週中）
      → RPP広告のインプレッション・クリック数を確認
      → 検索キーワード順位の変化を確認
      → 6月→7月のイベント差（マラソン等）を確認

  P1. 主力TOP3（yj-0003, mc-0006, loona-h）の在庫確認
      → 欠品リスクがあれば即座に広告抑制

  P1. 前年比でもアクセス-17%と低下中
      → SEO対策・商品名・キーワード見直しを検討

{'='*70}
"""

    print(report)

    # 保存
    out_dir = Path(sales_cur).parent / "ec_consulting_reports"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "full_report_202607.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"✅ レポート保存: {out_path}")


if __name__ == "__main__":
    main()
