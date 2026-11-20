// پیام ۱۸ — پلن مالی V4.0: پورسانت معرف فقط فاکتور اول + بازبینی کامل (Persian RTL)
// Skill: docx | Route: Create | Scene: report | Cover: R1 (هم‌سان با پیام ۳ تا ۱۷)
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
function faNum(n) { return String(n).replace(/\d/g, (d) => FA_DIGITS[+d]).replace(/,/g, "٬"); }
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
  const breakAfter = new Set([..."،؛:！؟", ..."-_—–·/", ..." \t"]);
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

// ─── محاسبهٔ اعداد جداول تطبیق (مطابق src/lib/plan18.ts — V4.0) ──
function svcSettle(W, referred, isFirst) {
  const collected = referred && isFirst ? Math.round(W * 0.9) : W;
  const expert = Math.round(W * 0.67);
  const referrer = referred && isFirst ? Math.round(W * 0.10) : 0; // V4.0: فقط فاکتور اول
  const company = collected - expert - referrer;
  return { collected, expert, referrer, company, margin: W - expert };
}
function goodsSettle(S, C, F, referred, isFirst) {
  const saleNet = referred && isFirst ? Math.round(S * 0.9) : S;
  const profit = saleNet - C - F;
  const referrer = referred && isFirst && profit > 0 ? Math.round(profit * 0.20) : 0; // V4.0: فقط فاکتور اول
  const company = profit > 0 ? profit - referrer : 0;
  return { saleNet, profit, referrer, company };
}
const W = 1000000, S = 12500000, C = 10000000, F = 150000;
const svF = svcSettle(W, true, true), svN = svcSettle(W, true, false);
const gdF = goodsSettle(S, C, F, true, true), gdN = goodsSettle(S, C, F, true, false);
console.log("CHECK svc first:", JSON.stringify(svF), "| later:", JSON.stringify(svN));
console.log("CHECK goods first:", JSON.stringify(gdF), "| later:", JSON.stringify(gdN));
// کنترل‌های ریاضی
console.log("svc sums:", svF.expert + svF.referrer + svF.company === svF.collected, svN.expert + svN.referrer + svN.company === svN.collected);
console.log("goods sums:", gdF.referrer + gdF.company === gdF.profit, gdN.referrer + gdN.company === gdN.profit);
console.log("bank later:", 13_500_000 - (svN.expert + C + F + gdN.referrer) === svN.company + gdN.company);
console.log("bank first:", 12_150_000 - (svF.expert + C + F + svF.referrer + gdF.referrer) === svF.company + gdF.company);

const coverConfig = {
  title: "پلن مالی V4.0 — پورسانت معرف یک‌بارمصرف",
  subtitle: "V4.0 — اصلاح مالک: معرف فقط در همان فاکتور اولِ معرفی‌شده پورسانت می‌گیرد (۱۰٪ سود خدمات + ۲۰٪ سود کالا — همان فاکتورِ تخفیف ۱۰٪ مشتری) | از فاکتور دوم به بعد سود شرکت = باقیمانده کامل | بازبینی کامل پلن مالی و اصلاح ۵ باگ | صحت‌سنجی ۳۰/۳۰",
  englishLabel: "FINANCIAL PLAN V4.0 — ALOSHETAB",
  metaLines: [
    "شماره سند: پیام ۱۸ — تاریخ: ۱۹ نوامبر ۲۰۲۶ / ۲۸ آبان ۱۴۰۵",
    "وضعیت پیاده‌سازی: موتور plan18 + تسویهٔ خدمات و کالا + آزمون ۳۰/۳۰ سبز روی بیلد production",
    "تغییر نسبت به v3.2: پورسانت مستمر معرف (۱۵٪ خدمات / ۳۰٪ کالا) به‌طور کامل حذف شد",
    "حساب‌ها: بانک ملی (کارت 6037-99) ← سود خالص شرکت | بانک مهر (شبا + کارت 6063-73) ← در گردش",
    "محرمانگی: سهم‌های معرف/کارشناس/شرکت فقط در دیتابیس و ایمیل بک‌اند — در هیچ پاسخ API نیست",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "V4.0 — پلن مالی",
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
    children: [faRun("توضیح: برای به‌روزرسانی شماره صفحات، روی فهرست راست‌کلیک و Update Field را انتخاب کنید.", { size: 18, italics: true, color: "888888" })],
  }),
];

