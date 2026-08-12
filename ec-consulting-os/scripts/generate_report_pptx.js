const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10" x 5.625"

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Maclogi ブランドカラー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  teal:    "5CBEC6", // primary brand teal
  navy:    "44546A", // dark navy for cards/headers
  white:   "FFFFFF",
  bg:      "FFFFFF",
  text:    "222222",
  muted:   "666666",
  light:   "F5F7FA",
  border:  "D0D8E4",
  red:     "C0392B",
  green:   "27AE60",
  orange:  "E67E22",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 分析データ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const data = {
  client:  "株式会社マクロジ",
  period:  "2026年7月",
  channel: "楽天市場",
  cur: { sales: 5264311, orders: 419, aov: 12563, access: 23174, cvr: 1.81 },
  prv: { sales: 7653026, orders: 598, aov: 12797, access: 29406, cvr: 2.03 },
  skus: [
    { id: "yj-0003",   name: "すのこベッド（シングル）",   sales: 1098680, share: 20.9, mom: -8.9,  qty: 74,  price: 14847 },
    { id: "mc-0006",   name: "ペットドライヤーハウス",      sales:  984410, share: 18.7, mom: +83.6, qty: 59,  price: 16685 },
    { id: "loona-h",   name: "AI搭載ペットロボットLoona",   sales:  693000, share: 13.2, mom: +29.1, qty:  7,  price: 99000 },
    { id: "yj-0002_a", name: "大容量収納ベッド",            sales:  511780, share:  9.7, mom: -12.0, qty: 40,  price: 12795 },
    { id: "mc-0004-1", name: "見守りカメラTalkMee",         sales:  280410, share:  5.3, mom:  +0.1, qty: 69,  price:  4064 },
    { id: "yj-0004_a", name: "テレビ台幅150cm",             sales:  260910, share:  5.0, mom: +65.5, qty: 39,  price:  6690 },
    { id: "yj-0001_b", name: "機能性すのこベッド",          sales:  256350, share:  4.9, mom: -74.6, qty: 28,  price:  9155 },
  ],
};

