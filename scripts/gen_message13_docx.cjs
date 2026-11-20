// پیام ۱۳ — تب فروشگاه‌ها، سیاست قیمت دوگانه (فروش بالاترین/خرید پایین‌ترین توافقی)، اتصال لحظه‌ای (Persian RTL)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (هم‌سان با پیام ۳ تا ۱۲)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  TableLayoutType, PageOrientation,
} = require("docx");
const fs = require("fs");

// ─────────────────────────── Palette GO-1 (Graphite Orange) ───────────────────────────
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

function faRun(text, opts = {}) {
  const size = opts.size || 24;
  return new TextRun({
    text,
    font: FONT,
    rightToLeft: true,
    size,
    sizeComplexScript: size,
    bold: !!opts.bold,
    boldComplexScript: !!opts.bold,
    italics: !!opts.italics,
    color: opts.color || BODY_COLOR,
    characterSpacing: opts.characterSpacing,
  });
}

function bodyPara(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: opts.after != null ? opts.after : 120 },
    children: [faRun(text, opts)],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    bidirectional: true,
    spacing: { before: 360, after: 160, line: 380, lineRule: "atLeast" },
    children: [faRun(text, { size: 32, bold: true, color: HEAD_COLOR })],
  });
}

function tableCaption(text) {
  return new Paragraph({
    bidirectional: true,
    keepNext: true,
    spacing: { before: 160, after: 80, line: 312 },
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
      bidirectional: true,
      alignment: isHeader ? AlignmentType.CENTER : undefined,
      spacing: { line: 312 },
      children: [faRun(line, { size: 21, bold: isHeader, color: isHeader ? PAL.table.headerText : BODY_COLOR })],
    })),
  });
  return new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headerCells.map((t, i) => mkCell(t, i, true)) }),
      ...dataRows.map(r => new TableRow({ cantSplit: true, children: r.map((t, i) => mkCell(t, i, false)) })),
    ],
  });
}

