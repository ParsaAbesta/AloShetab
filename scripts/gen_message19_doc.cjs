// پیام ۱۹ — پلن مالی V4.1: قفل سود بلاصاحب → بانک ملی + رفع باگ‌ها + پاداش سقف‌دار دوره‌ای (Persian RTL)
// Skill: docx | Route: Create | Scene: report | Cover: R1 (هم‌سان با پیام ۳ تا ۱۸)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableLayoutType, PageOrientation,
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

// ─── محتوا ────────────────────────────────────────────────
const coverConfig = {
  palette: PAL,
  englishLabel: "ALOSHETAB — V4.1 FINANCIAL PLAN UPDATE",
  title: "پیام ۱۹ — پلن مالی V4.1: قفل سود بلاصاحب، رفع باگ‌ها و پاداش دوره‌ای",
  subtitle: "سامانه الو شتاب — سه تکلیف جدید مالک روی پایهٔ پلن ۱۸ (V4.0)؛ سایر مفاد V4.0 بدون تغییر",
  metaLines: [
    "نسخهٔ سامانه: v4.1.0 (v4.1-IR / v4.1-WORLD) — شماره‌گذاری V4.1",
    "تاریخ: ۲۸ آبان ۱۴۰۵ / ۱۹ نوامبر ۲۰۲۶",
    "صحت‌سنجی: ۶۰ آزمون روی بیلد Production (پیام ۱۸: ۳۰/۳۰ + پیام ۱۹: ۳۰/۳۰)",
    "طبقه‌بندی: محرمانه — فقط مالک",
  ],
  footerLeft: "الو شتاب — سند داخلی مالک",
  footerRight: "V4.1 — پیام ۱۹",
};

