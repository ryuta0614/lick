#!/usr/bin/env python3
"""
EC Consulting OS — Google Drive データ取得スクリプト
Google Drive の楽天RMSデータから report_data.json を生成する。

使い方:
  python fetch_from_drive.py <shop_name> <YYYYMM>
  例: python fetch_from_drive.py mkn24 202607

前提:
  - scripts/ フォルダに credentials.json を配置（Google Cloud Console からダウンロード）
  - 初回実行時にブラウザで Google 認証が開く
  - pip install gspread google-auth google-auth-oauthlib google-api-python-client
"""

import json
import os
import sys
from pathlib import Path

try:
    import gspread
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
except ImportError:
    print("❌ 必要なライブラリがありません。")
    print("   pip install gspread google-auth google-auth-oauthlib google-api-python-client")
    sys.exit(1)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

SCRIPTS_DIR = Path(__file__).parent
TOKEN_PATH = SCRIPTS_DIR / "token.json"
CREDS_PATH = SCRIPTS_DIR / "credentials.json"


# ─────────────────────────────────────────────
# 認証
# ─────────────────────────────────────────────

def get_credentials() -> Credentials:
    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDS_PATH.exists():
                print(f"❌ credentials.json が見つかりません: {CREDS_PATH}")
                print("   手順: Google Cloud Console → APIとサービス → 認証情報")
                print("         → OAuth 2.0 クライアントID（デスクトップアプリ）を作成")
                print("         → JSON をダウンロードして credentials.json として保存")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_PATH), SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())
        print("✅ 認証完了（token.json を保存しました）")

    return creds


# ─────────────────────────────────────────────
# Drive 検索
# ─────────────────────────────────────────────

def find_spreadsheet_id(drive_service, shop_name: str, table_name: str) -> str | None:
    """店舗名 + テーブル名でスプレッドシートを Drive 検索"""
    # ブラケットを避け、部分一致で検索する
    query = (
        f"name contains '{shop_name}shop' "
        f"and name contains '{table_name}' "
        f"and name contains 'forLM' "
        f"and mimeType = 'application/vnd.google-apps.spreadsheet' "
        f"and trashed = false"
    )
    common_params = dict(
        fields="files(id, name)",
        pageSize=10,
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
    )
    # まず allDrives で検索
    for corpora in ("allDrives", "user"):
        try:
            result = drive_service.files().list(
                q=query, corpora=corpora, **common_params
            ).execute()
            files = result.get("files", [])
            if files:
                print(f"  （{corpora} で発見: {files[0]['name']}）")
                return files[0]["id"]
        except Exception:
            pass
    return None


# ─────────────────────────────────────────────
# データ取得
# ─────────────────────────────────────────────

def get_sheet_data(gc, file_id: str) -> list[dict]:
    """スプレッドシートの最初のシートを dict リストで返す"""
    sh = gc.open_by_key(file_id)
    ws = sh.get_worksheet(0)
    return ws.get_all_records()


def find_row(records: list[dict], year_month: str) -> dict | None:
    """YYYYMM に一致する行を返す（YYYY-MM-01 形式で検索）"""
    date_str = f"{year_month[:4]}-{year_month[4:6]}-01"
    for r in records:
        if str(r.get("日付", "")).startswith(date_str[:7]):
            return r
    return None


def prev_month(year_month: str) -> str:
    """YYYYMM → 前月の YYYYMM"""
    y, m = int(year_month[:4]), int(year_month[4:6])
    if m == 1:
        return f"{y-1}12"
    return f"{y}{m-1:02d}"


# ─────────────────────────────────────────────
# JSON 組み立て
# ─────────────────────────────────────────────

def mom_pct(cur, prv):
    if not prv or prv == 0:
        return 0.0
    return round((cur - prv) / prv * 100, 1)


