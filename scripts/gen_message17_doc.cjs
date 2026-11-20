// پیام ۱۷ — پلن خرید و فروش میز کالا و میز خدمات v3.2 (Persian RTL)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (هم‌سان با پیام ۳ تا ۱۵)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  TableLayoutType, PageOrientation,
} = require("docx");
const fs = require("fs");

const PAL = {
  bg: "1A2330", primary: "1A2330", accent: "D4875A",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "D4875A", headerText: "FFFFFF", accentLine: "D4875A", innerLine: "DDD0C8", surface: "F8F0EB" },
};
const BODY_COLOR = "000000";
const HEAD_COLOR = "1A2330";
const FONT = { ascii: "Tahoma", hAnsi: "Tahoma", cs: "Tahoma" };

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function faNum(n) {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[+d]).replace(/,/g, "٬");
}
function money(n) { return faNum(n.toLocaleString("en-US")); }

function faRun(text, opts = {}) {
  const size = opts.size || 24;
  return new TextRun({
    text, font: FONT, rightToLeft: true, size, sizeComplexScript: size,
    bold: !!opts.bold, boldComplexScript: !!opts.bold, italics: !!opts.italics,
    color: opts.color || BODY_COLOR, characterSpacing: opts.characterSpacing,
  });
}
function bodyPara(text, opts = {}) {
  return new Paragraph({
    bidirectional: true, alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: opts.after != null ? opts.after : 120 },
    children: [faRun(text, opts)],
  });
}
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, bidirectional: true,
    spacing: { before: 360, after: 160, line: 380, lineRule: "atLeast" },
    children: [faRun(text, { size: 32, bold: true, color: HEAD_COLOR })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, bidirectional: true,
    spacing: { before: 240, after: 120, line: 340, lineRule: "atLeast" },
    children: [faRun(text, { size: 27, bold: true, color: HEAD_COLOR })],
  });
}
function bullet(text, opts = {}) {
  return new Paragraph({
    bidirectional: true, alignment: AlignmentType.RIGHT,
    spacing: { line: 312, after: 60 }, indent: { right: 420, hanging: 210 },
    children: [faRun("•  ", { size: 22, bold: true, color: PAL.accent }), faRun(text, { size: opts.size || 22 })],
  });
}
function tableCaption(text) {
  return new Paragraph({
    bidirectional: true, keepNext: true, spacing: { before: 160, after: 80, line: 312 },
    children: [faRun(text, { size: 21, bold: true, color: "505A64" })],
  });
}
function rtlTable(widths, headerCells, dataRows) {
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine },
    left: NB, right: NB,
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine },
    insideVertical: NB,
  };
  const mkCell = (text, i, isHeader) => new TableCell({
    width: { size: widths[i], type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: isHeader ? { type: ShadingType.CLEAR, fill: PAL.table.headerBg } : undefined,
    children: String(text).split("\n").map(line => new Paragraph({
      bidirectional: true, alignment: isHeader ? AlignmentType.CENTER : undefined,
      spacing: { line: 312 },
      children: [faRun(line, { size: 21, bold: isHeader, color: isHeader ? PAL.table.headerText : BODY_COLOR })],
    })),
  });
  return new Table({
    visuallyRightToLeft: true, width: { size: 100, type: WidthType.PERCENTAGE }, borders,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headerCells.map((t, i) => mkCell(t, i, true)) }),
      ...dataRows.map(r => new TableRow({ cantSplit: true, children: r.map((t, i) => mkCell(t, i, false)) })),
    ],
  });
}
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."،؛:！？", ..."-_—–·/", ..." \t"]);
  const lines = []; let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) { const last = lines.pop(); lines[lines.length - 1] += " " + last; }
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 36, minPt = 24) {
  const charWidth = (pt) => pt * 12;
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = Math.floor(maxWidthTwips / charWidth(titlePt));
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, Math.floor(maxWidthTwips / charWidth(minPt))); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const safeRemaining = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}
function buildCoverR1(config) {
  const P = config.palette;
  const padStart = 1200, padEnd = 800;
  const availableWidth = 11906 - padStart - padEnd - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 36, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentStart = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  children.push(new Paragraph({
    bidirectional: true, indent: { left: padStart, right: padEnd }, spacing: { after: 500 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
    children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, sizeComplexScript: 18, color: P.accent, font: FONT, characterSpacing: 40 })],
  }));
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      bidirectional: true, indent: { left: padStart },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, sizeComplexScript: titleSize, bold: true, boldComplexScript: true, rightToLeft: true, color: P.cover.titleColor, font: FONT })],
    }));
  }
  children.push(new Paragraph({
    bidirectional: true, indent: { left: padStart }, spacing: { after: 800, line: 380, lineRule: "atLeast" },
    children: [faRun(config.subtitle, { size: 24, color: P.cover.subtitleColor })],
  }));
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      bidirectional: true, indent: { left: padStart + 200 }, spacing: { after: 80 },
      border: { left: accentStart }, children: [faRun(line, { size: 24, color: P.cover.metaColor })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    bidirectional: true, indent: { left: padStart, right: padEnd },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      faRun(config.footerLeft || "", { size: 16, color: P.cover.footerColor }),
      new TextRun({ text: "                                        ", font: FONT }),
      faRun(config.footerRight || "", { size: 16, color: P.cover.footerColor }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children })],
    })],
  })];
}

