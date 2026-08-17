/**
 * EC Consulting OS — PowerPoint Report Generator (Maclogi Brand Design)
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
    console.error(`ファイルが見つかりません: ${jsonArg}`);
    process.exit(1);
  }
  report = JSON.parse(fs.readFileSync(jsonArg, "utf-8"));
  console.log(`データ読み込み: ${jsonArg}`);
} else {
  console.log("JSONファイル未指定 → サンプルデータを使用します");
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
      { id: "yj-0003",   name: "すのこベッド（シングル）",  sales: 1098680, share: 20.9, mom: -8.9,  qty: 74,  price: 14847 },
      { id: "mc-0006",   name: "ペットドライヤーハウス",     sales:  984410, share: 18.7, mom: 83.6,  qty: 59,  price: 16685 },
      { id: "loona-h",   name: "AI搭載ペットロボットLoona",  sales:  693000, share: 13.2, mom: 29.1,  qty:  7,  price: 99000 },
      { id: "yj-0002_a", name: "大容量収納ベッド",           sales:  511780, share:  9.7, mom: -12.0, qty: 40,  price: 12795 },
      { id: "mc-0004-1", name: "見守りカメラTalkMee",        sales:  280410, share:  5.3, mom:  0.1,  qty: 69,  price:  4064 },
      { id: "yj-0004_a", name: "テレビ台幅150cm",            sales:  260910, share:  5.0, mom: 65.5,  qty: 39,  price:  6690 },
      { id: "yj-0001_b", name: "機能性すのこベッド",         sales:  256350, share:  4.9, mom: -74.6, qty: 28,  price:  9155 },
    ],
    analysis: {
      facts: [
        "アクセスが前月比-21.2%（-6,232人）・前年比-17.0%",
        "売上が前月比-31.2%（¥-2,388,715）と大幅減少",
        "客単価 ¥12,563（前月比-1.8%）は安定を維持",
        "TOP3商品で売上の52.8%を占める（集中度：中）",
        "mc-0006（ペットドライヤーハウス）が前月比+83.6%と急成長",
        "yj-0001_b（機能性すのこベッド）が前月比-74.6%と急落",
      ],
      hypotheses: [
        "アクセスが-21.2%と急減 → RPP広告予算の変化・モールイベント有無・SEO順位変化を確認",
        "客単価は安定しているためCVR・商品構成の悪化ではなく集客不足が主因の可能性",
        "yj-0001_bの急落は在庫切れまたは検索順位下落が原因の可能性が高い",
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
        {
          priority: "P2", title: "商品構成の最適化", deadline: "来月以降",
          items: ["低CVR商品のページ改善", "セット販売の拡充検討"],
        },
      ],
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Maclogi ブランドカラー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  teal:       "5CBEC6",
  tealLight:  "EAF6F7",
  navy:       "44546A",
  white:      "FFFFFF",
  lightGray:  "F5F5F5",
  borderGray: "D9D9D9",
  orange:     "F0A500",
  red:        "D94F3D",
  redLight:   "FDECEA",
  green:      "3DAD6A",
  greenLight: "E8F5EE",
  muted:      "8A9BB0",
  text:       "2C3E50",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ユーティリティ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const fmt   = (n) => Number(n).toLocaleString("ja-JP");
const pct   = (v) => v == null ? "—" : (v >= 0 ? `+${Number(v).toFixed(1)}%` : `${Number(v).toFixed(1)}%`);
const pcol  = (v) => v == null ? C.muted : v >= 0 ? C.green : C.red;
const pbg   = (v) => v == null ? C.lightGray : v >= 0 ? C.greenLight : C.redLight;
const grade = (v) => v == null ? "—" : v >= 5 ? "◎" : v >= 0 ? "○" : v >= -5 ? "△" : "×";
const gcol  = (v) => v == null ? C.muted : v >= 5 ? C.green : v >= 0 ? C.teal : v >= -5 ? C.orange : C.red;

const { meta, kpi, skus = [], analysis } = report;

// 翌月の計算
function nextMonthLabel(period) {
  const m = period.match(/(\d+)年(\d+)月/);
  if (!m) return "翌月";
  let y = parseInt(m[1]), mo = parseInt(m[2]) + 1;
  if (mo > 12) { y++; mo = 1; }
  return `${y}年${mo}月`;
}
const nextMonth = nextMonthLabel(meta.period || "");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10" × 5.625"

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 共通フレーム（スライド2〜8）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function addFrame(slide, pageNum, bigTitle, subTitle) {
  // 背景
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: "100%",
    fill: { color: C.white }, line: { color: C.white },
  });
  // タイトル文字
  const titleText = subTitle ? `${bigTitle}  |  ${subTitle}` : bigTitle;
  slide.addText(titleText, {
    x: 0.28, y: 0.11, w: 7.8, h: 0.56,
    fontSize: 18, bold: true, color: C.navy, fontFace: "Calibri",
    valign: "middle",
  });
  // 右上: マクロジ
  slide.addText("マクロジ", {
    x: 8.0, y: 0.11, w: 1.72, h: 0.56,
    fontSize: 12, bold: true, color: C.navy, fontFace: "Calibri",
    align: "right", valign: "middle",
  });
  // タイトル下の teal ライン
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0.72, w: "100%", h: 0.035,
    fill: { color: C.teal }, line: { color: C.teal },
  });
  // フッター teal バー
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 5.39, w: "100%", h: 0.235,
    fill: { color: C.teal }, line: { color: C.teal },
  });
  slide.addText("© 2026 マクロジ Co., Ltd.", {
    x: 0.18, y: 5.4, w: 3.2, h: 0.2,
    fontSize: 7, color: C.white, fontFace: "Calibri", valign: "middle",
  });
  slide.addText("Confidential", {
    x: 3.5, y: 5.4, w: 3.0, h: 0.2,
    fontSize: 7, color: C.white, fontFace: "Calibri", align: "center", valign: "middle",
  });
  slide.addText(String(pageNum), {
    x: 7.5, y: 5.4, w: 2.3, h: 0.2,
    fontSize: 7, bold: true, color: C.white, fontFace: "Calibri", align: "right", valign: "middle",
  });
}

// カード描画ヘルパー
function addCard(slide, x, y, w, h, opts = {}) {
  const bg   = opts.bg   || C.tealLight;
  const bord = opts.bord || C.teal;
  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill: { color: bg },
    line: { color: bord, pt: opts.borderPt || 1 },
  });
  if (opts.accentColor) {
    slide.addShape(pres.ShapeType.rect, {
      x, y, w: opts.accentW || 0.06, h,
      fill: { color: opts.accentColor }, line: { color: opts.accentColor },
    });
  }
  if (opts.topBar) {
    slide.addShape(pres.ShapeType.rect, {
      x, y, w, h: 0.04,
      fill: { color: opts.topBar }, line: { color: opts.topBar },
    });
  }
}

// タグ/チップ描画
function addTag(slide, x, y, label, opts = {}) {
  const bg  = opts.bg  || C.teal;
  const col = opts.col || C.white;
  const fs  = opts.fs  || 7;
  const tw  = opts.tw  || 0.55;
  slide.addShape(pres.ShapeType.rect, {
    x, y, w: tw, h: 0.22,
    fill: { color: bg }, line: { color: bg },
  });
  slide.addText(label, {
    x, y, w: tw, h: 0.22,
    fontSize: fs, bold: true, color: col, fontFace: "Calibri",
    align: "center", valign: "middle",
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 1: タイトル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();

  // 全面 teal 背景
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: "100%",
    fill: { color: C.teal }, line: { color: C.teal },
  });

  // 斜めストライプ装飾（薄い teal の平行四辺形）
  // 幅0.28"の細い帯を-70度ぐらいの角度で並べる
  // pptxgenjs では parallelogram が使えないため、
  // 細長い rect を回転させてストライプを表現する
  const stripeColor = "6CC8D0";
  const stripeCount = 12;
  for (let si = 0; si < stripeCount; si++) {
    s.addShape(pres.ShapeType.rect, {
      x: -1.0 + si * 1.0, y: -1.0,
      w: 0.22, h: 9.0,
      rotate: 20,
      fill: { color: stripeColor, transparency: 55 },
      line: { color: stripeColor, transparency: 55, pt: 0 },
    });
  }

  // 中央: "マクロジ" ロゴテキスト（白・大）
  // Meiryo = Windows標準日本語フォント。文字間詰め。
  s.addText("マクロジ", {
    x: 0, y: 0.9, w: "100%", h: 1.5,
    fontSize: 68, bold: true, color: C.white, fontFace: "Meiryo",
    charSpacing: -2,
    align: "center", valign: "middle",
  });

  // 上区切りライン
  s.addShape(pres.ShapeType.rect, {
    x: 1.2, y: 2.62, w: 7.6, h: 0.025,
    fill: { color: C.white, transparency: 35 }, line: { color: C.white, transparency: 35 },
  });

  // クライアント名
  s.addText(`${meta.client}様`, {
    x: 0, y: 2.72, w: "100%", h: 0.56,
    fontSize: 22, bold: true, color: C.white, fontFace: "Meiryo",
    align: "center", valign: "middle",
  });

  // ドキュメントタイトル
  s.addText(`${meta.channel} 売上分析レポート　${meta.period}`, {
    x: 0, y: 3.3, w: "100%", h: 0.48,
    fontSize: 17, bold: true, color: C.white, fontFace: "Meiryo",
    align: "center", valign: "middle",
  });

  // 下区切りライン
  s.addShape(pres.ShapeType.rect, {
    x: 1.2, y: 3.86, w: 7.6, h: 0.025,
    fill: { color: C.white, transparency: 35 }, line: { color: C.white, transparency: 35 },
  });

  // コピーライト（フッター、バー無し）
  s.addText("© 2026 マクロジ Co., Ltd.", {
    x: 0, y: 5.18, w: "100%", h: 0.3,
    fontSize: 8.5, color: C.white, fontFace: "Meiryo", align: "center", valign: "middle",
    transparency: 25,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 2: エグゼクティブサマリー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 2, "エグゼクティブサマリー", `${meta.period} 概況`);

  // 5 KPI タイル（横一列）
  const tiles = [
    { label: "売上",   value: `¥${fmt(kpi.cur.sales)}`,                   mom: kpi.mom.sales },
    { label: "注文件数", value: `${fmt(kpi.cur.orders)}件`,                mom: kpi.mom.orders },
    { label: "アクセス", value: `${fmt(kpi.cur.access)}人`,                mom: kpi.mom.access },
    { label: "CVR",    value: `${Number(kpi.cur.cvr).toFixed(2)}%`,        mom: kpi.mom.cvr },
    { label: "客単価", value: `¥${fmt(kpi.cur.aov)}`,                      mom: kpi.mom.aov },
  ];

  const tileW = 1.82, tileH = 1.42, tileGap = 0.06;
  const tileStartX = 0.28;

  tiles.forEach((t, i) => {
    const tx = tileStartX + i * (tileW + tileGap);
    const ty = 0.82;

    // タイル背景: navy
    s.addShape(pres.ShapeType.rect, {
      x: tx, y: ty, w: tileW, h: tileH,
      fill: { color: C.navy }, line: { color: C.navy },
    });
    // teal ラベル
    s.addText(t.label, {
      x: tx, y: ty + 0.1, w: tileW, h: 0.26,
      fontSize: 9, bold: true, color: C.teal, fontFace: "Calibri",
      align: "center", valign: "middle",
    });
    // 白 値
    s.addText(t.value, {
      x: tx, y: ty + 0.38, w: tileW, h: 0.52,
      fontSize: t.label === "売上" ? 15 : 16, bold: true, color: C.white, fontFace: "Calibri",
      align: "center", valign: "middle",
    });
    // 前月比
    const momStr = `前月比 ${pct(t.mom)}`;
    s.addText(momStr, {
      x: tx, y: ty + 0.94, w: tileW, h: 0.34,
      fontSize: 10, bold: true, color: pcol(t.mom), fontFace: "Calibri",
      align: "center", valign: "middle",
    });
  });

  // 今月の重要メッセージ ヘッダー
  s.addText("今月の重要メッセージ", {
    x: 0.28, y: 2.36, w: 5, h: 0.28,
    fontSize: 10, bold: true, color: C.navy, fontFace: "Calibri",
  });

  // 事実カード3枚
  const facts = (analysis.facts || []).slice(0, 3);
  const cardH = 0.54;
  facts.forEach((fact, i) => {
    const fy = 2.68 + i * (cardH + 0.08);
    addCard(s, 0.28, fy, 9.44, cardH, { bg: C.tealLight, bord: C.teal, accentColor: C.teal, accentW: 0.06 });
    // ラベルタグ
    addTag(s, 0.38, fy + 0.16, `FACT ${i + 1}`, { bg: C.navy, tw: 0.58, fs: 7 });
    s.addText(fact, {
      x: 1.04, y: fy + 0.08, w: 8.5, h: cardH - 0.16,
      fontSize: 9.5, color: C.text, fontFace: "Calibri", valign: "middle",
    });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 3: KPIダッシュボード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 3, "KPIダッシュボード", "前月比較");

  // テーブル列定義
  const cols  = [0.28, 2.52, 4.60, 6.28, 7.62, 8.70];
  const colW  = [2.20, 2.04, 1.64, 1.30, 1.04, 1.02];
  const heads = ["指標", "今月", "前月", "前月比", "評価", ""];

  const tableTop = 0.85;
  const hdrH = 0.42;

  // ヘッダー navy バー
  s.addShape(pres.ShapeType.rect, {
    x: 0.28, y: tableTop, w: 9.44, h: hdrH,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  heads.forEach((h, i) => {
    if (!h) return;
    s.addText(h, {
      x: cols[i] + 0.08, y: tableTop + 0.02, w: colW[i], h: hdrH - 0.04,
      fontSize: 10, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
    });
  });

  const rows = [
    { label: "売上合計",     cur: `¥${fmt(kpi.cur.sales)}`,               prv: `¥${fmt(kpi.prv.sales)}`,               m: kpi.mom.sales },
    { label: "注文件数",     cur: `${fmt(kpi.cur.orders)}件`,              prv: `${fmt(kpi.prv.orders)}件`,              m: kpi.mom.orders },
    { label: "客単価 (AOV)", cur: `¥${fmt(kpi.cur.aov)}`,                 prv: `¥${fmt(kpi.prv.aov)}`,                 m: kpi.mom.aov },
    { label: "アクセス数",   cur: `${fmt(kpi.cur.access)}人`,              prv: `${fmt(kpi.prv.access)}人`,              m: kpi.mom.access },
    { label: "CVR",          cur: `${Number(kpi.cur.cvr).toFixed(2)}%`,    prv: `${Number(kpi.prv.cvr).toFixed(2)}%`,   m: kpi.mom.cvr },
  ];

  const rowH = 0.72;
  rows.forEach((r, ri) => {
    const ry = tableTop + hdrH + ri * rowH;
    const rowBg = ri % 2 === 0 ? C.white : C.lightGray;

    // 行背景
    s.addShape(pres.ShapeType.rect, {
      x: 0.28, y: ry, w: 9.44, h: rowH,
      fill: { color: rowBg }, line: { color: C.borderGray, pt: 0.5 },
    });

    // 指標（teal bg）
    s.addShape(pres.ShapeType.rect, {
      x: cols[0], y: ry, w: colW[0], h: rowH,
      fill: { color: C.tealLight }, line: { color: C.borderGray, pt: 0.5 },
    });
    s.addText(r.label, {
      x: cols[0] + 0.12, y: ry + 0.06, w: colW[0] - 0.16, h: rowH - 0.12,
      fontSize: 11, bold: true, color: C.navy, fontFace: "Calibri", valign: "middle",
    });

    // 今月
    s.addText(r.cur, {
      x: cols[1] + 0.08, y: ry + 0.06, w: colW[1] - 0.12, h: rowH - 0.12,
      fontSize: 11, bold: true, color: C.navy, fontFace: "Calibri", valign: "middle",
    });

    // 前月
    s.addText(r.prv, {
      x: cols[2] + 0.08, y: ry + 0.06, w: colW[2] - 0.12, h: rowH - 0.12,
      fontSize: 10, color: C.muted, fontFace: "Calibri", valign: "middle",
    });

    // 前月比（色背景セル）
    s.addShape(pres.ShapeType.rect, {
      x: cols[3], y: ry + 0.1, w: colW[3] - 0.06, h: rowH - 0.2,
      fill: { color: pbg(r.m) }, line: { color: C.borderGray, pt: 0.5 },
    });
    s.addText(pct(r.m), {
      x: cols[3], y: ry + 0.1, w: colW[3] - 0.06, h: rowH - 0.2,
      fontSize: 12, bold: true, color: pcol(r.m), fontFace: "Calibri",
      align: "center", valign: "middle",
    });

    // 評価
    s.addText(grade(r.m), {
      x: cols[4] + 0.04, y: ry + 0.06, w: colW[4], h: rowH - 0.12,
      fontSize: 16, bold: true, color: gcol(r.m), fontFace: "Calibri",
      align: "center", valign: "middle",
    });
  });

  // TOP3集中度 バッジ
  const top3y = tableTop + hdrH + rows.length * rowH + 0.12;
  s.addShape(pres.ShapeType.rect, {
    x: 0.28, y: top3y, w: 9.44, h: 0.5,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  s.addText("TOP3商品 集中度", {
    x: 0.42, y: top3y + 0.04, w: 2.5, h: 0.42,
    fontSize: 10, color: C.teal, fontFace: "Calibri", valign: "middle",
  });
  s.addText(`${kpi.top3_share != null ? kpi.top3_share : "—"}%`, {
    x: 2.9, y: top3y + 0.02, w: 1.4, h: 0.46,
    fontSize: 22, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
  });
  s.addText("売上の半分以上を上位3商品が占めています。在庫リスク・集中リスクに注意。", {
    x: 4.4, y: top3y + 0.06, w: 5.1, h: 0.38,
    fontSize: 9, color: C.muted, fontFace: "Calibri", valign: "middle",
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 4: 売上構成 | SKU別分析
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  const displaySkus = skus.slice(0, 10);
  addFrame(s, 4, "売上構成", `SKU別 TOP${displaySkus.length}`);

  if (displaySkus.length === 0) {
    s.addText("SKUデータがありません", {
      x: 0.28, y: 2.0, w: 9.44, h: 0.5,
      fontSize: 13, color: C.muted, fontFace: "Calibri", align: "center",
    });
  } else {
    // テーブルヘッダー
    const cols = [
      { label: "順位",   x: 0.28, w: 0.48 },
      { label: "商品ID", x: 0.82, w: 1.10 },
      { label: "商品名", x: 1.98, w: 2.42 },
      { label: "売上",   x: 4.46, w: 1.40 },
      { label: "構成比", x: 5.92, w: 0.84 },
      { label: "前月比", x: 6.80, w: 0.88 },
      { label: "件数",   x: 7.72, w: 0.60 },
      { label: "単価",   x: 8.36, w: 1.36 },
    ];

    const tableTop = 0.85;
    const hdrH = 0.4;

    s.addShape(pres.ShapeType.rect, {
      x: 0.28, y: tableTop, w: 9.44, h: hdrH,
      fill: { color: C.navy }, line: { color: C.navy },
    });
    cols.forEach(c => {
      s.addText(c.label, {
        x: c.x + 0.04, y: tableTop + 0.02, w: c.w, h: hdrH - 0.04,
        fontSize: 9, bold: true, color: C.white, fontFace: "Calibri",
        align: "center", valign: "middle",
      });
    });

    const rowH = Math.min(0.5, (5.39 - 0.18 - tableTop - hdrH - 0.04) / displaySkus.length);

    displaySkus.forEach((sku, ri) => {
      const ry = tableTop + hdrH + ri * rowH;
      // 上位3は薄い teal 背景
      const rowBg = ri < 3 ? C.tealLight : ri % 2 === 0 ? C.white : C.lightGray;

      s.addShape(pres.ShapeType.rect, {
        x: 0.28, y: ry, w: 9.44, h: rowH,
        fill: { color: rowBg }, line: { color: C.borderGray, pt: 0.5 },
      });

      // 順位バッジ
      const rankColors = ["C0A020", "888888", "A06030"];
      const badgeColor = ri < 3 ? rankColors[ri] : C.navy;
      s.addShape(pres.ShapeType.rect, {
        x: 0.32, y: ry + rowH * 0.12, w: 0.38, h: rowH * 0.76,
        fill: { color: badgeColor }, line: { color: badgeColor },
      });
      s.addText(String(ri + 1), {
        x: 0.32, y: ry + rowH * 0.12, w: 0.38, h: rowH * 0.76,
        fontSize: 10, bold: true, color: C.white, fontFace: "Calibri",
        align: "center", valign: "middle",
      });

      // 商品ID
      s.addText(sku.id || "—", {
        x: cols[1].x + 0.04, y: ry + 0.04, w: cols[1].w - 0.06, h: rowH - 0.08,
        fontSize: 8, color: C.muted, fontFace: "Calibri", valign: "middle",
      });

      // 商品名
      s.addText(sku.name || "—", {
        x: cols[2].x + 0.04, y: ry + 0.04, w: cols[2].w - 0.06, h: rowH - 0.08,
        fontSize: 9, color: C.text, fontFace: "Calibri", valign: "middle",
      });

      // 売上
      s.addText(`¥${fmt(sku.sales)}`, {
        x: cols[3].x + 0.04, y: ry + 0.04, w: cols[3].w - 0.08, h: rowH - 0.08,
        fontSize: 10, bold: true, color: C.navy, fontFace: "Calibri",
        align: "right", valign: "middle",
      });

      // 構成比 + ミニバー
      const sharePct = sku.share || 0;
      const maxBarW = cols[4].w - 0.12;
      const barW = Math.max(0.02, (sharePct / 100) * maxBarW * 3); // scaled
      s.addShape(pres.ShapeType.rect, {
        x: cols[4].x + 0.04, y: ry + rowH * 0.62, w: Math.min(barW, maxBarW), h: 0.06,
        fill: { color: C.teal }, line: { color: C.teal },
      });
      s.addText(`${sharePct.toFixed(1)}%`, {
        x: cols[4].x + 0.04, y: ry + 0.04, w: cols[4].w - 0.08, h: rowH * 0.58,
        fontSize: 9, color: C.muted, fontFace: "Calibri", align: "center", valign: "middle",
      });

      // 前月比
      const momText  = sku.is_new ? "新規" : pct(sku.mom);
      const momColor = sku.is_new ? C.teal : pcol(sku.mom);
      const momBg    = sku.is_new ? C.tealLight : pbg(sku.mom);
      s.addShape(pres.ShapeType.rect, {
        x: cols[5].x + 0.04, y: ry + rowH * 0.14, w: cols[5].w - 0.08, h: rowH * 0.72,
        fill: { color: momBg }, line: { color: C.borderGray, pt: 0.5 },
      });
      s.addText(momText, {
        x: cols[5].x + 0.04, y: ry + rowH * 0.14, w: cols[5].w - 0.08, h: rowH * 0.72,
        fontSize: 9.5, bold: true, color: momColor, fontFace: "Calibri",
        align: "center", valign: "middle",
      });

      // 件数
      s.addText(String(sku.qty ?? "—"), {
        x: cols[6].x + 0.02, y: ry + 0.04, w: cols[6].w - 0.04, h: rowH - 0.08,
        fontSize: 9, color: C.text, fontFace: "Calibri", align: "center", valign: "middle",
      });

      // 単価
      s.addText(`¥${fmt(sku.price)}`, {
        x: cols[7].x + 0.04, y: ry + 0.04, w: cols[7].w - 0.08, h: rowH - 0.08,
        fontSize: 8, color: C.muted, fontFace: "Calibri", align: "right", valign: "middle",
      });
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 5: 分析 | FACT & 仮説
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 5, "分析", "データが示す事実と仮説");

  const facts  = analysis.facts || [];
  const hypos  = analysis.hypotheses || [];

  const colTop = 0.85;
  const colH   = 4.42;
  const colW   = 4.62;

  // --- 左列: FACT ---
  s.addShape(pres.ShapeType.rect, {
    x: 0.28, y: colTop, w: colW, h: colH,
    fill: { color: C.lightGray }, line: { color: C.borderGray, pt: 1 },
  });
  // ヘッダー
  s.addShape(pres.ShapeType.rect, {
    x: 0.28, y: colTop, w: colW, h: 0.44,
    fill: { color: C.teal }, line: { color: C.teal },
  });
  s.addText("■ FACT（確認された事実）", {
    x: 0.38, y: colTop + 0.02, w: colW - 0.14, h: 0.4,
    fontSize: 11, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
  });

  const factRowH = Math.min(0.62, (colH - 0.56) / Math.max(facts.length, 1));
  facts.forEach((f, i) => {
    const fy = colTop + 0.52 + i * factRowH;
    // カード
    s.addShape(pres.ShapeType.rect, {
      x: 0.38, y: fy, w: colW - 0.2, h: factRowH - 0.08,
      fill: { color: C.tealLight }, line: { color: C.teal, pt: 1 },
    });
    s.addShape(pres.ShapeType.rect, {
      x: 0.38, y: fy, w: 0.06, h: factRowH - 0.08,
      fill: { color: C.teal }, line: { color: C.teal },
    });
    addTag(s, 0.5, fy + (factRowH - 0.28) / 2, "FACT", { bg: C.navy, tw: 0.5, fs: 7 });
    s.addText(f, {
      x: 1.08, y: fy + 0.04, w: colW - 0.92, h: factRowH - 0.16,
      fontSize: 9, color: C.text, fontFace: "Calibri", valign: "middle",
    });
  });

  // --- 右列: 仮説 ---
  const rx = 0.28 + colW + 0.2;
  s.addShape(pres.ShapeType.rect, {
    x: rx, y: colTop, w: colW, h: colH,
    fill: { color: C.lightGray }, line: { color: C.borderGray, pt: 1 },
  });
  s.addShape(pres.ShapeType.rect, {
    x: rx, y: colTop, w: colW, h: 0.44,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  s.addText("■ 仮説（原因・背景）", {
    x: rx + 0.1, y: colTop + 0.02, w: colW - 0.14, h: 0.4,
    fontSize: 11, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
  });

  const hypoRowH = Math.min(0.78, (colH - 0.56) / Math.max(hypos.length, 1));
  hypos.forEach((h, i) => {
    const hy = colTop + 0.52 + i * hypoRowH;
    s.addShape(pres.ShapeType.rect, {
      x: rx + 0.1, y: hy, w: colW - 0.2, h: hypoRowH - 0.08,
      fill: { color: "FFF8EE" }, line: { color: C.orange, pt: 1 },
    });
    s.addShape(pres.ShapeType.rect, {
      x: rx + 0.1, y: hy, w: 0.06, h: hypoRowH - 0.08,
      fill: { color: C.orange }, line: { color: C.orange },
    });
    addTag(s, rx + 0.22, hy + (hypoRowH - 0.28) / 2, "仮説", { bg: C.orange, tw: 0.46, fs: 7 });
    s.addText(h, {
      x: rx + 0.76, y: hy + 0.04, w: colW - 0.88, h: hypoRowH - 0.16,
      fontSize: 9, color: C.text, fontFace: "Calibri", valign: "middle",
    });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 6: 施策 | アクションプラン
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 6, "施策", "アクションプラン");

  const actions = analysis.actions || [];
  const p0 = actions.filter(a => a.priority === "P0");
  const p1 = actions.filter(a => a.priority === "P1");
  const p2 = actions.filter(a => a.priority === "P2");

  const priSections = [
    { label: "P0 今週中に実施", icon: "P0", color: C.red,    items: p0 },
    { label: "P1 今月中に実施", icon: "P1", color: C.orange, items: p1 },
    { label: "P2 来月以降",     icon: "P2", color: C.muted,  items: p2 },
  ].filter(sec => sec.items.length > 0);

  let curY = 0.86;
  const totalH = 4.42;
  const secGap = 0.08;
  const secH = (totalH - secGap * (priSections.length - 1)) / priSections.length;

  priSections.forEach((sec) => {
    const sy = curY;
    const sh = secH;

    // セクションヘッダー
    s.addShape(pres.ShapeType.rect, {
      x: 0.28, y: sy, w: 9.44, h: 0.38,
      fill: { color: sec.color }, line: { color: sec.color },
    });
    s.addText(sec.label, {
      x: 0.42, y: sy + 0.01, w: 9.0, h: 0.36,
      fontSize: 11, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
    });

    // アクションカード
    const cardCount = sec.items.length;
    const maxCols = 3;
    const cols = Math.min(cardCount, maxCols);
    const cardGap = 0.1;
    const cardW = (9.44 - cardGap * (cols - 1)) / cols;
    const cardAreaH = sh - 0.38 - 0.06;

    sec.items.forEach((a, ci) => {
      const col = ci % maxCols;
      const cx = 0.28 + col * (cardW + cardGap);
      const cy = sy + 0.42;

      s.addShape(pres.ShapeType.rect, {
        x: cx, y: cy, w: cardW, h: cardAreaH,
        fill: { color: C.white }, line: { color: C.borderGray, pt: 1 },
      });
      s.addShape(pres.ShapeType.rect, {
        x: cx, y: cy, w: 0.07, h: cardAreaH,
        fill: { color: sec.color }, line: { color: sec.color },
      });

      // タイトル
      s.addText(a.title || "", {
        x: cx + 0.12, y: cy + 0.05, w: cardW - 0.18, h: 0.34,
        fontSize: 9.5, bold: true, color: C.navy, fontFace: "Calibri", valign: "middle",
      });
      // 期限
      if (a.deadline) {
        s.addText(`期限: ${a.deadline}`, {
          x: cx + 0.12, y: cy + 0.38, w: cardW - 0.18, h: 0.2,
          fontSize: 7.5, color: C.muted, fontFace: "Calibri",
        });
      }
      // items — 1つのテキストボックスに複数行でまとめて表示（折り返し対応）
      const allItems = a.items || [];
      if (allItems.length > 0) {
        const textArr = allItems.map((item, idx) => ({
          text: `• ${item}`,
          options: { breakLine: idx < allItems.length - 1 },
        }));
        s.addText(textArr, {
          x: cx + 0.14, y: cy + 0.56, w: cardW - 0.22, h: Math.max(0.1, cardAreaH - 0.60),
          fontSize: 7.5, color: C.text, fontFace: "Calibri", valign: "top",
        });
      }
    });

    curY += sh + secGap;
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 7: 機会損失 | 優先施策まとめ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 7, "機会損失", "優先度サマリー");

  const actions = analysis.actions || [];

  // テーブル列
  const tcols = [
    { label: "#",       x: 0.28, w: 0.34 },
    { label: "対象",    x: 0.66, w: 1.10 },
    { label: "課題・アクション",    x: 1.80, w: 3.60 },
    { label: "推奨施策",   x: 5.44, w: 2.68 },
    { label: "優先度",  x: 8.16, w: 1.56 },
  ];

  const tableTop = 0.86;
  const hdrH = 0.40;

  s.addShape(pres.ShapeType.rect, {
    x: 0.28, y: tableTop, w: 9.44, h: hdrH,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  tcols.forEach(c => {
    s.addText(c.label, {
      x: c.x + 0.04, y: tableTop + 0.02, w: c.w, h: hdrH - 0.04,
      fontSize: 9.5, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
    });
  });

  // 行数に応じて行高さを動的に計算（テーブル全体が次回確認事項ボックス上端 4.8" に収まるよう）
  const tableAvailH = 3.80; // ヘッダー除く最大高さ
  const rowH = Math.min(0.62, Math.max(0.44, tableAvailH / Math.max(actions.length, 1)));
  const priBg = { P0: C.redLight, P1: "FFF8EE", P2: C.white };
  const priTextColor = { P0: C.red, P1: C.orange, P2: C.muted };

  actions.forEach((a, ri) => {
    const ry = tableTop + hdrH + ri * rowH;
    const bg = priBg[a.priority] || C.white;

    s.addShape(pres.ShapeType.rect, {
      x: 0.28, y: ry, w: 9.44, h: rowH,
      fill: { color: bg }, line: { color: C.borderGray, pt: 0.5 },
    });

    // #
    s.addText(String(ri + 1), {
      x: tcols[0].x + 0.04, y: ry + 0.06, w: tcols[0].w, h: rowH - 0.12,
      fontSize: 10, color: C.muted, fontFace: "Calibri", align: "center", valign: "middle",
    });
    // 対象（priority badge）
    addTag(s, tcols[1].x + 0.06, ry + (rowH - 0.26) / 2, a.priority,
      { bg: priTextColor[a.priority] || C.muted, tw: 0.44, fs: 8 });
    // 課題
    s.addText(a.title || "—", {
      x: tcols[2].x + 0.04, y: ry + 0.06, w: tcols[2].w - 0.08, h: rowH - 0.12,
      fontSize: 9.5, bold: true, color: C.navy, fontFace: "Calibri", valign: "middle",
    });
    // 推奨施策（1件目のみ・40文字で切り詰め）
    const raw0 = (a.items || [])[0] || "";
    const item0 = raw0.length > 40 ? raw0.slice(0, 40) + "…" : raw0;
    const raw1 = (a.items || [])[1] || "";
    const item1 = raw1 ? (raw1.length > 38 ? raw1.slice(0, 38) + "…" : raw1) : "";
    const itemLines = item1
      ? [{ text: item0, options: { breakLine: true } }, { text: item1 }]
      : item0;
    s.addText(itemLines, {
      x: tcols[3].x + 0.04, y: ry + 0.04, w: tcols[3].w - 0.1, h: rowH - 0.08,
      fontSize: 7, color: C.text, fontFace: "Meiryo", valign: "middle",
    });
    // 優先度
    s.addText(a.deadline || "—", {
      x: tcols[4].x + 0.04, y: ry + 0.06, w: tcols[4].w - 0.08, h: rowH - 0.12,
      fontSize: 9, color: priTextColor[a.priority] || C.muted, fontFace: "Calibri",
      align: "center", valign: "middle",
    });
  });

  // 次回確認事項ボックス（テーブル直下に配置、フッター上端5.27"まで）
  const boxY = tableTop + hdrH + actions.length * rowH + 0.1;
  const boxH = Math.max(0.48, 5.27 - boxY);
  s.addShape(pres.ShapeType.rect, {
    x: 0.28, y: boxY, w: 9.44, h: boxH,
    fill: { color: C.tealLight }, line: { color: C.teal, pt: 1 },
  });
  s.addShape(pres.ShapeType.rect, {
    x: 0.28, y: boxY, w: 9.44, h: 0.34,
    fill: { color: C.teal }, line: { color: C.teal },
  });
  s.addText("次回確認事項", {
    x: 0.38, y: boxY + 0.01, w: 4, h: 0.32,
    fontSize: 10, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
  });
  s.addText("① アクセス急減の原因特定結果の共有  ② RPP広告設定変更後のインプレッション推移  ③ 主力3商品の在庫状況", {
    x: 0.42, y: boxY + 0.36, w: 9.1, h: boxH - 0.42,
    fontSize: 9, color: C.text, fontFace: "Calibri", valign: "middle",
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Slide 8: ネクストステップ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addFrame(s, 8, "ネクストステップ", `${nextMonth}に向けて`);

  // 3ステップフロー
  const steps = [
    {
      num: "1",
      title: "原因特定",
      desc: "アクセス急減の要因（広告・SEO・イベント）を特定し、優先課題を確定する",
      period: "今週中",
    },
    {
      num: "2",
      title: "施策実行",
      desc: "RPP広告最適化・検索キーワード改善・8月イベント参加準備を実行する",
      period: "今月中",
    },
    {
      num: "3",
      title: "効果検証",
      desc: `${nextMonth}のKPI確認MTGにて売上回復を検証。改善率をKPIとして設定する`,
      period: "翌月初",
    },
  ];

  const stepW = 2.82;
  const stepH = 2.2;
  const stepGap = 0.48;
  const stepTop = 0.92;
  const startX = (10 - (stepW * 3 + stepGap * 2)) / 2;

  steps.forEach((st, i) => {
    const sx = startX + i * (stepW + stepGap);

    // カード
    s.addShape(pres.ShapeType.rect, {
      x: sx, y: stepTop, w: stepW, h: stepH,
      fill: { color: C.tealLight }, line: { color: C.teal, pt: 1 },
    });
    // トップバー
    s.addShape(pres.ShapeType.rect, {
      x: sx, y: stepTop, w: stepW, h: 0.04,
      fill: { color: C.teal }, line: { color: C.teal },
    });

    // 番号サークル（近似）
    s.addShape(pres.ShapeType.ellipse, {
      x: sx + stepW / 2 - 0.3, y: stepTop + 0.1, w: 0.6, h: 0.6,
      fill: { color: C.teal }, line: { color: C.teal },
    });
    s.addText(st.num, {
      x: sx + stepW / 2 - 0.3, y: stepTop + 0.1, w: 0.6, h: 0.6,
      fontSize: 16, bold: true, color: C.white, fontFace: "Calibri",
      align: "center", valign: "middle",
    });

    // 期間タグ
    addTag(s, sx + stepW / 2 - 0.4, stepTop + 0.78, st.period,
      { bg: C.navy, tw: 0.8, fs: 8 });

    // タイトル
    s.addText(st.title, {
      x: sx + 0.1, y: stepTop + 1.06, w: stepW - 0.2, h: 0.38,
      fontSize: 13, bold: true, color: C.navy, fontFace: "Calibri",
      align: "center", valign: "middle",
    });
    // 説明
    s.addText(st.desc, {
      x: sx + 0.12, y: stepTop + 1.46, w: stepW - 0.24, h: 0.68,
      fontSize: 8.5, color: C.muted, fontFace: "Calibri", valign: "top",
    });

    // 矢印（→）
    if (i < steps.length - 1) {
      s.addText("→", {
        x: sx + stepW + 0.06, y: stepTop + 0.7, w: stepGap - 0.06, h: 0.6,
        fontSize: 20, bold: true, color: C.teal, fontFace: "Calibri",
        align: "center", valign: "middle",
      });
    }
  });

  // チェックリスト（タイムライン）
  const checkTop = stepTop + stepH + 0.18;
  const checkH   = 5.27 - checkTop;
  s.addShape(pres.ShapeType.rect, {
    x: 0.28, y: checkTop, w: 9.44, h: checkH,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  s.addText("次回レポートまでのチェックリスト", {
    x: 0.42, y: checkTop + 0.06, w: 4, h: 0.3,
    fontSize: 10, bold: true, color: C.teal, fontFace: "Calibri",
  });

  const checks = [
    `RPP広告 インプレッション推移を週次でモニタリング（目標: 前月水準回復）`,
    `TOP3商品の在庫日数を確認し、欠品リスク商品は広告抑制`,
    `${nextMonth} 売上目標設定・KPIシート更新`,
    `${nextMonth} 月次レポート用データ取得日程を確認`,
  ];
  const itemH = (checkH - 0.42) / checks.length;
  checks.forEach((c, i) => {
    s.addText(`✓ ${c}`, {
      x: 0.42, y: checkTop + 0.38 + i * itemH, w: 9.0, h: itemH,
      fontSize: 9, color: C.white, fontFace: "Calibri", valign: "middle",
    });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 出力
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const periodSlug = (meta.period || "report")
  .replace(/(\d+)年(\d+)月/, (_, y, m) => `${y}${m.padStart(2, "0")}`)
  .replace(/年|月/g, "");
const outDir  = jsonArg ? path.dirname(jsonArg) : ".";
const outFile = path.join(outDir, `ec_report_${periodSlug}.pptx`);

pres.writeFile({ fileName: outFile })
  .then(() => console.log(`生成完了: ${outFile}`))
  .catch(e => { console.error("エラー:", e); process.exit(1); });