def build_json(
    shop_name: str,
    client_name: str,
    year_month: str,
    cur_store: dict,
    prv_store: dict,
    cur_skus: list[dict],
    prv_skus: list[dict],
) -> dict:

    def safe_int(v):
        try:
            return int(str(v).replace(",", ""))
        except (ValueError, TypeError):
            return 0

    def safe_float(v):
        try:
            return float(str(v).replace(",", ""))
        except (ValueError, TypeError):
            return 0.0

    cur_sales   = safe_int(cur_store.get("売上金額（全て）", 0))
    cur_orders  = safe_int(cur_store.get("売上件数（全て）", 0))
    cur_access  = safe_int(cur_store.get("アクセス人数（全て）", 0))
    cur_cvr     = safe_float(cur_store.get("転換率（全て）", 0))
    cur_aov     = safe_int(cur_store.get("客単価（全て）", 0))

    prv_sales   = safe_int(prv_store.get("売上金額（全て）", 0)) if prv_store else 0
    prv_orders  = safe_int(prv_store.get("売上件数（全て）", 0)) if prv_store else 0
    prv_access  = safe_int(prv_store.get("アクセス人数（全て）", 0)) if prv_store else 0
    prv_cvr     = safe_float(prv_store.get("転換率（全て）", 0)) if prv_store else 0
    prv_aov     = safe_int(prv_store.get("客単価（全て）", 0)) if prv_store else 0

    # SKU 整形（itemPageAnalysis）
    prv_sku_map = {s.get("商品管理番号", ""): s for s in prv_skus}

    skus_sorted = sorted(cur_skus, key=lambda x: safe_int(x.get("売上", 0)), reverse=True)
    top_skus = skus_sorted[:10]

    sku_out = []
    for sku in top_skus:
        sku_id   = str(sku.get("商品管理番号", ""))
        sku_sale = safe_int(sku.get("売上", 0))
        prv_sku  = prv_sku_map.get(sku_id, {})
        prv_sale = safe_int(prv_sku.get("売上", 0)) if prv_sku else None
        sku_mom  = round((sku_sale - prv_sale) / prv_sale * 100, 1) if prv_sale else None

        sku_out.append({
            "id":     sku_id,
            "name":   sku_id,  # itemPageAnalysis に商品名なし → ID で代替
            "sales":  sku_sale,
            "share":  round(sku_sale / cur_sales * 100, 1) if cur_sales else 0,
            "mom":    sku_mom,
            "qty":    safe_int(sku.get("売上件数", 0)),
            "price":  safe_int(sku.get("客単価", 0)),
            "is_new": not bool(prv_sku),
        })

    top3_share = sum(s["sales"] for s in sku_out[:3]) / cur_sales * 100 if cur_sales else 0
    sales_diff = cur_sales - prv_sales

    def pct_str(v):
        return f"{'+'if v>=0 else ''}{v:.1f}%"

    access_mom = mom_pct(cur_access, prv_access)
    aov_mom    = mom_pct(cur_aov, prv_aov)
    cvr_mom    = mom_pct(cur_cvr, prv_cvr)
    sales_mom  = mom_pct(cur_sales, prv_sales)
    orders_mom = mom_pct(cur_orders, prv_orders)

    # 自動 FACT
    period_label = f"{year_month[:4]}年{int(year_month[4:6])}月"
    facts = [
        f"アクセスが前月比{pct_str(access_mom)}（{cur_access - prv_access:+,}人）",
        f"売上が前月比{pct_str(sales_mom)}（¥{sales_diff:+,}）",
        f"客単価 ¥{cur_aov:,}（前月比{pct_str(aov_mom)}）",
        f"TOP3商品で売上の{top3_share:.1f}%を占める",
    ]
    for s in sku_out:
        if s["mom"] and s["mom"] >= 50:
            facts.append(f"{s['id']} が前月比+{s['mom']:.1f}%と急成長")
        elif s["mom"] and s["mom"] <= -50:
            facts.append(f"{s['id']} が前月比{s['mom']:.1f}%と急落")

    # 自動 HYPOTHESIS
    hypotheses = []
    if access_mom < -10:
        hypotheses.append(
            f"アクセスが{pct_str(access_mom)}と急減 "
            "→ RPP広告予算の変化・モールイベント有無・SEO順位変化を確認"
        )
    if aov_mom > 0 and sales_mom < 0:
        hypotheses.append(
            "客単価は改善しているためCVR・商品構成の悪化ではなく、集客不足が主因の可能性"
        )
    if cvr_mom < -5:
        hypotheses.append(
            f"CVRが{pct_str(cvr_mom)}と低下 → 商品ページの訴求力・競合価格との乖離を確認"
        )

    # 自動 ACTION
    actions = []
    if access_mom < -10:
        actions.append({
            "priority": "P0",
            "title": "アクセス急減の原因特定",
            "deadline": "今週中",
            "items": [
                "RPP広告のインプレッション・CPC変化を確認",
                "検索キーワード順位の変化を RMS で確認",
                "前月イベント有無（マラソン等）を確認",
            ],
        })
    if sku_out:
        top3_ids = "・".join(s["id"] for s in sku_out[:3])
        actions.append({
            "priority": "P1",
            "title": "主力TOP3の在庫リスク確認",
            "deadline": "今週中",
            "items": [
                f"{top3_ids} の在庫日数を確認",
                "欠品リスクがあれば即座に広告を抑制",
            ],
        })

    return {
        "meta": {
            "client":       client_name,
            "period":       period_label,
            "channel":      "楽天市場",
            "shop_name":    shop_name,
            "generated_by": "EC Consulting OS - fetch_from_drive.py",
        },
        "kpi": {
            "cur": {
                "sales":  cur_sales,
                "orders": cur_orders,
                "aov":    cur_aov,
                "access": cur_access,
                "cvr":    round(cur_cvr, 2),
            },
            "prv": {
                "sales":  prv_sales,
                "orders": prv_orders,
                "aov":    prv_aov,
                "access": prv_access,
                "cvr":    round(prv_cvr, 2),
            },
            "mom": {
                "sales":  round(sales_mom, 1),
                "orders": round(orders_mom, 1),
                "aov":    round(aov_mom, 1),
                "access": round(access_mom, 1),
                "cvr":    round(cvr_mom, 1),
            },
            "access_yoy_pct": 0.0,
            "sales_diff":     sales_diff,
            "top3_share":     round(top3_share, 1),
        },
        "skus": sku_out,
        "analysis": {
            "facts":      facts,
            "hypotheses": hypotheses,
            "actions":    actions,
        },
    }


# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print("使い方: python fetch_from_drive.py <shop_name> <YYYYMM>")
        print("例:     python fetch_from_drive.py mkn24 202607")
        shop_name  = input("ショップ名 (例: mkn24): ").strip()
        year_month = input("対象月 YYYYMM (例: 202607): ").strip()
    else:
        shop_name  = sys.argv[1]
        year_month = sys.argv[2]

    if len(year_month) != 6 or not year_month.isdigit():
        print("❌ 対象月は YYYYMM 形式で入力してください（例: 202607）")
        sys.exit(1)

    client_name = input(f"顧客名（Enter={shop_name}）: ").strip() or shop_name
    prev_ym     = prev_month(year_month)

    print(f"\n📡 Google Drive に接続中...")
    creds = get_credentials()
    gc    = gspread.authorize(creds)
    drive = build("drive", "v3", credentials=creds)

    # salesStoreSummary
    print(f"🔍 [{shop_name}shop]_forLM_[monthly]salesStoreSummary を検索中...")
    store_id = find_spreadsheet_id(drive, shop_name, "salesStoreSummary")
    if not store_id:
        print(f"❌ salesStoreSummary が見つかりません（ショップ名: {shop_name}）")
        sys.exit(1)

    store_data  = get_sheet_data(gc, store_id)
    cur_store   = find_row(store_data, year_month)
    prv_store   = find_row(store_data, prev_ym)

    if not cur_store:
        print(f"❌ {year_month} のデータが salesStoreSummary に存在しません")
        sys.exit(1)

    print(f"  ✅ 店舗KPI取得: 売上 ¥{int(str(cur_store.get('売上金額（全て）', 0)).replace(',', '')):,}")

    # itemPageAnalysis（SKU別）
    print(f"🔍 [{shop_name}shop]_forLM_[monthly]itemPageAnalysis を検索中...")
    item_id = find_spreadsheet_id(drive, shop_name, "itemPageAnalysis")
    cur_skus, prv_skus = [], []

    if item_id:
        item_data = get_sheet_data(gc, item_id)
        cur_date  = f"{year_month[:4]}-{year_month[4:6]}-01"
        prv_date  = f"{prev_ym[:4]}-{prev_ym[4:6]}-01"
        cur_skus  = [r for r in item_data if str(r.get("日付", "")).startswith(cur_date[:7])]
        prv_skus  = [r for r in item_data if str(r.get("日付", "")).startswith(prv_date[:7])]
        print(f"  ✅ SKUデータ取得: {len(cur_skus)} SKU")
    else:
        print("  ⚠️  itemPageAnalysis が見つかりません（SKU分析をスキップ）")

    # JSON 組み立て
    print("\n📊 分析データ生成中...")
    report = build_json(shop_name, client_name, year_month, cur_store, prv_store or {}, cur_skus, prv_skus)

    # 出力
    out_dir = Path(f"C:/Users/ryuta/Downloads/ec_consulting_reports/{shop_name}_{year_month}")
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "report_data.json"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    period_label = f"{year_month[:4]}年{int(year_month[4:6])}月"
    print(f"\n✅ JSON出力: {json_path}")
    print(f"   顧客: {client_name} / 期間: {period_label}")
    print(f"   売上: ¥{report['kpi']['cur']['sales']:,}（前月比{report['kpi']['mom']['sales']:+.1f}%）")
    print(f"   SKU: {len(report['skus'])}件")
    print(f"\n次のステップ:")
    print(f'  python enrich_analysis.py "{json_path}"')
    print(f'  node generate_report_pptx.js "{json_path}"')


if __name__ == "__main__":
    main()
