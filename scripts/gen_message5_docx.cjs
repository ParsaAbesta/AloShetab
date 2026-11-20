// پیام ۵ — هسته عملکردی: مدل داده و سرویس‌ها (Persian RTL document)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (same as پیام ۳)
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

// Horizontal-only table style, RTL column order (first column = rightmost)
// \n در متن سلول = پاراگراف جدا؛ ep() شکست خط را فقط بعد از / مجاز می‌کند
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

// ─────────────────────────── Cover layout math (Persian-adapted) ───────────────────────────
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
  title: "هسته عملکردی: مدل داده و سرویس‌ها",
  subtitle: "پیام ۵ از ۷ — ماشین حالت سفارش، پرداخت و تخفیف معرف، موتور تسویه محرمانه",
  englishLabel: "FUNCTIONAL CORE",
  metaLines: [
    "شماره سند: پیام ۵ از سری هفت‌پیامی تحویل پروژه الو شتاب",
    "تاریخ تنظیم: ۲۴ آبان ۱۴۰۵ (۱۵ نوامبر ۲۰۲۶)",
    "نسخه کد: 0.5.0-core — بسته تحویلی: alo_shetab_core.zip",
    "وضعیت: تحویل‌شده — ۵۱ آزمون دود موفق، بدون شکست",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "پیام ۵ از ۷",
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
  bodyPara("این سند، پیام پنجم از برنامه هفت‌پیامی تحویل پروژه الو شتاب است و مطابق نقشه راه مصوب پیام ۳، به «پیاده‌سازی هسته عملکردی شامل مدل داده و سرویس‌ها» اختصاص یافته است. در این پیام، فرآیند شش‌مرحله‌ای سفارش‌گیری که در پیام ۴ به‌صورت اسکلت بود، به‌صورت کامل و قابل اجرا پیاده شد: ثبت سفارش، کارشناسی و اعلام برآورد، پرداخت مشتری همراه با اعمال تخفیف کد معرف، اعزام همکار انجام‌دهنده، اعلام رضایت مشتری به‌عنوان گیت تسویه و در نهایت تسویه داخلی سهم‌ها. خروجی این پیام، بسته کد نسخه 0.5.0-core در فایل alo_shetab_core.zip است که هم‌اکنون در پوشه تحویل قرار دارد."),
  bodyPara("دو الزام راهبردی کارفرما در کانون این پیام بوده است. نخست، قاعده تقسیم مبلغ میان سه ذی‌نفع: همکار انجام‌دهنده چهار‌هفتم، معرف مشتری یک‌هفتم و سامانه باقی‌مانده مبلغ؛ این تقسیم در موتور داخلی محاسبه و در پایگاه داده ذخیره می‌شود اما مطابق اصلاحیه کارفرما در هیچ پاسخ عمومی یا صفحه مشتری ظاهر نمی‌شود و مشاهده آن تنها از مسیر لایه مدیریت امکان‌پذیر است. دوم، قاعده نرخ‌گذاری مبتنی بر بازار: نرخ سامانه همیشه یک درصد زیر بالاترین نرخ بازار است که در کاتالوگ ۱۰۴ خدمت بارگذاری‌شده و در سرویس قیمت‌گذاری به‌صورت قانون بازتولید می‌شود."),
  bodyPara("کیفیت تحویل با مجموعه ۵۱ آزمون دود سنجیده شده که چرخه کامل سفارش را از ثبت تا تسویه، در دو سناریوی «با کد معرف» و «بدون کد معرف» به‌اجرا درمی‌آورد، صحت ریاضیات سهم‌ها و توازن حسابداری آن را کنترل می‌کند، چهار گیت سخت فرآیند را می‌آزماید و به‌صورت خودکار تمام پاسخ‌های عمومی را از نظر وجود هر نشانه‌ای از سهم‌ها جارو می‌کند. نتیجه اجرا: ۵۱ آزمون موفق و صفر شکست؛ همچنین تست دود پیام ۴ بدون خطا اجرا شد و سازگاری با اسکلت پیشین تأیید گردید."),

  // ── ۱. دامنه تحویل ──
  h1("۱. دامنه تحویل و تطبیق با نقشه راه"),
  bodyPara("بر پایه جدول ۵ سند پیام ۳، مرز قراردادی پیام ۵ عبارت بود از «مدل داده و migration، سرویس‌های اصلی، سرویس‌های API و احراز هویت» با معیار پذیرش «اجرای سرتاسری سناریوی اصلی کاربر از طریق API». جدول ۱ نشان می‌دهد هر بند از این تعهد در کدام اجزای بسته تحویلی محقق شده است. نکته قابل توجه این است که مدیریت هویت و دسترسی، که در جدول ۲ پیام ۳ اولویت بالا داشت، در این نسخه به دو شکل پیاده شده است: شناسایی مشتری بر پایه شماره موبایل در لحظه ثبت سفارش، و احراز هویت توکنی برای تمام مسیرهای مدیریت؛ مکانیزم کامل ورود با رمز عبور و بازیابی آن مطابق برنامه به پیام ۶ موکول شده است."),
  bodyPara("در این پیام تصمیم گرفته شد لایه سرویس‌های کسب‌وکار به‌صورت مستقل از لایه مسیرها ساخته شود؛ یعنی هیچ منطق مالی در خودِ مسیرها نوشته نشده و همه قواعد در سه ماژول سرویس متمرکز است. این جداسازی، هم آزمون‌پذیری را ممکن کرد و هم برای پیام ۶ مسیر اتصال رابط کاربری را کوتاه می‌کند، زیرا رابط کاربری تنها با همان قراردادهای API کار خواهد کرد.", { after: 80 }),
  tableCaption("جدول ۱: تطبیق تعهدات پیام ۵ با اجزای تحویل‌شده"),
  rtlTable(
    [26, 44, 30],
    ["تعهد پیام ۵ (نقشه راه)", "جزء تحویل‌شده", "محل در بسته کد"],
    [
      ["مدل داده و migration", "هفت موجودیت با کلیدهای خارجی و قید یکتایی؛ ساخت خودکار جدول‌ها", "app/models.py"],
      ["سرویس‌های اصلی", "ماشین حالت سفارش، سرویس قیمت‌گذاری، موتور تسویه", "app/services/"],
      ["سرویس‌های API", "دوازده نقطه پایانی در دو لایه عمومی و مدیریت", "app/routers/"],
      ["احراز هویت", "توکن مدیریت برای تمام مسیرهای ادمین + شناسایی مشتری با موبایل", "app/routers/admin.py"],
      ["معیار پذیرش: اجرای سرتاسری", "تست دود ۵۱ آزمونی چرخه کامل ثبت تا تسویه", "tests/smoke_p5.py"],
    ]
  ),

  // ── ۲. معماری ──
  h1("۲. معماری لایه‌ای و ساختار بسته کد"),
  bodyPara("معماری بسته کد سه‌لایه‌ای است: لایه مسیرها (Router) تنها وظیفه دریافت درخواست، اعتبارسنجی ساختاری و ساخت پاسخ را دارد؛ لایه سرویس‌ها (Service) تمام قواعد کسب‌وکار از جمله گذارهای وضعیت، اعتبارسنجی کد معرف، محاسبه مبالغ و تقسیم سهم‌ها را اجرا می‌کند؛ و لایه مدل‌ها (Model) تنها ساختار داده و روابط را تعریف می‌کند. جهت وابستگی یک‌طرفه است: مسیرها به سرویس‌ها و سرویس‌ها به مدل‌ها وابسته‌اند و هرگز برعکس. این قاعده باعث شد کل منطق مالی در دو فایل متمرکز شود و بازبینی محرمانگی سهم‌ها به بازبینی یک فایل خلاصه گردد."),
  bodyPara("محرمانگی سهم‌ها در سه سد مستقل تثبیت شده است. سد نخست، فهرست سفید فیلدهای عمومی در فایل پیکربندی است که خروجی عمومی سفارش را به هشت فیلد مشخص محدود می‌کند و هر فیلد دیگری به‌سادگی از پاسخ حذف می‌شود. سد دوم، ساختار اسکیماهاست: اسکیمای خروجی عمومی اصلاً فیلدی برای سهم‌ها ندارد و اسکیمای تسویه در لایه مدیریت تعریف شده و در هیچ مسیر عمومی فراخوانی نمی‌شود. سد سوم، آزمون خودکار است: تست دود پیام ۵ تمام پاسخ‌های عمومی را به‌صورت بازگشتی جارو می‌کند و حضور هر کلید یا مقدار حاوی نشانه سهم را شکست تلقی می‌کند. به این ترتیب حتی اگر در آینده فیلدی به مدل داده افزوده شود، این سه سد از نشت آن به نمایش عمومی جلوگیری می‌کنند.", { after: 80 }),
  tableCaption("جدول ۲: اجزای بسته کد و مسئولیت هر جزء"),
  rtlTable(
    [30, 70],
    ["جزء", "مسئولیت"],
    [
      ["app/config.py", "نسبت‌های تسویه، نرخ تخفیف معرف، قانون نرخ بازار و فهرست سفید فیلدهای عمومی"],
      ["app/models.py", "هفت موجودیت: کاربر، دسته خدمت، خدمت، سفارش، رویداد سفارش، پرداخت، تسویه"],
      ["app/services/orders.py", "ماشین حالت سفارش، ثبت رویدادها، اعتبارسنجی و اعمال تخفیف معرف"],
      ["app/services/pricing.py", "قانون نرخ ۹۹٪ بازار، محاسبه تخفیف ۵٪ و مبلغ نهایی پرداختی"],
      ["app/services/settlement.py", "موتور محرمانه تقسیم ۴/۷ و ۱/۷ و باقی‌مانده؛ کنترل توازن حسابداری"],
      ["app/routers/public.py", "ثبت سفارش، پرداخت، اعلام رضایت، خط زمانی — بدون هیچ سهمی"],
      ["app/routers/admin.py", "کارشناسی، اعزام، تسویه و مشاهده سهم‌ها — تنها محل دسترسی به سهم‌ها"],
      ["tests/smoke_p5.py", "۵۱ آزمون: چرخه کامل، ریاضیات سهم‌ها، گیت‌ها، محرمانگی و احراز هویت"],
    ]
  ),

  // ── ۳. مدل داده ──
  h1("۳. مدل داده"),
  bodyPara("مدل داده پیام ۵ بر هفت موجودیت استوار است و نسبت به اسکلت پیام ۴، دو موجودیت و چند فیلد کلیدی تکمیل شده است. تغییر بنیادین، جداسازی کامل «پرداخت» از «سفارش» است: هر سفارش می‌تواند چند رکورد پرداخت داشته باشد (مثلاً یک پرداخت ناموفق کارت‌به‌کارت و سپس یک پرداخت موفق درگاه) و وضعیت سفارش تنها با موفق‌شدن پرداخت تغییر می‌کند. تغییر دوم، تکمیل جدول تسویه است که علاوه بر سه سهم، مبنای تسویه و عکس نسبت‌های لحظه تسویه را نیز ثبت می‌کند تا اگر در آینده نسبت‌ها اصلاح شود، تسویه‌های گذشته با اعداد روز ثبت‌شده خود باقی بمانند و امکان حسابرسی دوره‌ای فراهم شود."),
  bodyPara("نکته طراحی مهم آن است که جدول پرداخت آگاهانه هیچ فیلدی برای سهم‌ها ندارد و جدول تسویه نیز تنها با فراخوانی صریح مسیر مدیریت قابل مشاهده است؛ یعنی داده محرمانه در لایه داده تفکیک فیزیکی دارد، نه صرفاً تفکیک نمایشی. شناسه همکار انجام‌دهنده روی سفارش ثبت می‌شود تا در تسویه مشخص باشد واریز چهار‌هفتم به نفع کدام همکار محاسبه شده است.", { after: 80 }),
  tableCaption("جدول ۳: موجودیت‌های مدل داده و نقش آن‌ها"),
  rtlTable(
    [22, 48, 30],
    ["موجودیت", "نقش و فیلدهای کلیدی", "وضعیت در پیام ۵"],
    [
      ["کاربر (User)", "مشتری یا همکار یا مدیر؛ کد معرف یکتا برای هر کاربر؛ ارجاع‌دهنده سفارش", "تکمیل شد (نقش همکار)"],
      ["دسته و خدمت (Service)", "۲۰ دسته و ۱۰۴ خدمت با نرخ الو شتاب و نرخ مرجع بازار", "از پیام ۴ — بدون تغییر"],
      ["سفارش (Order)", "کد یکتا، وضعیت، برآورد، تخفیف، پرداختی نهایی، کد معرف، شناسه همکار", "تکمیل شد (شناسه همکار)"],
      ["رویداد سفارش (OrderEvent)", "خط زمانی شش مرحله با یادداشت ثابت فارسی؛ مبنای پیگیری مشتری", "از پیام ۴ — بدون تغییر"],
      ["پرداخت (Payment)", "روش (درگاه یا کارت‌به‌کارت)، وضعیت، مبلغ، شماره پیگیری؛ بدون هیچ سهمی", "جدید در پیام ۵"],
      ["تسویه (Settlement)", "سه سهم + مبنای تسویه + عکس نسبت‌ها + گیت رضایت؛ فقط لایه مدیریت", "تکمیل شد (سه سهم)"],
    ]
  ),

  // ── ۴. ماشین حالت ──
  h1("۴. ماشین حالت سفارش و گیت‌های سخت"),
  bodyPara("قلب هسته عملکردی، ماشین حالت سفارش است که وضعیت را در هفت گام از «ثبت‌شده» تا «تسویه‌شده» پیش می‌برد و در هر گام، گذارهای غیرمجاز را با پاسخ ۴۰۹ رد می‌کند. چهار گیت سخت در این ماشین تعبیه شده است: پرداخت تنها پس از اعلام برآورد پذیرفته می‌شود؛ اعزام همکار تنها پس از پرداخت موفق مشتری مجاز است؛ اعلام رضایت تنها پس از اعزام امکان‌پذیر است؛ و تسویه تنها پس از رضایت مشتری و فقط برای یک‌بار انجام می‌شود. این گیت‌ها همان توالی اجباری شش‌مرحله‌ای مصوب کارفرما هستند و آزمون‌های خودکار، رد شدن هر ترتیب نادرست را تأیید کرده‌اند."),
  bodyPara("هر گذار در جدول رویداد سفارش با شماره مرحله، وضعیت مقصد و یادداشت ثابت فارسی ثبت می‌شود؛ بنابراین خط زمانی هر سفارش برای مشتری (در پیام ۶) و برای پشتیبانی داخلی، از یک منبع واحد ساخته می‌شود. مسیر عمومی خط زمانی نیز از فهرست سفید پیروی می‌کند و صرفاً مراحل فرآیندی را نشان می‌دهد.", { after: 80 }),
  tableCaption("جدول ۴: مراحل شش‌گانه، نقطه پایانی و گیت ورود — همه نقاط پایانی با روش POST فراخوانی می‌شوند"),
  rtlTable(
    [8, 22, 42, 28],
    ["مرحله", "رخداد", "نقطه پایانی", "گیت ورود"],
    [
      ["۱", "ثبت سفارش", ep("/api/v1/orders"), "—"],
      ["۲", "کارشناسی و اعلام برآورد", ep("/api/v1/admin/orders/{code}/survey") + "\n" + ep("/api/v1/admin/orders/{code}/estimate"), "توکن مدیریت"],
      ["۳", "پرداخت مشتری", ep("/api/v1/orders/{code}/pay"), "برآورد اعلام‌شده"],
      ["۴", "اعزام همکار", ep("/api/v1/admin/orders/{code}/dispatch"), "پرداخت موفق + تعیین همکار"],
      ["۵", "اعلام رضایت مشتری", ep("/api/v1/orders/{code}/satisfaction"), "اعزام‌شده"],
      ["۶", "تسویه داخلی سهم‌ها", ep("/api/v1/admin/orders/{code}/settle"), "رضایت مشتری + عدم تسویه قبلی"],
    ]
  ),

  // ── ۵. پرداخت و تخفیف معرف ──
  h1("۵. سرویس پرداخت و تخفیف کد معرف"),
  bodyPara("سرویس پرداخت دو روش را پشتیبانی می‌کند که رفتار آن‌ها عمداً متفاوت است. پرداخت از طریق درگاه بلافاصله موفق تلقی می‌شود، سفارش را به وضعیت «پرداخت‌شده» می‌برد و رسید پرداخت برمی‌گرداند. پرداخت کارت‌به‌کارت اما با وضعیت «در انتظار تأیید مدیریت» ثبت می‌شود و تا مدیر با فراخوانی نقطه پایانی تأیید، آن را موفق اعلام نکند، سفارش پیش نمی‌رود؛ این رفتار با واقعیت عملیاتی انتقال بانکی هماهنگ است و از اعزام همکار پیش از وصول واقعی مبلغ جلوگیری می‌کند. اعتبارسنجی کد معرف نیز در همین مرحله و با سه قاعده انجام می‌شود که در جدول ۵ آمده است."),
  bodyPara("تخفیف معرف به مبلغ برآورد اعمال می‌شود و پرداختی نهایی، مبنای تمام محاسبات بعدی از جمله تسویه است. اگر کد معرف ارائه نشود، پرداختی نهایی برابر مبلغ برآورد ثبت می‌گردد و در تسویه، سهم معرف صفر و سهم سامانه سه‌هفتم خواهد شد. ارائه کد نامعتبر، کد خودِ مشتری یا کد تکراری برای سفارش، به‌جای نادیده‌گرفتن، با پیام خطای صریح رد می‌شود؛ این تصمیم از سوءبرداشت مشتری و سوءاستفاده از کدها جلوگیری می‌کند.", { after: 80 }),
  tableCaption("جدول ۵: قواعد اعمال تخفیف کد معرف"),
  rtlTable(
    [30, 40, 30],
    ["قاعده", "شرح", "رفتار سامانه"],
    [
      ["اعتبار کد", "کد باید متعلق به کاربر موجود باشد", "کد نامعتبر: رد با پیام صریح (۴۰۰)"],
      ["عدم خودارجاعی", "استفاده از کد معرفِ خود مشتری مجاز نیست", "رد با پیام صریح (۴۰۰)"],
      ["یکتایی اعمال", "هر سفارش فقط یک‌بار تخفیف می‌پذیرد", "اعمال مجدد: رد (۴۰۰)"],
      ["مبلغ تخفیف", "۵٪ مبلغ برآورد، گردشده به تومان", "مثال: برآورد ۲٬۵۰۰٬۰۰۰ ← تخفیف ۱۲۵٬۰۰۰"],
    ]
  ),

  // ── ۶. موتور تسویه ──
  h1("۶. موتور تسویه محرمانه (مرحله ۶)"),
  bodyPara("موتور تسویه، الزام محرمانگی کارفرما را با طراحی «محاسبه و ذخیره، بدون نمایش» پیاده می‌کند. مبنای تسویه، مبلغ پرداختی واقعی مشتری پس از تخفیف معرف است؛ سپس چهار‌هفتم آن به سهم همکار انجام‌دهنده و یک‌هفتم آن به سهم معرف اختصاص می‌یابد و سهم سامانه به‌صورت باقی‌ماندهٔ دقیق محاسبه می‌شود. قاعده گرد کردن به این صورت است که سهم مجری و معرف با گرد کردن نیم‌به‌بالا به تومان محاسبه می‌شوند و سهم سامانه از کسر آن دو از مبلغ کل به‌دست می‌آید؛ به این ترتیب مجموع سه سهم همیشه دقیقاً برابر مبلغ پرداختی است و هیچ مبلغی میان سهم‌ها گم یا دوبرابر نمی‌شود. در سفارش بدون معرف، سهم معرف صفر ثبت می‌شود و سهم سامانه سه‌هفتم خواهد بود."),
  bodyPara("لحظه تسویه، نسبت‌های به‌کاررفته در ستونی جداگانه ذخیره می‌شود تا هر تغییر آینده در نسبت‌ها اثر برگشتی روی تسویه‌های گذشته نداشته باشد و حسابرسی دوره‌ای ممکن باشد. پیش از ثبت هر تسویه، یک کنترل حسابداری خودکار توازن سه سهم را با مبلغ پرداختی می‌سنجد و در صورت عدم توازن، کل عملیات متوقف می‌شود. مطابق اصلاحیه کارفرما، تمام این داده‌ها فقط از دو مسیر لایه مدیریت قابل مشاهده‌اند: ثبت تسویه و مشاهده تسویه؛ هر دو با توکن مدیریت محافظت می‌شوند و آزمون خودکار، نبود این مسیرها در لایه عمومی و پاک بودن تمام پاسخ‌های عمومی از هر نشانه سهم را به‌طور مستمر تأیید می‌کند.", { after: 80 }),
  tableCaption("جدول ۶: مثال عددی کامل تسویه — سفارش با کد معرف (برآورد ۲٬۵۰۰٬۰۰۰ تومان)"),
  rtlTable(
    [40, 30, 30],
    ["قلم", "محاسبه", "مبلغ (تومان)"],
    [
      ["مبلغ برآورد کارشناس", "—", "۲٬۵۰۰٬۰۰۰"],
      ["تخفیف کد معرف (۵٪)", "۲٬۵۰۰٬۰۰۰ × ۵٪", "۱۲۵٬۰۰۰"],
      ["مبنای تسویه (پرداختی مشتری)", "۲٬۵۰۰٬۰۰۰ − ۱۲۵٬۰۰۰", "۲٬۳۷۵٬۰۰۰"],
      ["سهم همکار انجام‌دهنده (۴/۷)", "۲٬۳۷۵٬۰۰۰ × ۴ ÷ ۷", "۱٬۳۵۷٬۱۴۳"],
      ["سهم معرف مشتری (۱/۷)", "۲٬۳۷۵٬۰۰۰ × ۱ ÷ ۷", "۳۳۹٬۲۸۶"],
      ["سهم سامانه (باقی‌مانده = ۲/۷)", "۲٬۳۷۵٬۰۰۰ − دو سهم", "۶۷۸٬۵۷۱"],
      ["کنترل توازن", "جمع سه سهم", "۲٬۳۷۵٬۰۰۰ (دقیقاً برابر پرداختی)"],
    ]
  ),
  bodyPara("همان مثال برای سفارش بدون معرف با پرداختی یک‌میلیون تومانی چنین است: سهم مجری ۵۷۱٬۴۲۹ و سهم سامانه ۴۲۸٬۵۷۱ تومان و سهم معرف صفر. آزمون‌های دود، هر دو سناریو را با چهار مبلغ مختلف (شامل مبالغ غیرمضرب هفت مانند ۹۹۹٬۹۹۹ تومان) اجرا کرده‌اند و توازن دقیق در همه موارد برقرار است."),

  // ── ۷. پوشش آزمون ──
  h1("۷. پوشش آزمون و نتایج اجرا"),
  bodyPara("مجموعه آزمون پیام ۵ در فایل tests/smoke_p5.py با ۵۱ آزمون خودکار سامان یافته است و شش گروه پوششی را در بر می‌گیرد. نکته برجسته نتایج، دو آزمون محرمانگی است: جاروی بازگشتی تمام پاسخ‌های عمومی برای هر نشانه سهم (کلید یا مقدار) که پاک بودن کامل را نشان داد، و تطبیق دقیق فیلدهای خروجی عمومی با فهرست سفید هشت‌تایی. تست دود پیام ۴ نیز پس از تغییرات، دوباره اجرا شد و بدون خطا گذشت؛ تنها تفاوت رفتاری، رد شدن اعزام بدون تعیین همکار است که طبق گیت‌های جدید فرآیند، صحیح و مورد انتظار است.", { after: 80 }),
  tableCaption("جدول ۷: گروه‌های آزمون و نتیجه اجرا (۲۴ آبان ۱۴۰۵)"),
  rtlTable(
    [34, 14, 52],
    ["گروه آزمون", "تعداد", "پوشش"],
    [
      ["سلامت و کاتالوگ", "۲", "نسخه هسته و صحت بارگذاری ۲۰ دسته و ۱۰۴ خدمت"],
      ["قانون نرخ و تخفیف", "۴", "نرخ ۹۹٪ بازار، محاسبه تخفیف ۵٪ و مبلغ نهایی"],
      ["ریاضیات موتور تسویه", "۷", "توازن حسابداری روی چهار مبلغ شامل غیرمضرب هفت"],
      ["چرخه کامل با کد معرف", "۲۷", "شش مرحله، چهار گیت سخت، سه سهم، عکس نسبت‌ها"],
      ["چرخه بدون معرف و کارت‌به‌کارت", "۷", "تأیید ادمین، سهم معرف صفر، سهم سامانه ۳/۷"],
      ["محرمانگی و احراز هویت", "۴", "جاروی نشانه سهم، سفیدلیست، نبود مسیر تسویه عمومی، توکن"],
      ["جمع کل", "۵۱", "همه موفق — صفر شکست"],
    ]
  ),

  // ── ۸. تغییرات ناسازگار ──
  h1("۸. تغییرهای رفتاری نسبت به اسکلت پیام ۴"),
  bodyPara("پیاده‌سازی هسته، چهار تغییر رفتاری آگاهانه نسبت به اسکلت پیام ۴ ایجاد کرده است که برای پیگیری کارفرما و تیم توسعه شفاف ثبت می‌شود. نخست، اعزام همکار دیگر از وضعیت «برآورد اعلام‌شده» انجام نمی‌شود و گیت «پرداخت موفق مشتری» روی آن حاکم است؛ همچنین تعیین شناسه همکار انجام‌دهنده در همان فراخوانی الزامی شد. دوم، اعلام برآورد پس از پرداخت مشتری مسدود شد تا مبلغ مبنا پس از پرداخت تغییر نکند. سوم، ساختار جدول تسویه از دو فیلد به شش فیلد گسترش یافت و نام سهم مجری به شکل یکدست به executor_share تغییر کرد. چهارم، جدول پرداخت جدید است و به همین دلیل پایگاه داده از نو ساخته و کاتالوگ مجدداً بارگذاری شد؛ در محیط عملیاتی پیام ۷، این تغییر با مکانیزم migration نسخه‌دار اعمال خواهد شد، نه بازسازی کامل."),

  // ── ۹. معیارهای پذیرش ──
  h1("۹. معیارهای پذیرش پیام ۵ و وضعیت احراز"),
  bodyPara("بر پایه چک‌لیست هشت‌بعدی آمادگی Production در پیام ۳، سه بُعد به پیام ۵ یا پیام‌های مشترک ۵ و ۷ مرتبط‌اند: «داده و پایگاه داده»، «امنیت» و بخشی از «کد و نسخه‌بندی». جدول ۸ وضعیت احراز هر معیار را در لحظه تحویل نشان می‌دهد. دو ردیف هنوز کامل نشده‌اند: مکانیزم migration نسخه‌دار و پشتیبان‌گیری روزانه در بستر استقرار پیام ۷ تکمیل می‌شود و احراز نهایی امنیت (از جمله HTTPS) نیز به محیط استقرار وابسته است؛ با این حال پایه فنی هر دو در همین پیام گذاشته شده است.", { after: 80 }),
  tableCaption("جدول ۸: وضعیت معیارهای پذیرش مرتبط با پیام ۵"),
  rtlTable(
    [30, 50, 20],
    ["معیار", "شواهد احراز", "وضعیت"],
    [
      ["اجرای سرتاسری سناریوی اصلی", "تست دود ۵۱ آزمونی: ثبت تا تسویه در دو سناریو", "احراز شد"],
      ["صحت تقسیم سهم‌ها", "توازن دقیق روی مبالغ متعدد + عکس نسبت‌ها", "احراز شد"],
      ["محرمانگی سهم‌ها در نمایش عمومی", "سد سه‌لایه + جاروی خودکار پاسخ‌های عمومی", "احراز شد"],
      ["گیت‌های فرآیند شش‌مرحله‌ای", "رد شدن هر چهار ترتیب نادرست با ۴۰۹", "احراز شد"],
      ["احراز هویت مسیرهای مدیریت", "۴۰۱ بدون توکن روی تمام مسیرهای ادمین", "احراز شد"],
      ["migration نسخه‌دار و پشتیبان‌گیری", "بازسازی دستی در پیام ۵؛ مکانیزم نسخه‌دار در پیام ۷", "در پیام ۷"],
      ["HTTPS و امنیت محیط استقرار", "وابسته به محیط عملیاتی", "در پیام ۷"],
    ]
  ),

  // ── ۱۰. مفروضات و گام بعدی ──
  h1("۱۰. مفروض‌های قابل اصلاح و گام بعدی"),
  bodyPara("برای آنکه جریان کار متوقف نشود، سه تصمیم پیش‌فرض در این پیام گرفته شده که هر سه با یک جمله از سوی کارفرما قابل اصلاح‌اند و محل تغییر آن‌ها به یک خط کد در فایل پیکربندی خلاصه می‌شود. نخست، مبنای تسویه «مبلغ پرداختی مشتری پس از تخفیف معرف» انتخاب شد، نه مبلغ برآورد پیش از تخفیف؛ با این انتخاب، هزینه تخفیف میان سه ذی‌نفع به تناسب سهم‌ها تقسیم می‌شود. دوم، در سفارش بدون معرف، سهم سامانه سه‌هفتم در نظر گرفته شد؛ یعنی سهم معرف به هیچ ذی‌نفع دیگری منتقل نمی‌شود و فقط کسر می‌گردد، اگرچه در عمل چنین سفارشی سهم معرف هم نخواهد داشت. سوم، پرداخت درگاه در همین نسخه به‌صورت شبیه‌سازی‌شده موفق می‌شود و اتصال به درگاه بانکی واقعی (زرین‌پال یا مشابه) در پیام ۶ انجام خواهد شد.", { after: 80 }),
  tableCaption("جدول ۹: مفروض‌های انتخابی پیام ۵ و مسیر اصلاح"),
  rtlTable(
    [26, 44, 30],
    ["موضوع", "پیش‌فرض فعلی", "اثر اصلاح کارفرما"],
    [
      ["مبنای تسویه", "مبلغ پرداختی پس از تخفیف معرف", "تغییر یک خط در موتور تسویه"],
      ["سامانه در نبود معرف", "باقی‌مانده = ۳/۷ مبلغ", "تغییر قاعده باقی‌مانده در موتور"],
      ["درگاه پرداخت", "شبیه‌سازی‌شده (تأیید خودکار)", "اتصال واقعی درگاه در پیام ۶"],
    ]
  ),
  bodyPara("گام بعدی برنامه، پیام ۶ با موضوع «رابط کاربری و یکپارچه‌سازی» است: صفحات فارسی راست‌به‌چپ برای مشتری (کاتالوگ، ثبت سفارش، پرداخت و پیگیری با خط زمانی)، پنل مدیریت برای کارشناسی، اعزام، تسویه محرمانه و گزارش‌ها، اتصال درگاه بانکی واقعی و صفحه دانلود با کد QR برنامه. تمام قراردادهای API مورد نیاز رابط کاربری در همین پیام تثبیت شده‌اند و پیام ۶ صرفاً روی همین قراردادها خواهد نشست؛ تست دود ۵۱ آزمونی نیز به‌عنوان شبکه ایمنی رگرسیون در تمام پیام‌های بعدی حفظ می‌شود.", { after: 0 }),
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
            children: [faRun("هسته عملکردی الو شتاب | پیام ۵", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/پیام-۵-هسته-عملکردی.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
