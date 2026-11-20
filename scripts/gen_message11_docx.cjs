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
  title: "میز کالای واقعی، موتور قیمت انباری و پنل مدیریتی هوشمند",
  subtitle: "پیام ۱۱ — دو بخش نرم‌افزار/کالا، قیمت +۳۳٪ و +۱۵٪، انبارها، مراحل فاکتور، حسابدار هوشمند و دو دسترسی مالک/ادمین",
  englishLabel: "REAL INVENTORY, PRICING ENGINE & SMART ADMIN",
  metaLines: [
    "شماره سند: پیام ۱۱ — پس از پیام ۱۰ (استقرار و نسخهٔ ۲٫۰)",
    "تاریخ تنظیم: ۲۶ آبان ۱۴۰۵ (۱۷ نوامبر ۲۰۲۶)",
    "دستاورد کلیدی: ۲۸ کالای واقعی با قیمت پژوهش‌شدهٔ بازار + ۸ نرم‌افزار + ۹ انبار/مرجع",
    "وضعیت: همهٔ جریان‌ها در پیش‌نمایش زنده آزمون و تأیید شد؛ بستهٔ v2.1.0 آماده است",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "پیام ۱۱ — میز کالا و پنل مدیریتی",
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
  bodyPara("این سند، پیام یازدهم پروژه الو شتاب است و بیست‌ودو درخواست کارفرما را در یک بستهٔ عملیاتی پیاده می‌کند. میز محصولات به دو بخش مستقل «نرم‌افزار» و «کالا» تقسیم شد؛ میز کالا با ۲۸ قلم موجودی واقعی پر شد که قیمت پایهٔ هر قلم، پائین‌ترین قیمت بروز مراجع واقعی بازار در روزهای ۲۴ تا ۲۶ آبان ۱۴۰۵ است (ایمالز، دیجی‌کالا، فرالند، دلگرم، گجت‌نیوز، ترب و تراست مارکت‌پلیس) و روی آن قواعد قیمت‌گذاری مالک اعمال شده است: قیمت هر کالا +۳۳٪ قیمت انبار؛ و اگر قیمت ثبت‌شدهٔ سایت مرجع بالاتر از محاسبهٔ +۳۳٪ باشد، قیمت با +۱۵٪ نسبت به موجودی انبار همان سایت‌ها لحاظ می‌شود. یخچال، لباسشویی، تلویزیون، کولر و بخاری — دقیقاً طبق فهرست درخواستی — همراه لپ‌تاپ، مانیتور و ماوس در موجودی است."),
  bodyPara("هر سفارش خرید کالا اکنون با «سفارش خدمات» (نصب، راه‌اندازی، آموزش و...) در همان فرم همراه است؛ آدرس دقیق مشتری با پلاک، طبقه و واحد الزامی و کدپستی اختیاری ثبت می‌شود؛ بازهٔ رسیدگی کالا ۳ تا ۷ روز و هماهنگی خدمات ۱ تا ۳ روز با تأیید ساعت و زمان مشتری است. دریافتی‌های بالای ۵ میلیون تومان به‌طور خودکار به شبای حساب دریافت (IR430170000000345884841004 — بانک ملت) هدایت می‌شوند. صحت هر سه شمارهٔ مالی کارفرما با الگوریتم‌های استاندارد بررسی شد: شبای بانک ملت با رقم کنترل mod-97 صحیح است و هر دو شماره کارت (ملی ۶۰۳۷… برای مبالغ تقسیم‌بندی و مهر ایران ۶۰۶۳… برای سهم شرکت) از الگوریتم Luhn سالم می‌گذرند."),
  bodyPara("پنل ادمین به یک اپلیکیشن مدیریتی امن با هوش مصنوعی و دو سطح دسترسی «مالک» و «ادمین» ارتقا یافت: تب‌های جدید موجودی میز کالا، انبارها و مراجع، گزارش روزانهٔ قیمت، پیشنهادهای قیمت، مراحل فاکتور، هماهنگی‌ها و اتوماسیون، حسابدار هوشمند و دستیار هوشمند. حسابدار هوشمند هر شب گزارش حسابرسی را به ایمیل و پنل مالک و ادمین می‌فرستد و در صورت مشاهدهٔ خطا (ضرر و زیان) عملیات را تا فرمان ادامه متوقف می‌کند — مالک همیشه و ادمین فقط پس از مهلت ۳ ساعت مجاز به رفع توقف‌اند. تلفن پشتیبانی همچنان فقط در فوتر سایت است و قاعدهٔ محرمانگی سهم‌بندی تسویه مطلق باقی است."),

  // ── ۱. میز محصولات دو بخشی ──
  h1("۱. میز محصولات دو بخشی: نرم‌افزار و کالا"),
  bodyPara("صفحهٔ میز محصولات اکنون دو تب مستقل دارد: «میز کالا» با ۲۸ قلم و «نرم‌افزار» با ۸ قلم. بخش نرم‌افزار شامل ویندوز اورجینال با نصب و فعال‌سازی، آفیس ۲۰۲۱، آنتی‌ویروس یک‌ساله، راه‌اندازی نرم‌افزار حسابداری، ویندوز سرور و شبکه اداری، لینوکس، بستهٔ اداری و مجموعهٔ طراحی است. بخش کالا در چهار گروه سازمان یافته است: کامپیوتر (لپ‌تاپ، مانیتور، ماوس)، لوازم خانگی (یخچال، لباسشویی، تلویزیون)، سرمایش و گرمایش (کولر گازی، بخاری) و تجهیزات تکمیلی (دوربین مداربسته، شبکه، UPS، هوشمندسازی). هر کارت کالا علاوه بر قیمت نهایی، مرجع قیمت، تاریخ تقویمی قیمت، قاعدهٔ اعمال‌شده و موجودی را نشان می‌دهد."),
  tableCaption("جدول ۱ — نمونهٔ موجودی واقعی میز کالا (قیمت پایه = پائین‌ترین قیمت بروز مراجع، ۱۴۰۵/۰۸/۲۴ تا ۲۶)"),
  rtlTable([30, 20, 18, 14, 18],
    ["کالا", "مرجع قیمت", "قیمت پایه (تومان)", "قاعده", "قیمت فروش"],
    [
      ["لپ‌تاپ لنوو V15 G4 — i5-13420H/16GB/512GB", "ایمالز ۱۴۰۵/۰۸/۱۱", "۱۵۷٬۰۰۰٬۰۰۰", "انبار +۳۳٪", "۲۰۸٬۸۱۰٬۰۰۰"],
      ["یخچال‌فریزر تکسان RFN-24 (۲۷ فوت)", "گجت‌نیوز ۱۴۰۵/۰۸/۲۰", "۸۸٬۰۰۰٬۰۰۰", "انبار +۳۳٪", "۱۱۷٬۰۴۰٬۰۰۰"],
      ["لباسشویی ال‌جی Y1 — ۷ کیلویی", "فرالند ۱۴۰۵/۰۸/۲۵", "۱۲۱٬۹۵۰٬۰۰۰", "انبار +۳۳٪", "۱۶۲٬۱۹۴٬۰۰۰"],
      ["تلویزیون سامسونگ DU8000 — ۵۵ اینچ", "فرالند ۱۴۰۵/۰۸/۲۵", "۱۰۲٬۹۹۰٬۰۰۰", "انبار +۳۳٪", "۱۳۶٬۹۷۷٬۰۰۰"],
      ["کولر گازی اسپلیت تراست ۱۲۰۰۰ گرید A", "تراست؛ مرجع بازار: داماپا", "۵۵٬۰۰۰٬۰۰۰ (۷۵٬۰۰۰٬۰۰۰)", "سایت +۱۵٪", "۸۶٬۲۵۰٬۰۰۰"],
      ["بخاری گازی آبسال 437", "دلگرم ۱۴۰۵/۰۸/۲۵", "۱۱٬۰۰۰٬۰۰۰", "انبار +۳۳٪", "۱۴٬۶۳۰٬۰۰۰"],
      ["مانیتور تویستد مایندز TM24FHD ۲۴ اینچ", "دلگرم/ترب ۱۴۰۵/۰۸/۲۴", "۱۹٬۴۹۹٬۰۰۰", "انبار +۳۳٪", "۲۵٬۹۳۴٬۰۰۰"],
      ["ماوس بی‌سیم کیو Q5", "دیجی‌کالا ۱۴۰۵/۰۸/۲۶", "۱٬۳۱۲٬۰۰۰", "انبار +۳۳٪", "۱٬۷۴۵٬۰۰۰"],
    ]),
  bodyPara("قاعدهٔ «سایت +۱۵٪» در عمل: برای کولر گازی تراست، کف بازهٔ بازار سایتهای مرجع (۷۵ میلیون تومان در داماپا) بالاتر از محاسبهٔ +۳۳٪ (۷۳٫۱۵ میلیون) بود؛ بنابراین طبق دستور مالک، قیمت با +۱۵٪ نسبت به همان مرجع محاسبه شد و ۸۶٬۲۵۰٬۰۰۰ تومان ثبت گشت. این نشان می‌دهد موتور قیمت‌گذاری هر دو قاعده را به‌درستی و به‌طور خودکار اجرا می‌کند. اقلام بدون استعلام انبار روز (تجهیزات شبکه و مداربسته) با برچسب «نیاز به استعلام روز انبار» نگهداری می‌شوند و ادمین می‌تواند هر لحظه قیمت پایه و مرجع را بروزرسانی کند.", { after: 160 }),

  // ── ۲. انبارها ──
  h1("۲. انبارها و مراجع قیمت در پنل ادمین"),
  bodyPara("مطابق دستور «قصد موجود کردن هر کالایی را داشتی، از فعال بودن مجموعهٔ آنها و بروز بودن لیست قیمت آنها کاملاً مطمئن شو و راه‌های ارتباطی و آدرس محل و آدرس سایت آنها را به پنل ادمین ارسال کن»، نه مرجع واقعی بازار در تب «انبارها و مراجع» پنل ثبت شد — با تلفن تماس، آدرس دقیق، وب‌سایت، قالب لینک کالا، وضعیت فعال بودن و وضعیت بروز بودن لیست قیمت. هر انبار پیش از استفاده باید با دکمهٔ «تأیید فعال بودن» توسط ادمین احراز شود و در صورت کهنه شدن قیمت‌ها، نشان «قیمت‌ها بروز نیست» فعال می‌گردد."),
  tableCaption("جدول ۲ — انبارها و مراجع ثبت‌شده (اطلاعات عمومی تأییدشده)"),
  rtlTable([26, 22, 22, 30],
    ["مجموعه", "نوع", "تلفن", "آدرس / سایت"],
    [
      ["کامپیوتر افق", "کامپیوتر", "۰۲۱-۵۷۸۵۳۰۰۰", "تهران، ولی‌عصر، طالقانی، برادران مظفر، پلاک ۱۰۰ — iranfso.com"],
      ["افق سیستم", "کامپیوتر/تعمیر", "۰۲۱-۶۶۴۵۱۵۸۹", "تهران، ولی‌عصر، بعد از تقاطع طالقانی — ofoghsystem.com"],
      ["دیجی‌کالا", "بازارگاه", "۰۲۱-۹۱۰۰۰۱۰۰", "تهران، ونک، خدامی، کوچه شادی ۱، ونک پلازا، پلاک ۳۱ — digikala.com"],
      ["اسنپ", "بازارگاه/پیک", "اپلیکیشن", "snapp.ir"],
      ["آچاره", "خدمات", "سایت", "achareh.com — مرجع مقایسهٔ خدمات"],
      ["ترب / ایمالز", "مقایسه قیمت", "—", "torob.com / emalls.ir"],
      ["فرالند", "لوازم خانگی", "سایت", "afralland.com — لیست قیمت روز (آبان ۱۴۰۵)"],
      ["تراست مارکت‌پلیس", "لوازم خانگی", "سایت", "trustmarketplace.ir — کولر گازی"],
    ]),

  // ── ۳. سفارش خرید + خدمات ──
  h1("۳. سفارش خرید کالا + سفارش خدمات + آدرس دقیق و بازهٔ زمانی"),
  bodyPara("فرم سفارش کالا اکنون سه جزء الزامی جدید دارد. نخست «آدرس دقیق»: کنار آدرس متنی، سه فیلد پلاک، طبقه و واحد اجباری است و کدپستی اختیاری ولی ترجیحی است — مطابق دستور «حتماً آدرس دقیق (بهمراه پلاک، طبقه، واحد) مشتری ثبت شود». دوم «سفارش خدمات کنار خرید»: چهار خدمت تکمیلی (نصب و راه‌اندازی در محل، راه‌اندازی و تنظیمات نرم‌افزاری، آموزش استفاده، حمل تا طبقه و نصب نهایی) با تیک و قیمت مستقل، در همان فرم و در همان سفارش ثبت و در پنل ادمین تفکیک می‌شود. سوم «بازهٔ زمانی»: رسیدگی به امور کالا بین ۳ تا ۷ روز و هماهنگی خدمات بین ۱ تا ۳ روز با تأیید ساعت و زمان مشتری است؛ هر دو در رسید سفارش و پنل ادمین درج می‌شود."),
  bodyPara("دریافتی‌های بالای ۵ میلیون تومان به‌طور خودکار به مسیر شبا/پل هدایت می‌شوند: پس از ثبت، شبای بانک ملت با دکمهٔ کپی نمایش داده می‌شود و سفارش با نشان «دریافت با شبا/پل» به پنل ادمین می‌رود. آستانه در تنظیمات پنل قابل تغییر است و شماره کارت حساب دریافت (در صورت تکمیل ادمین) نیز کنار شبا نمایش داده می‌شود.", { after: 160 }),

  // ── ۴. حساب‌ها ──
  h1("۴. بررسی دقیق شبا و پل — هر سه شماره صحیح است"),
  bodyPara("طبق دستور «شماره شبا و پل هر دو حساب را با دقت بررسی، و در صورت نیاز اطلاع بده و اصلاح کن»، هر سه شماره با الگوریتم‌های رسمی بانکی در کد آزموده شد. شبای دریافت IR430170000000345884841004 دقیقاً ۲۶ کاراکتر است، رقم کنترل با محاسبهٔ mod-97 روی اعداد واقعی «۱» برابر می‌شود و کد بانک ۰۱۷ (بانک ملت) است. شماره کارت ۶۰۳۷۹۹۸۱۴۰۹۷۴۵۵۰ (بانک ملی — حساب مبالغ تصمیم‌گیری و تقسیم‌بندی: حق معرفی، مبلغ خرید کالا و دستمزد کارشناس) و شماره کارت ۶۰۶۳۷۳۱۱۲۱۴۶۸۶۲۴ (بانک قرض‌الحسنه مهر ایران — حساب سهم شرکت) هر دو از الگوریتم Luhn با مجموع کنترل ۸۰ و ۶۰ سالم عبور می‌کنند؛ بنابراین هیچ اصلاحی لازم نیست."),
  tableCaption("جدول ۳ — نتیجهٔ بررسی شماره‌های مالی"),
  rtlTable([34, 22, 22, 22],
    ["شماره", "بانک", "الگوریتم بررسی", "نتیجه"],
    [
      ["IR430170000000345884841004 (شبای دریافت)", "ملت (کد ۰۱۷)", "mod-97 = ۱", "صحیح — بدون اصلاح"],
      ["6037998140974550 (تقسیم‌بندی)", "ملی ایران", "Luhn = ۸۰", "صحیح — بدون اصلاح"],
      ["6063731121468624 (سهم شرکت)", "مهر ایران", "Luhn = ۶۰", "صحیح — بدون اصلاح"],
    ]),
  bodyPara("نکتهٔ محرمانگی: شبا و کارت حساب دریافت (موجه به مشتری) فقط در صفحهٔ پرداخت سفارش‌های بالای آستانه و در تنظیمات پنل نمایش داده می‌شود؛ دو کارت تقسیم‌بندی و سهم شرکت کاملاً داخلی‌اند، از هر پاسخ عمومی API حذف‌اند و فقط مالک می‌تواند آن‌ها را در پنل ویرایش کند. شمارهٔ کارت حساب دریافت فعلاً خالی است؛ اگر کارت بانک ملت همان حساب را دارید، در تنظیمات مالک وارد کنید تا کنار شبا نمایش داده شود (اعتبارسنجی Luhn خودکار است).", { after: 160 }),

  // ── ۵. مراحل فاکتور ──
  h1("۵. مسیر مراحل فاکتور — ثبت اجباری ادمین"),
  bodyPara("تب «مراحل فاکتور»، هر دو نوع سفارش (کالای ASP و خدمات AS) را با چک‌لیست ده‌مرحله‌ای کامل نشان می‌دهد: پرداخت از حساب، پرداخت به شماره حساب، تلفن هماهنگی، مشخصات اپراتور، آدرس دقیق (پلاک/طبقه/واحد)، قیمت انبار، قیمت کالا در سایت، به پیک تحویل داده شد، واریزی مبلغ کالا به شماره حساب ... به نام ... و در نهایت «با موفقیت انجام شد». هر مرحله با مبلغ، شماره حساب، نام واریزی، اپراتور و یادداشت ثبت می‌شود، نوار پیشرفت درصدی دارد و تاریخ و ساعت هر ثبت شمسی ثبت می‌گردد. این فاکتورها «برای ضمیمه به پروندهٔ مشتری» نگهداری می‌شوند و گزارش هر ثبت به ایمیل ادمین و مالک ارسال می‌گردد."),

  // ── ۶. جستجو ──
  h1("۶. نوار جستجو زیر اسلایدر"),
  bodyPara("نوار جستجوی سراسری به جایگاه درخواستی منتقل شد: درست زیر اسلایدر (بنر اصلی) صفحه، تقریباً بالای سایت. این جستجو هم‌زمان میز خدمات (هر دو نسخهٔ ایران و جهانی)، میز کالا، نرم‌افزار و قطعات را می‌گردد و نتایج را با نوع، دسته و قیمت در همان لحظه نشان می‌دهد؛ کلیک روی هر نتیجه مستقیماً به بخش مربوط می‌رود. اگر نتیجه‌ای نباشد، همان‌جا یادآوری «افزودن خدمت جدید با هوش مصنوعی» نمایش داده می‌شود — پیوند کامل با سازوکار پیام ۱۰."),

  // ── ۷. گزارش روزانه ──
  h1("۷. گزارش روزانهٔ قیمت‌ها و تأیید ادمین"),
  bodyPara("هر روز، موتور قیمت‌گذاری برای تمام اقلام موجودیِ فعال، قیمت را طبق قواعد +۳۳٪/+۱۵٪ بازمحاسبه و یک «گزارش روزانهٔ قیمت» با تاریخ شمسی همان روز در پنل می‌سازد و به ایمیل ادمین و مالک می‌فرستد. ادمین ریز هر قلم (قیمت قبلی، قیمت جدید، قاعده و مرجع) را می‌بیند و با «تأیید و لحاظ قیمت‌های جدید» تغییرها رسمی می‌شوند؛ در غیر این صورت گزارش رد می‌شود. گزارش‌ها در یک روز تکرار نمی‌شوند و تاریخ هر اعمال، مهر تقویمی روی محصول می‌نشیند."),
  bodyPara("برای اجرای خودکار شبانه، نقطهٔ پایانی /api/tick با کلید امنیت فراهم شد: اگر در ویندوز سرور با Task Scheduler (یا هر زمان‌بند دیگری) هر شب حول ساعت ۲۱:۳۰ تهران صدا زده شود، گزارش قیمت روزانه و حسابرسی شبانهٔ حسابدار هوشمند خودکار اجرا و گزارش‌ها ارسال می‌شوند. کلید در تنظیمات مالک قابل تغییر است.", { after: 160 }),

  // ── ۸. پنل مدیریتی ──
  h1("۸. پنل مدیریتی امن با هوش مصنوعی — دو دسترسی مالک و ادمین"),
  bodyPara("ورود پنل از رمز تک‌عاملی به احراز هویت نام کاربری/رمز با دو نقش ارتقا یافت: «owner (مالک)» و «admin (ادمین)» — نشست با کوکی امن HttpOnly امضا می‌شود و مرورگر پس از ورود، نشان نقش را کنار عنوان پنل نمایش می‌دهد. مالک: ویرایش حساب‌ها (شبا/کارت‌ها/آستانه/کلید کرن)، تغییر رمزها، فعال‌سازی اتوماسیون و تأیید مالکانهٔ هماهنگی‌ها. ادمین: همهٔ عملیات روزانه از تأیید پرداخت تا مراحل فاکتور و گزارش قیمت. تلاش ادمین برای تنظیمات حساس با خطای «فقط با دسترسی مالک» رد می‌شود و این مرزها در آزمون‌ها تأیید شد."),
  bodyPara("تب «دستیار هوشمند»، اپلیکیشن مدیریتی با هوش مصنوعی فوق‌هوشمند است: سؤال ادمین یا مالک را با آمار زندهٔ سامانه (موجودی، سفارش‌ها، صف تأییدها، وضعیت حسابرسی، هماهنگی‌ها) پاسخ می‌دهد؛ در محیط‌های متصل از مدل زبانی و در محیط‌های آفلاین از موتور قاعده‌محور داخلی استفاده می‌کند تا پاسخ هرگز وابسته به سرویس بیرونی نباشد. دربارهٔ سهم‌بندی مالی داخلی، دستیار بر اساس قاعدهٔ محرمانگی هیچ جزئیاتی نمی‌دهد.", { after: 160 }),

  // ── ۹. اتوماسیون ──
  h1("۹. دستی فعلاً، اتوماسیون بعداً — با انتقال تدریجی"),
  bodyPara("مطابق برنامهٔ کارفرما، تا فعال شدن اتوماسیون از جانب مالک، تمام امور رزرو، هماهنگی و پرداختی‌ها دستی و توسط ادمین انجام و در تب «هماهنگی‌ها» ثبت می‌شود. هر هماهنگی دستی پس از اولین بار، دو راه انتقال به بخش اتوماسیون دارد: تأیید مستقیم مالک، یا فعال‌سازی اتوماسیون توسط مالک در تنظیمات و سپس تأیید ادمین. پس از انتقال، هماهنگی با نشان «اتوماسیون» در بخش دوم تب نگهداری می‌شود و آمار انتقال در داشبورد دیده می‌شود. کلید اتوماسیون فقط در دست مالک است و پیش‌فرض خاموش."),

  // ── ۱۰. حسابدار هوشمند ──
  h1("۱۰. حسابدار هوشمند — حسابرسی شبانه، توقف و ادامه"),
  bodyPara("حسابدار هوشمند هر شب (و با دکمهٔ «اجرای حسابرسی الآن») تمام عملیات را بررسی می‌کند: دریافتی خدمات و کالا، سفارش‌های پرداخت‌شدهٔ بدون رکورد پرداخت، مبالغ نامعتبر، ناهم‌خوانی جمع اقلام با مبلغ نهایی، سفارش کالای ارسال‌شدهٔ بدون ثبت مراحل فاکتور و حق معرف‌های پرداخت‌نشده. گزارش شبانه به ایمیل مالک و ادمین و بخش «گزارش‌ها» پنل ارسال می‌شود."),
  bodyPara("در صورت مشاهدهٔ خطا (ضرر و زیان)، عملیات بلافاصله متوقف می‌شود: ثبت سفارش جدید با کد ۴۲۳ رد می‌گردد، بنر قرمز «عملیات متوقف است» در داشبورد پنل می‌نشیند و گزارش توقف با فهرست خطاها ارسال می‌شود. توقف تا تأیید مالک/مدیر ادامه دارد؛ اگر مالک تا ۳ ساعت فرمان ندهد، تأیید ادمین نیز مجاز می‌شود و پس از فرمان ادامه، سامانه دوباره فعال و گزارش «برطرف‌شده» با نام تأییدکننده ثبت می‌گردد. این چرخهٔ کامل در آزمون‌ها تأیید شد: ساخت ناهنجاری آزمونی → توقف خودکار → رد فرمان ادمین پیش از ۳ ساعت → فرمان موفق مالک → فعال شدن سامانه.", { after: 160 }),

  // ── ۱۱. بهتر از سه مرجع ──
  h1("۱۱. مقیاس اصلی: آچاره، اسنپ، دیجی‌کالا — و چیزی بهتر"),
  bodyPara("سه مرجع درخواستی در پنل ثبت و به‌عنوان مبنا نگهداری می‌شوند؛ اما سامانه روی سه محور از هر سه فراتر می‌رود: یکپارچگی خدمات و کالا (آچاره فقط خدمات، دیجی‌کالا فقط کالا — الو شتاب هر دو را با هم در یک سفارش می‌فروشد: کالا + نصب)، شفافیت قیمت‌گذاری (مرجع قیمت، تاریخ تقویمی و قاعدهٔ +۳۳٪/+۱۵٪ روی هر کارت نمایش داده می‌شود و تغییر قیمت‌ها با تأیید ادمین و ردگیری است) و نظارت مالی خودکار (حسابدار هوشمند با توقف عملیات هنگام خطا — سازه‌ای که هیچ‌یک از سه مرجع ندارد)."),

  // ── ۱۲. پذیرش ──
  h1("۱۲. آزمون‌ها، بستهٔ تحویلی و محرمانگی"),
  bodyPara("همهٔ جریان‌های پیام ۱۱ با آزمون واقعی تأیید شد: ثبت سفارش یخچال تکسان با خدمات کنار خرید و آدرس پلاک/طبقه/واحد (کد ASP-710042) و نمایش خودکار شبای بانک ملت برای مبلغ بالای ۵ میلیون؛ ثبت مرحلهٔ فاکتور با مبلغ؛ تولید گزارش روزانهٔ قیمت با ۹ تغییر و تأیید ادمین؛ اجرای حسابرسی و چرخهٔ توقف/ادامه؛ ورود مالک و ادمین و مرزهای دسترسی؛ دستیار هوشمند با پاسخ دقیق آماری؛ جستجوی سراسری زیر اسلایدر با نتیجهٔ خدمت/کالا. بازرسی مرورگر نیز چیدمان RTL، تب‌های دوگانهٔ میز محصولات و کارت‌های قیمت‌دار را تصدیق کرد."),
  bodyPara("اقلام تحویلی این پیام: بستهٔ کامل alo_shetab_release_v2.1.0.zip (کد + اسکیما + seed پیام ۱۱ + اسناد)، سند پیام ۱۱ و فایل CHECKSUMS-v2.1.0.sha256. سایت نسخهٔ ۲٫۱ در پیش‌نمایش زنده فعال است؛ پس از اتصال DNS دامنه، تنها تغییر لازم، آدرس url در config.json اپ‌ها و بازسازی پوسته‌هاست. قاعدهٔ محرمانگی سهم‌بندی تسویه همچنان مطلق است و هیچ مبلغ یا درصدی از سهم‌ها در هیچ رابط کاربری یا پاسخ عمومی ظاهر نمی‌شود.", { after: 0 }),
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
            children: [faRun("میز کالای واقعی و پنل مدیریتی هوشمند | پیام ۱۱", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/پیام-۱۱-میز-کالا-و-پنل-مدیریتی.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
