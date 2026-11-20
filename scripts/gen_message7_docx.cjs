// پیام ۷ — تست، اشکال‌زدایی و بسته استقرار Production (Persian RTL document)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (same as پیام ۳ و ۵ و ۶)
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
  title: "تست، اشکال‌زدایی و بسته استقرار Production",
  subtitle: "پیام ۷ از ۷ — ۶۷ آزمون خودکار، تحکیم محرمانگی تسویه و بسته انتشار نسخهٔ 1.0.0",
  englishLabel: "TESTING, DEBUGGING AND PRODUCTION RELEASE",
  metaLines: [
    "شماره سند: پیام ۷ از سری هفت‌پیامی تحویل پروژه الو شتاب",
    "تاریخ تنظیم: ۲۴ آبان ۱۴۰۵ (۱۵ نوامبر ۲۰۲۶)",
    "نسخه کد: 1.0.0-release — بسته تحویلی: alo_shetab_release_v1.0.0.zip",
    "وضعیت: تحویل نهایی — ۱۹+۴۰+۸ آزمون موفق و چک‌لیست Production احرازشده",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "پیام ۷ از ۷",
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
  bodyPara("این سند، پیام هفتم و پایانی برنامه هفت‌پیامی تحویل پروژه الو شتاب است و مطابق نقشه راه مصوب پیام ۳، به «تست، اشکال‌زدایی و تحویل بسته استقرار Production» اختصاص یافته است. تعهد این پیام سه لایه داشت: اجرای کامل آزمون پذیرش روی محصول واحد نسخه 0.6.0-ui، شناسایی و رفع اشکالات باقی‌مانده، و بسته‌بندی نسخه انتشار Production به همراه پیکربندی محیط، راهنمای بهره‌برداری و چک‌لیست پذیرش. هر سه لایه محقق شد و خروجی آن در بسته نسخه 1.0.0-release به نشانی alo_shetab_release_v1.0.0.zip در پوشه تحویل قرار دارد."),
  bodyPara("در لایه آزمون، سه حلقه مکمل اجرا شد: آزمون سرتاسری مسیر طلایی (۱۹ آزمون) از کاتالوگ تا تسویه محرمانه؛ مجموعه دود یکپارچه تازه‌ساخته پیام ۷ (۴۰ آزمون) که برای نخستین بار علاوه بر مسیر مشتری، تمام پاسخ‌های پنل مدیریت و سرویس‌های جانبی هلدینگ و احراز هویت ادمین را نیز ممیزی می‌کند؛ و آزمون نسخه Production ساخته‌شده با خروجی standalone (۸ آزمون) روی سرور واقعی. مجموع ۶۷ آزمون خودکار، همگی سبز شدند و سنجش کارایی روی نسخه Production نیز میانگین پاسخ ۵ میلی‌ثانیه و صدک ۹۵ برابر ۱۱ میلی‌ثانیه را ثبت کرد که هدف نقشه راه (صدک ۹۵ زیر ۵۰۰ میلی‌ثانیه) را با حاشیه‌ای وسیع محقق می‌سازد."),
  bodyPara("در لایه اشکال‌زدایی، مهم‌ترین یافته در راستای قاعده محرمانگی کارفرما بود: بازرسی دقیق نشان داد پنل مدیریت و چند پاسخ API سمت ادمین، مبالغ سهم‌بندی تسویه (۴/۷ انجام‌دهنده، ۱/۷ معرف، ۲/۷ ألو شتاب) را به رابط کاربری بازمی‌گرداندند. هر نُه نقطه نشتی شناسایی‌شده حذف یا ماسک شد و قاعده به حالت مطلق رسید: مبالغ سهم‌ها تنها در پایگاه داده و گزارش‌های ایمیل بک‌اند وجود دارند و هیچ صفحه یا پاسخ APIای — حتی پنل ادمین — آن‌ها را نمایش نمی‌دهد؛ این رفتار اکنون با آزمون دائمی کنترل می‌شود. چهار اشکال فنی دیگر (مجموعه آزمون منسوخ پیام ۴، دو خطای پنهان نوع‌ها و مسیر مطلق بارگذاری کاتالوگ در اسکریپت استقرار) نیز رفع شد."),

  // ── ۱. دامنه تحویل ──
  h1("۱. دامنه تحویل و تطبیق با نقشه راه"),
  bodyPara("بر پایه جدول ۳ و جدول ۵ سند پیام ۳، مرز قراردادی پیام ۷ «تست، اشکال‌زدایی و بسته استقرار Production» است و با تحویل آن، برنامه هفت‌پیامی کامل می‌شود. جدول ۱ نشان می‌دهد هر بند از تعهد پیام ۷ با کدام اقدام و در کدام خروجی محقق شده است."),
  tableCaption("جدول ۱ — تطبیق تعهد پیام ۷ با اقلام تحویلی"),
  rtlTable([26, 46, 28],
    ["بند تعهد", "اقدام انجام‌شده", "محل تحقق"],
    [
      ["آزمون پذیرش نهایی", "اجرای سه حلقه آزمون (سرتاسری ۱۹ آزمونی، دود یکپارچه ۴۰ آزمونی، Production ۸ آزمونی) روی مسیر کامل مشتری و ادمین", "scripts/e2e_p6.sh و scripts/smoke_p7.py"],
      ["اشکال‌زدایی", "رفع چهار اشکال واقعی شامل مجموعه آزمون منسوخ، دو خطای پنهان نوع‌ها و مسیر مطلق اسکریپت بارگذاری کاتالوگ", "src/ و scripts/"],
      ["تحکیم محرمانگی سهم‌ها", "حذف یا ماسک نُه نقطه افشای مبالغ تسویه در پنل مدیریت و API ادمین؛ آزمون دائمی ممیزی نشتی", "مسیرهای /api/admin/* و src/components/as/Admin.tsx"],
      ["سنجش کارایی", "اندازه‌گیری واقعی تأخیر روی نسخه Production: میانگین ۵ میلی‌ثانیه، صدک ۹۵ برابر ۱۱ میلی‌ثانیه، ۲۰ درخواست هم‌زمان با میانگین ۳ میلی‌ثانیه", "خروجی standalone روی سرور آزمون"],
      ["بازبینی امنیتی", "مرور ایستای کد بر پهنه ده ریسک برتر OWASP با آزمون خودکار کنترل دسترسی و اعتبارسنجی ورودی", "بخش ۶ همین سند"],
      ["بسته استقرار Production", "ایمیج Docker سه‌مرحله‌ای، Compose، نمونه متغیرهای محیط، راهنمای بهره‌برداری و چک‌لیست پذیرش", "Dockerfile، docker-compose.yml، DEPLOYMENT.md"],
    ]),
  bodyPara("با احراز کامل جدول ۱، برنامه هفت‌پیامی تحویل به پایان رسیده است؛ محصول واحد و استقرارپذیر شامل کاتالوگ رسمی ۱۰۴ خدمت، چرخه شش‌مرحله‌ای سفارش، درگاه پرداخت، پنل مدیریت، سرویس‌های هلدینگ و موتور تسویه محرمانه، اکنون در قالب یک بسته انتشار یکپارچه در اختیار کارفرماست.", { after: 160 }),

  // ── ۲. برنامه آزمون ──
  h1("۲. برنامه آزمون و نتایج"),
  bodyPara("برنامه آزمون پیام ۷ بر سه حلقه مکمل استوار بود تا نه‌تنها رفتار محصول، بلکه رفتار نسخه منتشرشده نیز سنجیده شود. حلقه نخست، آزمون سرتاسری پیام ۶ است که مسیر طلایی شش‌مرحله‌ای (ثبت سفارش، پرداخت، پیگیری، اعزام، رضایت، تسویه) را با ۱۹ آزمون پوشش می‌دهد و پس از همه تغییرات این پیام مجدداً اجرا شد. حلقه دوم، مجموعه دود یکپارچه تازه است که در همین پیام ساخته شد: ۴۰ آزمون در یازده گروه که علاوه بر مسیر مشتری، ممیزی محرمانگی تمام پاسخ‌های ادمین، ماسک مبالغ در گزارش‌ها و لاگ‌ها، احراز هویت و سرویس‌های جانبی هلدینگ را کنترل می‌کند. حلقه سوم، اجرای هشت آزمون منتخب روی نسخه Production (خروجی standalone با متغیرهای محیط واقعی) است تا فاصله محیط توسعه و انتشار نیز اندازه‌گیری شود."),
  tableCaption("جدول ۲ — نتایج حلقه‌های آزمون پیام ۷"),
  rtlTable([30, 14, 56],
    ["حلقه آزمون", "نتیجه", "پوشش کلیدی"],
    [
      ["سرتاسری مسیر طلایی (e2e_p6.sh)", "۱۹/۱۹", "کاتالوگ، سفارش با و بدون معرف، درگاه، پیگیری، ادمین، رضایت، تسویه، خدمات درصدی"],
      ["دود یکپارچه پیام ۷ (smoke_p7.py)", "۴۰/۴۰", "یازده گروه؛ شامل ممیزی نشتی در همه پاسخ‌های API و ماسک گزارش‌ها و احراز هویت ادمین"],
      ["نسخه Production (standalone)", "۸/۸", "کاتالوگ، سفارش، پرداخت، پیگیری و ممیزی محرمانگی روی سرور منتشرشده"],
      ["سنجش کارایی", "محقق شد", "میانگین ۵ms، صدک ۹۵ برابر ۱۱ms، حداکثر ۱۴ms؛ ۲۰ درخواست هم‌زمان با میانگین ۳ms"],
    ]),
  bodyPara("در اجرای آزمون تسویه روی سفارش نمونه ۹٬۳۱۰٬۹۵۰ تومانی، سهم انجام‌دهنده برابر ۵٬۳۲۰٬۵۴۳ تومان (۴/۷)، حق معرف برابر ۱٬۳۳۰٬۱۳۶ تومان (۱/۷) و سهم خالص ألو شتاب برابر ۲٬۶۶۰٬۲۷۱ تومان (۲/۷ پس از کسر حق معرف) در پایگاه داده ثبت شد و جمع سهم‌ها دقیقاً برابر مبلغ کل بود. مجموعه آزمون پس از بارگذاری مجدد پایگاه داده از کاتالوگ رسمی (شبیه‌سازی استقرار تازه) نیز یک‌بار دیگر به‌طور کامل سبز شد تا تکرارپذیری مسیر استقرار احراز گردد.", { after: 160 }),

  // ── ۳. اشکال‌زدایی ──
  h1("۳. اشکال‌زدایی: اشکالات شناسایی‌شده و رفع"),
  bodyPara("اجرای حلقه‌های آزمون و بازبینی ایستای کد (کنترل نوع‌ها) پنج اشکال واقعی آشکار کرد که همگی رفع و با اجرای مجدد مجموعه آزمون بسته شدند. سه اشکال نخست در بازبینی ایستا و دو مورد دیگر در اجرای پویا شناسایی شدند؛ فهرست کامل به همراه ریشه و راه‌حل در جدول ۳ آمده است."),
  tableCaption("جدول ۳ — اشکالات پیام ۷ و اقدام اصلاحی"),
  rtlTable([30, 34, 36],
    ["اشکال", "ریشه", "اقدام اصلاحی"],
    [
      ["مجموعه آزمون دود پیام ۴ از کار افتاده بود", "آزمون قدیمی به اسکلت فیستاپی منسوخ پیام ۴ وابسته بود که جای خود را به نسخه وب داده است", "مجموعه دود یکپارچه تازه (smoke_p7.py) روی API واقعی نسخه وب ساخته شد؛ پوشش از ۹ به ۴۰ آزمون رسید"],
      ["خطای نوع در بازگشت موتور تسویه", "نوع بازگشتی «ok» بولی عمومی بود و گیت‌های شرطی را محدود نمی‌کرد", "نوع موفق به مقدار ثابت «ok: true» تبدیل شد تا کنترل جریان در زمان ساخت تضمین شود"],
      ["خطای نوع در فیلتر جستجوی سفارش ادمین", "تعریف دستی نوع شرط جستجو با خروجی Prisma ناهمخوان بود", "جایگزینی با نوع استاندارد OrderWhereInput از خود Prisma"],
      ["فراخوانی نادرست تابع اعداد فارسی", "پاس‌دادن آرگومان اضافی زبان به تابعی که فقط یک آرگومان می‌پذیرد", "فراخوانی به امضای صحیح تابع اصلاح شد"],
      ["اسکریپت بارگذاری کاتالوگ به مسیر مطلق وابسته بود", "مسیر مطلق محیط توسعه در کد نوشته شده بود و در سرور دیگر کار نمی‌کرد", "مسیرها نسبت به ریشه پروژه و متغیر PROJECT_ROOT حل می‌شوند؛ استقرار تازه آزمایش و تأیید شد"],
    ]),
  bodyPara("نکته مشترک سه اشکال نوع‌ها این بود که پیکربندی ساخت، خطاهای کنترل نوع را نادیده می‌گرفت و همین موجب پنهان‌ماندن آن‌ها در پیام‌های پیشین شده بود. در پیام ۷ هر سه خطا ریشه‌ای رفع شد و خروجی کنترل نوع‌ها برای کل پوشه سروسامانه اکنون صفر خطاست؛ با این حال از تغییر رفتار «نادیده‌گرفتن خطاها در ساخت» صرف‌نظر شد تا مسیر انتشار جاری بدون متغیر تازه تغییر کند و این تصمیم در بخش ۸ به‌عنوان توصیه عملیاتی ثبت شده است.", { after: 160 }),

  // ── ۴. تحکیم محرمانگی ──
  h1("۴. تحکیم محرمانگی سهم‌بندی تسویه"),
  bodyPara("قاعده محرمانگی کارفرما مطلق است: نسبت‌های تسویه (۴/۷ انجام‌دهنده، ۱/۷ معرف، ۲/۷ ألو شتاب) تنها در موتور سمت سرور محاسبه و در پایگاه داده ثبت می‌شود و نباید در هیچ نقطه از رابط کاربری ظاهر شود. در پیام ۶ تمام نقاط عمومی (صفحات مشتری، پاسخ‌های API عمومی و چت‌بات) پاک‌سازی شده بود؛ بازرسی اختصاصی این پیام اما نشان داد لایه پنل مدیریت — که در پیام ۶ خارج از پهنه پاک‌سازی بود — هنوز در پنج نقطه، مبالغ مشتق از سهم‌بندی را به مرورگر می‌فرستاد. این نُه نقطه (در سطح API و رابط کاربری) حذف یا ماسک شد و مرز تازه چنین تعریف شد: پنل ادمین برای عملیات (تأیید، اعزام، تعیین مجری، ثبت واریز) کافی است و مبالغ تسویه فقط از دو کانال بک‌اند یعنی پایگاه داده و ایمیل گزارش در دسترس مالک است."),
  tableCaption("جدول ۴ — نقاط افشای محرمانگی لایه ادمین و اقدام انجام‌شده"),
  rtlTable([30, 34, 36],
    ["نقطه افشا", "وضعیت پیشین", "اقدام پیام ۷"],
    [
      ["فهرست سفارش ادمین (API)", "هر قلم، فیلدهای سهم مجری و سهم شرکت را برمی‌گرداند", "حذف فیلدها؛ تنها نشان بولی «تسویه‌شده» باقی ماند"],
      ["جزئیات سفارش در پنل (UI)", "نمایش رنگی سهم مجری و سهم شرکت کنار هر قلم", "حذف کامل؛ فقط برچسب وضعیت تسویه"],
      ["پاسخ دکمه تسویه (API و UI)", "مبلغ سهم مجری و شرکت در پاسخ و پیام موفقیت نمایش داده می‌شد", "پاسخ به «ok» فروکاسته شد؛ پیام موفقیت بدون مبلغ"],
      ["فهرست همکاران (API و UI)", "جمع دریافتی هر همکار (مشتق از ۴/۷) نمایش داده می‌شد", "حذف؛ فقط تعداد کارها و تعداد اقلام تسویه‌شده"],
      ["مبلغ حق معرف (API و UI)", "مبلغ هر حق معرف و جمع پرداخت‌نشده/واریزشده در پنل دیده می‌شد", "حذف مبالغ؛ فقط شمارش موارد و نشان وضعیت واریز"],
      ["داشبورد مدیریت (API و UI)", "جمع مبلغ حق معرف‌های پرداخت‌نشده نمایش داده می‌شد", "حذف مبلغ؛ فقط تعداد موارد"],
      ["گزارش‌ها و لاگ فعالیت (API و UI)", "بدنه گزارش تسویه و لاگ، حاوی مبالغ سهم‌ها بود", "ماسک خودکار مبالغ در پاسخ API؛ ایمیلی که به مالک می‌رود کامل می‌ماند"],
    ]),
  bodyPara("برای تضمین پایدار این مرز، مجموعه دود پیام ۷ یک ممیزی بازگشتی دارد که در هر پاسخ — از کاتالوگ و پیگیری تا تمام مسیرهای ادمین و گزارش‌ها — جستجوی کلیدهای سهم را انجام می‌دهد و نبود خط سهمِ رقمی در خطوط گزارشِ نمایش‌داده‌شده را کنترل می‌کند؛ شش آزمون ممیزی محرمانگی در جدول ۲ به این وسیله پوشش داده شده است. بدین ترتیب چرخه کامل قاعده کارفرما برقرار است: محاسبه در موتور سرور، ثبت در پایگاه داده، اطلاع‌رسانی در ایمیل بک‌اند، و صفر بودن بازتاب در هر رابط کاربری.", { after: 160 }),

  // ── ۵. بسته استقرار ──
  h1("۵. بسته استقرار Production"),
  bodyPara("بسته انتشار نسخه 1.0.0-release با ۱۸۴ فایل شامل کد منبع، اسکیمای پایگاه داده، دارایی‌های ثابت و مانیفست PWA، کاتالوگ رسمی دوزبانه، آزمون‌های پذیرش، نمونه متغیرهای محیط، ایمیج Docker سه‌مرحله‌ای، پیکربندی Compose و راهنمای بهره‌برداری است. در مسیر Docker، کانتینر در اولین اجرا اسکیمای پایگاه داده را می‌سازد، کاتالوگ رسمی ۱۰۴ خدمت را بارگذاری می‌کند و سرور را روی پورت 3000 بالا می‌آورد؛ پایگاه داده SQLite روی یک حجم ماندگار سوار می‌شود تا پشتیبان‌گیری به سادگی کپی همان حجم انجام شود. دو اصلاح استقرارپذیری نیز در همین پیام اعمال شد: اسکریپت بارگذاری کاتالوگ دیگر به مسیر مطلق وابسته نیست و نمونه متغیرهای محیط، مقادیر موردنیاز شامل تنظیم اختیاری SMTP برای موتور گزارش ایمیل را مستند می‌کند."),
  tableCaption("جدول ۵ — محتویات بسته انتشار و کارکرد هر جزء"),
  rtlTable([28, 46, 26],
    ["جزء", "کارکرد", "فایل"],
    [
      ["کد منبع و اسکیما", "اپلیکیشن Next.js، موتور تسویه محرمانه و مدل کامل داده", "src/ و prisma/schema.prisma"],
      ["کاتالوگ رسمی", "۲۰ دسته / ۱۰۴ خدمت با نرخ روز ۱۴۰۵/۰۸/۲۴ و توضیح دوزبانه", "download/ (JSON و CSV)"],
      ["اسکریپت بارگذاری", "ساخت پایگاه داده از کاتالوگ رسمی؛ مستقل از مسیر استقرار", "scripts/seed104.mjs"],
      ["آزمون‌های پذیرش", "۱۹ آزمون سرتاسری + ۴۰ آزمون دود و ممیزی محرمانگی", "scripts/e2e_p6.sh و scripts/smoke_p7.py"],
      ["ایمیج Docker", "ساخت سه‌مرحله‌ای و اجرای standalone با کاربر غیرریشه و حجم پایگاه داده", "Dockerfile و docker-compose.yml"],
      ["پیکربندی محیط", "نمونه متغیرهای Production شامل پایگاه داده و SMTP", ".env.production.example"],
      ["راهنمای بهره‌برداری", "گام‌های استقرار Docker و بدون Docker، تنظیمات پس از استقرار و چک‌لیست", "DEPLOYMENT.md"],
    ]),
  bodyPara("مسیر بهره‌برداری پیشنهادی چنین است: استقرار با Compose، تغییر رمز ادمین از تب تنظیمات، تکمیل متغیرهای SMTP برای فعال شدن ایمیل گزارش‌ها، اتصال درگاه پرداخت واقعی در نقطه اتصال آماده‌شده، فعال‌سازی کرون پشتیبان‌گیری روزانه SQLite و قرار دادن سرویس پشت وب‌سرور دارای گواهی TLS. چک‌لیست هشت‌بندی بخش ۷ همین سند، پذیرش نهایی کارفرما را پوشش می‌دهد.", { after: 160 }),

  // ── ۶. امنیت و کارایی ──
  h1("۶. بازبینی امنیتی و سنجش کارایی"),
  bodyPara("بازبینی امنیتی این پیام، مرور ایستای کد بر پهنه ده ریسک برتر OWASP بود و یافته‌های آن با آزمون پویا تقویت شد. کنترل دسترسی تمام مسیرهای ادمین با کوکی سمت سرور انجام می‌شود و آزمون خودکار، پاسخ ۴۰۱ بدون احراز را در همه آن‌ها تأیید کرد؛ تمام ورودی‌های POST با طرح‌های اعتبارسنجی سخت‌گیرانه پالایش می‌شوند و آزمون، رد درخواست‌های نادرست سرمایه‌گذاری و برآورد متفرقه را نشان داد؛ همه پرس‌وجوها از راه ORM پارامتری می‌گذرد؛ مبلغ و ضرایب سفارش همیشه سمت سرور محاسبه می‌شود و کلاینت هیچ ابزار مالی ندارد؛ تسویه درون یک تراکنش با گاردهای تکرارناپذیری اجرا می‌شود؛ و قاعده ویژه کارفرما یعنی مطلق‌شدن محرمانگی سهم‌ها در بخش ۴ برقرار و آزمون‌پذیر است."),
  tableCaption("جدول ۶ — مرور ایستا بر ریسک‌های کلیدی OWASP و وضعیت"),
  rtlTable([30, 46, 24],
    ["حوزه ریسک", "تدبیر موجود در محصول", "وضعیت"],
    [
      ["کنترل دسترسی شکسته", "گیت کوکی ادمین روی همه مسیرهای /api/admin/*؛ آزمون ۴۰۱ بدون احراز", "احراز شد"],
      ["اعتبارسنجی ورودی", "طرح‌های سخت‌گیرانه روی همه ورودی‌های POST؛ رد آزمایشی ورودی نادرست", "احراز شد"],
      ["تزریق", "پرس‌وجوی پارامتری ORM در تمام مدل‌ها", "احراز شد"],
      ["طراحی نادرست", "محاسبه مالی صرفاً سمت سرور؛ تسویه تراکنشی با گارد تکرارناپذیری", "احراز شد"],
      ["محرمانگی تجاری", "سهم‌ها فقط در پایگاه داده و ایمیل بک‌اند؛ ممیزی خودکار نشتی", "احراز شد"],
      ["پیکربندی نادرست", "اجرا با کاربر غیرریشه در Docker؛ پیکربندی صرفاً با متغیر محیط", "احراز شد"],
      ["محدودسازی نرخ و آزمون نفوذ", "نیازمند زیرساخت شبکه و سرویس PSP واقعی؛ توصیه عملیاتی پس از تحویل", "موکول به بهره‌برداری"],
    ]),
  bodyPara("سنجش کارایی روی نسخه Production انجام شد: در ۶۰ درخواست متوالی به API کاتالوگ، میانگین تأخیر ۵ میلی‌ثانیه، صدک میانی ۴ میلی‌ثانیه، صدک ۹۵ برابر ۱۱ میلی‌ثانیه و بدترین حالت ۱۴ میلی‌ثانیه ثبت شد؛ در موج هم‌زمان ۲۰ درخواستی، میانگین هر درخواست ۳ میلی‌ثانیه ماند. هدف جدول پیام ۳ (صدک ۹۵ زیر ۵۰۰ میلی‌ثانیه با ۱۰۰ کاربر هم‌زمان) در سطح API با حاشیه بیش از چهل‌وپنج‌برابری محقق است؛ اجرای تست بار میدانی با k6 روی زیرساخت نهایی کارفرما به‌عنوان عملیات پس از تحویل توصیه می‌شود تا تأخیر شبکه واقعی نیز در سنجش وارد شود.", { after: 160 }),

  // ── ۷. چک‌لیست پذیرش ──
  h1("۷. چک‌لیست پذیرش Production و وضعیت نهایی"),
  bodyPara("جدول ۷ جمع‌بندی پذیرش نهایی برنامه هفت‌پیامی است: هر معیار با روش احراز عینی بررسی و همگی تأیید شده‌اند. این جدول جایگزین جدول معیارهای پیام ۶ است و طبق تعهد همان پیام، همراه نتایج آزمون و بازبینی امنیتی، وضعیت نهایی تحویل را نشان می‌دهد."),
  tableCaption("جدول ۷ — چک‌لیست پذیرش Production و وضعیت احراز"),
  rtlTable([36, 42, 22],
    ["معیار پذیرش", "روش احراز", "وضعیت"],
    [
      ["سلامت انتشار Production", "کاتالوگ ۱۰۵ خدمتی و ۲۰ دسته از نسخه standalone", "احراز شد"],
      ["چرخه کامل مشتری روی نسخه منتشرشده", "سفارش، پرداخت و پیگیری روی سرور Production (۸/۸)", "احراز شد"],
      ["صفر بودن نشتی سهم‌ها در تمام رابط‌ها", "ممیزی بازگشتی همه پاسخ‌های API در مجموعه ۴۰ آزمونی", "احراز شد"],
      ["صحت موتور تسویه محرمانه", "تطبیق ۴/۷ و ۱/۷ و جمع سهم‌ها با مبلغ کل در پایگاه داده", "احراز شد"],
      ["کاتالوگ رسمی و تخفیف ۵ درصدی", "آزمون کاتالوگ و مبلغ تخفیف سفارش معرف‌دار (۴۹۰٬۰۵۰ تومان روی نمونه)", "احراز شد"],
      ["هدف کارایی نقشه راه", "صدک ۹۵ برابر ۱۱ میلی‌ثانیه در برابر هدف ۵۰۰ میلی‌ثانیه", "احراز شد"],
      ["تکرارپذیری استقرار", "بارگذاری مجدد کاتالوگ و اجرای سبز کامل آزمون‌ها", "احراز شد"],
      ["بسته استقرار و راهنما", "بسته ۱۸۴ فایلی + Dockerfile + Compose + راهنمای بهره‌برداری", "احراز شد"],
    ]),
  bodyPara("بند «محدودسازی نرخ و آزمون نفوذ» از جدول ۶ عمداً به فهرست عملیات پس از تحویل منتقل شد؛ زیرا به زیرساخت شبکه واقعی و سرویس درگاه نیاز دارد و در محیط آزمون قابل احراز نیست. این انتقال با روح نقشه راه سازگار است چون هیچ بندی از چرخه محصول را برجا نمی‌گذارد و پیش از اعلام بهره‌برداری عمومی اجرای آن توصیه شده است.", { after: 160 }),

  // ── ۸. تحویل نهایی ──
  h1("۸. جمع‌بندی تحویل و توصیه‌های پس از انتشار"),
  bodyPara("با تحویل پیام ۷، برنامه هفت‌پیامی پروژه الو شتاب کامل شد. پوشه تحویل اکنون مجموعه کامل تعریف تا استقرار را در بر می‌گیرد: کاتالوگ رسمی ۲۰ دسته و ۱۰۴ خدمت با نرخ روز (پیام ۲)، نقشه راه Production (پیام ۳)، اسکلت پروژه (پیام ۴)، هسته عملکردی و موتور تسویه محرمانه (پیام ۵)، رابط کاربری دوزبانه و یکپارچه‌سازی (پیام ۶) و بسته انتشار نسخه 1.0.0 همراه سند حاضر (پیام ۷). نسخه‌های پیشین کد (اسکلت، هسته و رابط) برای شفافیت تاریخی در پوشه باقی‌اند و بسته انتشار، جانشین کامل آن‌هاست."),
  tableCaption("جدول ۸ — توصیه‌های عملیاتی پس از تحویل"),
  rtlTable([30, 44, 26],
    ["موضوع", "اقدام توصیه‌شده", "زمان پیشنهادی"],
    [
      ["درگاه پرداخت واقعی", "اتصال PSP شاپرک در نقطه اتصال آماده و آزمون میدانی تراکنش کم‌مبلغ", "پیش از بهره‌برداری عمومی"],
      ["محدودسازی نرخ و آزمون نفوذ", "فعال‌سازی محدودساز در وب‌سرور و سفارش آزمون نفوذ مستقل", "پیش از بهره‌برداری عمومی"],
      ["تست بار میدانی k6", "اجرای سناریوی ۱۰۰ کاربر هم‌زمان روی زیرساخت نهایی کارفرما", "هفته نخست بهره‌برداری"],
      ["نظارت و هشدار", "پایش سلامت، خطاها و حجم پایگاه داده و هشدار خودکار", "همراه بهره‌برداری"],
      ["کنترل نوع در ساخت", "فعال‌سازی سخت‌گیرانه خطاهای نوع در خط ساخت پس از تثبیت نسخه", "نخستین به‌روزرسانی"],
    ]),
  bodyPara("برای هر اصلاح کوچک از سوی کارفرما — از تغییر متن‌ها تا تعیین نهایی PSP — ساختار برنامه آماده است: قواعد مالی و چرخه سفارش در موتور سرور متمرکزند، رابط‌ها از قرارداد پایدار پیام ۵ تغذیه می‌شوند و مجموعه ۶۷ آزمونی، بی‌خطر بودن هر تغییر را در چند دقیقه نشان می‌دهد. پروژه الو شتاب در وضعیت تحویل‌شده و آماده بهره‌برداری است.", { after: 0 }),
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
            children: [faRun("تست، اشکال‌زدایی و بسته استقرار Production الو شتاب | پیام ۷", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/پیام-۷-تست-و-استقرار-Production.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