// ─────────────────────────── Cover layout math ───────────────────────────
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."،؛:！？", ..."-_—–·/", ..." \t"]);
  const lines = [];
  let remaining = title;
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
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
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
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, Math.floor(maxWidthTwips / charWidth(minPt)));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0,
  } = params;
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
    bidirectional: true,
    indent: { left: padStart, right: padEnd }, spacing: { after: 500 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
    children: [new TextRun({
      text: config.englishLabel.split("").join("  "),
      size: 18, sizeComplexScript: 18, color: P.accent, font: FONT, characterSpacing: 40,
    })],
  }));

  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: padStart },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({
        text: titleLines[i], size: titleSize, sizeComplexScript: titleSize, bold: true, boldComplexScript: true,
        rightToLeft: true, color: P.cover.titleColor, font: FONT,
      })],
    }));
  }

  children.push(new Paragraph({
    bidirectional: true,
    indent: { left: padStart }, spacing: { after: 800, line: 380, lineRule: "atLeast" },
    children: [faRun(config.subtitle, { size: 24, color: P.cover.subtitleColor })],
  }));

  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: padStart + 200 }, spacing: { after: 80 },
      border: { left: accentStart },
      children: [faRun(line, { size: 24, color: P.cover.metaColor })],
    }));
  }

  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  children.push(new Paragraph({
    bidirectional: true,
    indent: { left: padStart, right: padEnd },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      faRun(config.footerLeft || "", { size: 16, color: P.cover.footerColor }),
      new TextRun({ text: "                                        ", font: FONT }),
      faRun(config.footerRight || "", { size: 16, color: P.cover.footerColor }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ─────────────────────────── Content ───────────────────────────
const coverConfig = {
  title: "فروشگاه‌ها، سیاست قیمت دوگانه و اتصال لحظه‌ای",
  subtitle: "پیام ۱۳ — لیست فروشگاه‌ها در پنل ادمین؛ فروش به بالاترین قیمت ارائه‌شده؛ خرید و تأمین موجودی از پایین‌ترین قیمت توافقی؛ اتصال به سایت نوسان قیمت لحظه‌ای؛ قیمت‌ها فقط از بروزترین منابع",
  englishLabel: "STORES, SELL-HIGH / BUY-LOW POLICY & LIVE PRICE FEED",
  metaLines: [
    "شماره سند: پیام ۱۳ — تکمیل قواعد پیام ۱۱ و ۱۲ (تاریخ پیام: ۱۷ نوامبر ۲۰۲۶)",
    "تاریخ تنظیم: ۲۶ آبان ۱۴۰۵",
    "دستاورد کلیدی: تب فروشگاه‌ها + موتور سیاست پیشنهاد قیمت + اتصال واقعی لحظه‌ای TGJU (۵ نرخ زنده)",
    "وضعیت: ۹۲ آزمون دود سبز (۴۴ آزمون جدید پیام ۱۳ + ۴۸ آزمون رگرسیون پیام ۱۲)",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "پیام ۱۳ — فروشگاه‌ها و اتصال لحظه‌ای",
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
  // ── خلاصه اجرایی ──
  h1("خلاصه اجرایی"),
  bodyPara("این سند، پیام سیزدهم را در سامانه الو شتاب اعمال می‌کند. پیام ۱۳ سه دستور اصلی دارد: نخست «لیست تمام فروشگاه‌ها در پنل ادمین گذاشته شود» — یک تب کامل «فروشگاه‌ها» به پنل مدیریتی افزوده شد که جدا از تب انبارها، هر فروشگاه را با راه‌های ارتباطی، آدرس، سایت، نوع اتصال و وضعیت لحظه‌ای نشان می‌دهد. دوم «فروش به بالاترین قیمت ارائه شده / خرید و تأمین موجودی از پایین‌ترین قیمت توافقی» — یک موتور سیاست قیمت ساخته شد که برای هر کالا، قیمت ارائه‌شدهٔ هر فروشگاه و قیمت توافقی خرید را جداگانه نگه می‌دارد و قیمت نمایشی میز کالا را از بالاترین ارائه‌شده و هدف خرید را از پایین‌ترین توافقی محاسبه می‌کند. سوم «اگر سایت نوسان قیمت می‌شناسی که آمار دقیق لحظه‌ای بدهد، به آن وصل شو» — سامانه اکنون به tgju.org (مرجع نوسان لحظه‌ای ارز و طلا در ایران) به‌صورت واقعی متصل است و در آزمون تولید، پنج نرخ زنده (دلار، یورو، سکه امامی، سکه گرمی و طلای ۱۸ عیار) را دریافت و ثبت کرد."),
  bodyPara("دو قاعدهٔ تازگی نیز تکمیل شد: «قیمت‌ها از بروزترین‌ها بروز شود» — در همهٔ محاسبات، بروزترین پیشنهادِ هر فروشگاه ملاک است و گزارش روزانهٔ قیمت از تازه‌ترین داده‌ها ساخته می‌شود؛ و مرز تازگی قیمت‌ها (فقط بعد از ۱۴۰۵/۰۸/۱۰) همچنان روی ثبت دستی، اتصال لحظه‌ای و نمایش عمومی اعمال می‌شود. همهٔ قواعد قبلی پیام ۱۱ و ۱۲ — حداقل فاکتور ۵٬۰۰۰٬۰۰۰ تومان، قیمت نمایشی = قیمت مرجع بدون افزودنی، افزودنی +۳۳٪ (+۱۵٪ رقابتی) و پیک فقط در صفحهٔ پرداخت، شبای حساب دریافت، آدرس دقیق مشتری، سفارش خدمات کنار خرید و مراحل فاکتور — دست‌نخورده و فعال باقی‌مانده‌اند و با آزمون رگرسیون ۴۸ موردی مجدداً تأیید شدند."),

  // ── ۱. تب فروشگاه‌ها ──
  h1("۱. تب «فروشگاه‌ها» در پنل ادمین — لیست کامل با راه‌های ارتباطی"),
  bodyPara("تب جدید «فروشگاه‌ها» در پنل مدیریتی، متمایز از تب «انبارها و مراجع»، هشت فروشگاه اصلی را ثبت کرده است: دیجی‌کالا، اسنپ، ترب، ایمالز، تکنولایف، فرالند، تراست مارکت‌پلیس و باسلام. برای هر فروشگاه، نام، نوع (بازار آنلاین، مقایسه‌گر قیمت، فروشگاه اینترنتی)، سایت، تلفن، آدرس کامل شهر، تعداد پیشنهادهای ثبت‌شده، بالاترین قیمت فروش و پایین‌ترین قیمت توافقی خرید آن فروشگاه، تاریخ تازه‌ترین قیمت و وضعیت اتصال لحظه‌ای نمایش داده می‌شود. ادمین می‌تواند فروشگاه جدید با فرم اختصاصی اضافه کند (کلید یکتا، نوع، راه‌های ارتباطی و قالب جستجوی لحظه‌ای) و فعال بودن مجموعه را تأیید کند."),
  tableCaption("جدول ۱ — فروشگاه‌های ثبت‌شده و وضعیت اتصال لحظه‌ای"),
  rtlTable([20, 24, 20, 36],
    ["فروشگاه", "نوع", "اتصال لحظه‌ای", "وضعیت و یادداشت"],
    [
      ["دیجی‌کالا", "بازار آنلاین", "آداپتور رسمی API", "تأییدشده؛ تلفن و آدرس رسمی ثبت است — در صورت چالش CDN، ثبت کوکی معتبر در تنظیمات (DIGIKALA_COOKIE) اتصال را فعال می‌کند"],
      ["اسنپ", "بازار آنلاین", "آداپتور اسنپ‌مارکت", "تأییدشده؛ قیمت‌ها سمت مرورگر رندر می‌شود — نیازمند کلید API رسمی"],
      ["ترب", "مقایسه‌گر قیمت", "آداپتور API ترب", "تأییدشده؛ کپچای آرکپچا مانع اتصال سرور به سرور است"],
      ["ایمالز", "مقایسه‌گر قیمت", "دستی", "تأییدشده؛ ثبت استعلام دستی فعال است"],
      ["تکنولایف", "فروشگاه اینترنتی", "دستی", "تلفن و آدرس رسمی باید توسط ادمین تکمیل/تأیید شود"],
      ["فرالند", "فروشگاه اینترنتی", "دستی", "لیست قیمت روز لوازم خانگی — تلفن رسمی توسط ادمین تکمیل شود"],
      ["تراست مارکت‌پلیس", "فروشگاه اینترنتی", "دستی", "کولر گازی اسپلیت — اطلاعات تماس توسط ادمین تکمیل شود"],
      ["باسلام", "بازار آنلاین", "دستی", "در صورت نیاز ادمین فعال می‌کند"],
    ]),
  bodyPara("در بالای همین تب، کارت «نرخ‌های لحظه‌ای مرجع» قرار دارد که با دکمهٔ «همگام‌سازی لحظه‌ای» به سایت نوسان قیمت وصل می‌شود و آخرین نرخ دلار آمریکا، یورو، سکه امامی، سکه گرمی و طلای ۱۸ عیار را همراه درصد تغییر نسبت به ثبت قبلی نشان می‌دهد. هیچ دادهٔ ساختگی در این کارت نوشته نمی‌شود؛ اگر اتصال در محیط سرور برقرار نشود، پیام خطای واقعی ثبت و نمایش داده می‌شود.", { after: 160 }),

  // ── ۲. موتور سیاست ──
  h1("۲. موتور سیاست قیمت — فروش بالاترین، خرید پایین‌ترین توافقی"),
  bodyPara("برای هر کالا، هر فروشگاه یک «پیشنهاد قیمت» دارد که دو عدد جدا را نگه می‌دارد: «قیمت ارائه‌شده» — دقیقاً همان قیمتی که در سایت فروشگاه گذاشته شده (پیام ۱۲) — و «قیمت توافقی» — قیمتی که در مذاکرهٔ خرید/تأمین موجودی به آن رسیدیم (داخلی و محرمانه، فقط در پنل ادمین). موتور سیاست از میان پیشنهادهای فعال، بروزترین پیشنهاد هر فروشگاه را انتخاب می‌کند («قیمت‌ها از بروزترین‌ها بروز شود»)، سپس بالاترین قیمت ارائه‌شده را به‌عنوان پایهٔ فروش («فروش به بالاترین قیمت ارائه شده») و پایین‌ترین قیمت توافقی را به‌عنوان هدف خرید و تأمین موجودی («خرید از پایین‌ترین قیمت توافقی») برمی‌گرداند؛ حاشیهٔ ناخالص بازار (تفاضل این دو) به‌صورت داخلی برای تصمیم‌گیری ادمین محاسبه می‌شود."),
  bodyPara("قاعدهٔ افزودنی صفحهٔ پرداخت روی همین جفت قیمت سوار است: اگر فاصلهٔ بازار تا قیمت توافقی ما بیش از ۳۳ درصد باشد (مثل کولر تراست: ارائه‌شدهٔ بازار ۷۵ میلیون، توافقی ۵۵ میلیون)، افزودنی رقابتی ۱۵٪ کافی است؛ در غیر این صورت افزودنی استاندارد ۳۳٪ روی قیمت ارائه‌شده اعمال می‌شود. قیمت نمایشی میز کالا پس از «اعمال سیاست» (با تأیید ادمین) برابر بالاترین ارائه‌شده می‌شود و مشتری در صفحهٔ پرداخت همان ریزدیسکی پیام ۱۲ را می‌بیند: قیمت مرجع × تعداد، افزودنی، پیک و تعدیل حداقل فاکتور. ثبت استعلام تازه با گیت تاریخ پایش می‌شود — پیشنهادی با تاریخ قبل از ۱۴۰۵/۰۸/۱۰ با خطای شفاف رد می‌شود."),
  tableCaption("جدول ۲ — نمونهٔ محاسبهٔ موتور سیاست (مبلغ‌ها به تومان — از آزمون واقعی)"),
  rtlTable([26, 18, 18, 18, 20],
    ["کالا", "ارائه‌شده‌ها (فروش)", "توافقی‌ها (خرید)", "قیمت نمایشی", "افزودنی پرداخت"],
    [
      ["ماوس بی‌سیم Q5", "دیجی‌کالا ۱٬۳۱۲٬۰۰۰ / تکنولایف ۱٬۳۰۰٬۰۰۰", "۱٬۲۲۰٬۰۰۰ / ۱٬۲۰۰٬۰۰۰", "۱٬۳۱۲٬۰۰۰ (بالاترین)", "+۳۳٪ — پرداخت ۱٬۳۱۲٬۰۰۰ + ۴۳۳٬۰۰۰ + ۲۵۰٬۰۰۰ پیک"],
      ["کالای آزمون سیاست", "فروشگاه الف ۱۲٬۰۰۰٬۰۰۰", "۹٬۰۰۰٬۰۰۰", "۱۲٬۰۰۰٬۰۰۰ (بالاترین)", "+۱۵٪ رقابتی (فاصله > ۳۳٪) — پرداخت ۱۴٬۰۵۰٬۰۰۰ با پیک"],
      ["کولر گازی تراست ۱۲۰۰۰", "بازار ۷۵٬۰۰۰٬۰۰۰ / تراست ۵۵٬۰۰۰٬۰۰۰", "۶۸٬۰۰۰٬۰۰۰ / ۵۵٬۰۰۰٬۰۰۰", "۷۵٬۰۰۰٬۰۰۰ پس از اعمال سیاست", "+۱۵٪ رقابتی — همیشه ارزان‌تر از مرجع"],
    ]),

  // ── ۳. اتصال لحظه‌ای ──
  h1("۳. اتصال به سایت نوسان قیمت — TGJU متصل، چهار آداپتور آماده"),
  bodyPara("برای دستور «اگر سایت نوسان قیمت می‌شناسی که آمار دقیق لحظه‌ای بدهد، به آن وصل شو»، سامانه به tgju.org متصل شد — معتبرترین مرجع نوسان لحظه‌ای ارز و طلا در ایران. اتصال واقعی است: در آزمون تولید، پنج نرخ زنده از HTML رسمی سایت خوانده و با مهر زمانی در پایگاه داده ثبت شد (دلار ۲۶۶٬۹۰۰، یورو و نرخ‌های سکه و طلای ۱۸ عیار — همه به تومان). این نرخ‌ها دو کاربرد دارند: نمایش زنده در تب فروشگاه‌ها برای تصمیم‌گیری ادمین، و «علم‌گر نوسان» — اگر دلار یا طلا بیش از ۲ درصد حرکت کند، کالاهای بدون استعلام تازه باید دوباره قیمت بخورند (بروزرسانی از بروزترین‌ها). چرخهٔ شبانهٔ سامانه (/api/tick) هر بار این اتصال را تازه می‌کند."),
  bodyPara("برای قیمت لحظه‌ایِ هر کالا، سه آداپتور دیگر هم پیاده‌سازی شد: آداپتور رسمی دیجی‌کالا (api.digikala.com — قیمت selling_price از ریال به تومان تبدیل و به‌عنوان پیشنهاد لحظه‌ای ثبت می‌شود)، آداپتور ترب و آداپتور اسنپ‌مارکت. در محیط آزمون، CDN دیجی‌کالا چالش امنیتی (۳۰۷) و ترب کپچای آرکپچا نشان دادند؛ هر دو آداپتور وضعیت شفاف («چالش امنیتی») را با راهنمای رفع ثبت می‌کنند — با استقرار روی سرور داخل ایران یا ثبت کوکی معتبر در تنظیمات، اتصال زنده می‌شود. اصل حاکم: هیچ قیمت ساختگی از اتصال قطع نوشته نمی‌شود؛ تا لحظهٔ اتصال موفق، ثبت دستی استعلام (که خودش گیت تازگی دارد) مبنای کار است.", { after: 160 }),

  // ── ۴. مرز تاریخی ──
  h1("۴. مرز تازگی قیمت‌ها — از ۱۴۰۵/۰۸/۱۰ به بعد (قابل تغییر از تنظیمات)"),
  bodyPara("در پیام ۱۳ قاعدهٔ تازگی با عبارت «از 2026/8/1 به بعد» تکرار شده است. چون همین قاعده در پیام ۱۲ با تاریخ صریح «2026/nov/1» داده شده بود و ۱ نوامبر ۲۰۲۶ معادل ۱۰ آبان ۱۴۰۵ است، مرز فعال سامانه روی ۱۴۰۵/۰۸/۱۰ تنظیم شده است. اگر منظور کارفرما «آبان ۱» (۱۴۰۵/۰۸/۰۱ = ۲۳ اکتبر ۲۰۲۶) باشد، تنها کافی است مالک در تنظیمات پنل، مقدار «مرز تازگی قیمت» را به 2026-10-23 تغییر دهد — بدون هیچ تغییر کد، همهٔ گیت‌ها (نمایش، جستجو، سفارش، ثبت پیشنهاد) خودکار با مرز جدید کار می‌کنند."),
  bodyPara("با همین مرز، ۳۹ پیشنهاد قیمت فروشگاه‌ها برای ۱۹ کالا با تاریخ ۱۴۰۵/۰۸/۲۶ (امروز) ثبت شد و همه تازه‌اند؛ ۹ قلم تجهیزات قدیمی که استعلام تازه ندارند همچنان از ویترین عمومی خارج و در انتظار استعلام انبار هستند. قیمت‌های نمایشی فعلی میز کالا تغییری نکرده‌اند — اعمال سیاست بالاترین/پایین‌ترین فقط با تأیید صریح ادمین (دکمهٔ «اعمال سیاست» یا تأیید گزارش روزانه) انجام می‌شود تا هیچ قیمت بدون اطلاع مالک عوض نشود.", { after: 160 }),

  // ── ۵. حساب‌ها ──
  h1("۵. حساب‌های مالی — بررسی مجدد، هر سه صحیح"),
  bodyPara("طبق دستور دائمی «شماره شبا و پل هر دو حساب را با دقت بررسی و در صورت نیاز اصلاح کن»، هر سه شماره مجدداً با کد مستقل سنجیده شد: شبای حساب دریافت IR430170000000345884841004 با طول ۲۶ و باقیماندهٔ mod-97 برابر ۱ صحیح است (بانک مهر ایران — کد ۰۱۷)؛ کارت تقسیم‌بندی 6037998140974550 (بانک ملی ایران، مجموع Luhn ۸۰) و کارت سهم شرکت 6063731121468624 (قرض‌الحسنه مهر ایران، مجموع Luhn ۶۰) هر دو سالم‌اند. نیازی به اصلاح شماره‌ها نیست و همهٔ فاکتورها (چون ≥ ۵ میلیون تومان‌اند) از طریق شبای حساب دریافت دریافت می‌شوند."),
  tableCaption("جدول ۳ — نتیجهٔ نهایی حسابرسی شماره‌های مالی (۲۶ آبان ۱۴۰۵)"),
  rtlTable([36, 22, 20, 22],
    ["شماره", "بانک", "الگوریتم", "نتیجه"],
    [
      ["IR430170000000345884841004 (شبای دریافت)", "بانک مهر ایران (کد ۰۱۷)", "mod-97 = ۱", "صحیح — بدون اصلاح"],
      ["6037998140974550 (تقسیم‌بندی — محرمانه)", "بانک ملی ایران", "Luhn = ۸۰", "صحیح — بدون اصلاح"],
      ["6063731121468624 (سهم شرکت — محرمانه)", "بانک قرض‌الحسنه مهر ایران", "Luhn = ۶۰", "صحیح — بدون اصلاح"],
    ]),

  // ── ۶. آزمون‌ها ──
  h1("۶. آزمون‌ها، رفع اشکالات و اقلام تحویلی"),
  bodyPara("مجموعهٔ آزمون پیام ۱۳ با ۴۴ سنجه اجرا شد و همه سبز شدند: ثبت و فهرست ۸ فروشگاه با اطلاعات تماس؛ اتصال واقعی لحظه‌ای (۵ نرخ زنده از tgju.org با تبدیل ریال به تومان)؛ محاسبهٔ دقیق موتور سیاست (بالاترین ارائه‌شده، پایین‌ترین توافقی، حاشیهٔ داخلی، قاعدهٔ افزودنی)؛ ردّ پیشنهاد کهنه با گیت تاریخ؛ اعمال کامل سیاست روی کالای آزمایشی (قیمت نمایشی ۱۲٬۰۰۰٬۰۰۰، افزودنی رقابتی ۱۵٪، پرداخت ۱۴٬۰۵۰٬۰۰۰ با پیک)؛ محرمانگی APIهای فروشگاه و پیشنهاد (۴۰۱ بدون ورود)؛ و کارکرد چرخهٔ شبانه با اتصال لحظه‌ای. آزمون رگرسیون پیام ۱۲ نیز با ۴۸ سنجه سبز ماند."),
  bodyPara("در همین بازبینی سه اشکال واقعی پیدا و رفع شد: خطای نوع‌دادهٔ «قیمت نهایی» در مسیر افزودن کالا (مقدار محاسبه‌شدهٔ اشتباه به دیتابیس می‌رفت)، سرریز عددی نرخ سکه در ستون قیمت (ذخیره‌سازی به تومان اصلاح شد) و انتشار فیلد عملیات به کوئری بروزرسانی در دو مسیر پنل. بذرپاشی داده‌ها (فروشگاه‌ها و پیشنهادها) به اسکریپت مستقل seed_p13 منتقل شد و پاک‌سازی داده‌های آزمون با cleanup_p13 خودکار شد."),
  bodyPara("اقلام تحویلی: کد به‌روزشدهٔ سامانه (نسخهٔ v2.3-IR — اسکیما، موتور سیاست، آداپتورهای اتصال، تب فروشگاه‌ها، بذر و آزمون)، این سند و گزارش‌های آزمون. اقلام باز برای مالک: تکمیل تلفن و آدرس رسمی فروشگاه‌های «نیاز به تأیید» در تب فروشگاه‌ها؛ ثبت نهایی قیمت‌های توافقی پس از مذاکره؛ در صورت تمایل به اتصال زندهٔ دیجی‌کالا، ثبت کوکی معتبر در تنظیمات یا استقرار روی سرور داخل ایران؛ و تغییر (یا تأیید) مرز تازگی قیمت در تنظیمات. قاعدهٔ محرمانگی سهم‌بندی تسویه همچنان مطلق است: مبالغ و درصدهای سهم‌ها فقط در پایگاه داده و ایمیل بک‌اند، بدون هیچ نمایشی در رابط کاربری یا پاسخ عمومی API. قیمت‌های توافقی خرید نیز فقط در پنل ادمین دیده می‌شوند و هرگز به رابط عمومی ارسال نمی‌شوند.", { after: 0 }),
];

// ─────────────────────────── Assembly ───────────────────────────
const pgSize = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24, color: BODY_COLOR },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT, size: 32, bold: true, color: HEAD_COLOR },
        paragraph: { spacing: { before: 360, after: 160, line: 380 } },
      },
      heading2: {
        run: { font: FONT, size: 28, bold: true, color: HEAD_COLOR },
        paragraph: { spacing: { before: 240, after: 120, line: 360 } },
      },
    },
  },
  sections: [
    { // Section 1: Cover — margin 0, no header/footer, no page number
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1(coverConfig),
    },
    { // Section 2: TOC
      properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin } },
      children: tocChildren,
    },
    { // Section 3: Body — Arabic page numbers starting at 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            bidirectional: true, alignment: AlignmentType.CENTER, spacing: { line: 240 },
            children: [faRun("فروشگاه‌ها و اتصال لحظه‌ای | پیام ۱۳", { size: 18, color: "808080" })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { line: 240 },
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, sizeComplexScript: 18, color: "808080", font: FONT })],
          })],
        }),
      },
      children: bodyChildren,
    },
  ],
});

const OUT = "/home/z/my-project/download/پیام-۱۳-فروشگاه‌ها-و-اتصال-لحظه‌ای.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
