/**
 * EC Consulting OS — MTG Progress Deck Generator (Maclogi Brand Design)
 * 当月進捗MTGデッキ（広告進捗・週次RPP/TDA・優先アクション）
 * Usage: node generate_mtg_pptx.js <path/to/mtg_data.json>
 */

const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JSONロード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let mtg;
const jsonArg = process.argv[2];
if (jsonArg) {
  if (!fs.existsSync(jsonArg)) {
    console.error(`ファイルが見つかりません: ${jsonArg}`);
    process.exit(1);
  }
  mtg = JSON.parse(fs.readFileSync(jsonArg, "utf-8"));
} else {
  console.log("JSONファイル未指定 → サンプルデータを使用します");
  mtg = {
    meta: { client: "サンプル株式会社", shop_name: "sample", period: "2026年8月", as_of: "2026年8月17日", channel: "楽天市場" },
    ad_total: { cost: 100158, sales: 52855, orders: 18 },
    ad_summary: {
      rpp:     { cost: 43631, sales: 30967, orders: 9,  clicks: 1622, cpc: 26.9, cvr: 0.55, roas: 71 },
      rpp_exp: { cost: 36642, sales: 19288, orders: 8,  clicks: 540,  cpc: 67.9, cvr: 1.48, roas: 53 },
      tda:     { cost: 19885, sales: 2600,  orders: 1,  clicks: 67,   cpc: 296.8, cvr: 1.49, roas: 13 },
      pure:    { cost: 0,     sales: 0,     orders: 0 },
      cpa:     { cost: 0,     sales: 0,     orders: 0 },
    },
    rpp_weekly: [
      { week_start: "2026/08/01", week_end: "2026/08/07", cost: 28830, clicks: 898, cpc: 32,   sales: 14084, orders: 3, cvr: 0.33, roas: 49 },
      { week_start: "2026/08/08", week_end: "2026/08/14", cost: 10006, clicks: 459, cpc: 22,   sales: 4983,  orders: 3, cvr: 0.65, roas: 50 },
      { week_start: "2026/08/15", week_end: "2026/08/21", cost: 4795,  clicks: 265, cpc: 18,   sales: 11900, orders: 3, cvr: 1.13, roas: 248 },
      { week_start: "2026/08/22", week_end: "2026/08/28", cost: 0,     clicks: 0,   cpc: 0,    sales: 0,     orders: 0, cvr: 0.00, roas: 0 },
      { week_start: "2026/08/29", week_end: "2026/08/31", cost: 0,     clicks: 0,   cpc: 0,    sales: 0,     orders: 0, cvr: 0.00, roas: 0 },
    ],
    tda_weekly: [
      { week_start: "2026/08/01", week_end: "2026/08/07", cost: 9,     clicks: 0,   cpc: 0,    sales: 2600, orders: 0, cvr: 0.00, roas: 28889 },
      { week_start: "2026/08/08", week_end: "2026/08/14", cost: 10759, clicks: 32,  cpc: 336,  sales: 0,    orders: 1, cvr: 3.13, roas: 0 },
      { week_start: "2026/08/15", week_end: "2026/08/21", cost: 9117,  clicks: 35,  cpc: 260,  sales: 0,    orders: 0, cvr: 0.00, roas: 0 },
      { week_start: "2026/08/22", week_end: "2026/08/28", cost: 0,     clicks: 0,   cpc: 0,    sales: 0,    orders: 0, cvr: 0.00, roas: 0 },
      { week_start: "2026/08/29", week_end: "2026/08/31", cost: 0,     clicks: 0,   cpc: 0,    sales: 0,    orders: 0, cvr: 0.00, roas: 0 },
    ],
    rpp_exp_weekly: [],
    actions: [
      { priority: "P0", title: "売上急減の根本原因特定", deadline: "今週金曜", items: ["楽天市場管理画面で7月の掲載状況確認（出品中/一時停止/削除状態の確認）", "sks_01とhgel_1の検索キーワード順位を3日ごと測定し、検索露出量の推移を数値化", "楽天内SEO診断ツールでカテゴリー内順位を確認", "前月6月の売上が高かった理由を振り返り（セール開催有無・新商品投入・外部連携等）を記録"] },
      { priority: "P0", title: "商品ページ品質向上と在庫最適化", deadline: "今週木曜", items: ["sks_01とhgel_1の商品説明文を競合上位3商品と比較し、不足している要素（サイズ表、使用シーン画像等）を追加", "各SKUのレビュー数を確認し、レビューが5件未満の場合は購入フォロー施策でレビュー獲得を強化", "在庫数を確認し、各商品で最小出品数以上の在庫を確保（在庫切れによる非表示を排除）", "商品画像をスマートフォン表示で確認し、圧縮・見づらさがあれば高解像度画像に差し替え"] },
      { priority: "P1", title: "楽天市場内広告施策の再構築", deadline: "今月末日", items: ["楽天広告（検索広告・バナー広告）の月間予算を前月比で復帰目標（売上¥144,710）に必要な予算を逆算し確保", "sks_01を主要キーワード（月間検索数100以上）に対して自動入札で出稿、CVR向上を30日間で測定", "楽天アフィリエイト提携媒体を3社以上新規獲得し、外部流入を強化（月間100クリック以上を目標）", "楽天お買い物マラソン・スーパーSALEへの参加有無を確認し、参加する場合はクーポン・割引レベルを前月以上に設定"] },
      { priority: "P1", title: "商品ラインアップ多様化：TOP3集中度100%から脱却", deadline: "今月末日", items: ["現在2商品しか売れていない状況を打破。新規SKU掲載計画を立案", "既存SKUを活用した商品バンドル・セット販売を検討し、客単価向上と集中リスク低減を図る"] },
    ],
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Maclogi ブランドカラー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  teal:       "5CBEC6",
  tealLight:  "EAF6F7",
  tealMid:    "A8DDE2",
  navy:       "44546A",
  white:      "FFFFFF",
  lightGray:  "F5F5F5",
  borderGray: "D9D9D9",
  orange:     "F0A500",
  red:        "D94F3D",
  redLight:   "FDECEA",
  green:      "3DAD6A",
  muted:      "8A9BB0",
  text:       "2C3E50",
  rowAlt:     "F0F8F9",
};

const fmt = (n) => Number(n).toLocaleString("ja-JP");
const fmtPct = (v) => v == null ? "—" : `${Number(v).toFixed(2)}%`;
const dash = (v) => (!v && v !== 0) || v === "-" ? "-" : v;

const { meta, ad_summary, ad_total, rpp_weekly = [], tda_weekly = [], rpp_exp_weekly = [], actions = [] } = mtg;

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 共通フレーム
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function addFrame(slide, pageNum, bigTitle, subTitle) {
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.white }, line: { color: C.white } });
  const titleText = subTitle ? `${bigTitle}  |  ${subTitle}` : bigTitle;
  slide.addText(titleText, { x: 0.28, y: 0.1, w: 7.8, h: 0.58, fontSize: 18, bold: true, color: C.navy, fontFace: "Meiryo", valign: "middle" });
  slide.addText("マクロジ", { x: 8.0, y: 0.1, w: 1.72, h: 0.58, fontSize: 11, bold: true, color: C.navy, fontFace: "Meiryo", align: "right", valign: "middle" });
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0.72, w: "100%", h: 0.035, fill: { color: C.teal }, line: { color: C.teal } });
  // フッター
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 5.39, w: "100%", h: 0.235, fill: { color: C.teal }, line: { color: C.teal } });
  slide.addText("© 2026 マクロジ Co., Ltd.", { x: 0.18, y: 5.4, w: 3.2, h: 0.2, fontSize: 7, color: C.white, fontFace: "Meiryo", valign: "middle" });
  slide.addText("Confidential", { x: 3.5, y: 5.4, w: 3.0, h: 0.2, fontSize: 7, color: C.white, fontFace: "Meiryo", align: "center", valign: "middle" });
  slide.addText(String(pageNum), { x: 7.5, y: 5.4, w: 2.3, h: 0.2, fontSize: 7, bold: true, color: C.white, fontFace: "Meiryo", align: "right", valign: "middle" });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 1: タイトル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.teal }, line: { color: C.teal } });
  const stripeColor = "6CC8D0";
  for (let si = 0; si < 12; si++) {
    s.addShape(pres.ShapeType.rect, { x: -1.0 + si * 1.0, y: -1.0, w: 0.22, h: 9.0, rotate: 20,
      fill: { color: stripeColor, transparency: 55 }, line: { color: stripeColor, transparency: 55, pt: 0 } });
  }
  s.addText("マクロジ", { x: 0, y: 0.9, w: "100%", h: 1.5, fontSize: 68, bold: true, color: C.white, fontFace: "Meiryo", charSpacing: -2, align: "center", valign: "middle" });
  s.addShape(pres.ShapeType.rect, { x: 1.2, y: 2.62, w: 7.6, h: 0.025, fill: { color: C.white, transparency: 35 }, line: { color: C.white, transparency: 35 } });
  s.addText(`${meta.client}様`, { x: 0, y: 2.72, w: "100%", h: 0.56, fontSize: 22, bold: true, color: C.white, fontFace: "Meiryo", align: "center", valign: "middle" });
  s.addText(`${meta.channel} 当月進捗レポート　${meta.period}（${meta.as_of}時点）`, { x: 0, y: 3.3, w: "100%", h: 0.48, fontSize: 16, bold: true, color: C.white, fontFace: "Meiryo", align: "center", valign: "middle" });
  s.addShape(pres.ShapeType.rect, { x: 1.2, y: 3.86, w: 7.6, h: 0.025, fill: { color: C.white, transparency: 35 }, line: { color: C.white, transparency: 35 } });
  s.addText("© 2026 マクロジ Co., Ltd.", { x: 0, y: 5.18, w: "100%", h: 0.3, fontSize: 8.5, color: C.white, fontFace: "Meiryo", align: "center", valign: "middle", transparency: 25 });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 2: 広告進捗サマリー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 2, "当月進捗", `広告進捗（${meta.as_of}時点）`);

  const adRows = [
    { label: "広告費用合計", key: null, bold: true, bg: C.teal, fg: C.white },
    { label: "└RPP",        key: "rpp",     indent: true },
    { label: "└RPP-EXP",    key: "rpp_exp", indent: true },
    { label: "└TDA",        key: "tda",     indent: true },
    { label: "└純広告",     key: "pure",    indent: true },
    { label: "└CPA",        key: "cpa",     indent: true },
  ];

  // ── 左側: 広告費用 ──
  const leftX = 0.28;
  const leftW = 4.5;
  const topY  = 0.82;
  const hdrH  = 0.34;
  const rowH  = 0.44;

  // ヘッダー
  s.addShape(pres.ShapeType.rect, { x: leftX, y: topY, w: leftW, h: hdrH, fill: { color: C.navy }, line: { color: C.navy } });
  [
    { label: "▼広告費用", x: leftX + 0.08, w: 1.6 },
    { label: "実績",       x: leftX + 1.8,  w: 0.9 },
    { label: "差分",       x: leftX + 2.72, w: 0.9 },
    { label: "消化率",     x: leftX + 3.64, w: 0.8 },
  ].forEach(h => {
    s.addText(h.label, { x: h.x, y: topY + 0.04, w: h.w, h: hdrH - 0.08, fontSize: 8.5, bold: true, color: C.white, fontFace: "Meiryo", valign: "middle", align: "center" });
  });

  const totalCost = ad_total.cost;

  adRows.forEach((row, ri) => {
    const ry = topY + hdrH + ri * rowH;
    const isTotal = !row.key;
    const actual  = isTotal ? totalCost : (ad_summary[row.key]?.cost || 0);
    const bg      = isTotal ? C.teal : (ri % 2 === 0 ? C.white : C.rowAlt);
    const fg      = isTotal ? C.white : C.text;
    const fs      = isTotal ? 9.5 : 9;
    const xhira   = row.indent ? leftX + 0.08 : leftX + 0.06;

    s.addShape(pres.ShapeType.rect, { x: leftX, y: ry, w: leftW, h: rowH, fill: { color: bg }, line: { color: C.borderGray, pt: 0.5 } });
    s.addText(row.label, { x: xhira, y: ry + 0.04, w: 1.7, h: rowH - 0.08, fontSize: fs, bold: isTotal, color: isTotal ? C.white : C.navy, fontFace: "Meiryo", valign: "middle" });
    s.addText(actual ? `¥${fmt(actual)}` : "¥0", { x: leftX + 1.78, y: ry + 0.04, w: 0.9, h: rowH - 0.08, fontSize: fs, bold: isTotal, color: fg, fontFace: "Meiryo", align: "right", valign: "middle" });
    s.addText("—", { x: leftX + 2.70, y: ry + 0.04, w: 0.9, h: rowH - 0.08, fontSize: fs, color: C.muted, fontFace: "Meiryo", align: "center", valign: "middle" });
    // 消化率（予算なし）
    s.addText("—", { x: leftX + 3.62, y: ry + 0.04, w: 0.82, h: rowH - 0.08, fontSize: fs, color: C.muted, fontFace: "Meiryo", align: "center", valign: "middle" });
  });

  // ── 右側: 広告売上 ──
  const rightX = 5.14;
  const rightW = 4.58;
  s.addShape(pres.ShapeType.rect, { x: rightX, y: topY, w: rightW, h: hdrH, fill: { color: C.navy }, line: { color: C.navy } });
  [
    { label: "▼広告売上", x: rightX + 0.08, w: 2.0 },
    { label: "実績",       x: rightX + 2.2,  w: 1.2 },
  ].forEach(h => {
    s.addText(h.label, { x: h.x, y: topY + 0.04, w: h.w, h: hdrH - 0.08, fontSize: 8.5, bold: true, color: C.white, fontFace: "Meiryo", valign: "middle", align: "center" });
  });

  const totalSales = ad_total.sales;
  adRows.forEach((row, ri) => {
    const ry = topY + hdrH + ri * rowH;
    const isTotal = !row.key;
    const actual  = isTotal ? totalSales : (ad_summary[row.key]?.sales || 0);
    const bg      = isTotal ? C.teal : (ri % 2 === 0 ? C.white : C.rowAlt);
    const fg      = isTotal ? C.white : C.text;
    const fs      = isTotal ? 9.5 : 9;

    s.addShape(pres.ShapeType.rect, { x: rightX, y: ry, w: rightW, h: rowH, fill: { color: bg }, line: { color: C.borderGray, pt: 0.5 } });
    s.addText(row.label.replace("広告費用", "広告売上"), { x: rightX + 0.08, y: ry + 0.04, w: 2.0, h: rowH - 0.08, fontSize: fs, bold: isTotal, color: isTotal ? C.white : C.navy, fontFace: "Meiryo", valign: "middle" });
    s.addText(actual ? `¥${fmt(actual)}` : "¥0", { x: rightX + 2.18, y: ry + 0.04, w: 1.2, h: rowH - 0.08, fontSize: fs, bold: isTotal, color: fg, fontFace: "Meiryo", align: "right", valign: "middle" });
  });

  // ── 下段左: 広告売上件数 ──
  const botY  = topY + hdrH + adRows.length * rowH + 0.12;
  const botH  = hdrH;
  const botRH = rowH * 0.85;

  s.addShape(pres.ShapeType.rect, { x: leftX, y: botY, w: leftW, h: botH, fill: { color: C.navy }, line: { color: C.navy } });
  [
    { label: "▼広告売上件数", x: leftX + 0.08, w: 1.7 },
    { label: "実績",           x: leftX + 1.9,  w: 0.8 },
    { label: "差分",           x: leftX + 2.72, w: 0.8 },
  ].forEach(h => {
    s.addText(h.label, { x: h.x, y: botY + 0.04, w: h.w, h: botH - 0.08, fontSize: 8.5, bold: true, color: C.white, fontFace: "Meiryo", valign: "middle", align: "center" });
  });

  const orderRows = [
    { label: "広告合計",  key: null },
    { label: "└RPP",     key: "rpp" },
    { label: "└RPP-EXP", key: "rpp_exp" },
    { label: "└TDA",     key: "tda" },
  ];
  orderRows.forEach((row, ri) => {
    const ry = botY + botH + ri * botRH;
    const isTotal = !row.key;
    const actual  = isTotal ? ad_total.orders : (ad_summary[row.key]?.orders || 0);
    const bg      = isTotal ? C.teal : (ri % 2 === 0 ? C.white : C.rowAlt);
    const fs      = isTotal ? 9 : 8.5;

    s.addShape(pres.ShapeType.rect, { x: leftX, y: ry, w: leftW, h: botRH, fill: { color: bg }, line: { color: C.borderGray, pt: 0.5 } });
    s.addText(row.label, { x: leftX + 0.08, y: ry + 0.03, w: 1.7, h: botRH - 0.06, fontSize: fs, bold: isTotal, color: isTotal ? C.white : C.navy, fontFace: "Meiryo", valign: "middle" });
    s.addText(String(actual), { x: leftX + 1.9, y: ry + 0.03, w: 0.8, h: botRH - 0.06, fontSize: fs, bold: isTotal, color: isTotal ? C.white : C.text, fontFace: "Meiryo", align: "center", valign: "middle" });
    s.addText("—", { x: leftX + 2.72, y: ry + 0.03, w: 0.8, h: botRH - 0.06, fontSize: fs, color: C.muted, fontFace: "Meiryo", align: "center", valign: "middle" });
  });

  // ── 下段右: 広告CPC ──
  s.addShape(pres.ShapeType.rect, { x: rightX, y: botY, w: rightW, h: botH, fill: { color: C.navy }, line: { color: C.navy } });
  [
    { label: "▼広告CPC", x: rightX + 0.08, w: 1.8 },
    { label: "実績",      x: rightX + 2.0,  w: 0.9 },
    { label: "差分",      x: rightX + 2.92, w: 0.9 },
  ].forEach(h => {
    s.addText(h.label, { x: h.x, y: botY + 0.04, w: h.w, h: botH - 0.08, fontSize: 8.5, bold: true, color: C.white, fontFace: "Meiryo", valign: "middle", align: "center" });
  });

  const cpcRows = [
    { label: "広告費用合計", key: null },
    { label: "└RPP",        key: "rpp" },
    { label: "└RPP-EXP",   key: "rpp_exp" },
    { label: "└TDA",        key: "tda" },
    { label: "└純広告",     key: "pure" },
  ];
  cpcRows.forEach((row, ri) => {
    const ry = botY + botH + ri * botRH;
    const isTotal = !row.key;
    const cpc = isTotal
      ? (ad_total.cost && (ad_summary.rpp?.clicks + ad_summary.rpp_exp?.clicks + ad_summary.tda?.clicks)
          ? Math.round(ad_total.cost / (ad_summary.rpp.clicks + ad_summary.rpp_exp.clicks + ad_summary.tda.clicks))
          : 0)
      : (ad_summary[row.key]?.cpc || 0);
    const bg = isTotal ? C.teal : (ri % 2 === 0 ? C.white : C.rowAlt);
    const fs = isTotal ? 9 : 8.5;

    s.addShape(pres.ShapeType.rect, { x: rightX, y: ry, w: rightW, h: botRH, fill: { color: bg }, line: { color: C.borderGray, pt: 0.5 } });
    s.addText(row.label.replace("広告費用", "広告CPC"), { x: rightX + 0.08, y: ry + 0.03, w: 1.8, h: botRH - 0.06, fontSize: fs, bold: isTotal, color: isTotal ? C.white : C.navy, fontFace: "Meiryo", valign: "middle" });
    s.addText(cpc ? String(Math.round(cpc)) : "0", { x: rightX + 2.0, y: ry + 0.03, w: 0.9, h: botRH - 0.06, fontSize: fs, bold: isTotal, color: isTotal ? C.white : C.text, fontFace: "Meiryo", align: "center", valign: "middle" });
    s.addText("—", { x: rightX + 2.92, y: ry + 0.03, w: 0.9, h: botRH - 0.06, fontSize: fs, color: C.muted, fontFace: "Meiryo", align: "center", valign: "middle" });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 週次広告テーブル共通関数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function addWeeklyAdSlide(pageNum, label, weeks) {
  const s = pres.addSlide();
  addFrame(s, pageNum, "当月進捗", `${label}広告進捗（${meta.as_of}時点）`);

  if (!weeks || weeks.length === 0) {
    s.addText("データがありません", { x: 0.28, y: 2.5, w: 9.44, h: 0.5, fontSize: 13, color: C.muted, fontFace: "Meiryo", align: "center" });
    return;
  }

  // ラベルボックス
  s.addShape(pres.ShapeType.rect, { x: 0.28, y: 0.84, w: 1.8, h: 0.32, fill: { color: C.tealLight }, line: { color: C.teal, pt: 1 } });
  s.addText(`▼${label}（Weekly）`, { x: 0.34, y: 0.84, w: 1.74, h: 0.32, fontSize: 9, bold: true, color: C.navy, fontFace: "Meiryo", valign: "middle" });

  // テーブル列定義
  const cols = [
    { label: "Weekly",   x: 0.28, w: 1.18, key: "week_start", fmt: v => v },
    { label: "",         x: 1.46, w: 1.02, key: "week_end",   fmt: v => v },
    { label: "実績",     x: 2.48, w: 1.24, key: "cost",       fmt: v => v ? `¥${fmt(v)}` : "¥0" },
    { label: "クリック数", x: 3.72, w: 1.06, key: "clicks",   fmt: v => fmt(v) },
    { label: "CPC",      x: 4.78, w: 0.84, key: "cpc",        fmt: v => v ? String(Math.round(v)) : "0" },
    { label: "売上",     x: 5.62, w: 1.24, key: "sales",      fmt: v => v ? `¥${fmt(v)}` : "¥0" },
    { label: "売上件数", x: 6.86, w: 0.84, key: "orders",     fmt: v => String(v) },
    { label: "CVR",      x: 7.70, w: 0.72, key: "cvr",        fmt: v => v ? `${v}%` : "0.00%" },
    { label: "ROAS",     x: 8.42, w: 1.30, key: "roas",       fmt: v => v ? `${fmt(v)}%` : "-" },
  ];

  const tableTop = 1.22;
  const hdrH    = 0.40;
  const rowH    = 0.50;

  s.addShape(pres.ShapeType.rect, { x: 0.28, y: tableTop, w: 9.44, h: hdrH, fill: { color: C.teal }, line: { color: C.teal } });
  cols.forEach(c => {
    if (!c.label) return;
    s.addText(c.label, { x: c.x + 0.04, y: tableTop + 0.04, w: c.w - 0.06, h: hdrH - 0.08, fontSize: 9, bold: true, color: C.white, fontFace: "Meiryo", align: "center", valign: "middle" });
  });

  weeks.forEach((w, ri) => {
    const ry = tableTop + hdrH + ri * rowH;
    const bg = ri % 2 === 0 ? C.white : C.rowAlt;
    const isEmpty = !w.cost && !w.sales && !w.orders;

    s.addShape(pres.ShapeType.rect, { x: 0.28, y: ry, w: 9.44, h: rowH, fill: { color: bg }, line: { color: C.borderGray, pt: 0.5 } });

    cols.forEach(c => {
      let val = w[c.key];
      let text = c.fmt(val);
      // 空週は数値を0表示、ただし CPC/CVR/ROAS は "-"
      if (isEmpty && ["cpc","cvr","roas"].includes(c.key)) text = "-";

      const isCost  = c.key === "cost";
      const isSales = c.key === "sales";
      const isRoas  = c.key === "roas";

      s.addText(text, {
        x: c.x + 0.04, y: ry + 0.06, w: c.w - 0.06, h: rowH - 0.12,
        fontSize: 9, color: (isCost || isSales || isRoas) ? C.navy : C.text,
        bold: isCost || isSales,
        fontFace: "Meiryo", align: "center", valign: "middle",
      });
    });
  });

  // 合計行
  const totR = tableTop + hdrH + weeks.length * rowH;
  const totCost   = weeks.reduce((a, w) => a + (w.cost || 0), 0);
  const totClicks = weeks.reduce((a, w) => a + (w.clicks || 0), 0);
  const totSales  = weeks.reduce((a, w) => a + (w.sales || 0), 0);
  const totOrders = weeks.reduce((a, w) => a + (w.orders || 0), 0);
  const totCpc    = totClicks ? Math.round(totCost / totClicks * 10) / 10 : 0;
  const totCvr    = totClicks ? (totOrders / totClicks * 100).toFixed(2) : "0.00";
  const totRoas   = totCost ? Math.round(totSales / totCost * 100) : 0;

  s.addShape(pres.ShapeType.rect, { x: 0.28, y: totR, w: 9.44, h: rowH, fill: { color: "FFF8E1" }, line: { color: C.orange, pt: 1 } });
  s.addText("合計", { x: 0.32, y: totR + 0.06, w: 2.14, h: rowH - 0.12, fontSize: 9.5, bold: true, color: C.navy, fontFace: "Meiryo", align: "center", valign: "middle" });

  const totVals = [
    { x: cols[2].x, w: cols[2].w, text: `¥${fmt(totCost)}` },
    { x: cols[3].x, w: cols[3].w, text: fmt(totClicks) },
    { x: cols[4].x, w: cols[4].w, text: String(totCpc) },
    { x: cols[5].x, w: cols[5].w, text: `¥${fmt(totSales)}` },
    { x: cols[6].x, w: cols[6].w, text: String(totOrders) },
    { x: cols[7].x, w: cols[7].w, text: `${totCvr}%` },
    { x: cols[8].x, w: cols[8].w, text: totRoas ? `${fmt(totRoas)}%` : "-" },
  ];
  totVals.forEach(v => {
    s.addText(v.text, { x: v.x + 0.04, y: totR + 0.06, w: v.w - 0.06, h: rowH - 0.12, fontSize: 9.5, bold: true, color: C.navy, fontFace: "Meiryo", align: "center", valign: "middle" });
  });
}

// 週次スライドを生成
let pageNum = 3;
if (rpp_weekly.length > 0)     { addWeeklyAdSlide(pageNum++, "RPP",     rpp_weekly); }
if (rpp_exp_weekly.length > 0) { addWeeklyAdSlide(pageNum++, "RPP-EXP", rpp_exp_weekly); }
if (tda_weekly.length > 0)     { addWeeklyAdSlide(pageNum++, "TDA",     tda_weekly); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 優先アクション（P0/P1）スライド
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if (actions.length > 0) {
  const s = pres.addSlide();
  addFrame(s, pageNum++, "優先アクション（P0 / P1）", "");

  s.addText("Impact × Confidence × Speed ÷ Effort の順で優先順位付けしています。", {
    x: 0.28, y: 0.78, w: 9.0, h: 0.26,
    fontSize: 9, color: C.muted, fontFace: "Meiryo",
  });

  const priColor = { P0: C.red, P1: C.orange, P2: C.navy };
  const maxCols  = 4;
  const cardGap  = 0.12;
  const cardW    = (9.44 - cardGap * (maxCols - 1)) / maxCols;
  const cardTop  = 1.1;
  const cardH    = 4.12;

  actions.slice(0, maxCols).forEach((a, ci) => {
    const cx = 0.28 + ci * (cardW + cardGap);
    const color = priColor[a.priority] || C.navy;

    // カード枠
    s.addShape(pres.ShapeType.rect, { x: cx, y: cardTop, w: cardW, h: cardH, fill: { color: C.white }, line: { color: C.borderGray, pt: 1 } });

    // ヘッダーバー
    s.addShape(pres.ShapeType.rect, { x: cx, y: cardTop, w: cardW, h: 0.48, fill: { color: color }, line: { color: color } });
    s.addText(`${a.priority} ${a.title}`, {
      x: cx + 0.06, y: cardTop + 0.02, w: cardW - 0.1, h: 0.44,
      fontSize: 8.5, bold: true, color: C.white, fontFace: "Meiryo", valign: "middle",
    });

    // 期限
    if (a.deadline) {
      s.addText(`期限: ${a.deadline}`, {
        x: cx + 0.08, y: cardTop + 0.52, w: cardW - 0.12, h: 0.22,
        fontSize: 7.5, color: C.muted, fontFace: "Meiryo",
      });
    }

    // アイテム
    const itemsText = (a.items || []).map(it => `✓ ${it}`).join("\n");
    s.addText((a.items || []).map((it, idx) => ({
      text: `✓ ${it}`,
      options: { breakLine: idx < (a.items.length - 1) },
    })), {
      x: cx + 0.08, y: cardTop + 0.76, w: cardW - 0.14, h: cardH - 0.82,
      fontSize: 7.5, color: C.text, fontFace: "Meiryo", valign: "top",
    });
  });

  // 5件目以降は別行（2行目カード）
  if (actions.length > maxCols) {
    const s2 = pres.addSlide();
    addFrame(s2, pageNum++, "優先アクション（続き）", "");
    const remain = actions.slice(maxCols, maxCols * 2);
    remain.forEach((a, ci) => {
      const cx = 0.28 + ci * (cardW + cardGap);
      const color = priColor[a.priority] || C.navy;
      s2.addShape(pres.ShapeType.rect, { x: cx, y: cardTop, w: cardW, h: cardH, fill: { color: C.white }, line: { color: C.borderGray, pt: 1 } });
      s2.addShape(pres.ShapeType.rect, { x: cx, y: cardTop, w: cardW, h: 0.48, fill: { color: color }, line: { color: color } });
      s2.addText(`${a.priority} ${a.title}`, { x: cx + 0.06, y: cardTop + 0.02, w: cardW - 0.1, h: 0.44, fontSize: 8.5, bold: true, color: C.white, fontFace: "Meiryo", valign: "middle" });
      if (a.deadline) {
        s2.addText(`期限: ${a.deadline}`, { x: cx + 0.08, y: cardTop + 0.52, w: cardW - 0.12, h: 0.22, fontSize: 7.5, color: C.muted, fontFace: "Meiryo" });
      }
      s2.addText((a.items || []).map((it, idx) => ({ text: `✓ ${it}`, options: { breakLine: idx < (a.items.length - 1) } })), {
        x: cx + 0.08, y: cardTop + 0.76, w: cardW - 0.14, h: cardH - 0.82,
        fontSize: 7.5, color: C.text, fontFace: "Meiryo", valign: "top",
      });
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 出力
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ym = (meta.period || "").replace(/(\d+)年(\d+)月/, (_, y, m) => `${y}${m.padStart(2, "0")}`).replace(/[年月]/g, "");
const asOfSlug = (meta.as_of || "").replace(/[年月日\s]/g, "").replace(/(\d+)(\d{2})(\d{2})$/, "$1$2$3");
const outDir  = jsonArg ? path.dirname(jsonArg) : ".";
const outFile = path.join(outDir, `mtg_report_${ym}.pptx`);

pres.writeFile({ fileName: outFile })
  .then(() => console.log(`生成完了: ${outFile}`))
  .catch(e => { console.error("エラー:", e); process.exit(1); });
