// پیام ۶ — رابط کاربری و یکپارچه‌سازی (Persian RTL document)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (same as پیام ۳ و ۵)
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

const ep = (path) => path.split("/").join("/​");
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

// ─────────────────────────── Cover R1 (RTL-adapted: right-aligned) ───────────────────────────
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
  title: "رابط کاربری و یکپارچه‌سازی",
  subtitle: "پیام ۶ از ۷ — کاتالوگ رسمی ۱۰۴ خدمت، درگاه پرداخت، پنل مدیریت و حفاظت محرمانگی سهم‌ها",
  englishLabel: "UI AND INTEGRATION",
  metaLines: [
    "شماره سند: پیام ۶ از سری هفت‌پیامی تحویل پروژه الو شتاب",
    "تاریخ تنظیم: ۲۴ آبان ۱۴۰۵ (۱۵ نوامبر ۲۰۲۶)",
    "نسخه کد: 0.6.0-ui — بسته تحویلی: alo_shetab_ui.zip",
    "وضعیت: تحویل‌شده — ۱۹/۱۹ آزمون سرتاسری و بازبینی مرورگری موفق",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "پیام ۶ از ۷",
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
  bodyPara("این سند، پیام ششم از برنامه هفت‌پیامی تحویل پروژه الو شتاب است و مطابق نقشه راه مصوب پیام ۳، به «رابط کاربری و یکپارچه‌سازی» اختصاص یافته است. در پیام ۵ هسته عملکردی و قراردادهای API تثبیت شد و تعهد این پیام، نشاندن رابط کاربری فارسی راست‌به‌چپ روی همان قراردادها بود: صفحات مشتری شامل کاتالوگ، ثبت سفارش، پرداخت و پیگیری با خط زمانی؛ پنل مدیریت برای کارشناسی، اعزام، تسویه محرمانه و گزارش‌ها؛ اتصال به درگاه پرداخت و صفحه دانلود با کد QR. تمام بندهای این تعهد محقق شده و خروجی آن در بسته کد نسخه 0.6.0-ui به نشانی alo_shetab_ui.zip در پوشه تحویل قرار دارد."),
  bodyPara("فراتر از تعهد پایه، دو کار یکپارچه‌سازی تعیین‌کننده نیز انجام شد. نخست، پایگاه دادهٔ وب‌اپلیکیشن با کاتالوگ رسمی پیام ۲ هم‌تراز شد: ۱۰۴ خدمت رسمی در ۲۰ دسته با نرخ‌های به‌روز ۱۴۰۵/۰۸/۲۴ (۹۹ درصد بالاترین نرخ بازار) جایگزین فهرست اولیه ۴۱ خدمتی شد و چهار خدمت کارمزد درصدی (معاملات ملکی و بازاریابی کمیسیونی) به مسیر کارشناسی متصل گردید. دوم، بر پایه اصلاح کارفرما، تخفیف کد معرف از ۸ درصد به ۵ درصد تغییر کرد و در تمام لایه‌ها — موتور قیمت‌گذاری، تنظیمات، متن‌های رابط کاربری و چت‌بات — یکدست شد."),
  bodyPara("تضمین سوم این پیام، حفاظت از محرمانگی سهم‌بندی تسویه است: طبق دستور کارفرما، نسبت‌های تسویه تنها در موتور سمت سرور محاسبه و در پایگاه داده ثبت می‌شود و نباید در هیچ نقطه از رابط کاربری، پاسخ‌های API عمومی یا متن‌های گزارش‌شده به مشتری ظاهر شود. در آستانه این پیام، ردیابی کامل رشته‌ها و فیلدها نشان داد متن‌های قدیمی رابط کاربری و دو پاسخ API هنوز این مقادیر را افشا می‌کردند؛ هر ۲۲ نقطه نشتی شناسایی‌شده پاک‌سازی شد و آزمون سرتاسری و بازبینی مرورگری، صفر بودن نشتی را در وضعیت نهایی تأیید کرد."),

  // ── ۱. دامنه تحویل ──
  h1("۱. دامنه تحویل و تطبیق با نقشه راه"),
  bodyPara("بر پایه جدول ۵ سند پیام ۳، مرز قراردادی پیام ۶ «رابط کاربری و یکپارچه‌سازی» بود و گام بعدی برنامه پس از آن، تست، اشکال‌زدایی و تحویل بسته استقرار در پیام ۷ قرار دارد. جدول ۱ نشان می‌دهد هر بند از تعهد پیام ۶ در کدام اجزای بسته تحویلی محقق شده است."),
  tableCaption("جدول ۱ — تطبیق تعهد پیام ۶ با اقلام تحویلی"),
  rtlTable([24, 44, 32],
    ["بند تعهد", "اقلام محقق‌شده", "محل تحقق"],
    [
      ["صفحات مشتری (فارسی، راست‌به‌چپ)", "کاتالوگ با فیلتر دسته و جستجو، ویزارد شش‌مرحله‌ای سفارش، پیش‌فاکتور با ریز محاسبات، رسید و چاپ فاکتور، پیگیری با خط زمانی و امتیازدهی ۵+۵", "src/components/as/ (Catalog، OrderWizard، Track، Gateway)"],
      ["پنل مدیریت", "داشبورد، سفارش‌ها با کارشناسی و اعزام، تأیید پرداخت کارت‌به‌کارت، قیمت‌گذاری، نرخ روز، همکاران، معرفی‌ها، محصولات، گزارش‌ها و تنظیمات", "src/components/as/Admin.tsx و مسیرهای /api/admin/*"],
      ["اتصال درگاه پرداخت", "چرخهٔ کامل شبیه‌سازی‌شدهٔ شاپرک/شتاب (کارت، رمز دوم، پیامک یک‌بارمصرف) با نقطه اتصال PSP واقعی و مسیر جایگزین کارت‌به‌کارت با تأیید ادمین", "src/app/api/payments/route.ts و Gateway.tsx"],
      ["صفحه دانلود با کد QR", "بخش دریافت برنامه با لینک نصب و کد QR در کاتالوگ و هدر", "src/components/as/GetApp.tsx"],
      ["یکپارچه‌سازی کاتالوگ رسمی", "۱۰۴ خدمت رسمی در ۲۰ دسته + متفرقه، نرخ‌های ۱۴۰۵/۰۸/۲۴، خدمات درصدی، توضیح دوزبانه", "scripts/seed104.mjs و prisma/schema.prisma"],
      ["حفاظت محرمانگی سهم‌ها", "پاک‌سازی کامل رابط کاربری و API عمومی؛ تسویه صرفاً سمت سرور", "src/lib/settlement.ts و مسیرهای عمومی"],
    ]),
  bodyPara("ستون‌های عمودی هلدینگ (میز محصولات، سرمایه‌گذاری، صندوق حمایت، جذب همکار، پشتیبانی هوشمند و ارتباط با ما) که در نسخه‌های پیشین ساخته شده بودند، در همین پیام با داده‌های واقعی و متن‌های اصلاح‌شده هم‌تراز شدند تا محصول واحد و قابل انتشار آماده آزمون نهایی پیام ۷ باشد.", { after: 160 }),

  // ── ۲. معماری رابط کاربری ──
  h1("۲. معماری رابط کاربری و تجربه مشتری"),
  bodyPara("رابط کاربری به‌صورت تک‌صفحه‌ای مبتنی بر نما (View) روی App Router پیاده شده است: کلید تغییر نما در وضعیت سراسری (Zustand) نگه داشته می‌شود و هر نما داده خود را از همان قراردادهای API پیام ۵ می‌خواند؛ بنابراین هیچ منطق مالی در کلاینت نوشته نشده است. زبان پیش‌فرض فارسی و راست‌به‌چپ است و با کلید تغییر زبان، جهت صفحه به چپ‌به‌راست و همه متن‌ها به انگلیسی تبدیل می‌شود؛ حالت شب و روز، چیدمان موبایل‌محور و رعایت الگوهای دسترس‌پذیری (برچسب ARIA، هدف لمسی دست‌کم ۴۴ پیکسل، پیمایش کیبورد) در تمام نماها برقرار است."),
  bodyPara("کاتالوگ خدمت برای مقیاس جدید بازطراحی شد: نوار فیلتر دسته‌ها با شمارش زنده هر دسته در بالای شبکه خدمات نشسته و جعبه جستجوی فوری روی نام فارسی، نام انگلیسی و نام دسته کار می‌کند. هر کارت خدمت، دکمه راهنمای مجزا دارد که شرح کامل دوزبانه خدمت، نرخ پایه و توانایی انجام از راه دور را نشان می‌دهد؛ چهار خدمت کارمزد درصدی به‌جای نرخ ثابت، درصد کارمزد و برچسب «تعیین توسط کارشناس» را نمایش می‌دهند."),
  bodyPara("ویزارد سفارش شش مرحله دارد: سبد و تعداد، مشخصات مشتری با اعتبارسنجی فیلدبه‌فیلد، حالت انجام (در محل یا از راه دور با ضریب ۰٫۷)، کد معرف اختیاری، پیش‌فاکتور با ریز ضرایب روز هفته، ساعت، نرخ روز خدمت و تخفیف معرف، و در پایان درگاه پرداخت. چرخه درگاه دقیقاً همان مسیر بانکی است: انتخاب کارت، ورود رمز دوم و پیامک یک‌بارمصرف؛ پس از تأیید، رسید با کد رهگیری AS-XXXXXX و دکمه چاپ فاکتور صادر می‌شود. مشتری همان کد را در صفحه پیگیری وارد می‌کند، خط زمانی وضعیت را می‌بیند و پس از «انجام‌شده» شدن سفارش، امتیاز مهارت و اخلاق (هر کدام تا پنج ستاره) را ثبت می‌کند؛ تسویه بلافاصله پس از ثبت رضایت به‌صورت خودکار اجرا می‌شود و هیچ جزئیات آن به مشتری نشان داده نمی‌شود."),

  // ── ۳. یکپارچه‌سازی داده ──
  h1("۳. یکپارچه‌سازی با کاتالوگ رسمی و قواعد مالی"),
  bodyPara("پیش از این پیام، وب‌اپلیکیشن فهرست اولیه ۴۱ خدمتی با تخفیف ۸ درصدی را نگه می‌داشت که با کاتالوگ رسمی پیام ۲ و اصلاحات بعدی کارفرما هم‌خوان نبود. برای یکپارچه‌سازی، اسکریپت دوزبانه‌سازی با مدل زبانی نام انگلیسی و توضیح فارسی و انگلیسی هر ۱۰۴ خدمت را تولید کرد (خروجی: scripts/catalog104_enriched.json) و اسکریپت بارگذاری، پایگاه داده را از نو ساخت: هر خدمت با کلید پایدار، دسته رسمی، نرخ پایه برابر نرخ الو شتاب (۹۹ درصد بالاترین نرخ بازار، گردشده به هزار تومان) و توضیح دوزبانه ثبت شد. خدمت «متفرقه» با موتور برآورد هوش مصنوعی و مسیر کارشناسی، به‌عنوان قلم ۱۰۵ کنار کاتالوگ رسمی باقی ماند."),
  tableCaption("جدول ۲ — تغییرهای یکپارچه‌سازی و دلیل هر تغییر"),
  rtlTable([30, 32, 38],
    ["محور", "وضعیت پیشین", "وضعیت پس از پیام ۶"],
    [
      ["فهرست خدمات", "۴۱ خدمت فهرست اولیه PRD", "۱۰۴ خدمت رسمی پیام ۲ در ۲۰ دسته + متفرقه؛ نرخ‌ها بر پایه ۱۴۰۵/۰۸/۲۴"],
      ["تخفیف کد معرف", "۸ درصد (متن PRD)", "۵ درصد طبق اصلاح کارفرما؛ هم‌تراز در موتور قیمت، تنظیمات، رابط کاربری و چت‌بات"],
      ["خدمات کارمزد درصدی", "پشتیبانی‌نشده", "چهار خدمت (کارمزد رهن و اجاره، رهن کامل، خرید و فروش ملک، بازاریابی کمیسیونی) با percentValue؛ ثبت سفارش مستقیم به مسیر کارشناسی می‌رود و پرداخت تا تعیین مبلغ قطعی مسدود است"],
      ["توضیح خدمات", "متن ثابت نمونه", "توضیح فارسی و انگلیسی اختصاصی هر خدمت (تولید با مدل زبانی و بازبینی)"],
      ["جستجو و دسته‌بندی", "شبکه ساده", "فیلتر ۲۰ دسته با شمارش + جستجوی زنده"],
    ]),
  bodyPara("در سمت موتور قیمت‌گذاری، تنها تغییر لازم همین خدمات درصدی بود: چون کارمزد به مبلغ معامله وابسته است، ثبت سفارش آن‌ها مستقیم به وضعیت «نیاز به بررسی و کارشناسی» می‌رود و کارشناس در پنل مدیریت مبلغ قطعی را تعیین می‌کند؛ سپس سفارش به صف پرداخت بازمی‌گردد. این مسیر با همان گیت‌های ماشین حالت پیام ۵ پیاده شد و هیچ استثنایی در قواعد پرداخت ایجاد نکرد.", { after: 160 }),

  // ── ۴. محرمانگی ──
  h1("۴. حفاظت از محرمانگی سهم‌بندی تسویه"),
  bodyPara("قاعده محرمانگی کارفرما روشن است: نسبت‌های تسویه (سهم انجام‌دهنده، سهم معرف و سهم سامانه) فقط در موتور سمت سرور محاسبه و در پایگاه داده ثبت می‌شود و در هیچ نقطه‌ای که مشتری یا بازدیدکننده می‌تواند ببیند — متن‌های رابط کاربری، پاسخ‌های API عمومی، چت‌بات و متن گزارش‌های رویداد — نباید بازتاب یابد. ردیابی کامل با الگوهای «۴/۷»، «۱/۷»، «۲/۷» و نام فیلدهای سهم نشان داد ۲۲ نقطه افشا در شش فایل وجود داشت؛ همگی پاک‌سازی شدند."),
  tableCaption("جدول ۳ — سطوح پاک‌سازی محرمانگی و اقدام انجام‌شده"),
  rtlTable([26, 40, 34],
    ["سطح", "نمونه نقاط شناسایی‌شده", "اقدام"],
    [
      ["متن‌های عمومی رابط کاربری", "شرط پذیرش قواعد در ویزارد، پانوشت فوتر، کارت معرفی، شرح مرحله ۶، صفحه جذب همکار، صفحه سرمایه‌گذار و پرسش‌های متداول (فارسی و انگلیسی)", "بازنویسی بدون هیچ نسبتی؛ عبارت کلی «تسویهٔ خودکار پس از رضایت مشتری» و «جزئیات مالی محرمانه است»"],
      ["پنل مدیریت", "برچسب‌های «سهم مجری (۴/۷)» و مشابه", "نمایش فقط مبلغ ثبت‌شده با برچسب بی‌نسبت؛ مبلغ، سجل مالی است و نزد ادمینِ ورودکرده می‌ماند"],
      ["پاسخ‌های API عمومی", "پیگیری سفارش همه فیلدهای سهم و مبلغ حق معرف را برمی‌گرداند؛ ثبت رضایت نتیجه تسویه را برمی‌گرداند", "ساخت پاسخ امن با فهرست سفید فیلدها؛ فقط نشان بولی «تسویه‌شده» بدون مبالغ"],
      ["چت‌بات پشتیبانی", "چهار پاسخ آماده با ذکر نسبت‌ها", "بازنویسی پاسخ‌ها؛ قانون محرمانگی به دستور سیستمی مدل زبانی نیز افزوده شد"],
      ["متن گزارش‌های رویداد", "متن تسویه و واریز حق معرف در صف گزارش", "حذف نسبت‌ها؛ گزارش فقط مبالغ را در پنل ادمین نشان می‌دهد"],
      ["ثابت‌های کد", "فایل ثابت‌ها و موتور تسویه", "بدون تغییر — محاسبه و ثبت سمت سرور طبق قاعده کارفرما حفظ شد"],
    ]),
  bodyPara("برای اطمینان پایدار، دو آزمون دائمی به مجموعه آزمون افزوده شد: آزمون رشته‌ای که جستجوی الگوی نسبت‌ها در همه فایل‌های رابط کاربری و مسیرهای عمومی را کنترل می‌کند و آزمون پاسخِ پیگیری که نبود فیلدهای سهم را بررسی می‌نماید؛ این دو آزمون در پیام ۷ به مجموعه رگرسیون پیوست می‌شوند.", { after: 160 }),

  // ── ۵. پنل مدیریت ──
  h1("۵. پنل مدیریت و تعمیم مسیر کارشناسی"),
  bodyPara("پنل مدیریت با ورود رمزی امن (کوکی سمت سرور، رمز قابل تغییر در تنظیمات) روی همان قراردادهای پیام ۵ کار می‌کند و شامل نه تب است: داشبورد (تعداد سفارش‌ها بر اساس وضعیت، کیف پول شرکت، میانگین امتیاز، سفارش‌های اخیر)، سفارش‌ها (جزئیات کامل، انتقال وضعیت گیت‌محور، تعیین همکار مجری، قیمت‌گذاری کارشناسی)، تأیید پرداخت کارت‌به‌کارت، قیمت‌گذاری ۱۰۵ خدمت با جستجو و نوار پیمایش، نرخ روز خدمت، همکاران (تأیید جذب، سطح و امتیاز)، معرفی‌ها (ثبت واریز)، محصولات و گزارش‌ها و تنظیمات."),
  bodyPara("تعمیم مهم این پیام در مسیر کارشناسی است: تا پیش از این، تعیین قیمت قطعی تنها برای قلم «متفرقه» ممکن بود؛ اکنون هر قلم نیازمند کارشناسی — متفرقه بدون برآورد یا خدمت کارمزد درصدی — پذیرش مبلغ قطعی را دارد و پس از تعیین، بازمحاسبه کل سفارش و تخصیص مجدد سهم اقلام به‌صورت تراکنشی انجام می‌شود. بدین ترتیب چهار خدمت کارمزد درصدی کاتالوگ رسمی بدون هیچ مسیر موازی، از سفارش تا تسویه پیش می‌روند.", { after: 160 }),

  // ── ۶. نتایج آزمون ──
  h1("۶. آزمون سرتاسری و بازبینی مرورگری"),
  bodyPara("اعتبار این پیام با دو حلقه آزمون سنجیده شد. حلقه نخست، آزمون سرتاسری خودکار روی API است که مسیر کامل مشتری و ادمین را از کاتالوگ تا تسویه اجرا می‌کند (scripts/e2e_p6.sh)؛ ۱۹ آزمون از ۱۹ آزمون موفق شد. حلقه دوم، بازبینی مرورگری واقعی است: ثبت سفارش واقعی از رابط کاربری تا رسید پرداخت، ورود ادمین و بازدید همه تب‌ها، تغییر زبان و جهت صفحه و آزمون چیدمان موبایل؛ بدون خطای کنسول و بدون هیچ نسبتی در متن رندرشده."),
  tableCaption("جدول ۴ — نتایج آزمون سرتاسری (خلاصه گروه‌ها)"),
  rtlTable([30, 14, 56],
    ["گروه آزمون", "نتیجه", "نکته کلیدی احرازشده"],
    [
      ["کاتالوگ رسمی", "۳/۳", "۱۰۵ خدمت فعال، ۲۰ دسته، ۴ خدمت کارمزد درصدی"],
      ["ثبت سفارش و معرف", "۲/۲", "سفارش پایه و سفارش با کد معرف معتبر (مشتری مبنای معرف پیش‌تر ثبت می‌شود)"],
      ["پرداخت درگاه", "۲/۲", "شروع تراکنش و تأیید چرخه کارت، رمز دوم و پیامک یک‌بارمصرف"],
      ["پیگیری و محرمانگی", "۲/۲", "پاسخ پیگیری بدون هیچ فیلد سهم؛ وضعیت پس از پرداخت درست"],
      ["پنل ادمین", "۴/۴", "تعیین همکار و انتقال سه‌مرحله‌ای وضعیت تا «انجام‌شده»"],
      ["رضایت و تسویه محرمانه", "۲/۲", "پاسخ رضایت بدون جزئیات تسویه؛ ثبت امتیاز ۵+۵"],
      ["صحت موتور تسویه", "۳/۳", "سهم مجری برابر ۴/۷ مبلغ، حق معرف برابر ۱/۷، جمع سهم‌ها برابر کل"],
      ["خدمات کارمزد درصدی", "۴/۴", "کارشناسی‌محور بودن، مبلغ صفر، انسداد پرداخت، تعیین قیمت قطعی"],
    ]),
  bodyPara("در اجرای آزمون، سهم مجری سفارش نمونه ۲٬۰۶۹٬۱۰۰ تومانی برابر ۱٬۱۸۲٬۳۴۳ تومان (۴/۷)، حق معرف برابر ۲۹۵٬۵۸۶ تومان (۱/۷) و سهم خالص سامانه برابر ۵۹۱٬۱۷۱ تومان (۲/۷) ثبت شد که صحت موتور محرمانه را در عمل نشان می‌دهد. مبالغ فقط در پایگاه داده و پنل ادمین دیده می‌شوند و در هیچ پاسخ عمومی بازتاب ندارند.", { after: 160 }),

  // ── ۷. معیارهای پذیرش ──
  h1("۷. معیارهای پذیرش پیام ۶ و وضعیت احراز"),
  tableCaption("جدول ۵ — معیارهای پذیرش پیام ۶"),
  rtlTable([34, 44, 22],
    ["معیار", "روش احراز", "وضعیت"],
    [
      ["نشاندن رابط کاربری روی قراردادهای پیام ۵", "بازبینی کد؛ بدون منطق مالی در کلاینت", "احراز شد"],
      ["چرخه کامل مشتری از کاتالوگ تا رسید", "آزمون مرورگری واقعی با ثبت سفارش و پرداخت", "احراز شد"],
      ["پیگیری با خط زمانی و امتیازدهی ۵+۵", "آزمون سرتاسری و مرورگری", "احراز شد"],
      ["پنل مدیریت برای کارشناسی، اعزام و تسویه محرمانه", "آزمون سرتاسری ۱۹ آزمونی", "احراز شد"],
      ["یکپارچگی کاتالوگ رسمی و تخفیف ۵ درصدی", "آزمون کاتالوگ و محاسبه مبلغ سفارش معرف‌دار", "احراز شد"],
      ["صفر نشتی نسبت‌های تسویه در رابط و API عمومی", "جستجوی الگو در کد و پاسخ رندرشده مرورگر", "احراز شد"],
      ["دوزبانگی و تغییر جهت صفحه", "تغییر زبان در مرورگر و بررسی RTL/LTR", "احراز شد"],
      ["چیدمان واکنش‌گرا و بدون سرریز افقی موبایل", "نمای ۳۹۰ پیکسلی و سنجش عرض اسکرول", "احراز شد"],
    ]),
  bodyPara("هر تغییر دامنه از سوی کارفرما صرفاً ردیف‌های جدول ۵ را تغییر می‌دهد و ساختار برنامه ثابت می‌ماند؛ این جدول در پیام ۷ همراه چک‌لیست هشت‌بعدی Production به جدول وضعیت نهایی تحویل تبدیل می‌شود.", { after: 160 }),

  // ── ۸. مفروض‌ها و گام بعدی ──
  h1("۸. مفروض‌های قابل اصلاح و گام بعدی"),
  bodyPara("سه مفروض این پیام با یک جمله از کارفرما قابل اصلاح است. نخست، توضیح دوزبانه خدمات با مدل زبانی تولید و به‌صورت متنی در پایگاه داده ثبت شده و ویرایش هر ردیف از پنل قیمت‌گذاری ادمین ممکن است؛ اگر متن مصوب سازمانی موجود باشد، جایگزین می‌شود. دوم، برای خدمات کارمزد درصدی، برچسب عمومی «تعیین توسط کارشناس» انتخاب شد و درصد کارمزد به‌عنوان راهنما نمایش داده می‌شود؛ اگر ترجیح کارفرما پنهان‌ماندن کامل درصد است، با یک تغییر در کارت خدمت اعمال می‌شود. سوم، چرخه درگاه همچنان شبیه‌سازی‌شده است و نقطه اتصال PSP واقعی (با پذیرندگی شاپرک) آماده جای‌گذاری؛ فعال‌سازی نهایی به اطلاعات پذیرندگی نیاز دارد که خارج از دامنه کد است."),
  tableCaption("جدول ۶ — آنچه به پیام ۷ موکول می‌شود"),
  rtlTable([34, 40, 26],
    ["موضوع", "اقدام در پیام ۷", "مبنا"],
    [
      ["آزمون پذیرش نهایی", "اجرای چک‌لیست هشت‌بعدی Production و انتشار جدول وضعیت احراز", "جدول ۳ پیام ۳"],
      ["تست بار و کارایی", "تست k6 با هدف صدک ۹۵ زیر ۵۰۰ میلی‌ثانیه و ۱۰۰ کاربر هم‌زمان", "جدول ۳ پیام ۳"],
      ["بازبینی امنیتی", "مرور ده ریسک برتر OWASP، HTTPS و سرصفحه‌های امنیتی در محیط استقرار", "جدول ۳ پیام ۳"],
      ["پشتیبان‌گیری و migration نسخه‌دار", "مکانیزم نسخه‌دار تغییر طرح داده و پشتیبان روزانه", "جدول ۸ پیام ۵"],
      ["بسته استقرار Production", "بسته نهایی نصب، پیکربندی محیط و راهنمای بهره‌برداری", "جدول ۵ پیام ۳"],
    ]),
  bodyPara("گام بعدی و پایانی برنامه، پیام ۷ با موضوع «تست، اشکال‌زدایی و تحویل بسته استقرار» است: اجرای کامل چک‌لیست پذیرش Production روی مجموعه فعلی، تست بار، بازبینی امنیتی، مکانیزم پشتیبان‌گیری و تحویل بسته استقرارپذیر همراه سند نهایی. بستر این پیام اکنون آماده است و هیچ کار بازِ مانده‌ای از پیام ۶ وجود ندارد.", { after: 0 }),
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
            children: [faRun("رابط کاربری و یکپارچه‌سازی الو شتاب | پیام ۶", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/پیام-۶-رابط-کاربری-و-یکپارچه‌سازی.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
