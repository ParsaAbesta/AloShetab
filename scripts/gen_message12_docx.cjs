// پیام ۱۱ — میز محصولات دو بخشی، موجودی واقعی انباری، موتور قیمت +۳۳٪/+۱۵٪، انبارها، مراحل فاکتور، حسابدار هوشمند، پنل مالک/ادمین (Persian RTL document)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (same as پیام ۳ تا ۱۰)
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
  title: "اصلاحات پرداخت و قیمت‌گذاری میز کالا",
  subtitle: "پیام ۱۲ — حداقل فاکتور ۵٬۰۰۰٬۰۰۰ تومان؛ قیمت نمایشی = قیمت مرجع بدون افزودنی؛ افزودنی +۳۳٪ و هزینهٔ پیک فقط در صفحهٔ پرداخت؛ قیمت‌ها فقط از ۱ نوامبر ۲۰۲۶",
  englishLabel: "MIN-INVOICE, SOURCE-PRICE LISTING & PRICE FRESHNESS",
  metaLines: [
    "شماره سند: پیام ۱۲ — اصلاحیهٔ پیام ۱۱ (تاریخ پیام: ۱۷ نوامبر ۲۰۲۶)",
    "تاریخ تنظیم: ۲۶ آبان ۱۴۰۵",
    "دستاورد کلیدی: موتور پرداخت جدید با ریزدیسکی کامل + گیت تازگی قیمت + اصلاح نام بانک و دو اشکال واقعی",
    "وضعیت: ۴۶ آزمون دود، همهٔ جریان‌ها سبز؛ بستهٔ v2.2.0 آماده است",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "پیام ۱۲ — اصلاحات پرداخت و قیمت‌گذاری",
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
  bodyPara("این سند، پیام دوازدهم و اصلاحیهٔ پیام ۱۱ است و سه دستور جدید کارفرما در تاریخ ۱۷ نوامبر ۲۰۲۶ (۲۶ آبان ۱۴۰۵) را در کل سامانه اعمال می‌کند. نخست: «حداقل مبلغ دریافتی از هر فاکتور باید ۵٬۰۰۰٬۰۰۰ تومان باشد» — اکنون هر فاکتور (کالا، نرم‌افزار و خدمات) در صفحهٔ پرداخت به این سقف تعدیل می‌شود و چون همهٔ فاکتورها ≥ ۵ میلیون تومان‌اند، دریافت همهٔ آن‌ها از طریق شبای حساب دریافت انجام می‌شود. دوم: «قیمت کالاهایی که از موجودی فروشگاه‌ها کپی می‌شوند، همان که در سایت‌ها گذاشته شده باشد و هنگام پرداخت +۳۳٪ + هزینهٔ ارسال و بسته‌بندی (پیک) شود» — قیمت نمایشی میز کالا اکنون دقیقاً همان قیمت مرجع است (بدون هیچ افزودنی) و افزودنی +۳۳٪ (یا +۱۵٪ قاعدهٔ رقابتی) و هزینهٔ پیک فقط در صفحهٔ پرداخت با ریزدیسکی کامل محاسبه و نمایش داده می‌شود. سوم: «تمام بروزرسانی‌ها و قیمت‌ها فقط از ۲۰۲۶/۱۱/۰۱ به بعد» — یک گیت تازگی قیمت با مرز شمسی ۱۴۰۵/۰۸/۱۰ در نمایش، جستجو و سفارش‌گذاری اعمال شد."),
  bodyPara("در همین بازبینی، صحت هر سه شمارهٔ مالی کارفرما مجدداً با کد مستقل بررسی شد و هر سه صحیح‌اند؛ اما یک خطای مستندسازی کشف و اصلاح شد: کد بانکی ۰۱۷ در شبای دریافت، «بانک مهر ایران» است نه بانک ملت — همهٔ متن‌ها و راهنماهای پنل اصلاح شدند. همچنین دو اشکال واقعی رابط کاربری پیدا و رفع شد: فرم کارت‌به‌کارت خدمات، کارت‌های محرمانهٔ داخلی را (که هرگز به مرورگر فرستاده نمی‌شوند) فراخوانی می‌کرد و عملاً هیچ حسابی نمایش نمی‌داد — اکنون شبای دریافت را نشان می‌دهد؛ و درگاه پرداخت خدمات، مبلغ خدمات را بدون قطعات و تعدیل حداقل فاکتور می‌گرفت — اکنون مبلغ نهایی سفارش مبنای درگاه است."),

  // ── ۱. حداقل فاکتور ──
  h1("۱. حداقل مبلغ هر فاکتور = ۵٬۰۰۰٬۰۰۰ تومان"),
  bodyPara("مطابق دستور، حداقل مبلغ دریافتی هر فاکتور ۵٬۰۰۰٬۰۰۰ تومان تعیین شد و در سه نقطه اعمال می‌شود: پیش‌فاکتور زندهٔ خدمات (ردیف جدید «تعدیل به حداقل فاکتور»)، ثبت نهایی سفارش خدمات (مبلغ نهایی = حداکثر محاسبه و سقف ۵ میلیون؛ در رسید و پنل ادمین تفکیک می‌شود) و صفحهٔ پرداخت میز کالا و نرم‌افزار (خط «تعدیل به حداقل فاکتور» با مبلغ دقیق). این سقف در تنظیمات پنل با کلید «حداقل مبلغ هر فاکتور» ثبت شده و فقط مالک می‌تواند آن را تغییر دهد."),
  tableCaption("جدول ۱ — نمونه‌های واقعی از آزمون (مبلغ‌ها به تومان)"),
  rtlTable([30, 17, 17, 18, 18],
    ["سفارش", "قیمت مرجع", "افزودنی پرداخت", "هزینهٔ پیک", "مبلغ قابل پرداخت"],
    [
      ["ماوس بی‌سیم Q5 (کالای سبک)", "۱٬۳۱۲٬۰۰۰", "+۳۳٪ = ۴۳۳٬۰۰۰", "۲۵۰٬۰۰۰", "۱٬۹۹۵٬۰۰۰ → تعدیل +۳٬۰۰۵٬۰۰۰ = ۵٬۰۰۰٬۰۰۰"],
      ["بخاری گازی آبسال 437 (کالای سنگین)", "۱۱٬۰۰۰٬۰۰۰", "+۳۳٪ = ۳٬۶۳۰٬۰۰۰", "۷۵۰٬۰۰۰", "۱۵٬۳۸۰٬۰۰۰ (بدون تعدیل)"],
      ["کولر گازی تراست ۱۲۰۰۰ (قاعدهٔ رقابتی)", "۵۵٬۰۰۰٬۰۰۰ (موجودی انبار)", "+۱۵٪ = ۸٬۲۵۰٬۰۰۰", "۷۵۰٬۰۰۰", "۶۴٬۰۰۰٬۰۰۰"],
      ["آنتی‌ویروس یک‌ساله (نرم‌افزار — ارسال دیجیتال)", "۲٬۸۰۰٬۰۰۰", "+۳۳٪ = ۹۲۴٬۰۰۰", "۰", "۳٬۷۲۴٬۰۰۰ → تعدیل +۱٬۲۷۶٬۰۰۰ = ۵٬۰۰۰٬۰۰۰"],
      ["سفارش خدماتی کوچک (نمونهٔ آزمون)", "۹۹۰٬۰۰۰ (پس از ضرایب)", "—", "—", "۵٬۰۰۰٬۰۰۰ (تعدیل +۴٬۰۱۰٬۰۰۰)"],
    ]),
  bodyPara("پیامد منطقی این قاعده: چون هیچ فاکتوری زیر ۵ میلیون تومان صادر نمی‌شود، شرط «دریافتی بالای ۵ میلیون → شبا/پل» برای همهٔ فاکتورها برقرار است؛ بنابراین در همهٔ صفحات پرداخت، شبای حساب دریافت (IR430170000000345884841004 — بانک مهر ایران) با دکمهٔ کپی و در صورت تکمیل، کارت حساب دریافت هم نمایش داده می‌شود و هر رسید پس از ثبت به پنل ادمین ارسال و به پروندهٔ مشتری الصاق می‌گردد.", { after: 160 }),

  // ── ۲. مدل قیمت جدید ──
  h1("۲. قیمت نمایشی = همان قیمت مرجع؛ افزودنی و پیک فقط در صفحهٔ پرداخت"),
  bodyPara("مدل قبلی، افزودنی +۳۳٪ را در قیمت نمایشی میز کالا لحاظ می‌کرد. طبق اصلاح جدید، قیمت نمایشی هر کالا دقیقاً همان قیمتی است که در سایت یا انبار مرجع (دیجی‌کالا، اسنپ، ایمالز، فرالند، دلگرم و...) ثبت شده است — بدون هیچ افزودنی. افزودنی پرداخت (+۳۳٪ عادی یا +۱۵٪ در قاعدهٔ رقابتی «اگر قیمت سایت مرجع گران‌تر از محاسبهٔ ما بود») و هزینهٔ ارسال و بسته‌بندی (پیک) فقط در صفحهٔ پرداخت محاسبه می‌شوند و در یک کارت «ریزدیسکی پرداخت» به تفکیک نمایش داده می‌شوند: قیمت مرجع × تعداد، افزودنی پرداخت، هزینهٔ پیک، خدمات کنار خرید، تعدیل حداقل فاکتور و مبلغ قابل پرداخت."),
  bodyPara("هزینهٔ پیک بر اساس دستهٔ کالا دو نرخ دارد: کالای سبک/متوسط ۲۵۰٬۰۰۰ تومان و کالای سنگین (یخچال، لباسشویی، تلویزیون، کولر، بخاری) ۷۵۰٬۰۰۰ تومان — هر دو در تنظیمات مالک قابل تغییرند. نرم‌افزار ارسال دیجیتال دارد و هزینهٔ پیک ندارد؛ افزودنی پرداخت +۳۳٪ برای آن هم در صفحهٔ پرداخت اعمال می‌شود. کارت‌های میز کالا اکنون برچسب «قیمت مرجع» و یادآوری «+۳۳٪ و پیک در پرداخت» را نشان می‌دهند تا مشتری پیش از سفارش، حساب دقیق داشته باشد. قاعدهٔ رقابتی پیام ۱۱ همچنان فعال است اما معنای جدیدی یافته: به‌جای کاهش قیمت نمایشی، افزودنی پرداخت را از ۳۳٪ به ۱۵٪ می‌کاهد (نمونهٔ کولر تراست: نمایش ۵۵ میلیون، پرداخت ۶۴ میلیون در برابر قیمت سایت مرجع ۷۵ میلیون — همیشه ارزان‌تر از مرجع).", { after: 160 }),

  // ── ۳. تازگی ──
  h1("۳. گیت تازگی قیمت — فقط از ۱۴۰۵/۰۸/۱۰ (۲۰۲۶/۱۱/۰۱) به بعد"),
  bodyPara("مطابق دستور «تمام بروزرسانی‌ها و قیمت‌ها فقط از ۲۰۲۶/nov/1 به بعد باشد»، هر قیمت با تاریخ تقویمی خود مهر می‌خورد و یک گیت تازگی در چهار نقطه اعمال شد: نمایش عمومی میز کالا (کالاهای بدون تاریخ یا با تاریخ قبل از مرز نمایش داده نمی‌شوند)، جستجوی سراسری، ثبت سفارش (کالای کهنه با خطای شفاف رد می‌شود) و پنل ادمین (نشان قرمز «قیمت کهنه — نیاز به استعلام تازهٔ انبار» روی اقلام بدون تاریخ). مرز تازگی در تنظیمات مالک با کلید «مرز تازگی قیمت» ثبت است (۲۰۲۶-۱۱-۰۱ معادل ۱۴۰۵/۰۸/۱۰)."),
  bodyPara("بر اساس این گیت، ۹ قلم تجهیزات قدیمی (دوربین مداربسته، روتر، سوییچ، UPS، قفل و لامپ هوشمند و...) که قیمت‌های داخلی سال ۱۴۰۴ داشتند از ویترین عمومی خارج و در حالت «در انتظار استعلام» قرار گرفتند — ادمین با استعلام تازهٔ انبار (بعد از مرز) قیمت را ثبت می‌کند تا دوباره نمایش داده شوند. تمام ۱۹ کالای پژوهش‌شدهٔ بازار و ۸ نرم‌افزار، تاریخ قیمت ۱۴۰۵/۰۸/۲۶ (امروز) دارند و همگی تازه‌اند. گزارش روزانهٔ قیمت نیز ستون‌های تازگی گرفت: اقلام کهنه با نشان «کهنه — استعلام تازه لازم» در گزارش و ایمیل ادمین برجسته می‌شوند.", { after: 160 }),

  // ── ۴. حساب‌ها و اصلاحات ──
  h1("۴. حساب‌ها: هر سه شماره صحیح — و اصلاح نام بانک"),
  bodyPara("بررسی مستقل مجدد با کد پایتون/جاوااسکریپت تأیید کرد: شبای دریافت IR430170000000345884841004 با طول ۲۶ کاراکتر و باقیماندهٔ mod-97 برابر ۱ صحیح است و کد بانک آن ۰۱۷ = بانک مهر ایران است؛ کارت ۶۰۳۷۹۹۸۱۴۰۹۷۴۵۵۰ (ملی ایران — حساب تقسیم‌بندی: حق معرفی، خرید کالا، دستمزد کارشناس) با مجموع Luhn ۸۰ و کارت ۶۰۶۳۷۳۱۱۲۱۴۶۸۶۲۴ (قرض‌الحسنه مهر ایران — سهم شرکت) با مجموع ۶۰ هر دو سالم‌اند؛ نیازی به اصلاح شماره‌ها نبود."),
  tableCaption("جدول ۲ — نتیجهٔ نهایی بررسی شماره‌های مالی"),
  rtlTable([36, 22, 20, 22],
    ["شماره", "بانک", "الگوریتم", "نتیجه"],
    [
      ["IR430170000000345884841004 (شبای دریافت)", "بانک مهر ایران (کد ۰۱۷)", "mod-97 = ۱", "صحیح — بدون اصلاح"],
      ["6037998140974550 (تقسیم‌بندی — محرمانه)", "بانک ملی ایران", "Luhn = ۸۰", "صحیح — بدون اصلاح"],
      ["6063731121468624 (سهم شرکت — محرمانه)", "بانک قرض‌الحسنه مهر ایران", "Luhn = ۶۰", "صحیح — بدون اصلاح"],
    ]),
  bodyPara("اما در بازبینی متن‌ها یک خطای نام‌گذاری کشف شد: در مستندات و راهنمای پنل، کد ۰۱۷ به اشتباه «بانک ملت» نوشته شده بود؛ در جدول کد بانک‌های سامانه نیز چند کد جابه‌جا بود. هر دو اصلاح شد و اکنون همهٔ متن‌ها (پنل، دستیار هوشمند، صفحهٔ پرداخت) صحیح می‌گویند: شبای دریافت متعلق به بانک مهر ایران است. همچنین فرم کارت‌به‌کارت خدمات که کارت‌های محرمانهٔ داخلی را فراخوانی می‌کرد (و هرگز به مرورگر ارسال نمی‌شوند) به نمایش شبای دریافت تغییر یافت و مبلغ درگاه پرداخت خدمات به مبلغ نهایی سفارش (شامل قطعات و تعدیل حداقل فاکتور) متصل شد.", { after: 160 }),

  // ── ۵. پنل و تنظیمات ──
  h1("۵. پنل ادمین — تنظیمات جدید و ریزدیسکی سفارش‌ها"),
  bodyPara("چهار کلید تنظیماتی جدید (همه فقط با دسترسی مالک) به پنل افزوده شد: «حداقل مبلغ هر فاکتور» (۵٬۰۰۰٬۰۰۰)، «مرز تازگی قیمت» (2026-11-01)، «هزینهٔ ارسال و بسته‌بندی — کالای سبک» (۲۵۰٬۰۰۰) و «کالای سنگین» (۷۵۰٬۰۰۰). تب موجودی، برچسب قاعده را به «افزودنی پرداخت +۳۳٪ / +۱۵٪ (رقابتی)» تغییر داد و نشان تازگی گرفت؛ تب سفارش‌های کالا، ریزدیسکی کامل پرداخت هر سفارش (مرجع، افزودنی، پیک، تعدیل) را در کنار آدرس دقیق و خدمات کنار خرید نشان می‌دهد؛ و تب گزارش روزانهٔ قیمت، قیمت نمایشی جدید (= مرجع) و وضعیت تازگی هر قلم را نمایش می‌دهد. حداقل فاکتور و شبای دریافت به فهرست تنظیمات عمومی (فقط این دو، بدون هیچ دادهٔ محرمانهٔ سهم‌بندی) افزوده شد تا صفحات پرداخت بتوانند نمایش دهند."),

  // ── ۶. آزمون‌ها ──
  h1("۶. آزمون‌ها و بستهٔ تحویلی"),
  bodyPara("مجموعهٔ آزمون دود پیام ۱۲ با ۴۶ سنجهٔ دقیق اجرا شد و هر ۴۶ مورد سبز است: فیلتر تازگی در نمایش و جستجو؛ قیمت نمایشی = مرجع برای همهٔ ۱۹ کالا؛ محاسبهٔ صحیح افزودنی ۳۳٪/۱۵٪ و پیک سبک/سنگین؛ تعدیل حداقل فاکتور در کالا، نرم‌افزار و خدمات؛ نمایش شبای دریافت در همهٔ پرداخت‌ها؛ عدم افشای کارت‌های محرمانه در تنظیمات عمومی؛ ورود ادمین و تولید گزارش روزانهٔ مدل جدید. پس از آزمون، همهٔ سفارش‌های آزمونی از پایگاه داده پاک شد تا سامانه با دیتابیس تمیز تحویل شود."),
  bodyPara("اقلام تحویلی: بستهٔ کامل alo_shetab_release_v2.2.0.zip (کد به‌روزشده + اسکیما + seed + اسناد)، این سند (docx/pdf) و فایل CHECKSUMS-v2.2.0.sha256. نسخهٔ سامانه به v2.2-IR ارتقا یافت. قاعدهٔ محرمانگی سهم‌بندی تسویه همچنان مطلق است: مبالغ و درصدهای سهم‌ها فقط در پایگاه داده و ایمیل بک‌اند، بدون هیچ نمایشی در رابط کاربری یا پاسخ عمومی API. اقلام باز برای مالک: تکمیل شمارهٔ کارت (پل) حساب دریافت در تنظیمات، در صورت تمایل؛ و استعلام تازهٔ انبار برای ۹ قلم کهنه از طریق تب موجودی.", { after: 0 }),
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
            children: [faRun("اصلاحات پرداخت و قیمت‌گذاری | پیام ۱۲", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/پیام-۱۲-اصلاحات-پرداخت-و-قیمت‌گذاری.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
