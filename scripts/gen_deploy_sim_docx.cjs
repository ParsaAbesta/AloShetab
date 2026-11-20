// پیام ۸ — شبیه‌سازی استقرار Production و بستهٔ اصلاحی 1.0.1 (Persian RTL document)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (same as پیام ۳ تا ۷)
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

// ─────────────────────────── RTL helpers ───────────────────────────
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

// ─────────────────────────── Cover R1 (RTL-adapted) ───────────────────────────
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
  title: "شبیه‌سازی استقرار Production و بستهٔ اصلاحی 1.0.1",
  subtitle: "پیام ۸ — اجرای کامل مسیر استقرار مستند، پذیرش ۵۹/۵۹ روی نسخهٔ Production و رفع یافتهٔ خروجی standalone",
  englishLabel: "PRODUCTION DEPLOYMENT SIMULATION",
  metaLines: [
    "شماره سند: پیام ۸ (پیام تکمیلی استقرار) — پس از اتمام برنامهٔ هفت‌پیامی",
    "تاریخ تنظیم: ۲۵ آبان ۱۴۰۵ (۱۶ نوامبر ۲۰۲۶)",
    "نسخهٔ کد: 1.0.1 — بستهٔ تحویلی: alo_shetab_release_v1.0.1.zip",
    "وضعیت: پذیرش نسخهٔ Production سبز (۴۰+۱۹ آزمون) — آمادهٔ نصب روی سرور کارفرما",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "پیام ۸ — ضمیمهٔ استقرار",
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
  bodyPara("این سند، پیام تکمیلی استقرار پروژه الو شتاب است که پس از اتمام برنامه هفت‌پیامی و به دنبال درخواست «گام بعدی» کارفرما تنظیم شده است. موضوع آن، شبیه‌سازی کامل مسیر استقرار Production روی محیط آزمون ایزوله و دقیقاً مطابق بخش ۴ راهنمای بهره‌برداری (DEPLOYMENT.md، مسیر بدون Docker) است. برای این کار، بسته انتشار رسمی نسخه 1.0.0 بدون هیچ تغییری در محیطی تمیز باز شد، ۸۷۱ بسته وابستگی نصب گردید، اسکیمای پایگاه داده از صفر ساخته شد، کاتالوگ رسمی ۱۰۵ خدمتی بارگذاری شد و نسخه Production با خروجی standalone بیلد و روی پورت مستقل ۳۰۱۰ اجرا شد. سپس هر دو مجموعه پذیرش رسمی پروژه — دود یکپارچه ۴۰ آزمونی و سرتاسری ۱۹ آزمونی — روی همین نسخه Production اجرا شد و هر ۵۹ آزمون سبز شد."),
  bodyPara("اجرای واقعی مسیر استقرار، یک یافته محیطی ارزشمند نیز به دست داد: در میزبانی‌هایی که پوشه والد بسته استقرار حاوی فایل قفل (package.json یا bun.lock) است، Next.js آن را ریشه فضای کاری فرض می‌کند و خروجی standalone به‌جای مسیر مستند، به‌صورت تودرتو ساخته می‌شود؛ در نتیجه دستور اجرای مستند در راهنما شکست می‌خورد. ریشه این رفتار شناسایی، با پین‌کردن گزینه outputFileTracingRoot به ریشه خود بسته در next.config.ts به‌صورت قطعی اصلاح، با بازبیلد کامل روی همان محیط بازآزمایی و در قالب بسته اصلاحی alo_shetab_release_v1.0.1.zip منتشر شد. پس از اصلاح، خروجی بیلد همواره مسطح است و دستور node .next/standalone/server.js در هر میزبانی — چه سرور خلوت و چه زیرساخت اشتراکی — عیناً مطابق راهنما کار می‌کند."),
  bodyPara("مقر محرمانگی کارفرما نیز روی نسخه Production بازآزمایی شد: ممیزی خودکار در تمام پاسخ‌های API مشتری و ادمین هیچ نشانه‌ای از مبالغ سهم‌بندی تسویه (۴/۷ انجام‌دهنده، ۱/۷ معرف، ۲/۷ ألو شتاب) نیافت و صحت موتور تسویه در سطح پایگاه داده تأیید شد؛ سهم مجری دقیقاً ۴/۷، حق معرف دقیقاً ۱/۷ و جمع سهم‌ها برابر مبلغ کل بود. بدین ترتیب قاعده مطلق «مبالغ فقط در پایگاه داده و ایمیل بک‌اند» در نسخه منتشرشده و در محیطی غیر از محیط توسعه نیز برقرار است."),

  // ── ۱. روش شبیه‌سازی ──
  h1("۱. روش شبیه‌سازی استقرار"),
  bodyPara("شبیه‌سازی در پوشه ایزوله‌ای جدا از محیط توسعه انجام شد تا هیچ تداخلی با سرویس زنده پیش‌نمایش (پورت ۳۰۰۰) پیش نیاید؛ نسخه Production روی پورت مستقل ۳۰۱۰ بالا آمد. بسته v1.0.0 عیناً همان چیزی است که در پوشه تحویل قرار دارد و هیچ فایلی پیش از آزمون دست‌کاری نشد. چون در محیط شبیه‌سازی، سرویس‌دهنده Docker در دسترس نبود، معادل عملیاتیِ دقیق همان زنجیره‌ای که Dockerfile در کانتینر اجرا می‌کند — یعنی ساخت اسکیما، بارگذاری کاتالوگ و اجرای سرور — به‌صورت دستی و گام‌به‌گام طی شد؛ این همان مسیری است که در بخش ۴ راهنما برای میزبانی بدون Docker مستند شده است. پیش از اجرای آزمون‌های پذیرش نیز پایگاه داده حذف و از صفر بازسازی شد تا سناریوی «استقرار تازه در روز نخست» واقعی شبیه‌سازی شود."),
  tableCaption("جدول ۱ — گام‌های اجراشده استقرار و نتیجه هر گام"),
  rtlTable([24, 44, 32],
    ["گام", "دستور / اقدام", "نتیجه"],
    [
      ["استخراج بسته", "بازکردن alo_shetab_release_v1.0.0.zip در پوشه ایزوله", "۱۸۴ فایل، بدون تغییر"],
      ["نصب وابستگی‌ها", "bun install (معادل npm install --legacy-peer-deps راهنما)", "۸۷۱ بسته در ۱۱ ثانیه"],
      ["پیکربندی محیط", "کپی .env.production.example به .env و تنظیم DATABASE_URL و پورت ۳۰۱۰", "آماده"],
      ["ساخت اسکیما", "npx prisma db push", "پایگاه داده SQLite ساخته شد"],
      ["بارگذاری کاتالوگ", "node scripts/seed104.mjs", "۱۰۵ خدمت + تخفیف معرف ۵٪ ثبت شد"],
      ["بیلد Production", "next build با خروجی standalone", "موفق؛ تمام مسیرهای API و صفحات"],
      ["اجرای سرور", "node .next/standalone/server.js روی پورت ۳۰۱۰", "سرور Production بالا آمد"],
      ["بررسی سلامت", "GET /api و GET / و GET /api/services", "پاسخ سلامت استاندارد؛ صفحه اصلی ۲۰۰ در ۱۶ میلی‌ثانیه؛ کاتالوگ کامل"],
    ]),

  // ── ۲. یافته کلیدی ──
  h1("۲. یافته کلیدی: خروجی تودرتوی standalone و اصلاح قطعی"),
  bodyPara("در نخستین بیلد، فایل server.js در مسیر مورد انتظار یعنی .next/standalone/server.js ظاهر نشد؛ به‌جای آن خروجی در عمق مسیر والد ساخته شده بود. ریشه‌یابی نشان داد Next.js هنگام بیلد از محل پروژه به سمت بالا حرکت می‌کند و نخستین فایل قفل والد را «ریشه فضای کاری» فرض می‌کند. در محیط شبیه‌سازی، پوشه والدِ محل استخراج بسته شامل bun.lock پروژه توسعه بود و همین باعث شد خروجی به‌صورت .next/standalone/<مسیر والد>/<پوشه بسته>/server.js تولید شود. این رفتار در دنیای واقعی هم رخ می‌دهد: هر جا کارشناس استقرار بسته را زیر شاخه‌ای از یک مخزن یا مسیر مشترک حاوی package.json باز کند، دستور مستند راهنما بی‌پاسخ می‌ماند و خطای «Cannot find module .../server.js» می‌دهد."),
  bodyPara("اصلاح قطعی، پین‌کردن outputFileTracingRoot به ریشه خود بسته در next.config.ts است؛ تنها یک خط پیکربندی که فقط رفتار بیلد را تعیین می‌کند و هیچ تغییری در رفتار محیط توسعه، اجرای runtime یا قرارداد APIها ایجاد نمی‌کند. پس از اعمال اصلاح، بسته از صفر بازبیلد شد و خروجی مسطح و منطبق بر مستندات تولید شد؛ سپس کل زنجیره استقرار و هر ۵۹ آزمون پذیرش روی بیلد جدید تکرار و سبز شد. این یافته دقیقاً همان نوع ریسکی است که تنها با اجرای واقعی مسیر استقرار آشکار می‌شود و کشف آن پیش از نصب روی سرور کارفرما، هزینه راه‌اندازی روز نخست را حذف می‌کند."),
  tableCaption("جدول ۲ — وضعیت خروجی بیلد پیش و پس از اصلاح"),
  rtlTable([22, 44, 34],
    ["حالت", "مسیر فایل server.js در خروجی", "دستور مستند DEPLOYMENT.md"],
    [
      ["پیش از اصلاح", ".next/standalone/<مسیر والد>/…/<پوشه بسته>/server.js (تودرتو، وابسته به میزبان)", "شکست می‌خورد؛ خطای یافتن ماژول"],
      ["پس از اصلاح", ".next/standalone/server.js (مسطح و همیشگی)", "عیناً اجرا می‌شود؛ مستندات بدون تغییر معتبر می‌ماند"],
    ]),

  // ── ۳. نتایج پذیرش ──
  h1("۳. نتایج پذیرش روی نسخه Production"),
  bodyPara("مجموعه‌های پذیرش رسمی پروژه — که در پیام ۷ ساخته شده بودند — این بار نه روی نسخه توسعه، بلکه روی نسخه Production بیلدشده از بسته انتشار اجرا شدند. پیش از اجرا، پایگاه داده از صفر بازسازی و کاتالوگ رسمی بارگذاری شد تا نتیجه، معرف روز نخست بهره‌برداری باشد. هر ۵۹ آزمون شامل ممیزی محرمانگی سهم‌ها در تمام پاسخ‌های API مشتری و ادمین، صحت موتور تسویه در سطح پایگاه داده، چرخه کامل شش‌مرحله‌ای سفارش (ثبت، کارشناسی، پرداخت، اعزام، رضایت، تسویه)، تخفیف ۵ درصدی معرف، احراز هویت ادمین و سرویس‌های جانبی هلدینگ است."),
  tableCaption("جدول ۳ — نتایج آزمون پذیرش روی نسخه Production (پورت ۳۰۱۰)"),
  rtlTable([30, 16, 54],
    ["مجموعه آزمون", "نتیجه", "پوشش کلیدی"],
    [
      ["دود یکپارچه (smoke_p7.py)", "۴۰/۴۰", "یازده گروه؛ ممیزی نشتی سهم‌ها در تمام پاسخ‌ها، تسویه محرمانه، احراز ادمین، سرویس‌های هلدینگ"],
      ["سرتاسری (e2e_p6.sh)", "۱۹/۱۹", "چرخه کامل سفارش با و بدون معرف، درگاه، پیگیری، ادمین، رضایت، تسویه"],
      ["سلامت و کارایی", "احراز شد", "پاسخ سلامت استاندارد؛ صفحه اصلی ۲۰۰ در ۱۶ میلی‌ثانیه؛ کاتالوگ ۱۰۵ خدمتی پاسخ کامل"],
    ]),
  bodyPara("در آزمون تسویه روی نسخه Production، سهم انجام‌دهنده دقیقاً برابر ۴/۷، حق معرف برابر ۱/۷ و جمع سهم‌ها برابر مبلغ کل سفارش ثبت شد و هیچ رقمی از این مبالغ در هیچ پاسخ HTTP — حتی مسیرهای مدیریتی — بازنگشت؛ ثبت تنها در فایل پایگاه داده انجام شد. این نتیجه، اعتبار قاعده محرمانگی را از محیط توسعه به نسخه منتشرشده گسترش می‌دهد و برای گزارش حسابرسی مالک قابل استناد است.", { after: 160 }),

  // ── ۴. بسته اصلاحی v1.0.1 ──
  h1("۴. بسته اصلاحی نسخه 1.0.1"),
  bodyPara("خروجی این پیام، بسته alo_shetab_release_v1.0.1.zip است که با حداقل تفاوت نسبت به نسخه 1.0.0 منتشر شد تا ریسک بازبینی به حداقل برسد: پیکربندی اصلاح‌شده next.config.ts و یک تذکر عملیاتی در DEPLOYMENT.md درباره صریح‌کردن متغیر DATABASE_URL در مسیر بدون Docker. هیچ تغییر دیگری در کد منبع، اسکیمای پایگاه داده، کاتالوگ رسمی، رابط کاربری یا آزمون‌ها وجود ندارد و رفتار محصول یکسان است. نسخه 1.0.1 جانشین کامل 1.0.0 برای تمام استقرارهای تازه است و نسخه پیشین صرفاً برای شفافیت تاریخی در پوشه تحویل باقی می‌ماند."),
  tableCaption("جدول ۴ — تفاوت بسته 1.0.1 با 1.0.0"),
  rtlTable([26, 42, 32],
    ["فایل", "تغییر", "انگیزه"],
    [
      ["next.config.ts", "افزودن outputFileTracingRoot پین‌شده به ریشه بسته", "تضمین خروجی مسطح standalone در هر میزبانی؛ اعتبار دائمی دستور مستند راهنما"],
      ["DEPLOYMENT.md", "افزودن تذکر export صریح DATABASE_URL در مسیر بدون Docker", "حذف ابهام محیط در نخستین استقرار؛ مطابق با تجربه شبیه‌سازی"],
    ]),
  bodyPara("بسته اصلاحی از همان خط تولید و ممیزی نسخه 1.0.0 ساخته شده است: ساختار فایل‌ها عیناً یکسان است، آزمون‌های پذیرش داخل بسته تغییری نکرده‌اند و روی نسخه اصلاح‌شده دوباره سبز شده‌اند. کارفرما می‌تواند به‌جای مقایسه دستی، فقط دو فایل جدول ۴ را بازبینی کند؛ این شفافیت تغییرات، عرف انتشارهای نگهدارشی است و آینده نگهداری پروژه را ساده می‌کند.", { after: 160 }),

  // ── ۵. مسیر استقرار واقعی ──
  h1("۵. آنچه برای استقرار واقعی باقی می‌ماند و جمع‌بندی"),
  bodyPara("با احراز مسیر بیلد و پذیرش در محیط شبیه‌سازی، فاصله «بسته آماده استقرار» تا «سرویس زنده» صفر شده و آنچه باقی می‌ماند صرفاً زیرساخت و تصمیم‌های عملیاتی مالک است: تهیه سرور و دامنه و گواهی TLS، اجرای docker compose up -d --build (یا مسیر Node مستند)، تغییر رمز ادمین در نخستین ورود، تکمیل متغیرهای SMTP برای فعال‌شدن ایمیل گزارش‌ها، اتصال درگاه پرداخت واقعی در نقطه اتصال آماده‌شده و فعال‌سازی کرون پشتیبان‌گیری روزانه SQLite. همه این گام‌ها در بخش ۵ و ۷ راهنمای بهره‌برداری مستند است و اکنون در سطح بیلد و پذیرش، آزموده‌شده محسوب می‌شود."),
  tableCaption("جدول ۵ — وضعیت اقلام استقرار واقعی پس از شبیه‌سازی"),
  rtlTable([28, 34, 38],
    ["قلم", "وضعیت در شبیه‌سازی", "اقدام روی سرور کارفرما"],
    [
      ["بیلد standalone", "احراز شد (پس از اصلاح 1.0.1)", "عیناً طبق راهنما تکرار می‌شود"],
      ["آزمون پذیرش ۵۹/۵۹", "روی نسخه Production سبز شد", "پس از استقرار، یک‌بار تکرار شود"],
      ["Docker / Compose", "آماده؛ دیمون Docker در محیط شبیه‌سازی موجود نبود", "روی سرور اجرا شود (مسیر توصیه‌شده)"],
      ["دامنه، TLS، رمز ادمین", "خارج از گستره شبیه‌سازی", "طبق بخش ۵ راهنمای بهره‌برداری"],
      ["SMTP و درگاه پرداخت واقعی", "ساختار و نقطه اتصال آماده است", "با اطلاعات حساب‌های واقعی مالک تکمیل شود"],
    ]),
  bodyPara("پیام ۸ نشان داد بسته انتشار الو شتاب نه‌فقط در محیط توسعه، بلکه در مسیر واقعی استقرار نیز از منظر بیلد، سلامت، پذیرش عملکردی و محرمانگی مالی قابل اتکاست؛ تنها ریسک شناخته‌شده محیطی (تودرتویی خروجی standalone) ریشه‌ای رفع و در قالب نسخه 1.0.1 منتشر شد و کل زنجیره پس از اصلاح، کامل سبز شد. با تحویل بسته اصلاحی و سند حاضر، فاز استقرار بسته می‌شود و سامانه الو شتاب برای نصب روی سرور کارفرما آماده است.", { after: 0 }),
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
            children: [faRun("شبیه‌سازی استقرار Production الو شتاب | پیام ۸", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/پیام-۸-شبیه‌سازی-استقرار-Production.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