const bodyChildren = [
  h1("خلاصه اجرایی"),
  bodyPara("این سند، اصلاح مالک در پلن پورسانت معرف را به‌صورت دقیق ثبت، محاسبه و در سامانه پیاده‌سازی می‌کند: «تنها دفعه‌ای که معرف از کد معرفی پورسانت دریافت می‌کند، همان دفعهٔ اول است — همان دفعه‌ای که معرفی‌شده نیز ۱۰٪ تخفیف می‌گیرد.» بنابراین در V4.0، پورسانت معرف یک‌بارمصرف است: روی اولین فاکتور خرید مشتریِ معرفی‌شده فقط ۱۰٪ سود خدمات + ۲۰٪ سود کالا پرداخت می‌شود و از فاکتور دوم به بعد هیچ پورسانتی به معرف تعلق نمی‌گیرد؛ کل سود باقی‌مانده به شرکت می‌رسد. پورسانت مستمر دومرحله‌ای نسخهٔ v3.2 (۱۵٪ خدمات / ۳۰٪ کالا از فاکتور دوم به بعد) به‌طور کامل حذف شد."),
  bodyPara("سایر قواعد پلن بدون تغییر باقی است: سود میز خدمات = ۳۳٪ اجرت کارشناس (درون اجرت)، دستمزد کارشناس = ۶۷٪ اجرت، سود میز کالا = فروش به بالاترین قیمت معتبرترین فروشگاه‌های آنلاین − خرید از ارزان‌ترین انبار به پایین‌ترین قیمت توافقی − هزینهٔ پیک، تخفیف ۱۰٪ فقط فاکتور اول معرفی‌شده، واریز سود شرکت به بانک ملی و پرداخت حق معرف + ۶۷٪ اجرت + خرید کالا از حساب در گردش بانک مهر. کل پلن بازبینی شد؛ پنج نکتهٔ باگ‌گونه یافت و اصلاح شد (بخش ۴) و موتور پیاده‌سازی‌شده با ۳۰ آزمون روی بیلد production سبز است.", { after: 160 }),

  h1("۱. تقسیم سود V4.0 — میز خدمات"),
  bodyPara("مبنای محاسبات همان «اجرت کارشناس» است. در فاکتور اولِ مشتری معرفی‌شده، وصولی ۹۰٪ اجرت است (تخفیف ۱۰٪ مشتری) و از آن ۶۷٪ اجرت کارشناس و ۱۰٪ اجرت معرف پرداخت می‌شود؛ باقیمانده (۱۳٪ اجرت) سود خالص شرکت است. در فاکتورهای بعدی — حتی اگر کد معرف ذکر شود — پورسانتی پرداخت نمی‌شود و شرکت کل ۳۳٪ سود خدمات را برمی‌دارد."),
  tableCaption("جدول ۱ — تقسیم سود میز خدمات در V4.0 (بر پایهٔ اجرت کارشناس)"),
  rtlTable([28, 24, 24, 24],
    ["شرح", "فاکتور دوم به بعد", "فاکتور اول معرفی‌شده", "بدون معرف"],
    [
      ["وصولی از مشتری", "۱۰۰٪ اجرت", "۹۰٪ اجرت (تخفیف ۱۰٪)", "۱۰۰٪ اجرت"],
      ["دستمزد کارشناس → بانک مهر", "۶۷٪ اجرت", "۶۷٪ اجرت", "۶۷٪ اجرت (تا تسویه امانی)"],
      ["پورسانت معرف — فقط یک‌بار", "۰", "۱۰٪ اجرت", "—"],
      ["سود خالص شرکت", "۳۳٪ اجرت (باقیمانده)", "۱۳٪ اجرت (باقیمانده)", "۳۳٪ اجرت"],
      ["کنترل جمع", "۶۷+۳۳ = ۱۰۰", "۶۷+۱۰+۱۳ = ۹۰ = وصولی", "۶۷+۳۳ = ۱۰۰"],
    ]),

  h1("۲. تقسیم سود V4.0 — میز کالا"),
  bodyPara("در میز کالا سود = فروش − خرید − پیک است. در فاکتور اول معرفی‌شده، فروش خالص ۹۰٪ است (تخفیف ۱۰٪ کل فاکتور) و از سود همان فاکتور ۲۰٪ به معرف می‌رسد؛ باقیمانده (۸۰٪ سود) سهم شرکت است. از فاکتور دوم به بعد پورسانتی پرداخت نمی‌شود و شرکت ۱۰۰٪ سود کالا را برمی‌دارد. گارد «سود ≤ صفر → توقف تسویه و بررسی خرید» از نسخه‌های قبل حفظ شده است."),
  tableCaption("جدول ۲ — تقسیم سود میز کالا در V4.0 (بر پایهٔ سود همان فاکتور)"),
  rtlTable([28, 24, 24, 24],
    ["شرح", "فاکتور دوم به بعد", "فاکتور اول معرفی‌شده", "بدون معرف"],
    [
      ["فروش به مشتری", "بالاترین قیمت معتبر", "بالاترین قیمت معتبر − ۱۰٪", "بالاترین قیمت معتبر"],
      ["سود کالا", "فروش − خرید − پیک", "فروش خالص − خرید − پیک", "فروش − خرید − پیک"],
      ["پورسانت معرف — فقط یک‌بار", "۰", "۲۰٪ سود", "—"],
      ["سود خالص شرکت", "۱۰۰٪ سود (باقیمانده)", "۸۰٪ سود (باقیمانده)", "۱۰۰٪ سود"],
      ["گارد محافظتی", "سود ≤ ۰ → توقف و بررسی", "سود ≤ ۰ → توقف و بررسی", "سود ≤ ۰ → توقف و بررسی"],
    ]),

  h1("۳. پورسانت معرف و تخفیف مشتری — قاعدهٔ یک‌بارمصرف"),
  bodyPara("معرف، کد ملی ثبت‌شدهٔ او در سامانه است و مشتری هنگام ثبت سفارش خدمات یا خرید کالا آن را وارد می‌کند. ملاک «فاکتور اول»، نخستین سفارش ثبت‌شدهٔ همان مشتری است (سفارش‌های لغوشده شمارش نمی‌شوند) و تشخیص فقط در سرور انجام می‌شود تا دستکاری‌ناپذیر باشد. کد معرف روی همهٔ سفارش‌های بعدی فقط برای رکورد و رهگیری ذخیره می‌شود و هیچ پورسانتی ایجاد نمی‌کند."),
  tableCaption("جدول ۳ — نرخ‌های نهایی V4.0"),
  rtlTable([34, 22, 22, 22],
    ["حالت", "سهم خدمات", "سهم کالا", "تخفیف مشتری"],
    [
      ["فاکتور اول معرفی‌شده", "۱۰٪ اجرت", "۲۰٪ سود کالا", "۱۰٪ کل فاکتور"],
      ["فاکتور دوم به بعد", "۰", "۰", "—"],
      ["ثبت‌نام بدون کد معرف", "—", "—", "—"],
    ]),
  bodyPara("مبلغ پورسانت در لحظهٔ ثبت سفارش به‌صورت محرمانه (فقط سمت سرور) در رکورد معرفی ثبت می‌شود و در هیچ پاسخ عمومی API ظاهر نمی‌شود؛ همین قاعدهٔ محرمانگی برای سهم‌های کارشناس و شرکت نیز حفظ شده است.", { after: 160 }),

  h1("۴. بازبینی کامل پلن مالی — باگ‌های یافته و اصلاح"),
  tableCaption("جدول ۴ — پنج اصلاح V4.0"),
  rtlTable([8, 40, 52],
    ["#", "باگ / ریسک", "اصلاح اعمال‌شده"],
    [
      ["۱", "پورسانت دومرحله‌ای (دستور مالک): تعهد مالی مستمر و ردیابی نامحدود فاکتورهای معرفی‌شده می‌ساخت", "پورسانت معرف فقط یک‌بار — در همان فاکتور اولِ هم‌زمان با تخفیف ۱۰٪ مشتری؛ رکورد معرفی از فاکتور دوم ساخته نمی‌شود"],
      ["۲", "سود بلاصاحب پس از حذف پورسانت مستمر: اگر سهم شرکت ثابت ۱۸٪/۷۰٪ می‌ماند، ۱۵٪ سود خدمات و ۳۰٪ سود کالا از فاکتور دوم به بعد بدون صاحب می‌ماند (نشتی مالی)", "سهم شرکت = «باقیمانده» تعریف شد: ۳۳٪ خدمات / ۱۰۰٪ کالا در فاکتورهای بعدی — هیچ تومانی بلاتکلیف نمی‌ماند"],
      ["۳", "سلف-رفرال: با یک‌بارمصرف شدن پورسانت، انگیزهٔ ثبت‌نام دوم با هویت دیگر بیشتر می‌شود", "گارد REFERRAL_SELF (معرف ≠ معرفی‌شده با کد ملی یکتا) + تشخیص فاکتور اول فقط سمت سرور + آزمون اختصاصی جدید در verify_p18"],
      ["۴", "سود کالای منفی: نوسان قیمت فروشگاه آنلاین می‌تواند خرید + پیک را از فروش بالاتر ببرد", "گارد حفظ شد: تسویهٔ خودکار متوقف، سفارش با پرچم «سود منفی» برای بازبینی ادمین ثبت می‌شود"],
      ["۵", "تخفیف ۱۰٪ و پورسانت ۱۰/۲۰٪ هم‌زمان روی یک فاکتور: اگر پیش از تخفیف تقسیم شود، جمع سهم‌ها از وصولی بیشتر می‌شود", "ترتیب درست: اول تخفیف از وصولی کسر می‌شود، بعد سهم معرف پرداخت و شرکت باقیمانده می‌گیرد — هیچ ردیفی منفی نمی‌شود (در آزمون‌ها کنترل شد)"],
    ]),

  h1("۵. جریان بانکی — بانک ملی و بانک مهر"),
  bodyPara("همهٔ مبالغ وصولی مشتری به حساب در گردش (بانک مهر) می‌آید و از همان‌جا پرداخت‌های عملیاتی انجام می‌شود: دستمزد ۶۷٪ کارشناس، حق معرف (فقط فاکتور اول)، هزینهٔ خرید کالا از انبار و پیک. ماندهٔ باقی‌مانده — که دقیقاً برابر سود خالص شرکت است — به حساب بانک ملی واریز می‌شود. مقصد بانکی هر مبلغ در گزارش تسویهٔ هر سفارش صریحاً درج می‌شود."),
  tableCaption("جدول ۵ — حساب‌های بانکی و نقش هر حساب"),
  rtlTable([24, 40, 36],
    ["حساب", "شناسه", "نقش در V4.0"],
    [
      ["بانک ملی ایران", "کارت 6037-9981-4097-4550", "سود خالص شرکت (۳۳٪ خدمات بدون معرف / ۱۳٪ فاکتور اول + ۱۰۰٪ سود کالا / ۸۰٪ فاکتور اول)"],
      ["بانک مهر ایران", "شبا IR430170000000345884841004", "حساب دریافت فاکتورها و مبالغ در گردش"],
      ["بانک قرض‌الحسنه مهر ایران", "کارت 6063-7311-2146-8624", "پرداخت حق معرف (فقط فاکتور اول) + ۶۷٪ اجرت کارشناس + خرید کالا + پیک"],
    ]),

  h1("۶. جدول تطبیق عددی — دو نمونهٔ کامل"),
  bodyPara("سناریوی خدمات با اجرت کارشناس " + money(W) + " تومان و سناریوی کالا با فروش " + money(S) + " تومان، خرید توافقی " + money(C) + " تومان و پیک " + money(F) + " تومان؛ مشتری با کد معرف ثبت‌نام کرده است. اعداد دقیقاً با خروجی موتور plan18 انطباق داده شده است."),
  tableCaption("جدول ۶ — تسویهٔ خدمات: اجرت کارشناس " + money(W) + " تومان"),
  rtlTable([28, 24, 24, 24],
    ["ردیف", "فاکتور اول معرفی‌شده", "فاکتور دوم به بعد", "کنترل"],
    [
      ["وصولی از مشتری", money(svF.collected), money(svN.collected), "۹۰٪ در فاکتور اول"],
      ["دستمزد کارشناس (۶۷٪)", money(svF.expert), money(svN.expert), "ثابت — بانک مهر"],
      ["پورسانت معرف (فقط یک‌بار)", money(svF.referrer), money(svN.referrer), "۱۰٪ / ۰ — V4.0"],
      ["سود خالص شرکت", money(svF.company), money(svN.company), "۱۳٪ / ۳۳٪"],
      ["جمع تسهیم", money(svF.expert + svF.referrer + svF.company), money(svN.expert + svN.referrer + svN.company), "برابر وصولی"],
    ]),
  tableCaption("جدول ۷ — تسویهٔ کالا: فروش " + money(S) + " | خرید " + money(C) + " | پیک " + money(F)),
  rtlTable([28, 24, 24, 24],
    ["ردیف", "فاکتور اول معرفی‌شده", "فاکتور دوم به بعد", "کنترل"],
    [
      ["فروش به مشتری", money(gdF.saleNet), money(gdN.saleNet), "۹۰٪ در فاکتور اول"],
      ["سود کالا (فروش − خرید − پیک)", money(gdF.profit), money(gdN.profit), "مبنای تقسیم"],
      ["پورسانت معرف (فقط یک‌بار)", money(gdF.referrer), money(gdN.referrer), "۲۰٪ / ۰ — V4.0"],
      ["سود خالص شرکت", money(gdF.company), money(gdN.company), "۸۰٪ / ۱۰۰٪"],
      ["جمع تسهیم", money(gdF.referrer + gdF.company), money(gdN.referrer + gdN.company), "برابر سود کالا"],
    ]),
  bodyPara("کنترل بانکی فاکتور عادی (دوم به بعد): وصولی کل " + money(W + S) + " تومان؛ پرداخت از مهر: کارشناس " + money(svN.expert) + " + خرید انبار " + money(C) + " + پیک " + money(F) + " + معرف ۰ = " + money(svN.expert + C + F) + " تومان؛ مانده به بانک ملی = " + money(svN.company + gdN.company) + " تومان که دقیقاً برابر سود خالص شرکت است. در فاکتور اول نیز ماندهٔ ملی " + money(svF.company + gdF.company) + " تومان می‌شود و تراز کامل می‌ماند.", { after: 160 }),

  h1("۷. پیاده‌سازی فنی و صحت‌سنجی V4.0"),
  bodyPara("پلن V4.0 روی همان بیلد production (پورت ۳۰۱۰) پیاده و با ۳۰ آزمون صحت‌سنجی شد: همگی سبز. موتور محض در src/lib/plan18.ts جدا از دیتابیس نوشته شده؛ نرخ‌های فاکتور اول (۱۰٪ خدمات، ۲۰٪ کالا، تخفیف ۱۰٪) و دستمزد ۶۷٪ از جدول تنظیمات خوانده می‌شوند و مالک می‌تواند بدون تغییر کد از پنل اصلاح کند. دو کلید منسوخ SERVICES_REFERRER_PCT_NORMAL و GOODS_REFERRER_PCT_NORMAL دیگر خوانده نمی‌شوند — پورسانت مستمر در V4.0 وجود ندارد."),
  tableCaption("جدول ۸ — فایل‌های تغییرکرده و نقش هر یک"),
  rtlTable([40, 60],
    ["فایل", "نقش در V4.0"],
    [
      ["src/lib/plan18.ts", "موتور محض جدید: پورسانت معرف فقط فاکتور اول؛ جانشین plan17.ts"],
      ["src/app/api/orders", "ساخت رکورد معرفی فقط در فاکتور اول + پورسانت ۱۰٪ اجرت + تخفیف فاکتور اول"],
      ["src/app/api/products/order", "پورسانت کالا فقط فاکتور اول (۲۰٪ سود در زمان تسویه) + کد معرف برای رهگیری"],
      ["src/app/api/admin/product-orders", "تسویهٔ کالا با settleGoods18: فاکتور اول ۲۰٪/۸۰٪ — بعد: ۰/۱۰۰٪ + گزارش بانکی"],
      ["src/lib/settlement.ts", "تسویهٔ خودکار خدمات با موتور plan18 + گزارش «فقط فاکتور اول»"],
      ["src/lib/constants.ts", "کلیدهای منسوخ NORMAL = ۰؛ نسخهٔ سامانه: v4.0-IR / v4.0-WORLD"],
      ["scripts/verify_p18.cjs", "۳۰ آزمون V4.0 روی بیلد production — همگی سبز (جانشین verify_p17)"],
    ]),

  h1("۸. نظر کلی کارشناس دربارهٔ پلن"),
  bodyPara("نقاط قوت: مدل V4.0 ساده، بسته و ممیزی‌پذیر است؛ هیچ تعهد مالی درازمدت یا بدهی پورسانت انباشته برای شرکت نمی‌سازد؛ انگیزهٔ خرید اول مشتری قوی است (تخفیف ۱۰٪ مشتری و پورسانت معرف در یک نقطه متمرکز شده)؛ و حسابداری آن تک‌مرحله‌ای و کم‌خطاست — هر معرفی دقیقاً یک رکورد پورسانت دارد."),
  bodyPara("نقاط ضعف و ریسک: معرف بعد از اولین خرید مشتری دیگر انگیزهٔ مادی ندارد، پس احتمالاً فقط «خریدار قطعی» را معرفی می‌کند و رشد ارجاعی کُندتر از مدل مستمر می‌شود؛ همچنین ریسک تقلب سلف-رفرال بالاتر می‌رود که با گاردهای موجود (کد ملی یکتا، تشخیص سمت سرور، آزمون اختصاصی) بسته شده است."),
  bodyPara("جمع‌بندی و پیشنهاد: پلن قابل اجرا و از نظر مالی پایدارتر از نسخهٔ قبل است؛ با پنج گارد بخش ۴ آن را ببندید (پیاده‌سازی شد). اگر بعداً رشد ارجاعی کند شد، به‌جای بازگشت به پورسانت مستمر، یک پاداش سقف‌دار و دوره‌ای (مثلاً به ازای هر ۵ معرفیِ با فاکتور، یک مبلغ ثابت) با یک پارامتر پنل اضافه کنید — بدون تغییر پایهٔ V4.0.", { after: 200 }),
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
      headers: { default: new Header({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { line: 240 }, children: [faRun("پلن مالی V4.0 | پیام ۱۸", { size: 18, color: "808080" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240 }, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, sizeComplexScript: 18, color: "808080", font: FONT })] })] }) },
      children: bodyChildren,
    },
  ],
});

const OUT = "/home/z/my-project/download/پیام-۱۸-پلن-مالی-V4.0.docx";
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("WROTE:", OUT, buf.length, "bytes"); });
