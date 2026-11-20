// پیام ۳ — تحلیل نیازمندی‌ها و نقشه راه Production (Persian RTL document)
// Skill: docx | Route: Create | Scene: report (Template F adapted) | Cover: R1 + GO-1
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
const BODY_COLOR = "000000"; // Profile A formal: pure black body
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

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    bidirectional: true,
    spacing: { before: 240, after: 120, line: 360, lineRule: "atLeast" },
    children: [faRun(text, { size: 28, bold: true, color: HEAD_COLOR })],
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

// Horizontal-only table style, RTL column order (first column = rightmost)
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
    children: [new Paragraph({
      bidirectional: true,
      alignment: isHeader ? AlignmentType.CENTER : undefined,
      spacing: { line: 312 },
      children: [faRun(text, { size: 21, bold: isHeader, color: isHeader ? PAL.table.headerText : BODY_COLOR })],
    })],
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

// ─────────────────────────── Cover layout math (Persian-adapted) ───────────────────────────
// Persian glyphs average ~0.6x of CJK width at same pt → char width ≈ pt * 12 twips
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
  const charWidth = (pt) => pt * 12; // Persian-adapted
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

// ─────────────────────────── Cover R1 (RTL-adapted: right-aligned) ───────────────────────────
function buildCoverR1(config) {
  const P = config.palette;
  const padStart = 1200, padEnd = 800; // start = right side in RTL
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

  // 1. dynamic top whitespace
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  // 2. English label with accent bottom border
  children.push(new Paragraph({
    bidirectional: true,
    indent: { left: padStart, right: padEnd }, spacing: { after: 500 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
    children: [new TextRun({
      text: config.englishLabel.split("").join("  "),
      size: 18, sizeComplexScript: 18, color: P.accent, font: FONT, characterSpacing: 40,
    })],
  }));

  // 3. main title lines (dynamic size, explicit line spacing per Rule 8)
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

  // 4. subtitle
  children.push(new Paragraph({
    bidirectional: true,
    indent: { left: padStart }, spacing: { after: 800, line: 380, lineRule: "atLeast" },
    children: [faRun(config.subtitle, { size: 24, color: P.cover.subtitleColor })],
  }));

  // 5. meta lines with accent start border
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: padStart + 200 }, spacing: { after: 80 },
      border: { left: accentStart },
      children: [faRun(line, { size: 24, color: P.cover.metaColor })],
    }));
  }

  // 6. dynamic bottom whitespace
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  // 7. footer line with accent top separator
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
  title: "نقشه راه رساندن پروژه به Production",
  subtitle: "پیام ۳ از ۷ — تحلیل نیازمندی‌ها، چک‌لیست آمادگی و برنامه تحویل",
  englishLabel: "PRODUCTION ROADMAP",
  metaLines: [
    "شماره سند: پیام ۳ از سری هفت‌پیامی تحویل پروژه",
    "تاریخ تنظیم: ۲۴ آبان ۱۴۰۵ (۱۵ نوامبر ۲۰۲۶)",
    "تهیه‌کننده: دستیار فنی",
    "وضعیت: سند کاری — در انتظار تکمیل مشخصات پروژه",
  ],
  footerLeft: "سری اسناد تحویل پروژه",
  footerRight: "پیام ۳ از ۷",
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
  bodyPara("این سند، پیام سوم از برنامه هفت‌پیامی تحویل پروژه است و مطابق تعهد اعلام‌شده در پیام دوم، به تحلیل نیازمندی‌ها و تدوین نقشه راه اختصاص یافته است. تنها ورودی ثبت‌شده کارفرما پس از بازیابی نشست، عبارت «Prod» بوده است که در این سند به‌عنوان هدف «آماده‌سازی خروجی برای محیط Production» تفسیر می‌شود؛ یعنی تحویل نه یک نمونه آزمایشی، بلکه بسته‌ای شامل کد، پیکربندی، مستندات و رویه استقرار که معیارهای پذیرش بخش ۳ این سند را احراز کند."),
  bodyPara("چارچوب تحلیل در دو لایه تنظیم شده است: نیازمندی‌های عملکردی شامل مدیریت هویت و دسترسی، ماژول اصلی کسب‌وکار، رابط برنامه‌نویسی، گزارش‌گیری و اعلان‌ها؛ و نیازمندی‌های غیرعملکردی شامل کارایی، ظرفیت، امنیت، دسترس‌پذیری، مقیاس‌پذیری و نگه‌داشت‌پذیری. بر مبنای همین چارچوب، هشت بُعد «آمادگی Production» تعریف شده است که هر بُعد، معیار پذیرش مشخص و پیام مسئول خود را دارد."),
  bodyPara("بر اساس این تحلیل، پیام‌های آینده به‌ترتیب شامل اسکلت پروژه و پیکربندی پایه (پیام ۴)، پیاده‌سازی هسته عملکردی شامل مدل داده و سرویس‌ها (پیام ۵)، رابط کاربری و یکپارچه‌سازی (پیام ۶) و در نهایت تست، اشکال‌زدایی و تحویل بسته استقرار (پیام ۷) خواهد بود. اجرای کار بدون انتظار برای ورودی تکمیلی ادامه می‌یابد؛ هر مفروض بخش ۱ به‌محض دریافت مشخصات واقعی پروژه جایگزین می‌شود و ساختار نقشه راه بدون تغییر باقی می‌ماند."),

  // ── ۱. بازسازی زمینه ──
  h1("۱. بازسازی زمینه و مفروضات کاری"),
  bodyPara("تعریف اولیه پروژه که در ابتدای نشست مطرح بود، در جابجایی زمینه گفتگو از دست رفته است و در متن فعلی هیچ مشخصه‌ای از نام، دامنه کسب‌وکار، پشته فناوری یا فایل‌های موجود پروژه ثبت نیست. در پیام ۲ این موضوع به‌صورت شفاف گزارش شد و برنامه هفت‌پیامی با محوریت «تحویل مرحله‌به‌مرحله» تعریف شد؛ ادامه درخواست‌های کارفرما مبنی بر ارسال پیام بعدی، مجوز اجرای همین برنامه است."),
  bodyPara("درباره عبارت «Prod» سه تفسیر محتمل وجود دارد: نخست اشاره به محیط استقرار (Production)، دوم اشاره به سطح کیفیت تحویل (آماده بهره‌برداری واقعی) و سوم اشاره به مرحله پایانی چرخه توسعه. هر سه تفسیر به یک جمع‌بندی عملیاتی می‌رسند: خروجی نهایی باید بسته‌ای استقرارپذیر و پایدار باشد، نه یک پیش‌نمایش آزمایشی. بر همین اساس، تمام سنجش‌های این سند با معیار «آمادگی Production» انجام شده است."),
  bodyPara("جدول ۱ پنج مفروض کاری فعلی را به همراه اثر احتمالی تغییر هر یک ثبت می‌کند. قاعده حاکم بر همه مفروضات این است که کار هیچ‌گاه برای دریافت شفاف‌سازی متوقف نمی‌شود؛ هر مفروض یک تصمیم پیش‌فرض مستند است و با اولین اعلام قطعی کارفرما، بدون تغییر در ساختار برنامه، جایگزین می‌شود.", { after: 80 }),
  tableCaption("جدول ۱: مفروضات کاری فعلی و اثر تغییر آن‌ها"),
  rtlTable(
    [8, 18, 42, 32],
    ["کد", "موضوع", "مفروض انتخاب‌شده", "اثر تغییر کارفرما"],
    [
      ["A1", "نوع پروژه", "کاربرد تحت وب با رابط کاربری فارسی", "بازطراحی معماری در پیام ۴"],
      ["A2", "خروجی نهایی", "بسته استقرارپذیر Production شامل کد، پیکربندی و مستندات", "تعدیل فهرست تحویل در پیام ۷"],
      ["A3", "کدبیس موجود", "در این نشست در دسترس نیست؛ پیاده‌سازی از صفر آغاز می‌شود", "تبدیل پیام ۴ به بازسازی و پاکسازی کد موجود"],
      ["A4", "زبان رابط کاربری", "فارسی و راست‌به‌چپ", "افزودن نسخه دوزبانه در پیام ۶"],
      ["A5", "ریتم تحویل", "هر پیام یک بسته تحویلی مستقل و قابل بررسی", "بدون تغییر"],
    ]
  ),

  // ── ۲. تحلیل نیازمندی‌ها ──
  h1("۲. تحلیل نیازمندی‌ها"),
  bodyPara("نیازمندی‌ها در دو دسته عملکردی و غیرعملکردی تحلیل شده‌اند. از آنجا که دامنه دقیق کسب‌وکار هنوز توسط کارفرما اعلام نشده است، نیازمندی‌های عملکردی به‌صورت چارچوبی تدوین شده‌اند که هر پروژه تحت وبی به آن نیاز دارد و ردیف «ماژول اصلی کسب‌وکار» تا دریافت تعریف قطعی، با یک ماژول عمومی مدیریت داده پر می‌شود. نیازمندی‌های غیرعملکردی اما مستقل از دامنه کسب‌وکار قابل تعیین‌اند و به‌صورت اهداف کمی ثبت شده‌اند؛ این اهداف در پیام ۷ مبنای تست پذیرش خواهند بود."),

  h2("۲-۱. نیازمندی‌های عملکردی"),
  bodyPara("پنج حوزه عملکردی پایه در جدول ۲ شناسایی شده‌اند. اولویت‌بندی بر مبنای نقش هر حوزه در حداقل محصول قابل انتشار انجام شده است؛ حوزه‌های با اولویت بالا باید در پیام ۵ کامل شوند و حوزه‌های با اولویت متوسط در پیام ۶ به محصول متصل می‌گردند.", { after: 80 }),
  tableCaption("جدول ۲: نیازمندی‌های عملکردی و اولویت آن‌ها"),
  rtlTable(
    [24, 58, 18],
    ["حوزه", "شرح نیازمندی", "اولویت"],
    [
      ["مدیریت هویت و دسترسی", "ثبت‌نام، ورود، بازیابی رمز عبور، تعریف نقش‌ها و کنترل مجوزها بر مبنای نقش", "بالا"],
      ["ماژول اصلی کسب‌وکار", "موجودیت‌ها و جریان کاری اصلی؛ پیش‌فرض فعلی: ماژول عمومی مدیریت داده شامل ثبت، ویرایش، حذف، جست‌وجو و گزارش", "بالا"],
      ["رابط برنامه‌نویسی", "سرویس‌های RESTful مستند، اعتبارسنجی ورودی و پاسخ‌های خطای استاندارد", "بالا"],
      ["گزارش‌گیری و داشبورد", "نمایش شاخص‌های کلیدی و خروجی CSV و Excel از داده‌ها", "متوسط"],
      ["اعلان‌ها", "اعلان درون‌برنامه‌ای و ایمیلی برای رخدادهای کلیدی سیستم", "متوسط"],
    ]
  ),

  h2("۲-۲. نیازمندی‌های غیرعملکردی"),
  bodyPara("اهداف کمی جدول ۳ معیار «قابل قبول بودن» خروجی را تعیین می‌کنند و در پیام ۷ به‌صورت تست عملی بازبینی می‌شوند. مقادیر ثبت‌شده هدف‌های برنامه‌ریزی هستند، نه نتایج اندازه‌گیری‌شده، و در صورت اعلام الزامات سخت‌گیرانه‌تر از سوی کارفرما، پیش از پیام ۵ بازنگری می‌شوند.", { after: 80 }),
  tableCaption("جدول ۳: اهداف کمی نیازمندی‌های غیرعملکردی"),
  rtlTable(
    [20, 48, 32],
    ["ویژگی", "هدف کمی", "روش سنجش"],
    [
      ["کارایی", "زمان پاسخ صدک ۹۵ زیر ۵۰۰ میلی‌ثانیه برای سرویس‌های خواندنی", "تست بار با ابزار k6 در پیام ۷"],
      ["ظرفیت", "پشتیبانی از ۱۰۰ کاربر هم‌زمان بدون افزایش نرخ خطا", "تست بار مرحله‌ای در پیام ۷"],
      ["امنیت", "HTTPS اجباری، ذخیره امن رمز عبور و پوشش ده ریسک برتر OWASP", "بازبینی امنیتی در پیام ۷"],
      ["دسترس‌پذیری", "هدف در دسترس بودن ۹۹٫۵ درصد در ماه", "پایش آپ‌تایم پس از استقرار"],
      ["مقیاس‌پذیری", "امکان اجرای چند نمونه اپلیکیشن پشت بالانسر بار", "معماری بدون وضعیت در پیام ۴"],
      ["نگه‌داشت‌پذیری", "پوشش تست حداقل ۷۰ درصد برای ماژول‌های هسته", "گزارش پوشش تست در پیام ۷"],
    ]
  ),

  // ── ۳. چک‌لیست آمادگی ──
  h1("۳. تعریف آمادگی Production و چک‌لیست پذیرش"),
  bodyPara("در این برنامه، «آماده Production» بودن خروجی به هشت بُعد قابل سنجش تعریف می‌شود. این تعریف جایگزین قضاوت سلیقه‌ای است: خروجی تنها زمانی تحویل نهایی محسوب می‌شود که همه ردیف‌های جدول ۴ احراز شده باشند. هر بُعد به پیامی که باید آن را محقق کند متصل شده است تا در پایان هر پیام، وضعیت پیشرفت به‌صورت عینی قابل بررسی باشد.", { after: 80 }),
  tableCaption("جدول ۴: هشت بُعد آمادگی Production، معیار پذیرش و پیام مسئول"),
  rtlTable(
    [24, 58, 18],
    ["بُعد", "معیار پذیرش", "پیام مسئول"],
    [
      ["کد و نسخه‌بندی", "مخزن Git با ساختار شاخه‌بندی مشخص، فایل README اجرایی و تاریخچه تمیز", "۴"],
      ["پیکربندی و اسرار", "جداسازی کامل پیکربندی از کد، استفاده از متغیرهای محیطی و عدم حضور رمزها در مخزن", "۴"],
      ["داده و پایگاه داده", "اسکیمای نسخه‌دار با مکانیزم migration و رویه پشتیبان‌گیری روزانه", "۵"],
      ["استقرار و CI/CD", "خط لوله خودکار ساخت، تست و استقرار با امکان بازگشت یک‌مرحله‌ای", "۴ و ۷"],
      ["امنیت", "HTTPS، احراز هویت امن، کنترل دسترسی و پاکسازی ورودی‌ها", "۵ و ۷"],
      ["مشاهده‌پذیری", "ثبت لاگ ساخت‌یافته، متریک‌های پایه و هشداردهی خطا", "۶"],
      ["کارایی و بار", "احراز اهداف کمی جدول ۳ در تست بار", "۷"],
      ["مستندات و Runbook", "راهنمای نصب، پیکربندی و عیب‌یابی عملیاتی به زبان فارسی", "۷"],
    ]
  ),
  bodyPara("این چک‌لیست مرجع مشترک کارفرما و مجری است و در پیام ۷ به‌صورت جدول وضعیت (احراز شده / احراز نشده) گزارش نهایی خواهد شد. هر تغییر دامنه پروژه از سوی کارفرما صرفاً ردیف‌های این جدول را تغییر می‌دهد و ساختار کلی برنامه حفظ می‌شود.", { after: 160 }),

  // ── ۴. نقشه راه ──
  h1("۴. نقشه راه پیام‌های ۴ تا ۷"),
  bodyPara("چهار پیام باقی‌مانده برنامه، مسیر رسیدن از وضعیت فعلی به بسته استقرارپذیر را پوشش می‌دهند. جدول ۵ محتوای کاری، خروجی ملموس و معیار پذیرش هر پیام را مشخص می‌کند؛ معیار پذیرش همان مرز قراردادی هر پیام است و تحویل هر مرحله بدون احراز آن کامل شده تلقی نمی‌شود.", { after: 80 }),
  tableCaption("جدول ۵: محتوا، خروجی و معیار پذیرش پیام‌های ۴ تا ۷"),
  rtlTable(
    [10, 28, 30, 32],
    ["پیام", "محتوای کاری", "خروجی ملموس", "معیار پذیرش"],
    [
      ["۴", "اسکلت پروژه و پیکربندی پایه", "ساختار پوشه‌ها، ابزار ساخت، پیکربندی محیط‌ها، فایل Dockerfile و خط لوله CI", "پروژه بدون خطا ساخت و اجرا می‌شود و ساختار مطابق استاندارد است"],
      ["۵", "پیاده‌سازی هسته عملکردی", "مدل داده و migration، سرویس‌های اصلی، سرویس‌های API و احراز هویت", "سناریوی اصلی کاربر از طریق API سرتاسری اجرا می‌شود"],
      ["۶", "رابط کاربری و یکپارچه‌سازی", "صفحات فارسی راست‌به‌چپ، اتصال به API و اعتبارسنجی سمت کاربر", "جریان کامل کاربر بدون خطا انجام می‌شود"],
      ["۷", "تست، اشکال‌زدایی و تحویل", "مجموعه تست‌ها، رفع نقص، بسته استقرار Production، مستندات و Runbook", "چک‌لیست جدول ۴ کامل شود و بسته در پوشه تحویل قرار گیرد"],
    ]
  ),
  bodyPara("منطق توالی پیام‌ها وابستگی سخت است: اسکلت پیام ۴ بستر کدنویسی هسته در پیام ۵ را فراهم می‌کند، هسته پیام ۵ پیش‌نیاز اتصال رابط کاربری در پیام ۶ است و تست پیام ۷ تنها روی مجموعه کامل معنا دارد. اگر کارفرما کدبیس موجودی پیوست کند، پیام ۴ به بازسازی همان کدبیس تغییر می‌کند اما توالی و معیارهای پذیرش بدون تغییر باقی می‌ماند.", { after: 160 }),

  // ── ۵. نقاط تصمیم باز ──
  h1("۵. نقاط تصمیم باز و پیش‌فرض‌های انتخاب‌شده"),
  bodyPara("برای آنکه جریان کار متوقف نشود، برای هر نقطه تصمیم باز یک پیش‌فرض انتخاب شده و روی همان پیش‌فرض کار ادامه می‌یابد. جدول ۶ این نقاط را به همراه پیش‌فرض فعلی و جایگزینی که با اعلام کارفرما جایگزین می‌شود نشان می‌دهد. هیچ‌یک از این موارد مانع شروع پیام ۴ نیست.", { after: 80 }),
  tableCaption("جدول ۶: نقاط تصمیم باز، پیش‌فرض‌های فعلی و جایگزین‌های ممکن"),
  rtlTable(
    [22, 40, 38],
    ["نقطه تصمیم", "پیش‌فرض فعلی", "جایگزین با اعلام کارفرما"],
    [
      ["پشته فناوری", "Next.js با TypeScript و پایگاه داده PostgreSQL و استقرار با Docker", "هر پشته‌ای که کارفرما اعلام کند"],
      ["الگوی معماری", "معماری یکپارچه مدولار (Monolith مدولار)", "میکروسرویس در صورت نیاز مقیاس بالا"],
      ["زبان رابط کاربری", "فارسی و راست‌به‌چپ", "نسخه دوزبانه فارسی و انگلیسی"],
      ["محیط استقرار", "سرور مبتنی بر Docker با خط لوله CI", "پلتفرم ابری خاص مانند Vercel یا AWS"],
      ["دامنه کسب‌وکار", "ماژول عمومی مدیریت داده", "تعریف دقیق پروژه توسط کارفرما"],
    ]
  ),
  bodyPara("قاعده پایانی برنامه این است: پیام ۴ (اسکلت پروژه و پیکربندی پایه) بلافاصله پس از این سند و بر مبنای پیش‌فرض‌های جدول ۶ آغاز می‌شود. اگر کارفرما پیش از آن، تعریف دقیق پروژه، فایل یا الزام فنی خود را اعلام کند، پیام ۴ بر همان اساس تنظیم خواهد شد و در غیر این صورت، مسیر پیش‌فرض بدون توقف اجرا می‌گردد.", { after: 0 }),
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
    { // Section 2: TOC — no page-number footer (report scene: TOC page numbers optional)
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
            children: [faRun("نقشه راه رساندن پروژه به Production | پیام ۳", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/پیام-۳-نقشه-راه-Production.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