// ─── محاسبهٔ اعداد جداول تطبیق (مطابق src/lib/plan17.ts) ──
function svcSettle(W, referred, isFirst) {
  const collected = referred && isFirst ? Math.round(W * 0.9) : W;
  const expert = Math.round(W * 0.67);
  const referrer = referred ? Math.round(W * (isFirst ? 0.10 : 0.15)) : 0;
  const company = collected - expert - referrer;
  return { collected, expert, referrer, company, margin: W - expert };
}
function goodsSettle(S, C, F, referred, isFirst) {
  const saleNet = referred && isFirst ? Math.round(S * 0.9) : S;
  const profit = saleNet - C - F;
  const referrer = referred && profit > 0 ? Math.round(profit * (isFirst ? 0.20 : 0.30)) : 0;
  const company = profit > 0 ? profit - referrer : 0;
  return { saleNet, profit, referrer, company };
}
const W = 1000000, S = 12500000, C = 10000000, F = 150000;
const svN = svcSettle(W, true, false), svF = svcSettle(W, true, true);
const gdN = goodsSettle(S, C, F, true, false), gdF = goodsSettle(S, C, F, true, true);
console.log("CHECK services normal:", JSON.stringify(svN), "| first:", JSON.stringify(svF));
console.log("CHECK goods normal:", JSON.stringify(gdN), "| first:", JSON.stringify(gdF));

const coverConfig = {
  title: "پلن خرید و فروش میز کالا و میز خدمات",
  subtitle: "v3.2.0 — سود خدمات = ۳۳٪ اجرت کارشناس (درون اجرت) | سود کالا = فروش بالاترین قیمت معتبر − خرید ارزان‌ترین انبار − پیک | پورسانت معرف دومرحله‌ای | تخفیف ۱۰٪ فاکتور اول | جریان بانکی ملی و مهر | پیاده‌سازی و صحت‌سنجی ۲۶/۲۶",
  englishLabel: "BUY & SELL SETTLEMENT PLAN — ALOSHETAB v3.2",
  metaLines: [
    "شماره سند: پیام ۱۷ — تاریخ: ۱۹ نوامبر ۲۰۲۶ / ۲۸ آبان ۱۴۰۵",
    "وضعیت پیاده‌سازی: موتور plan17 + تسویهٔ خدمات و کالا + آزمون ۲۶/۲۶ سبز روی بیلد production",
    "سازگاری: پلن ۳۳٪ فقط در میز خدمات باقی است (پیام ۱۶) — افزودنی ۳۳٪ به تقسیم درون‌اجرت تبدیل شد",
    "حساب‌ها: بانک ملی (کارت 6037-99) ← سود خالص شرکت | بانک مهر (شبا + کارت 6063-73) ← در گردش",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "v3.2.0 — پلن خرید و فروش",
  palette: PAL,
};

const tocChildren = [
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360, line: 380, lineRule: "atLeast" },
    children: [faRun("فهرست مطالب", { size: 32, bold: true, color: HEAD_COLOR })],
  }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({
    bidirectional: true, spacing: { before: 200, line: 312 },
    children: [faRun("توضیح: این فهرست با کدهای فیلد تولید شده است. برای به‌روزرسانی شماره صفحات پس از ویرایش، روی فهرست راست‌کلیک کرده و گزینه Update Field را انتخاب کنید.", { size: 18, italics: true, color: "888888" })],
  }),
];

