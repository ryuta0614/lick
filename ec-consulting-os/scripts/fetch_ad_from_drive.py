#!/usr/bin/env python3
"""
EC Consulting OS — 広告進捗データ取得スクリプト
Google Drive の週次広告データ（RPP・TDA・RPP-EXP）を取得し mtg_data.json を生成する。

使い方:
  python fetch_ad_from_drive.py <shop_name> <YYYYMM> [as_of_date]
  例: python fetch_ad_from_drive.py mkn24 202608
      python fetch_ad_from_drive.py mkn24 202608 20260817
"""

import json
import os
import sys
from datetime import datetime, date
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
TOKEN_PATH  = SCRIPTS_DIR / "token.json"
CREDS_PATH  = SCRIPTS_DIR / "credentials.json"


# ─────────────────────────────────────────────
# 認証（fetch_from_drive.py と共通）
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
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_PATH), SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())
        print("✅ 認証完了")
    return creds


# ─────────────────────────────────────────────
# Drive 検索
# ─────────────────────────────────────────────

def find_sheet(drive_service, shop_name: str, keywords: list[str]) -> tuple[str, str] | tuple[None, None]:
    """shop_name + いずれかのキーワードを含むシートを検索。(id, name) を返す"""
    common_params = dict(
        fields="files(id, name)",
        pageSize=10,
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
    )
    for kw in keywords:
        query = (
            f"name contains '{shop_name}shop' "
            f"and name contains '{kw}' "
            f"and name contains 'forLM' "
            f"and mimeType = 'application/vnd.google-apps.spreadsheet' "
            f"and trashed = false"
        )
        for corpora in ("allDrives", "user"):
            try:
                res = drive_service.files().list(q=query, corpora=corpora, **common_params).execute()
                files = res.get("files", [])
                if files:
                    print(f"    （{corpora} で発見: {files[0]['name']}）")
                    return files[0]["id"], files[0]["name"]
            except Exception:
                pass
    return None, None


def list_all_shop_sheets(drive_service, shop_name: str) -> list[dict]:
    """デバッグ用：ショップ名に紐づく全スプレッドシートを一覧表示"""
    query = (
        f"name contains '{shop_name}shop' "
        f"and name contains 'forLM' "
        f"and mimeType = 'application/vnd.google-apps.spreadsheet' "
        f"and trashed = false"
    )
    common_params = dict(
        fields="files(id, name)",
        pageSize=50,
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
    )
    files = []
    for corpora in ("allDrives", "user"):
        try:
            res = drive_service.files().list(q=query, corpora=corpora, **common_params).execute()
            files.extend(res.get("files", []))
        except Exception:
            pass
    return files


# ─────────────────────────────────────────────
# シートデータ取得 & 列名検出
# ─────────────────────────────────────────────

def get_sheet_records(gc, file_id: str) -> list[dict]:
    sh = gc.open_by_key(file_id)
    ws = sh.get_worksheet(0)
    return ws.get_all_records()


def safe_int(v) -> int:
    try:
        return int(str(v).replace(",", "").replace("¥", "").replace("%", "").strip())
    except (ValueError, TypeError):
        return 0


def safe_float(v) -> float:
    try:
        return float(str(v).replace(",", "").replace("¥", "").replace("%", "").strip())
    except (ValueError, TypeError):
        return 0.0


# ─────────────────────────────────────────────
# 週次データパース
# ─────────────────────────────────────────────

# 列名の候補マッピング（スプレッドシートによって列名が異なる場合に対応）
COL_ALIASES = {
    "cost":    ["実績", "広告費用", "費用", "cost", "実績費用"],
    "clicks":  ["クリック数", "clicks", "クリック"],
    "cpc":     ["CPC", "cpc", "クリック単価"],
    "sales":   ["売上", "広告売上", "sales", "売上金額"],
    "orders":  ["売上件数", "注文件数", "orders"],
    "cvr":     ["CVR", "cvr", "転換率"],
    "roas":    ["ROAS", "roas"],
    "week_start": ["週", "Weekly", "開始日", "日付", "週開始"],
    "week_end":   ["終了日", "週終了"],
}


