/**
 * EC Consulting OS — PowerPoint Report Generator
 * Usage: node generate_report_pptx.js <path/to/report_data.json>
 *        node generate_report_pptx.js  ← uses sample data for testing
 */

const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JSONロード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let report;
const jsonArg = process.argv[2];
if (jsonArg) {
  if (!fs.existsSync(jsonArg)) {
    console.error(`❌ ファイルが見つかりません: ${jsonArg}`);
    process.exit(1);
  }
  report = JSON.parse(fs.readFileSync(jsonArg, "utf-8"));
  console.log(`📂 データ読み込み: ${jsonArg}`);
} else {
  // サンプルデータ（テスト用）
  console.log("⚠️  JSONファイル未指定 → サンプルデータを使用します");
  report = {
    meta: { client: "株式会社マクロジ", period: "2026年7月", channel: "楽天市場" },
    kpi: {
      cur:  { sales: 5264311, orders: 419, aov: 12563, access: 23174, cvr: 1.81 },
      prv:  { sales: 7653026, orders: 598, aov: 12797, access: 29406, cvr: 2.03 },
      mom:  { sales: -31.2, orders: -29.9, aov: -1.8, access: -21.2, cvr: -11.1 },
      access_yoy_pct: -17.0,
      sales_diff: -2388715,
      top3_share: 52.8,
    },
    skus: [
      { id: "yj-0003",   name: "すのこベッド（シングル）",  sales: 1098680, share: 20.9, mom: -8.9,  qty: 74, price: 14847 },
      { id: "mc-0006",   name: "ペットドライヤーハウス",     sales:  984410, share: 18.7, mom: 83.6,  qty: 59, price: 16685 },
      { id: "loona-h",   name: "AI搭載ペットロボットLoona",  sales:  693000, share: 13.2, mom: 29.1,  qty:  7, price: 99000 },
      { id: "yj-0002_a", name: "大容量収納ベッド",           sales:  511780, share:  9.7, mom: -12.0, qty: 40, price: 12795 },
      { id: "mc-0004-1", name: "見守りカメラTalkMee",        sales:  280410, share:  5.3, mom:  0.1,  qty: 69, price:  4064 },
      { id: "yj-0004_a", name: "テレビ台幅150cm",            sales:  260910, share:  5.0, mom: 65.5,  qty: 39, price:  6690 },
      { id: "yj-0001_b", name: "機能性すのこベッド",         sales:  256350, share:  4.9, mom: -74.6, qty: 28, price:  9155 },
    ],
    analysis: {
      facts: [
        "アクセスが前月比-21.2%（-6,232人）・前年比-17.0%",
        "売上が前月比-31.2%（¥-2,388,715）",
        "客単価 ¥12,563（前月比-1.8%）と安定維持",
        "TOP3商品で売上の52.8%を占める（集中度：中）",
        "mc-0006（ペットドライヤーハウス）が前月比+83.6%と急成長",
        "yj-0001_b（機能性すのこベッド）が前月比-74.6%と急落",
      ],
      hypotheses: [
        "アクセスが-21.2%と急減 → RPP広告予算の変化・モールイベント有無・SEO順位変化を確認",
        "客単価は改善しているためCVR・商品構成の悪化ではなく、集客不足が主因の可能性",
      ],
      actions: [
        {
          priority: "P0", title: "アクセス急減の原因特定", deadline: "今週中",
          items: ["RPP広告のインプレッション・CPC変化を確認", "検索キーワード順位の変化をRMSで確認", "前月イベント有無（マラソン等）を確認"],
        },
        {
          priority: "P1", title: "主力TOP3の在庫リスク確認", deadline: "今週中",
          items: ["yj-0003・mc-0006・loona-h の在庫日数を確認", "欠品リスクがあれば即座に広告を抑制"],
        },
        {
          priority: "P1", title: "アクセス回復施策の実行", deadline: "8月末",
          items: ["RPP広告予算の最適化（インプレッション回復）", "検索対策：商品名・キーワードの見直し", "8月イベントへの参加検討"],
        },
      ],
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Maclogi ブランドカラー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  teal:   "5CBEC6",
  navy:   "44546A",
  white:  "FFFFFF",
  bg:     "FFFFFF",
  text:   "222222",
  muted:  "666666",
  light:  "F5F7FA",
  border: "D0D8E4",
  red:    "C0392B",
  green:  "27AE60",
  orange: "E67E22",
};

const fmt  = (n) => Number(n).toLocaleString("ja-JP");
const pct  = (v) => v == null ? "N/A" : (v >= 0 ? `+${Number(v).toFixed(1)}%` : `${Number(v).toFixed(1)}%`);
const pcol = (v) => v == null ? C.muted : v >= 0 ? C.green : C.red;

const { meta, kpi, skus, analysis } = report;

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10" × 5.625"

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 共通フレーム
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function addFrame(slide, pageNum, title) {
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.bg }, line: { color: C.bg } });
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0.72, w: 9.0, h: 0.03, fill: { color: C.teal }, line: { color: C.teal } });
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 5.4, w: "100%", h: 0.225, fill: { color: C.teal }, line: { color: C.teal } });
  slide.addText("© 2026 マクロジ Co., Ltd.  Confidential", {
    x: 0.15, y: 5.41, w: 5, h: 0.2, fontSize: 7, color: C.white, fontFace: "Calibri",
  });
  slide.addText(title, {
    x: 0.3, y: 0.12, w: 7.5, h: 0.5, fontSize: 18, bold: true, color: C.navy, fontFace: "Calibri",
  });
  slide.addText(String(pageNum), {
    x: 9.2, y: 0.15, w: 0.55, h: 0.4, fontSize: 20, bold: true, color: C.teal, fontFace: "Calibri", align: "right",
  });
  slide.addText("Maclogi-EC Consulting", {
    x: 6.0, y: 0.08, w: 3.6, h: 0.28, fontSize: 8, color: C.muted, fontFace: "Calibri", align: "right",
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 1: タイトル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.teal }, line: { color: C.teal } });
  s.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.8, w: 8.8, h: 4.0, fill: { color: C.white }, line: { color: C.white } });
  s.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.8, w: 0.12, h: 4.0, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("月次ECレポート", { x: 1.0, y: 1.1, w: 8.0, h: 0.5, fontSize: 11, color: C.teal, bold: true, fontFace: "Calibri" });
  s.addText(`${meta.channel} 売上分析レポート`, { x: 1.0, y: 1.6, w: 8.0, h: 0.85, fontSize: 32, bold: true, color: C.navy, fontFace: "Calibri" });
  s.addText(`${meta.period}`, { x: 1.0, y: 2.45, w: 8.0, h: 0.5, fontSize: 16, color: C.navy, fontFace: "Calibri" });
  s.addShape(pres.ShapeType.rect, { x: 1.0, y: 3.05, w: 7.0, h: 0.025, fill: { color: C.border }, line: { color: C.border } });
  s.addText(`顧客：${meta.client}`, { x: 1.0, y: 3.15, w: 5, h: 0.35, fontSize: 13, color: C.muted, fontFace: "Calibri" });
  s.addText("作成：マクロジ ECコンサルティング部", { x: 1.0, y: 3.5, w: 6, h: 0.3, fontSize: 11, color: C.muted, fontFace: "Calibri" });
  s.addShape(pres.ShapeType.rect, { x: 0, y: 5.4, w: "100%", h: 0.225, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("© 2026 マクロジ Co., Ltd.  Confidential", { x: 0.15, y: 5.41, w: 5, h: 0.2, fontSize: 7, color: C.white, fontFace: "Calibri" });
  s.addText("Maclogi-EC Consulting", { x: 5.5, y: 5.41, w: 4.2, h: 0.2, fontSize: 7, color: C.white, fontFace: "Calibri", align: "right" });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 2: サマリー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 2, "サマリー");

  const top3 = [
    { label: "売上合計",  cur: `¥${fmt(kpi.cur.sales)}`,          mom: kpi.mom.sales },
    { label: "注文件数",  cur: `${fmt(kpi.cur.orders)}件`,         mom: kpi.mom.orders },
    { label: "アクセス数", cur: `${fmt(kpi.cur.access)}人`,        mom: kpi.mom.access },
  ];
  top3.forEach((h, i) => {
    const x = 0.3 + i * 3.15;
    s.addShape(pres.ShapeType.rect, { x, y: 0.85, w: 3.0, h: 1.85, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
    s.addShape(pres.ShapeType.rect, { x, y: 0.85, w: 3.0, h: 0.1, fill: { color: C.teal }, line: { color: C.teal } });
    s.addText(h.label, { x, y: 1.0, w: 3.0, h: 0.3, fontSize: 10, color: C.muted, fontFace: "Calibri", align: "center" });
    s.addText(h.cur,   { x, y: 1.3, w: 3.0, h: 0.55, fontSize: 19, bold: true, color: C.navy, fontFace: "Calibri", align: "center" });
    s.addText(`前月比 ${pct(h.mom)}`, { x, y: 1.88, w: 3.0, h: 0.35, fontSize: 11, bold: true, color: pcol(h.mom), fontFace: "Calibri", align: "center" });
  });

  const bot3 = [
    { label: "CVR",        cur: `${Number(kpi.cur.cvr).toFixed(2)}%`, mom: kpi.mom.cvr },
    { label: "客単価(AOV)", cur: `¥${fmt(kpi.cur.aov)}`,              mom: kpi.mom.aov },
    { label: "前月売上",   cur: `¥${fmt(kpi.prv.sales)}`,             mom: null },
  ];
  bot3.forEach((h, i) => {
    const x = 0.3 + i * 3.15;
    s.addShape(pres.ShapeType.rect, { x, y: 2.85, w: 3.0, h: 1.55, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText(h.label, { x, y: 2.92, w: 3.0, h: 0.28, fontSize: 9, color: C.teal, fontFace: "Calibri", align: "center" });
    s.addText(h.cur,   { x, y: 3.2,  w: 3.0, h: 0.5,  fontSize: 18, bold: true, color: C.white, fontFace: "Calibri", align: "center" });
    const sub = h.mom != null ? `前月比 ${pct(h.mom)}` : "2026年6月実績";
    s.addText(sub, { x, y: 3.73, w: 3.0, h: 0.3, fontSize: 9, color: h.mom != null ? pcol(h.mom) : C.teal, fontFace: "Calibri", align: "center" });
  });

  // Sales diff callout
  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 4.5, w: 9.4, h: 0.75, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 4.5, w: 0.08, h: 0.75, fill: { color: C.red }, line: { color: C.red } });
  const diff = kpi.sales_diff || (kpi.cur.sales - kpi.prv.sales);
  s.addText(`売上変化：¥${diff >= 0 ? "+" : ""}${fmt(diff)}　主因：アクセス急減（前月比${pct(kpi.mom.access)}）`, {
    x: 0.5, y: 4.57, w: 9.0, h: 0.35, fontSize: 11, bold: true, color: C.red, fontFace: "Calibri",
  });
  s.addText(`前年比アクセス：${pct(kpi.access_yoy_pct)}　TOP3商品集中度：${kpi.top3_share}%`, {
    x: 0.5, y: 4.9, w: 9.0, h: 0.28, fontSize: 9.5, color: C.muted, fontFace: "Calibri",
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 3: KPIダッシュボード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 3, "KPIダッシュボード｜前月比較");

  const cols = [0.3, 3.2, 5.0, 6.6, 7.9];
  const colW = [2.8, 1.7, 1.5, 1.25, 1.65];
  const headers = ["指標", "今月", "前月", "前月比", "評価"];

  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.82, w: 9.4, h: 0.38, fill: { color: C.navy }, line: { color: C.navy } });
  headers.forEach((h, i) => {
    s.addText(h, { x: cols[i] + 0.05, y: 0.84, w: colW[i], h: 0.34, fontSize: 10, bold: true, color: C.white, fontFace: "Calibri", valign: "middle" });
  });

  const autoNote = (label, momVal) => {
    if (label.includes("アクセス") && momVal < -10) return "⚠ 主因";
    if (label.includes("売上") && momVal < -10) return "⚠ 要対応";
    if (label.includes("注文") && momVal < -10) return "⚠ 要対応";
    if (momVal > 0) return "○ 良好";
    if (momVal < -5) return "△ 微減";
    return "— 安定";
  };

  const rows = [
    { label: "売上合計",    cur: `¥${fmt(kpi.cur.sales)}`,              prv: `¥${fmt(kpi.prv.sales)}`,              m: kpi.mom.sales },
    { label: "注文件数",    cur: `${fmt(kpi.cur.orders)}件`,             prv: `${fmt(kpi.prv.orders)}件`,            m: kpi.mom.orders },
    { label: "客単価(AOV)", cur: `¥${fmt(kpi.cur.aov)}`,               prv: `¥${fmt(kpi.prv.aov)}`,               m: kpi.mom.aov },
    { label: "アクセス数",  cur: `${fmt(kpi.cur.access)}人`,             prv: `${fmt(kpi.prv.access)}人`,            m: kpi.mom.access },
    { label: "CVR",         cur: `${Number(kpi.cur.cvr).toFixed(2)}%`,   prv: `${Number(kpi.prv.cvr).toFixed(2)}%`, m: kpi.mom.cvr },
  ];

  rows.forEach((r, ri) => {
    const y = 1.28 + ri * 0.72;
    s.addShape(pres.ShapeType.rect, { x: 0.3, y, w: 9.4, h: 0.68, fill: { color: ri % 2 === 0 ? C.bg : C.light }, line: { color: C.border, pt: 0.5 } });
    s.addText(r.label, { x: cols[0]+0.1,  y: y+0.05, w: colW[0], h: 0.58, fontSize: 11, bold: true, color: C.navy,       fontFace: "Calibri", valign: "middle" });
    s.addText(r.cur,   { x: cols[1]+0.05, y: y+0.05, w: colW[1], h: 0.58, fontSize: 11, color: C.text,       fontFace: "Calibri", valign: "middle" });
    s.addText(r.prv,   { x: cols[2]+0.05, y: y+0.05, w: colW[2], h: 0.58, fontSize: 10, color: C.muted,      fontFace: "Calibri", valign: "middle" });
    s.addText(pct(r.m),{ x: cols[3]+0.05, y: y+0.05, w: colW[3], h: 0.58, fontSize: 12, bold: true, color: pcol(r.m),   fontFace: "Calibri", valign: "middle" });
    s.addText(autoNote(r.label, r.m), { x: cols[4]+0.05, y: y+0.05, w: colW[4], h: 0.58, fontSize: 10, color: C.muted, fontFace: "Calibri", valign: "middle" });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 4: 売上分解
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 4, "売上分解｜アクセス × CVR × 客単価");

  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.85, w: 9.4, h: 0.52, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("売上 = アクセス × CVR × 客単価（AOV）", {
    x: 0.5, y: 0.9, w: 9.0, h: 0.42, fontSize: 14, bold: true, color: C.white, fontFace: "Calibri", align: "center",
  });

  const factors = [
    { label: "アクセス",    cur: `${fmt(kpi.cur.access)}人`,              m: kpi.mom.access, note: kpi.mom.access < -10 ? "主因 ▶ 広告・SEO対策が急務" : "アクセス回復施策を継続" },
    { label: "CVR",         cur: `${Number(kpi.cur.cvr).toFixed(2)}%`,    m: kpi.mom.cvr,    note: Math.abs(kpi.mom.cvr) < 5 ? "安定 ▶ ページ品質は維持" : "ページ改善で補完を検討" },
    { label: "客単価(AOV)", cur: `¥${fmt(kpi.cur.aov)}`,                  m: kpi.mom.aov,    note: kpi.mom.aov > 0 ? "改善 ▶ セット販売継続" : "商品構成の見直しを検討" },
  ];

  factors.forEach((f, i) => {
    const x = 0.3 + i * 3.15;
    s.addShape(pres.ShapeType.rect, { x, y: 1.47, w: 3.0, h: 3.0, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
    s.addShape(pres.ShapeType.rect, { x, y: 1.47, w: 3.0, h: 0.1, fill: { color: C.teal }, line: { color: C.teal } });
    s.addText(f.label, { x, y: 1.64, w: 3.0, h: 0.32, fontSize: 11, bold: true, color: C.navy, fontFace: "Calibri", align: "center" });
    s.addText(f.cur,   { x, y: 1.98, w: 3.0, h: 0.55, fontSize: 21, bold: true, color: C.navy, fontFace: "Calibri", align: "center" });
    s.addText(pct(f.m),{ x, y: 2.55, w: 3.0, h: 0.4,  fontSize: 14, bold: true, color: pcol(f.m), fontFace: "Calibri", align: "center" });
    s.addShape(pres.ShapeType.rect, { x, y: 3.0, w: 3.0, h: 0.025, fill: { color: C.border }, line: { color: C.border } });
    s.addText(f.note, { x: x+0.1, y: 3.07, w: 2.8, h: 1.2, fontSize: 9, color: C.muted, fontFace: "Calibri" });
  });

  s.addText("×", { x: 3.2,  y: 2.1, w: 0.35, h: 0.4, fontSize: 18, bold: true, color: C.teal, fontFace: "Calibri", align: "center" });
  s.addText("×", { x: 6.35, y: 2.1, w: 0.35, h: 0.4, fontSize: 18, bold: true, color: C.teal, fontFace: "Calibri", align: "center" });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 5: SKUランキング
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 5, `SKU別売上ランキング TOP${skus.length}`);

  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.82, w: 9.4, h: 0.36, fill: { color: C.navy }, line: { color: C.navy } });
  const hcols = [
    { label: "順位", x: 0.35, w: 0.4 },
    { label: "商品名", x: 0.85, w: 2.7 },
    { label: "SKU-ID", x: 3.65, w: 1.4 },
    { label: "売上", x: 5.12, w: 1.45 },
    { label: "構成比", x: 6.62, w: 0.85 },
    { label: "前月比", x: 7.52, w: 0.9 },
    { label: "個数", x: 8.45, w: 0.7 },
    { label: "単価", x: 9.15, w: 0.55 },
  ];
  hcols.forEach(h => {
    s.addText(h.label, { x: h.x, y: 0.83, w: h.w, h: 0.34, fontSize: 9, bold: true, color: C.white, fontFace: "Calibri", align: "center", valign: "middle" });
  });

  skus.forEach((sku, ri) => {
    const y = 1.22 + ri * 0.55;
    s.addShape(pres.ShapeType.rect, { x: 0.3, y, w: 9.4, h: 0.52, fill: { color: ri % 2 === 0 ? C.bg : C.light }, line: { color: C.border, pt: 0.5 } });
    const rankColor = ri === 0 ? "C0A020" : ri === 1 ? "888888" : ri === 2 ? "A06030" : C.border;
    s.addShape(pres.ShapeType.rect, { x: 0.35, y: y+0.07, w: 0.38, h: 0.38, fill: { color: rankColor }, line: { color: rankColor } });
    s.addText(String(ri+1), { x: 0.35, y: y+0.07, w: 0.38, h: 0.38, fontSize: 11, bold: true, color: C.white, fontFace: "Calibri", align: "center", valign: "middle" });
    s.addText(sku.name, { x: 0.85, y: y+0.06, w: 2.7, h: 0.4, fontSize: 9, color: C.text, fontFace: "Calibri", valign: "middle" });
    s.addText(sku.id, { x: 3.65, y: y+0.06, w: 1.4, h: 0.4, fontSize: 9, color: C.muted, fontFace: "Calibri", align: "center", valign: "middle" });
    s.addText(`¥${fmt(sku.sales)}`, { x: 5.12, y: y+0.06, w: 1.45, h: 0.4, fontSize: 10, bold: true, color: C.navy, fontFace: "Calibri", align: "right", valign: "middle" });
    s.addText(`${sku.share.toFixed(1)}%`, { x: 6.62, y: y+0.06, w: 0.85, h: 0.4, fontSize: 9, color: C.muted, fontFace: "Calibri", align: "center", valign: "middle" });
    const momText = sku.is_new ? "新規" : pct(sku.mom);
    s.addText(momText, { x: 7.52, y: y+0.06, w: 0.9, h: 0.4, fontSize: 10, bold: true, color: sku.is_new ? C.teal : pcol(sku.mom), fontFace: "Calibri", align: "center", valign: "middle" });
    s.addText(String(sku.qty), { x: 8.45, y: y+0.06, w: 0.7, h: 0.4, fontSize: 9, color: C.text, fontFace: "Calibri", align: "center", valign: "middle" });
    s.addText(`¥${fmt(sku.price)}`, { x: 9.15, y: y+0.06, w: 0.55, h: 0.4, fontSize: 8, color: C.muted, fontFace: "Calibri", align: "right", valign: "middle" });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 6: FACT / HYPOTHESIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 6, "FACT（事実）／HYPOTHESIS（仮説）");

  // FACT
  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.85, w: 4.55, h: 4.4, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.85, w: 4.55, h: 0.42, fill: { color: C.teal }, line: { color: C.teal } });
  s.addText("FACT（データが示す事実）", { x: 0.35, y: 0.88, w: 4.45, h: 0.36, fontSize: 11, bold: true, color: C.white, fontFace: "Calibri", valign: "middle" });

  const rowH = Math.min(0.55, (4.4 - 0.55) / analysis.facts.length);
  analysis.facts.forEach((f, i) => {
    s.addText(`• ${f}`, { x: 0.45, y: 1.35 + i * rowH, w: 4.3, h: rowH, fontSize: 9.5, color: C.text, fontFace: "Calibri" });
  });

  // HYPOTHESIS
  s.addShape(pres.ShapeType.rect, { x: 5.1, y: 0.85, w: 4.55, h: 4.4, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
  s.addShape(pres.ShapeType.rect, { x: 5.1, y: 0.85, w: 4.55, h: 0.42, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("HYPOTHESIS（仮説・要確認）", { x: 5.15, y: 0.88, w: 4.45, h: 0.36, fontSize: 11, bold: true, color: C.white, fontFace: "Calibri", valign: "middle" });

  const hRowH = Math.min(0.72, (4.4 - 0.55) / analysis.hypotheses.length);
  analysis.hypotheses.forEach((h, i) => {
    s.addText(`• ${h}`, { x: 5.2, y: 1.35 + i * hRowH, w: 4.35, h: hRowH, fontSize: 9.5, color: C.text, fontFace: "Calibri" });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 7: アクションプラン
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 7, "優先アクション（P0 / P1）");

  s.addText("Impact × Confidence × Speed ÷ Effort の順で優先順位付けしています。", {
    x: 0.3, y: 0.82, w: 9.4, h: 0.36, fontSize: 9.5, color: C.muted, fontFace: "Calibri",
  });

  const priColor = (p) => p === "P0" ? C.red : C.orange;
  const colCount = Math.min(analysis.actions.length, 3);
  const colW = (9.4 - 0.3 * (colCount + 1)) / colCount;

  analysis.actions.forEach((a, i) => {
    const x = 0.3 + i * (colW + 0.3);
    s.addShape(pres.ShapeType.rect, { x, y: 1.28, w: colW, h: 4.0, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
    s.addShape(pres.ShapeType.rect, { x, y: 1.28, w: colW, h: 0.48, fill: { color: priColor(a.priority) }, line: { color: priColor(a.priority) } });
    s.addText(`${a.priority}  ${a.title}`, { x: x+0.1, y: 1.3, w: colW-0.2, h: 0.44, fontSize: 10, bold: true, color: C.white, fontFace: "Calibri", valign: "middle" });
    s.addText(`期限: ${a.deadline}`, { x: x+0.1, y: 1.82, w: colW-0.2, h: 0.28, fontSize: 8.5, color: C.muted, fontFace: "Calibri" });
    a.items.forEach((item, j) => {
      s.addText(`✓ ${item}`, { x: x+0.1, y: 2.18 + j * 0.6, w: colW-0.2, h: 0.56, fontSize: 9, color: C.text, fontFace: "Calibri" });
    });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 8: Next Steps
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 8, "Next Steps");

  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.85, w: 3.6, h: 4.4, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("来月に向けて", { x: 0.5, y: 1.2, w: 3.2, h: 0.5, fontSize: 14, bold: true, color: C.teal, fontFace: "Calibri" });
  s.addText("アクセス回復を軸に\n来月の売上目標に向けた\n施策を実行します", {
    x: 0.5, y: 1.75, w: 3.2, h: 1.2, fontSize: 12, color: C.white, fontFace: "Calibri",
  });
  s.addShape(pres.ShapeType.rect, { x: 0.5, y: 3.0, w: 3.0, h: 0.025, fill: { color: C.teal }, line: { color: C.teal } });
  s.addText("8月 目標\n¥6,500,000", {
    x: 0.5, y: 3.1, w: 3.2, h: 0.9, fontSize: 18, bold: true, color: C.white, fontFace: "Calibri",
  });

  const steps = [
    { week: "今週", task: "アクセス急減の原因特定（広告ログ・SEO確認）" },
    { week: "今週", task: "RPP広告の予算・配信設定を最適化" },
    { week: "今月中", task: `主力商品の在庫・欠品リスクを評価` },
    { week: "今月中", task: "8月イベント参加の準備・商品登録" },
    { week: "翌月初", task: "8月度レポート・KPI振り返りMTG" },
  ];
  steps.forEach((step, i) => {
    const y = 0.95 + i * 0.73;
    s.addShape(pres.ShapeType.rect, { x: 4.15, y, w: 5.5, h: 0.65, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
    s.addShape(pres.ShapeType.rect, { x: 4.15, y, w: 0.08, h: 0.65, fill: { color: C.teal }, line: { color: C.teal } });
    s.addText(step.week, { x: 4.3, y: y+0.03, w: 1.2, h: 0.28, fontSize: 8.5, color: C.teal, bold: true, fontFace: "Calibri" });
    s.addText(step.task, { x: 4.3, y: y+0.32, w: 5.2, h: 0.28, fontSize: 9.5, color: C.text, fontFace: "Calibri" });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 出力
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const periodSlug = (meta.period || "report").replace(/年|月/g, "");
const outDir = jsonArg ? path.dirname(jsonArg) : ".";
const outFile = path.join(outDir, `ec_report_${periodSlug}.pptx`);

pres.writeFile({ fileName: outFile })
  .then(() => console.log(`✅ 生成完了: ${outFile}`))
  .catch(e => { console.error("❌ エラー:", e); process.exit(1); });