const bodyChildren = [
  h1("۱. دستور کارفرما و پاسخ کوتاه"),
  bullet("«سود بلاصاحب به حساب ملی واریز شود» → قفل شد: هر تومانی که به کارشناس/معرف پرداخت نمی‌شود، سود شرکت است و به بانک ملی می‌رود؛ هیچ تومانی بلاصاحب نمی‌ماند (بخش ۲)."),
  bullet("«تمام باگ‌ها را رفع کن» → بازبینی کامل انجام شد؛ ۵ باگ واقعی یافت و رفع شد (بخش ۳)."),
  bullet("«پاداش سقف‌دار دوره‌ای بگذار» → پیاده‌سازی شد: پاداش یک‌ماههٔ شمسی با سقف تومانی برای هر معرف، از سهم شرکت (بخش ۴)."),
  bullet("«فایل‌ها با v4.1» → بستهٔ انتشار alo_shetab_release_v4.1.zip + نسخهٔ سامانه v4.1-IR/WORLD؛ اپ‌های اندروید/ویندوز V4.0 چون فقط پوسته‌اند بدون تغییر معتبرند."),
  bullet("«مسیر استقرار» → خلاصه در بخش ۶ — همان مسیر V4.0 با تگ aloshetab:4.1.0.", { after: 200 }),

  h1("۲. قفل «سود بلاصاحب → بانک ملی»"),
  bodyPara("در تسویهٔ خدمات V4.0، مبنای کسر «۶۷٪ کل اجرت» بود؛ اگر قلمی همکار تأییدشده نداشت، سهم پرداخت‌نشدهٔ همان قلم در هیچ ستونی نمی‌نشست — یک نشتی واقعی. در V4.1 فرمول به «دستمزد پرداختی واقعی» تغییر کرد: سود خالص شرکت = وصولی خدمات − دستمزد واقعی پرداختی به کارشناسان − پورسانت معرف (فقط فاکتور اول). هر تومانی که پرداخت نمی‌شود — اعم از سهم اقلام بدون همکار (امانی) یا گرد کردن — به‌عنوان سود بلاصاحب داخل سهم شرکت می‌ماند و به بانک ملی واریز می‌شود؛ در گزارش ایمیل تسویه نیز خط «سود بلاصاحب اقلام بدون همکار (→ بانک ملی)» اضافه شد."),
  tableCaption("جدول ۱ — نمونهٔ عددی (سفارش بدون همکار تأییدشده — همان آزمون Production)"),
  rtlTable([34, 22, 22, 22],
    ["ستون", "کد قدیم (V4.0)", "کد جدید (V4.1)", "مقصد"],
    [
      ["وصولی خدمات", money(5000000), money(5000000), "—"],
      ["دستمزد پرداختی کارشناس", money(0), money(0), "بانک مهر"],
      ["پورسانت معرف", money(0), money(0), "بانک مهر (فقط فاکتور اول)"],
      ["سود شرکت (شامل بلاصاحب)", money(4087962), money(5000000), "بانک ملی"],
      ["تومان بلاصاحب/نشتی", money(912038), money(0), "—"],
    ]),
  bodyPara("تفاوت دو ستون آخر یعنی " + money(912038) + " تومان از این سفارش در کد V4.0 گم می‌شد؛ در V4.1 کامل به بانک ملی می‌رود. در سفارش‌های عادی با همکار، مقدار نشتی فقط گرد کردن چندتومانی بود — آن هم اکنون بسته است.", { after: 200 }),

  h1("۳. باگ‌های شناسایی‌شده و رفع‌شده"),
  tableCaption("جدول ۲ — پنج باگ V4.0 و اصلاح V4.1"),
  rtlTable([8, 34, 38, 20],
    ["#", "باگ", "اصلاح V4.1", "آزمون"],
    [
      ["۱", "نشتی سود: کسر ۶۷٪ فرضی کل اجرت در تسویهٔ خدمات — سهم اقلام بدون همکار و گرد کردن بلاصاحب می‌ماند", "فرمول بر مبنای دستمزد پرداختی واقعی؛ همهٔ باقیمانده → بانک ملی + خط اختصاصی در گزارش", "پیام ۱۹ / ۱-۳"],
      ["۲", "تشخیص دوگانهٔ «فاکتور اول»: هر میز جداگانه می‌شمرد؛ معرف برای یک مشتری هم در کالا و هم در خدمات پورسانت یک‌بارمصرف می‌گرفت", "ماژول یکپارچهٔ تشخیص (src/lib/referral.ts) — شمارش مشترک سفارش‌های خدمات + کالا برای هر دو میز", "پیام ۱۹ / ۲"],
      ["۳", "اعتبارسنجی سست معرف در میز کالا: کد نامعتبر بی‌صدا نادیده می‌شد و سلف-رفرال کنترل نمی‌شد (سوراخ تخفیف/پورسانت)", "کد نامعتبر → ۴۰۰ REFERRAL_INVALID؛ خریدار = معرف → ۴۰۰ REFERRAL_SELF (هم‌سان با میز خدمات)", "پیام ۱۹ / ۳"],
      ["۴", "پورسانت معرف کالا فقط در ایمیل بود — در دیتابیس و تب «معرفی‌ها» ثبت نمی‌شد و قابل واریز‌گذاری نبود", "فیلدهای referralAmount/referralPaid در ProductOrder + نمایش و دکمهٔ واریز در تب «معرفی‌ها»", "پیام ۱۹ / ۴"],
      ["۵", "گارد «توقف عملیات حسابدار هوشمند» فقط در میز کالا بود؛ میز خدمات در زمان حسابرسی باز می‌ماند", "بررسی OPERATIONS_FROZEN در ثبت سفارش خدمات → ۴۲۳ (هم‌سان با کالا)", "پیام ۱۹ / ۶"],
    ]),
  bodyPara("هیچ‌کدام از اصلاح‌ها مفاد مالی V4.0 (۶۷٪ کارشناس، پورسانت یک‌بارمصرف ۱۰٪/۲۰٪، تخفیف ۱۰٪، جریان ملی/مهر) را تغییر نمی‌دهد؛ فقط نشتی و گاردها بسته شده‌اند.", { after: 200 }),

  h1("۴. پاداش سقف‌دار دوره‌ای معرف"),
  bodyPara("هدف: جبران ضعف انگیزهٔ پورسانت یک‌بارمصرف (نقطهٔ ضعف اعلام‌شده در نظر کارشناس پیام ۱۸) بدون بازگشت به تعهد مستمر. طراحی: دورهٔ یک‌ماههٔ شمسی؛ برای هر معرف، مبنای پاداش = (٪ سود خالص شرکت خدماتِ دورهٔ معرفی‌شده‌هایش) + (٪ سود خالص شرکت کالای همان دوره)؛ پاداش = مبنای محدود به سقف تومانی. تأمین از سهم شرکت (بانک ملی) و واریز به معرف از طریق بانک مهر؛ سند دوره محرمانه است و فقط به ایمیل مالک می‌رود. هر دوره فقط یک‌بار قابل بستن است (دورهٔ تکراری → ۴۰۹)."),
  tableCaption("جدول ۳ — تنظیمات پاداش (از پنل مالک قابل تغییر، بدون تغییر کد)"),
  rtlTable([42, 18, 40],
    ["کلید", "پیش‌فرض", "معنی"],
    [
      ["PERIODIC_BONUS_ENABLE", "1", "فعال/غیرفعال کل پاداش دوره‌ای"],
      ["PERIODIC_BONUS_PCT_SERVICES", "2", "٪ از سود خالص شرکت خدماتِ دورهٔ معرفی‌شده‌ها"],
      ["PERIODIC_BONUS_PCT_GOODS", "2", "٪ از سود خالص شرکت کالای دورهٔ معرفی‌شده‌ها"],
      ["PERIODIC_BONUS_CAP", money(2000000), "سقف پاداش هر معرف در هر دوره (تومان)"],
    ]),
  bodyPara("مکان استفاده: پنل مدیریت → تب «معرفی‌ها» → کادر «پاداش سقف‌دار دوره‌ای معرف (V4.1)»؛ دورهٔ جاری خودکار پیشنهاد می‌شود (مثل 1405-08)، دکمهٔ «محاسبه» پیش‌نمایش می‌دهد و «بستن دوره» سند را برای مالک ایمیل می‌کند. در آزمون Production با سود دورهٔ " + money(1225150) + " تومان معرفی‌شده‌ها، پاداش محاسبه‌شده " + money(24503) + " تومان شد و بستن دوره + مسدودسازی تکرار آن سبز بود.", { after: 200 }),

  h1("۵. صحت‌سنجی و فایل‌های v4.1"),
  bodyPara("دو مجموعه آزمون روی بیلد Production (پورت ۳۰۱۰) اجرا شد: verify_p18 (۳۰ آزمون — بدون هیچ شکست؛ تضمین بی‌ضرربودن اصلاحات روی پلن ۱۸) و verify_p19 جدید (۳۰ آزمون برای پنج باگ و پاداش دوره‌ای) — مجموعاً ۶۰/۶۰ سبز. شماره‌گذاری V4.1: package.json 4.1.0، نسخهٔ سامانه v4.1-IR/WORLD، بستهٔ انتشار alo_shetab_release_v4.1.zip (۳۳۸ فایل) با CHECKSUMS-v4.1.0.sha256."),
  tableCaption("جدول ۴ — فایل‌های کلیدی تغییرکرده"),
  rtlTable([40, 60],
    ["فایل", "نقش در V4.1"],
    [
      ["src/lib/referral.ts", "جدید: تشخیص یکپارچهٔ فاکتور اول + موتور پاداش سقف‌دار دوره‌ای"],
      ["src/lib/settlement.ts", "قفل سود بلاصاحب → بانک ملی + خط گزارش امانی"],
      ["src/app/api/admin/periodic-bonus", "جدید: پیش‌نمایش/بستن دورهٔ پاداش (GET/POST)"],
      ["src/app/api/products/order", "اعتبارسنجی سخت معرف + فاکتور اول یکپارچه"],
      ["src/app/api/admin/referrals", "پورسانت‌های کالا در تب معرفی‌ها + واریز goodsId"],
      ["src/app/api/admin/product-orders", "ثبت پورسانت کالا در دیتابیس هنگام تسویهٔ تحویل"],
      ["prisma/schema.prisma + alo_shetab_migration.sql", "سه فیلد referralAmount/referralPaid/referralPaidAt روی ProductOrder"],
    ]),

  h1("۶. استقرار V4.1 — خلاصه"),
  bullet("۱) در ریشهٔ بسته: docker build -t aloshetab:4.1.0 .  (اِجِم پورت‌های اضافه؛ همان Dockerfile V4.0)"),
  bullet("۲) در ClawCloud Run: تصویر aloshetab:4.1.0 را جای 4.0.0 بگذار؛ پورت 3000، متغیر DATABASE_URL مثل قبل."),
  bullet("۳) Volume قبلی را وصل نگه دار — دیتابیس موجود با migration خودکار بالا می‌آید (ALTER فیلدهای پورسانت کالا)."),
  bullet("۴) دامنهٔ aloshetab.ir همان است؛ DNS/TLS قبلی دست‌نخورده."),
  bullet("۵) پس از بالا آمدن: یک سفارش آزمون بزن و از تب معرفی‌ها کادر پاداش دوره‌ای را «محاسبه» کن."),
  bullet("۶) اپ‌های اندروید/ویندوز V4.0 بدون بازسازی به همان دامنه وصل‌اند؛ فقط سمت سرور عوض شده است.", { after: 200 }),
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
    {
      properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: new Header({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { line: 240 }, children: [faRun("پلن مالی V4.1 | پیام ۱۹", { size: 18, color: "808080" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240 }, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, sizeComplexScript: 18, color: "808080", font: FONT })] })] }) },
      children: bodyChildren,
    },
  ],
});

const OUT = "/home/z/my-project/download/پیام-۱۹-پلن-مالی-v4.1.docx";
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("WROTE:", OUT, buf.length, "bytes"); });