def detect_col(headers: list[str], key: str) -> str | None:
    for alias in COL_ALIASES.get(key, []):
        for h in headers:
            if alias.lower() in h.lower():
                return h
    return None


def parse_weekly(records: list[dict], year_month: str) -> list[dict]:
    """週次レコードから対象月のデータを抽出してパース"""
    if not records:
        return []

    headers = list(records[0].keys())
    col = {k: detect_col(headers, k) for k in COL_ALIASES}

    ym_prefix = f"{year_month[:4]}/{year_month[4:6]}"  # e.g. "2026/08"
    ym_prefix2 = f"{year_month[:4]}-{year_month[4:6]}"

    weeks = []
    for r in records:
        # 週開始日を取得
        start_raw = str(r.get(col["week_start"] or "", "")).strip()
        if not start_raw:
            continue
        # 対象月のみ
        if not (ym_prefix in start_raw or ym_prefix2 in start_raw):
            continue

        end_raw = str(r.get(col["week_end"] or "", "")).strip() if col["week_end"] else ""

        def get(key):
            c = col.get(key)
            return r.get(c, 0) if c else 0

        cost   = safe_int(get("cost"))
        clicks = safe_int(get("clicks"))
        sales  = safe_int(get("sales"))
        orders = safe_int(get("orders"))
        cpc    = safe_float(get("cpc")) or (round(cost / clicks, 1) if clicks else 0)
        cvr    = safe_float(get("cvr"))
        roas   = safe_int(get("roas")) or (round(sales / cost * 100) if cost else 0)

        weeks.append({
            "week_start": start_raw,
            "week_end":   end_raw,
            "cost":       cost,
            "clicks":     clicks,
            "cpc":        cpc,
            "sales":      sales,
            "orders":     orders,
            "cvr":        round(cvr, 2),
            "roas":       roas,
        })

    return weeks


def summarize_weekly(weeks: list[dict]) -> dict:
    """週次合計"""
    if not weeks:
        return {"cost": 0, "sales": 0, "orders": 0, "clicks": 0, "cpc": 0.0, "cvr": 0.0, "roas": 0}
    total_cost   = sum(w["cost"] for w in weeks)
    total_sales  = sum(w["sales"] for w in weeks)
    total_orders = sum(w["orders"] for w in weeks)
    total_clicks = sum(w["clicks"] for w in weeks)
    avg_cpc  = round(total_cost / total_clicks, 1) if total_clicks else 0.0
    avg_cvr  = round(total_orders / total_clicks * 100, 2) if total_clicks else 0.0
    avg_roas = round(total_sales / total_cost * 100) if total_cost else 0
    return {
        "cost":   total_cost,
        "sales":  total_sales,
        "orders": total_orders,
        "clicks": total_clicks,
        "cpc":    avg_cpc,
        "cvr":    avg_cvr,
        "roas":   avg_roas,
    }


# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print("使い方: python fetch_ad_from_drive.py <shop_name> <YYYYMM>")
        print("例:     python fetch_ad_from_drive.py mkn24 202608")
        shop_name  = input("ショップ名 (例: mkn24): ").strip()
        year_month = input("対象月 YYYYMM (例: 202608): ").strip()
    else:
        shop_name  = sys.argv[1]
        year_month = sys.argv[2]

    # as_of 日付（省略時は今日）
    if len(sys.argv) >= 4:
        aod = sys.argv[3]
        as_of = f"{aod[:4]}年{int(aod[4:6])}月{int(aod[6:8])}日"
    else:
        today = date.today()
        as_of = f"{today.year}年{today.month}月{today.day}日"

    client_name = input(f"顧客名（Enter={shop_name}）: ").strip() or shop_name

    period_label = f"{year_month[:4]}年{int(year_month[4:6])}月"

    print(f"\n📡 Google Drive に接続中...")
    creds = get_credentials()
    gc    = gspread.authorize(creds)
    drive = build("drive", "v3", credentials=creds)

    # ── 利用可能なシートを一覧表示（デバッグ）──
    all_sheets = list_all_shop_sheets(drive, shop_name)
    if all_sheets:
        print(f"\n📋 {shop_name} に紐づくシート一覧:")
        for s in all_sheets:
            print(f"   - {s['name']}")
    else:
        print(f"⚠️  {shop_name}shop に紐づくシートが見つかりません")

    # ── 広告シート検索キーワード ──
    AD_TARGETS = [
        ("rpp",     ["RPP"],            "RPP"),
        ("rpp_exp", ["RPPEXP", "RPP-EXP", "RPP_EXP", "RPPEXP"], "RPP-EXP"),
        ("tda",     ["TDA"],            "TDA"),
    ]

    ad_weekly   = {}   # key -> list of week dicts
    ad_summary  = {}   # key -> summary dict

    for key, keywords, label in AD_TARGETS:
        print(f"\n🔍 [{shop_name}shop]_forLM_...[{label}]... を検索中...")
        file_id, fname = find_sheet(drive, shop_name, keywords)
        if not file_id:
            print(f"  ⚠️  {label} シートが見つかりません（スキップ）")
            ad_weekly[key]  = []
            ad_summary[key] = {"cost": 0, "sales": 0, "orders": 0, "clicks": 0, "cpc": 0.0, "cvr": 0.0, "roas": 0}
            continue

        try:
            records = get_sheet_records(gc, file_id)
            print(f"  　列名: {list(records[0].keys()) if records else '(空)'}")
            weeks = parse_weekly(records, year_month)
            total = summarize_weekly(weeks)
            ad_weekly[key]  = weeks
            ad_summary[key] = total
            print(f"  ✅ {label}: {len(weeks)}週分 / 費用¥{total['cost']:,} / 売上¥{total['sales']:,}")
        except Exception as e:
            print(f"  ❌ {label} データ取得エラー: {e}")
            ad_weekly[key]  = []
            ad_summary[key] = {"cost": 0, "sales": 0, "orders": 0, "clicks": 0, "cpc": 0.0, "cvr": 0.0, "roas": 0}

    # ── 合計計算 ──
    total_ad_cost   = sum(ad_summary[k]["cost"]   for k in ("rpp", "rpp_exp", "tda"))
    total_ad_sales  = sum(ad_summary[k]["sales"]  for k in ("rpp", "rpp_exp", "tda"))
    total_ad_orders = sum(ad_summary[k]["orders"] for k in ("rpp", "rpp_exp", "tda"))

    # ── JSON 組み立て ──
    mtg_data = {
        "meta": {
            "client":    client_name,
            "shop_name": shop_name,
            "period":    period_label,
            "as_of":     as_of,
            "channel":   "楽天市場",
        },
        "ad_total": {
            "cost":   total_ad_cost,
            "sales":  total_ad_sales,
            "orders": total_ad_orders,
        },
        "ad_summary": {
            "rpp":     ad_summary.get("rpp",     {}),
            "rpp_exp": ad_summary.get("rpp_exp", {}),
            "tda":     ad_summary.get("tda",     {}),
            "pure":    {"cost": 0, "sales": 0, "orders": 0},
            "cpa":     {"cost": 0, "sales": 0, "orders": 0},
        },
        "rpp_weekly":     ad_weekly.get("rpp",     []),
        "rpp_exp_weekly": ad_weekly.get("rpp_exp", []),
        "tda_weekly":     ad_weekly.get("tda",     []),
        "actions": [],  # enrich_mtg.py で AI 補完
    }

    # ── 出力 ──
    out_dir = Path(f"C:/Users/ryuta/Downloads/ec_consulting_reports/{shop_name}_{year_month}")
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "mtg_data.json"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(mtg_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ JSON出力: {json_path}")
    print(f"   顧客: {client_name} / 期間: {period_label} / {as_of}時点")
    print(f"   広告費用合計: ¥{total_ad_cost:,}")
    print(f"   広告売上合計: ¥{total_ad_sales:,}")
    print(f"\n次のステップ:")
    print(f'  node generate_mtg_pptx.js "{json_path}"')


if __name__ == "__main__":
    main()