const bodyChildren = [
  h1("خلاصه اجرایی"),
  bodyPara("این سند، «پلن جدید خرید و فروش برای میز کالا و میز خدمات» (پیام ۱۷) را به‌صورت دقیق ثبت، محاسبه و در سامانه پیاده‌سازی می‌کند. طبق پلن، سود میز خدمات ۳۳٪ از اجرت کارشناس است و درون اجرت تقسیم می‌شود: دستمزد کارشناس ۶۷٪، پورسانت معرف ۱۵٪ (فاکتور اول معرفی‌شده ۱۰٪) و سود خالص شرکت ۱۸٪ (فاکتور اول ۱۳٪) — مجموع ۱۵ و ۱۸ دقیقاً برابر کل سود ۳۳ واحدی است. سود میز کالا نیز «اختلاف مبلغ خرید و فروش منهای هزینهٔ پیک» تعریف شده است: خرید از ارزان‌ترین انبار به پایین‌ترین قیمت توافقی و فروش به بالاترین قیمت ارائه‌شده در معتبرترین فروشگاه‌های اینترنتی؛ از این سود، ۳۰٪ (فاکتور اول ۲۰٪) پورسانت معرف و ۷۰٪ سود خالص شرکت می‌شود. مشتریِ ثبت‌نام‌شده با کد معرف روی اولین فاکتور خرید خود ۱۰٪ تخفیف می‌گیرد."),
  bodyPara("جریان بانکی نیز به همین ترتیب تثبیت شد: سود خالص شرکت (۱۸٪ سود خدمات + ۷۰٪ سود کالا) به حساب بانک ملی واریز می‌شود و حق معرف به‌همراه ۶۷٪ دستمزد کارشناس و مبلغ مورد نیاز برای خرید کالا از انبار، از حساب بانک مهر (مبالغ در گردش) پرداخت می‌شود. تمام نرخ‌ها در جدول تنظیمات پنل مالک قابل تغییر است و موتور محض پیاده‌سازی‌شده (src/lib/plan17.ts) با ۲۶ آزمون صحت‌سنجی روی بیلد production پاس شده است. نکتهٔ مهم ساختاری: با این پلن، «افزودنی ۳۳٪» که پیش‌تر روی فاکتور خدمات اضافه می‌شد حذف شده و همان ۳۳٪ اکنون به‌صورت سهم سود «درون» اجرت تقسیم می‌شود؛ یعنی فاکتور خدمات مشتری = اجرت کارشناس. این تغییر دقیقاً همانdirective پیام ۱۶ (باقی ماندن پلن ۳۳٪ در میز خدمات و حذف آن از میز کالا) را به شکل نهایی و بانک‌محور اجرا می‌کند.", { after: 160 }),

  h1("۱. سود میز خدمات — ۳۳٪ اجرت کارشناس"),
  bodyPara("مبنای همهٔ محاسبات خدمات «اجرت کارشناس» است: مبلغ پایهٔ خدمت پس از ضرایب تقویمی (روز هفته، ساعت، روز خدمت و حالت انجام) که همان مبلغی است که مشتری برای خدمت می‌پردازد. از این اجرت، ۶۷٪ دستمزد کارشناس است (به بانک مهر می‌رود) و ۳۳٪ سود میز خدمات (ألو شتاب). این سود سپس به‌طور کامل بین معرف و شرکت تقسیم می‌شود؛ هیچ مبلغی در سود خدمات بلااستفاده نمی‌ماند."),
  tableCaption("جدول ۱ — تقسیم سود میز خدمات (بر پایهٔ اجرت کارشناس)"),
  rtlTable([28, 24, 24, 24],
    ["شرح", "فاکتور دوم به بعد", "فاکتور اول معرفی‌شده", "بدون معرف"],
    [
      ["وصولی از مشتری", "۱۰۰٪ اجرت", "۹۰٪ اجرت (تخفیف ۱۰٪)", "۱۰۰٪ اجرت"],
      ["دستمزد کارشناس → بانک مهر", "۶۷٪ اجرت", "۶۷٪ اجرت", "۶۷٪ اجرت (تا تسویه امانی)"],
      ["پورسانت معرف", "۱۵٪ اجرت", "۱۰٪ اجرت", "—"],
      ["سود خالص شرکت", "۱۸٪ اجرت", "۱۳٪ اجرت (باقیمانده)", "۳۳٪ اجرت"],
      ["کنترل جمع", "۶۷+۱۵+۱۸ = ۱۰۰", "۶۷+۱۰+۱۳ = ۹۰ = وصولی", "۶۷+۳۳ = ۱۰۰"],
    ]),
  bodyPara("در فاکتور اول معرفی‌شده، تخفیف ۱۰٪ مشتری از سود خدمات پرداخت می‌شود؛ چون پورسانت معرف در فاکتور اول نیز به ۱۰٪ کاهش یافته، سهم شرکت به باقیمانده (۱۳٪) می‌رسد و هیچ ردیفی منفی نمی‌شود. در سفارش‌های بدون معرف نیز شرکت کل سود ۳۳٪ را برمی‌دارد. حداقل فاکتور ۵٬۰۰۰٬۰۰۰ تومان (پیام ۱۲) و جریان کارشناسی سفارش‌های متفرقه بدون تغییر باقی است.", { after: 160 }),

  h1("۲. سود میز کالا — اختلاف خرید و فروش منهای پیک"),
  bodyPara("در میز کالا، مشتری «بالاترین قیمت ارائه‌شده در معتبرترین فروشگاه‌های اینترنتی و آنلاین» را می‌پردازد و سامانه همان کالا را «از ارزان‌ترین انبار به پایین‌ترین قیمت توافقی» تأمین می‌کند. اختلاف این دو مبلغ، پس از کسر هزینهٔ پیک، سود میز کالا است. از نسخهٔ ۳٫۲ افزودنی پرداخت (سهم کارشناس ۱۸٪ + افزایش پلتفرم ۱۲٪) که در نسخه‌های ۳٫۰ و ۳٫۱ روی قیمت فروش اضافه می‌شد حذف شده است؛ چون پلن ۱۷ فروش را دقیقاً برابر بالاترین قیمت معتبر تعریف می‌کند. مبلغ خرید توافقی در لحظهٔ ثبت سفارش از قیمت انبار ثبت می‌شود و ادمین در زمان تحویل می‌تواند رقم نهایی مذاکره‌شده را ثبت/اصلاح کند."),
  tableCaption("جدول ۲ — تقسیم سود میز کالا (بر پایهٔ سود همان فاکتور)"),
  rtlTable([28, 24, 24, 24],
    ["شرح", "فاکتور دوم به بعد", "فاکتور اول معرفی‌شده", "بدون معرف"],
    [
      ["فروش به مشتری", "بالاترین قیمت معتبر", "بالاترین قیمت معتبر − ۱۰٪", "بالاترین قیمت معتبر"],
      ["سود کالا", "فروش − خرید − پیک", "فروش خالص − خرید − پیک", "فروش − خرید − پیک"],
      ["پورسانت معرف", "۳۰٪ سود", "۲۰٪ سود", "—"],
      ["سود خالص شرکت", "۷۰٪ سود", "۸۰٪ سود (باقیمانده)", "۱۰۰٪ سود"],
      ["گارد محافظتی", "سود ≤ ۰ → توقف و بررسی", "سود ≤ ۰ → توقف و بررسی", "سود ≤ ۰ → توقف و بررسی"],
    ]),
  bodyPara("اگر قیمت تمام‌شده (خرید + پیک) از قیمت فروش بالاتر برود، سفارش به‌طور خودکار تسویه نمی‌شود و با پرچم «سود منفی» در گزارش پنل برای بازبینی خرید ثبت می‌گردد؛ این گارد جلوی فروش زیان‌ده اتوماتیک را می‌گیرد.", { after: 160 }),

  h1("۳. پورسانت معرف و تخفیف فاکتور اول"),
  bodyPara("معرف، کد ملی ثبت‌شدهٔ او در سامانه است و مشتری هنگام ثبت سفارش خدمات یا خرید کالا آن را وارد می‌کند. پورسانت معرف دومرحله‌ای است: روی «اولین فاکتور خرید» مشتری معرفی‌شده نرخ پایین‌تر و از فاکتور دوم به بعد نرخ کامل اعمال می‌شود. ملاک فاکتور اول، نخستین سفارش ثبت‌شدهٔ همان مشتری است (سفارش‌های لغوشده شمارش نمی‌شوند) و این تشخیص در سرور انجام می‌شود تا دستکاری‌ناپذیر باشد. تخفیف ۱۰٪ نیز فقط برای مشتریِ ثبت‌نام‌شده با کد معرف و فقط روی همان فاکتور اول — روی کل فاکتور خرید (خدمات + قطعات در سفارش خدمات، و کل سفارش کالا) اعمال می‌شود."),
  tableCaption("جدول ۳ — نرخ‌های پورسانت معرف و تخفیف مشتری (پیام ۱۷)"),
  rtlTable([34, 22, 22, 22],
    ["حالت", "سهم خدمات", "سهم کالا", "تخفیف مشتری"],
    [
      ["فاکتور اول معرفی‌شده", "۱۰٪ اجرت", "۲۰٪ سود کالا", "۱۰٪ کل فاکتور"],
      ["فاکتور دوم به بعد", "۱۵٪ اجرت", "۳۰٪ سود کالا", "—"],
      ["ثبت‌نام بدون کد معرف", "—", "—", "—"],
    ]),
  bodyPara("مبلغ پورسانت معرف در لحظهٔ ثبت سفارش به‌صورت محرمانه (فقط سمت سرور) در رکورد معرفی ثبت می‌شود و در هیچ پاسخ عمومی API ظاهر نمی‌شود؛ همین قاعدهٔ محرمانگی پیشین برای سهم‌های کارشناس و شرکت نیز حفظ شده است.", { after: 160 }),

  h1("۴. جریان بانکی — بانک ملی و بانک مهر"),
  bodyPara("همهٔ مبالغ وصولی مشتری به حساب در گردش (بانک مهر) می‌آید و از همان‌جا پرداخت‌های عملیاتی انجام می‌شود: دستمزد ۶۷٪ کارشناس، حق معرف، هزینهٔ خرید کالا از انبار و پیک. ماندهٔ باقی‌مانده — که دقیقاً برابر سود خالص شرکت است — به حساب بانک ملی واریز می‌شود. این چیدمان دقیقاً همان دو دستور پیام ۱۷ است و در گزارش تسویهٔ هر سفارش، مقصد بانکی هر مبلغ صریحاً درج می‌شود."),
  tableCaption("جدول ۴ — حساب‌های بانکی و نقش هر حساب"),
  rtlTable([24, 40, 36],
    ["حساب", "شناسه", "نقش"],
    [
      ["بانک ملی ایران", "کارت 6037-9981-4097-4550", "سود خالص شرکت (۱۸٪ سود خدمات + ۷۰٪ سود کالا)"],
      ["بانک مهر ایران", "شبا IR430170000000345884841004", "حساب دریافت فاکتورها و مبالغ در گردش"],
      ["بانک قرض‌الحسنه مهر ایران", "کارت 6063-7311-2146-8624", "پرداخت حق معرف + ۶۷٪ اجرت کارشناس + خرید کالا + پیک"],
    ]),
  bodyPara("در تسویهٔ هر سفارش خدمات، گزارش ایمنی پنل شامل این سطرها است: دستمزد کارشناس (۶۷٪ اجرت → بانک مهر)، حق معرف (در تب «معرفی‌ها»)، سود خالص شرکت (→ بانک ملی) و خرید قطعات در صورت وجود. در تسویهٔ کالا نیز سود کالا، پورسانت معرف و مسیر بانکی ملی/مهر گزارش می‌شود.", { after: 160 }),

  h1("۵. جدول تطبیق عددی — دو نمونهٔ کامل"),
  bodyPara("برای شفافیت کامل، دو سناریو با اعداد واقعی محاسبه و با خروجی موتور پیاده‌سازی‌شده انطباق داده شده است. سناریوی خدمات با اجرت کارشناس " + money(W) + " تومان و سناریوی کالا با فروش " + money(S) + " تومان، خرید توافقی " + money(C) + " تومان و پیک " + money(F) + " تومان؛ در هر دو، مشتری با کد معرف ثبت‌نام کرده است."),
  tableCaption("جدول ۵ — تسویهٔ خدمات: اجرت کارشناس " + money(W) + " تومان"),
  rtlTable([28, 24, 24, 24],
    ["ردیف", "فاکتور عادی (دوم به بعد)", "فاکتور اول معرفی‌شده", "کنترل"],
    [
      ["وصولی از مشتری", money(svN.collected), money(svF.collected), "۹۰٪ در فاکتور اول"],
      ["دستمزد کارشناس (۶۷٪)", money(svN.expert), money(svF.expert), "ثابت — بانک مهر"],
      ["پورسانت معرف", money(svN.referrer), money(svF.referrer), "۱۵٪ / ۱۰٪"],
      ["سود خالص شرکت", money(svN.company), money(svF.company), "۱۸٪ / ۱۳٪"],
      ["جمع تسهیم", money(svN.expert + svN.referrer + svN.company), money(svF.expert + svF.referrer + svF.company), "برابر وصولی"],
    ]),
  tableCaption("جدول ۶ — تسویهٔ کالا: فروش " + money(S) + " | خرید " + money(C) + " | پیک " + money(F)),
  rtlTable([28, 24, 24, 24],
    ["ردیف", "فاکتور عادی (دوم به بعد)", "فاکتور اول معرفی‌شده", "کنترل"],
    [
      ["فروش به مشتری", money(gdN.saleNet), money(gdF.saleNet), "۹۰٪ در فاکتور اول"],
      ["سود کالا (فروش − خرید − پیک)", money(gdN.profit), money(gdF.profit), "مبنای تقسیم"],
      ["پورسانت معرف", money(gdN.referrer), money(gdF.referrer), "۳۰٪ / ۲۰٪ سود"],
      ["سود خالص شرکت", money(gdN.company), money(gdF.company), "۷۰٪ / ۸۰٪ سود"],
      ["جمع تسهیم", money(gdN.referrer + gdN.company), money(gdF.referrer + gdF.company), "برابر سود کالا"],
    ]),
  bodyPara("سناریوی ترکیبی (فاکتور عادی): مشتری در مجموع " + money(W + S) + " تومان به حساب در گردش (مهر) واریز می‌کند؛ پرداخت‌ها: کارشناس " + money(svN.expert) + " + خرید انبار " + money(C) + " + پیک " + money(F) + " + معرف " + money(svN.referrer + gdN.referrer) + " = " + money(svN.expert + C + F + svN.referrer + gdN.referrer) + " تومان؛ مانده به بانک ملی = " + money(svN.company + gdN.company) + " تومان که دقیقاً برابر «۱۸٪ سود خدمات + ۷۰٪ سود کالا» است. در فاکتور اول نیز ماندهٔ ملی " + money(svF.company + gdF.company) + " تومان می‌شود و تراز کامل می‌ماند.", { after: 160 }),

  h1("۶. پیاده‌سازی فنی و صحت‌سنجی v3.2"),
  bodyPara("کل پلن در نسخهٔ ۳٫۲٫۰ پیاده و روی بیلد production (پورت ۳۰۱۰) صحت‌سنجی شد: ۲۶ آزمون سبز. موتور محض پلن در src/lib/plan17.ts جدا از دیتابیس نوشته شده تا در هر نقطهٔ سامانه قابل استفاده باشد؛ نرخ‌ها از جدول تنظیمات خوانده می‌شوند و مالک می‌تواند بدون تغییر کد، هر درصد را از پنل اصلاح کند."),
  tableCaption("جدول ۷ — فایل‌های تغییرکرده و نقش هر یک"),
  rtlTable([40, 60],
    ["فایل", "نقش در پلن ۱۷"],
    [
      ["src/lib/plan17.ts", "موتور محض: تسویهٔ خدمات و کالا، مسیر بانکی ملی/مهر، خواندن نرخ‌ها"],
      ["src/lib/pricing.ts", "کوت خدمات: total = اجرت − تخفیف (حذف افزودنی)؛ سود ۳۳٪ گزارشی درون اجرت"],
      ["src/lib/inventory.ts", "computeCheckout17: پرداخت کالا = فروش − تخفیف + خدمات؛ محاسبهٔ سود کالا"],
      ["src/lib/settlement.ts", "تسویهٔ خودکار خدمات: کارشناس ۶۷٪ اجرت، معرف، شرکت، گزارش بانکی"],
      ["src/app/api/quote", "تشخیص فاکتور اول + تخفیف ۱۰٪ در پیش‌فاکتور زنده"],
      ["src/app/api/orders", "ثبت پورسانت معرف لادری + تخفیف فاکتور اول (خدمات + قطعات)"],
      ["src/app/api/products/order", "پلن کالا: فروش بدون افزودنی، خرید انبار، معرف، فاکتور اول"],
      ["src/app/api/admin/product-orders", "ثبت خرید توافقی ادمین + تسویهٔ کالا هنگام تحویل + گزارش بانکی"],
      ["prisma/schema.prisma", "ProductOrder: purchaseAmount، referrerCode، firstInvoice"],
      ["scripts/verify_p17.cjs", "۲۶ آزمون صحت‌سنجی روی بیلد production — همگی سبز"],
    ]),
  bodyPara("دو یادداشت نگهداری: نخست، آزمون قدیمی verify_p16 با ساختار جدید ناسازگار شده و منسوخ است (فرمول فاکتور خدمات از «اجرت + افزودنی ۳۳٪» به «اجرت» تغییر کرد)؛ مرجع جدید همان verify_p17.cjs است. دوم، سود کالای منفی به‌طور خودکار مسدود و پرچم‌گذاری می‌شود و تسویهٔ کالا فقط پس از ثبت مبلغ خرید توافقی نهایی توسط ادمین در زمان تحویل معنا دارد.", { after: 160 }),

  h1("۷. تفسیرهای پیش‌فرض — قابل تغییر از پنل مالک"),
  bullet("مبنای همهٔ درصدهای میز خدمات، «اجرت کارشناس» (مبلغ پایه پس از ضرایب) است؛ چون ۱۵+۱۸ دقیقاً ۳۳ می‌شود و تنها با این مضموم کل سود خدمات تقسیم می‌شود و هیچ مبلغی بلاتکلیف نمی‌ماند."),
  bullet("در فاکتور اول معرفی‌شده، سهم شرکت «باقیمانده» است (۱۳٪ خدمات و ۸۰٪ سود کالا) تا تخفیف ۱۰٪ مشتری به‌طور خودکار از سود کسر شود و همهٔ نرخ‌های اعلامی (۱۰٪ معرف، ۶۷٪ کارشناس) عیناً برقرار بماند؛ اگر مالک بخواهد سهم شرکت در فاکتور اول ثابت ۱۸٪/۷۰٪ بماند، کافی است نرخ‌ها را از پنل تنظیم کند."),
  bullet("پیک در میز کالا از سود کسر می‌شود (مشتری فقط قیمت فروش را می‌پردازد)؛ در صورت صلاح مالک، مدل انتقال هزینهٔ پیک به مشتری با یک پارامتر قابل افزودن است."),
  bodyPara("با اجرای این پلن، چرخهٔ کامل مالی سامانه — از پیش‌فاکتور و تخفیف معرفی تا تسویهٔ کارشناس، پورسانت معرف و واریز بانکی ملی/مهر — به‌صورت خودکار، محرمانه و ممیزی‌پذیر فعال است و مسیر استقرار روی دامنهٔ aloshetab.ir بدون تغییر باقی است؛ راهنمای فشردهٔ استقرار در سند جداگانهٔ «راهنمای استقرار کامل و خلاصه — v3.2.0» آمده است.", { after: 200 }),
];

const pgSize = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: FONT, size: 24, color: BODY_COLOR }, paragraph: { spacing: { line: 312 } } },
      heading1: { run: { font: FONT, size: 32, bold: true, color: HEAD_COLOR }, paragraph: { spacing: { before: 360, after: 160, line: 380 } } },
      heading2: { run: { font: FONT, size: 28, bold: true, color: HEAD_COLOR }, paragraph: { spacing: { before: 240, after: 120, line: 360 } } },
    },
  },
  sections: [
    { properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } }, children: buildCoverR1(coverConfig) },
    { properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin } }, children: tocChildren },
    {
      properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: new Header({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { line: 240 }, children: [faRun("پلن خرید و فروش | پیام ۱۷", { size: 18, color: "808080" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240 }, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, sizeComplexScript: 18, color: "808080", font: FONT })] })] }) },
      children: bodyChildren,
    },
  ],
});

const OUT = "/home/z/my-project/download/پیام-۱۷-پلن-خرید-و-فروش-v3.2.docx";
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("WROTE:", OUT, buf.length, "bytes"); });