const fmt = (n) => n.toLocaleString("ja-JP");
const pct = (v) => (v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`);
const mom = (cur, prv) => ((cur - prv) / prv * 100);
const pctColor = (v) => v >= 0 ? C.green : C.red;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ヘルパー：スライド共通フレーム
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function addFrame(slide, pageNum, title) {
  // White background
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.bg }, line: { color: C.bg } });

  // Teal line below header (thin, full width)
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0.72, w: 9.0, h: 0.03, fill: { color: C.teal }, line: { color: C.teal } });

  // Teal footer bar
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 5.4, w: "100%", h: 0.225, fill: { color: C.teal }, line: { color: C.teal } });

  // Copyright footer text
  slide.addText("© 2026 マクロジ Co., Ltd.  Confidential", {
    x: 0.15, y: 5.41, w: 5, h: 0.2,
    fontSize: 7, color: C.white, fontFace: "Calibri",
  });

  // Page title
  slide.addText(title, {
    x: 0.3, y: 0.12, w: 7.5, h: 0.5,
    fontSize: 18, bold: true, color: C.navy, fontFace: "Calibri",
  });

  // Page number
  slide.addText(String(pageNum), {
    x: 9.2, y: 0.15, w: 0.55, h: 0.4,
    fontSize: 20, bold: true, color: C.teal, fontFace: "Calibri", align: "right",
  });

  // "Maclogi-EC Consulting" top right label
  slide.addText("Maclogi-EC Consulting", {
    x: 6.0, y: 0.08, w: 3.6, h: 0.28,
    fontSize: 8, color: C.muted, fontFace: "Calibri", align: "right",
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 1: Title
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();

  // Full teal background
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.teal }, line: { color: C.teal } });

  // White center card
  s.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.8, w: 8.8, h: 4.0, fill: { color: C.white }, line: { color: C.white } });

  // Navy accent left edge on card
  s.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.8, w: 0.12, h: 4.0, fill: { color: C.navy }, line: { color: C.navy } });

  s.addText("月次ECレポート", {
    x: 1.0, y: 1.1, w: 8.0, h: 0.6,
    fontSize: 11, color: C.teal, bold: true, fontFace: "Calibri",
  });
  s.addText("楽天市場 売上分析レポート", {
    x: 1.0, y: 1.65, w: 8.0, h: 0.9,
    fontSize: 32, bold: true, color: C.navy, fontFace: "Calibri",
  });
  s.addText(`${data.period}　${data.channel}`, {
    x: 1.0, y: 2.55, w: 8.0, h: 0.5,
    fontSize: 16, color: C.navy, fontFace: "Calibri",
  });

  // Divider
  s.addShape(pres.ShapeType.rect, { x: 1.0, y: 3.1, w: 7.0, h: 0.025, fill: { color: C.border }, line: { color: C.border } });

  s.addText(`顧客：${data.client}`, {
    x: 1.0, y: 3.2, w: 5, h: 0.35,
    fontSize: 13, color: C.muted, fontFace: "Calibri",
  });
  s.addText("作成：マクロジ ECコンサルティング部", {
    x: 1.0, y: 3.55, w: 6, h: 0.3,
    fontSize: 11, color: C.muted, fontFace: "Calibri",
  });

  // Footer
  s.addShape(pres.ShapeType.rect, { x: 0, y: 5.4, w: "100%", h: 0.225, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("© 2026 マクロジ Co., Ltd.  Confidential", {
    x: 0.15, y: 5.41, w: 5, h: 0.2,
    fontSize: 7, color: C.white, fontFace: "Calibri",
  });
  s.addText("Maclogi-EC Consulting", {
    x: 5.5, y: 5.41, w: 4.2, h: 0.2,
    fontSize: 7, color: C.white, fontFace: "Calibri", align: "right",
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 2: サマリー（エグゼクティブ）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 2, "サマリー");

  // Intro text
  s.addText("2026年7月の楽天市場における主要KPIを前月比で比較します。アクセス急減が売上低下の主因です。", {
    x: 0.3, y: 0.82, w: 9.4, h: 0.45,
    fontSize: 10, color: C.muted, fontFace: "Calibri",
  });

  // 3 highlight boxes
  const highlights = [
    { label: "売上合計", cur: `¥${fmt(data.cur.sales)}`, sub: `前月比 ${pct(mom(data.cur.sales, data.prv.sales))}`, positive: false },
    { label: "注文件数", cur: `${fmt(data.cur.orders)}件`, sub: `前月比 ${pct(mom(data.cur.orders, data.prv.orders))}`, positive: false },
    { label: "アクセス数", cur: `${fmt(data.cur.access)}人`, sub: `前月比 ${pct(mom(data.cur.access, data.prv.access))}`, positive: false },
  ];
  const bx = [0.3, 3.45, 6.6];
  highlights.forEach((h, i) => {
    const x = bx[i];
    // Card
    s.addShape(pres.ShapeType.rect, { x, y: 1.4, w: 3.0, h: 1.8,
      fill: { color: C.light }, line: { color: C.border, pt: 1 } });
    // Teal top accent
    s.addShape(pres.ShapeType.rect, { x, y: 1.4, w: 3.0, h: 0.1, fill: { color: C.teal }, line: { color: C.teal } });
    s.addText(h.label, { x, y: 1.55, w: 3.0, h: 0.3, fontSize: 10, color: C.muted, fontFace: "Calibri", align: "center" });
    s.addText(h.cur, { x, y: 1.85, w: 3.0, h: 0.55, fontSize: 20, bold: true, color: C.navy, fontFace: "Calibri", align: "center" });
    const v = parseFloat(h.sub.replace(/[^0-9.-]/g,"")) * (h.sub.includes("-") ? -1 : 1);
    s.addText(h.sub, { x, y: 2.42, w: 3.0, h: 0.35, fontSize: 11, bold: true, color: pctColor(v), fontFace: "Calibri", align: "center" });
  });

  // Bottom row: CVR & AOV
  const bottom = [
    { label: "CVR", cur: `${data.cur.cvr.toFixed(2)}%`, sub: `前月比 ${pct(mom(data.cur.cvr, data.prv.cvr))}` },
    { label: "客単価(AOV)", cur: `¥${fmt(data.cur.aov)}`, sub: `前月比 ${pct(mom(data.cur.aov, data.prv.aov))}` },
    { label: "前月売上", cur: `¥${fmt(data.prv.sales)}`, sub: "2026年6月実績" },
  ];
  const bx2 = [0.3, 3.45, 6.6];
  bottom.forEach((h, i) => {
    const x = bx2[i];
    s.addShape(pres.ShapeType.rect, { x, y: 3.35, w: 3.0, h: 1.5,
      fill: { color: C.navy }, line: { color: C.navy } });
    s.addText(h.label, { x, y: 3.42, w: 3.0, h: 0.28, fontSize: 9, color: C.teal, fontFace: "Calibri", align: "center" });
    s.addText(h.cur, { x, y: 3.7, w: 3.0, h: 0.5, fontSize: 18, bold: true, color: C.white, fontFace: "Calibri", align: "center" });
    s.addText(h.sub, { x, y: 4.22, w: 3.0, h: 0.3, fontSize: 9, color: C.teal, fontFace: "Calibri", align: "center" });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 3: KPIダッシュボード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 3, "KPIダッシュボード｜前月比較");

  // Table header
  const cols = [0.3, 3.2, 5.0, 6.6, 7.9];
  const colW = [2.8, 1.7, 1.5, 1.25, 1.65];
  const headers = ["指標", "今月（7月）", "前月（6月）", "前月比", "評価"];

  // Header row
  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.82, w: 9.4, h: 0.38, fill: { color: C.navy }, line: { color: C.navy } });
  headers.forEach((h, i) => {
    s.addText(h, { x: cols[i] + 0.05, y: 0.84, w: colW[i], h: 0.34, fontSize: 10, bold: true, color: C.white, fontFace: "Calibri", valign: "middle" });
  });

  const rows = [
    { label: "売上合計", cur: `¥${fmt(data.cur.sales)}`, prv: `¥${fmt(data.prv.sales)}`, diff: mom(data.cur.sales, data.prv.sales), note: "⚠ 要対応" },
    { label: "注文件数", cur: `${fmt(data.cur.orders)}件`, prv: `${fmt(data.prv.orders)}件`, diff: mom(data.cur.orders, data.prv.orders), note: "⚠ 要対応" },
    { label: "客単価 (AOV)", cur: `¥${fmt(data.cur.aov)}`, prv: `¥${fmt(data.prv.aov)}`, diff: mom(data.cur.aov, data.prv.aov), note: "○ 維持" },
    { label: "アクセス数", cur: `${fmt(data.cur.access)}人`, prv: `${fmt(data.prv.access)}人`, diff: mom(data.cur.access, data.prv.access), note: "⚠ 主因" },
    { label: "CVR", cur: `${data.cur.cvr.toFixed(2)}%`, prv: `${data.prv.cvr.toFixed(2)}%`, diff: mom(data.cur.cvr, data.prv.cvr), note: "△ 微減" },
  ];

  rows.forEach((r, ri) => {
    const y = 1.28 + ri * 0.72;
    const bg = ri % 2 === 0 ? C.bg : C.light;
    s.addShape(pres.ShapeType.rect, { x: 0.3, y, w: 9.4, h: 0.68, fill: { color: bg }, line: { color: C.border, pt: 0.5 } });
    s.addText(r.label, { x: cols[0] + 0.1, y: y + 0.05, w: colW[0], h: 0.58, fontSize: 11, bold: true, color: C.navy, fontFace: "Calibri", valign: "middle" });
    s.addText(r.cur,   { x: cols[1] + 0.05, y: y + 0.05, w: colW[1], h: 0.58, fontSize: 11, color: C.text, fontFace: "Calibri", valign: "middle" });
    s.addText(r.prv,   { x: cols[2] + 0.05, y: y + 0.05, w: colW[2], h: 0.58, fontSize: 10, color: C.muted, fontFace: "Calibri", valign: "middle" });
    s.addText(pct(r.diff), { x: cols[3] + 0.05, y: y + 0.05, w: colW[3], h: 0.58, fontSize: 12, bold: true, color: pctColor(r.diff), fontFace: "Calibri", valign: "middle" });
    s.addText(r.note,  { x: cols[4] + 0.05, y: y + 0.05, w: colW[4], h: 0.58, fontSize: 10, color: C.muted, fontFace: "Calibri", valign: "middle" });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 4: 売上分解
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 4, "売上分解｜アクセス × CVR × 客単価");

  s.addText("売上変化の要因を3要素に分解し、施策の優先順位を特定します。", {
    x: 0.3, y: 0.82, w: 9.4, h: 0.38, fontSize: 10, color: C.muted, fontFace: "Calibri",
  });

  // Formula banner
  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 1.28, w: 9.4, h: 0.55, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("売上 = アクセス × CVR × 客単価（AOV）", {
    x: 0.5, y: 1.33, w: 9.0, h: 0.45,
    fontSize: 14, bold: true, color: C.white, fontFace: "Calibri", align: "center",
  });

  // Three factor cards
  const factors = [
    { label: "アクセス", cur: fmt(data.cur.access), unit: "人", diff: mom(data.cur.access, data.prv.access), contribution: "主因 ▶ 広告・SEO対策が急務" },
    { label: "CVR", cur: `${data.cur.cvr.toFixed(2)}`, unit: "%", diff: mom(data.cur.cvr, data.prv.cvr), contribution: "微減 ▶ ページ改善で補完可能" },
    { label: "客単価 (AOV)", cur: `¥${fmt(data.cur.aov)}`, unit: "", diff: mom(data.cur.aov, data.prv.aov), contribution: "安定 ▶ セット販売継続" },
  ];

  factors.forEach((f, i) => {
    const x = 0.3 + i * 3.15;
    s.addShape(pres.ShapeType.rect, { x, y: 1.93, w: 3.0, h: 2.8, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
    s.addShape(pres.ShapeType.rect, { x, y: 1.93, w: 3.0, h: 0.1, fill: { color: C.teal }, line: { color: C.teal } });
    s.addText(f.label, { x, y: 2.1, w: 3.0, h: 0.32, fontSize: 11, bold: true, color: C.navy, fontFace: "Calibri", align: "center" });
    s.addText(`${f.cur}${f.unit}`, { x, y: 2.45, w: 3.0, h: 0.55, fontSize: 22, bold: true, color: C.navy, fontFace: "Calibri", align: "center" });
    s.addText(pct(f.diff), { x, y: 3.02, w: 3.0, h: 0.42, fontSize: 14, bold: true, color: pctColor(f.diff), fontFace: "Calibri", align: "center" });
    s.addShape(pres.ShapeType.rect, { x, y: 3.5, w: 3.0, h: 0.025, fill: { color: C.border }, line: { color: C.border } });
    s.addText(f.contribution, { x: x + 0.1, y: 3.55, w: 2.8, h: 0.9, fontSize: 9, color: C.muted, fontFace: "Calibri" });
  });

  // "×" connectors
  s.addText("×", { x: 3.2, y: 2.65, w: 0.35, h: 0.4, fontSize: 18, bold: true, color: C.teal, fontFace: "Calibri", align: "center" });
  s.addText("×", { x: 6.35, y: 2.65, w: 0.35, h: 0.4, fontSize: 18, bold: true, color: C.teal, fontFace: "Calibri", align: "center" });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 5: SKU別売上ランキング
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 5, "SKU別売上ランキング TOP7");

  // Table header
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

  data.skus.forEach((sku, ri) => {
    const y = 1.22 + ri * 0.56;
    const bg = ri % 2 === 0 ? C.bg : C.light;
    s.addShape(pres.ShapeType.rect, { x: 0.3, y, w: 9.4, h: 0.52, fill: { color: bg }, line: { color: C.border, pt: 0.5 } });

    // Rank badge
    const rankColor = ri === 0 ? "C0A020" : ri === 1 ? "888888" : ri === 2 ? "A06030" : C.border;
    s.addShape(pres.ShapeType.rect, { x: 0.35, y: y + 0.07, w: 0.38, h: 0.38, fill: { color: rankColor }, line: { color: rankColor } });
    s.addText(String(ri + 1), { x: 0.35, y: y + 0.07, w: 0.38, h: 0.38, fontSize: 11, bold: true, color: C.white, fontFace: "Calibri", align: "center", valign: "middle" });

    s.addText(sku.name, { x: 0.85, y: y + 0.06, w: 2.7, h: 0.4, fontSize: 9, color: C.text, fontFace: "Calibri", valign: "middle" });
    s.addText(sku.id, { x: 3.65, y: y + 0.06, w: 1.4, h: 0.4, fontSize: 9, color: C.muted, fontFace: "Calibri", align: "center", valign: "middle" });
    s.addText(`¥${fmt(sku.sales)}`, { x: 5.12, y: y + 0.06, w: 1.45, h: 0.4, fontSize: 10, bold: true, color: C.navy, fontFace: "Calibri", align: "right", valign: "middle" });
    s.addText(`${sku.share.toFixed(1)}%`, { x: 6.62, y: y + 0.06, w: 0.85, h: 0.4, fontSize: 9, color: C.muted, fontFace: "Calibri", align: "center", valign: "middle" });
    s.addText(pct(sku.mom), { x: 7.52, y: y + 0.06, w: 0.9, h: 0.4, fontSize: 10, bold: true, color: pctColor(sku.mom), fontFace: "Calibri", align: "center", valign: "middle" });
    s.addText(String(sku.qty), { x: 8.45, y: y + 0.06, w: 0.7, h: 0.4, fontSize: 9, color: C.text, fontFace: "Calibri", align: "center", valign: "middle" });
    s.addText(`¥${fmt(sku.price)}`, { x: 9.15, y: y + 0.06, w: 0.55, h: 0.4, fontSize: 8, color: C.muted, fontFace: "Calibri", align: "right", valign: "middle" });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 6: FACT / HYPOTHESIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 6, "FACT（事実）／HYPOTHESIS（仮説）");

  // Left: FACT box
  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.85, w: 4.55, h: 4.4, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.85, w: 4.55, h: 0.42, fill: { color: C.teal }, line: { color: C.teal } });
  s.addText("FACT（データが示す事実）", { x: 0.35, y: 0.88, w: 4.45, h: 0.36, fontSize: 11, bold: true, color: C.white, fontFace: "Calibri", valign: "middle" });

  const facts = [
    "アクセスが前月比 -21.2%（-6,232人）と急減",
    "売上が前月比 -31.2%（-¥2,388,715）",
    "TOP3商品で売上の 52.8% を占める（集中リスク）",
    "mc-0006（ペットドライヤー）が +83.6% と急成長",
    "loona-h（AIロボット）が +29.1% と成長継続",
    "yj-0001_b（すのこベッドB）が -74.6% と急落",
    "客単価は ¥12,563（前月比 -1.8%）と安定維持",
  ];
  facts.forEach((f, i) => {
    s.addText(`• ${f}`, { x: 0.45, y: 1.35 + i * 0.52, w: 4.3, h: 0.48, fontSize: 9.5, color: C.text, fontFace: "Calibri" });
  });

  // Right: HYPOTHESIS box
  s.addShape(pres.ShapeType.rect, { x: 5.1, y: 0.85, w: 4.55, h: 4.4, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
  s.addShape(pres.ShapeType.rect, { x: 5.1, y: 0.85, w: 4.55, h: 0.42, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("HYPOTHESIS（仮説・要確認）", { x: 5.15, y: 0.88, w: 4.45, h: 0.36, fontSize: 11, bold: true, color: C.white, fontFace: "Calibri", valign: "middle" });

  const hyps = [
    "RPP広告予算削減 or インプレッション低下が\n　アクセス急減の主因か？（要: 広告ログ確認）",
    "6月マラソン vs 7月イベント差がアクセスに\n　影響している可能性（イベントカレンダー確認）",
    "yj-0001_bは欠品 or 価格競合の可能性\n　（在庫・競合状況を確認）",
    "mc-0006の成長は広告効果 or オーガニック？\n　（引き続き広告投資の継続が有効か）",
    "CVRは微減（-11.1%）のみ → ページ品質は\n　維持できており、集客回復で売上回復見込み",
  ];
  hyps.forEach((h, i) => {
    s.addText(`• ${h}`, { x: 5.2, y: 1.35 + i * 0.66, w: 4.35, h: 0.62, fontSize: 9.5, color: C.text, fontFace: "Calibri" });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 7: アクションプラン
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 7, "優先アクション（P0 / P1）");

  s.addText("Impact × Confidence × Speed ÷ Effort の順で施策を優先順位付けしています。", {
    x: 0.3, y: 0.82, w: 9.4, h: 0.36, fontSize: 9.5, color: C.muted, fontFace: "Calibri",
  });

  const actions = [
    {
      pri: "P0", color: C.red,
      title: "アクセス急減の原因特定",
      deadline: "今週中（8/15まで）",
      owner: "コンサル担当",
      items: [
        "RPP広告のインプレッション・CPC変化を確認",
        "検索キーワード順位の変化を RMS で確認",
        "6月マラソン vs 7月イベント有無を確認",
      ],
    },
    {
      pri: "P1", color: C.orange,
      title: "主力SKUの在庫リスク確認",
      deadline: "今週中（8/15まで）",
      owner: "EC担当",
      items: [
        "yj-0003・mc-0006・loona-h の在庫日数を確認",
        "欠品リスクがあれば即座に広告を抑制",
        "mc-0006 は成長中のため補充発注を検討",
      ],
    },
    {
      pri: "P1", color: C.orange,
      title: "アクセス回復施策の実行",
      deadline: "8月末まで",
      owner: "コンサル担当",
      items: [
        "RPP広告予算の最適化（インプレッション回復）",
        "検索対策：商品名・キーワードの見直し",
        "8月イベント（お盆セール）への参加検討",
      ],
    },
  ];

  actions.forEach((a, i) => {
    const x = 0.3 + i * 3.15;
    s.addShape(pres.ShapeType.rect, { x, y: 1.28, w: 3.0, h: 3.9, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
    // Priority badge
    s.addShape(pres.ShapeType.rect, { x, y: 1.28, w: 3.0, h: 0.48, fill: { color: a.color }, line: { color: a.color } });
    s.addText(`${a.pri}  ${a.title}`, { x: x + 0.1, y: 1.3, w: 2.8, h: 0.44, fontSize: 10, bold: true, color: C.white, fontFace: "Calibri", valign: "middle" });
    s.addText(`期限: ${a.deadline}　担当: ${a.owner}`, { x: x + 0.1, y: 1.8, w: 2.8, h: 0.3, fontSize: 8.5, color: C.muted, fontFace: "Calibri" });
    a.items.forEach((item, j) => {
      s.addText(`✓ ${item}`, { x: x + 0.1, y: 2.18 + j * 0.58, w: 2.8, h: 0.54, fontSize: 9, color: C.text, fontFace: "Calibri" });
    });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 8: Next Steps / クロージング
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 8, "Next Steps");

  // Left navy panel
  s.addShape(pres.ShapeType.rect, { x: 0.3, y: 0.85, w: 3.6, h: 4.4, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("来月に向けて", { x: 0.5, y: 1.2, w: 3.2, h: 0.5, fontSize: 14, bold: true, color: C.teal, fontFace: "Calibri" });
  s.addText("アクセス回復を軸に\n売上 ¥6.5M 以上を\n目標として設定します", {
    x: 0.5, y: 1.75, w: 3.2, h: 1.2, fontSize: 12, color: C.white, fontFace: "Calibri",
  });
  s.addShape(pres.ShapeType.rect, { x: 0.5, y: 3.0, w: 3.0, h: 0.025, fill: { color: C.teal }, line: { color: C.teal } });
  s.addText("8月 目標\n¥6,500,000", {
    x: 0.5, y: 3.1, w: 3.2, h: 0.9, fontSize: 18, bold: true, color: C.white, fontFace: "Calibri",
  });

  // Right: checklist
  const steps = [
    { week: "8/12〜8/15", task: "アクセス急減の原因特定（広告・SEO）" },
    { week: "8/15〜8/20", task: "RPP広告の予算・配信設定を最適化" },
    { week: "8/20〜8/25", task: "yj-0001_bの価格・ページ・在庫を見直し" },
    { week: "8/25〜8/31", task: "お盆セール・8月イベント参加の効果検証" },
    { week: "9/5", task: "8月度レポート・KPI振り返りMTG" },
  ];

  steps.forEach((step, i) => {
    const y = 0.95 + i * 0.75;
    s.addShape(pres.ShapeType.rect, { x: 4.15, y, w: 5.5, h: 0.65, fill: { color: C.light }, line: { color: C.border, pt: 1 } });
    s.addShape(pres.ShapeType.rect, { x: 4.15, y, w: 0.08, h: 0.65, fill: { color: C.teal }, line: { color: C.teal } });
    s.addText(step.week, { x: 4.3, y: y + 0.03, w: 1.5, h: 0.28, fontSize: 8.5, color: C.teal, bold: true, fontFace: "Calibri" });
    s.addText(step.task, { x: 4.3, y: y + 0.32, w: 5.2, h: 0.28, fontSize: 9.5, color: C.text, fontFace: "Calibri" });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 出力
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const outPath = "ec_report_maclogi_202607.pptx";
pres.writeFile({ fileName: outPath })
  .then(() => console.log(`✅ 生成完了: ${outPath}`))
  .catch(e => { console.error("❌ エラー:", e); process.exit(1); });
