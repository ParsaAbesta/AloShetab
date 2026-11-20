// پیام ۹ — اپلیکیشن‌های چندسکویی: اندروید، iOS و ویندوز (Persian RTL document)
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
  title: "اپلیکیشن‌های چندسکویی — اندروید، iOS و ویندوز",
  subtitle: "پیام ۹ — APK امضاشدهٔ اندروید، بستهٔ قابل‌حمل ویندوز (Electron) و مسیر رسمی iOS بر پایهٔ PWA و Capacitor",
  englishLabel: "CROSS-PLATFORM APPLICATIONS",
  metaLines: [
    "شماره سند: پیام ۹ (پیام تکمیلی اپلیکیشن‌ها) — پس از پیام ۸",
    "تاریخ تنظیم: ۲۵ آبان ۱۴۰۵ (۱۶ نوامبر ۲۰۲۶)",
    "بسته‌های تحویلی: AloShetab.apk و AloShetab-Windows-Portable-x64.zip و دو بیلدکیت",
    "وضعیت: هر سه سکو مسیر رسمی نصب دارد — پوسته‌ها نمایشگر وب‌اپ و بدون منطق مالی",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "پیام ۹ — ضمیمهٔ اپلیکیشن‌ها",
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
  bodyPara("این سند، پیام تکمیلی دوم پروژه الو شتاب است و به درخواست کارفرما برای «فایل‌های apk، iOS و ویندوز» پاسخ می‌دهد. استراتژی انتخابی، حفظ یک کدبیث واحد است: وب‌اپ سامانه که در پیام‌های ۵ تا ۷ ساخته و در پیام ۸ تا سطح استقرار احراز شد، هستهٔ مشترک هر سه سکو است و سه «پوسته» سبک، همان تجربه را به‌صورت اپ بومی ارائه می‌کنند: پوسته WebView اندروید، پوسته Electron ویندوز و مسیر رسمی اپل برای iOS که PWA و سپس Capacitor است. با این معماری، هر به‌روزرسانی آینده فقط روی سرور اعمال می‌شود و نیازی به انتشار مجدد فایل‌های اپ نیست."),
  bodyPara("فایل APK اندروید به‌صورت واقعی و امضاشده در همین محیط و از صفر ساخته شد: بدون Gradle، با زنجیره رسمی aapt2 و d8 و apksigner از build-tools نسخه ۳۴ و پلتفرم اندروید ۱۴. بسته ویندوز نیز بر پایه زمان اجرا رسمی Electron 33 مونتاژ شد و به‌صورت قابل‌حمل (بدون نصب) تحویل گردید. برای iOS، به دلیل سیاست اپل که تولید IPA امضاشده را فقط در Xcode روی مک و با حساب توسعه‌دهنده اپل ممکن می‌کند، دو مسیر رسمی مستند شد: نصب فوری PWA روی آیفون (همین امروز و بدون هزینه) و بیلدکیت Capacitor برای ساخت اپ بومی روی مک."),
  bodyPara("قاعده محرمانگی کارفرما در هر سه پوسته صادق است: پوسته‌ها صرفاً نمایشگر وب‌اپ‌اند و هیچ منطق مالی در آن‌ها وجود ندارد؛ محاسبه و ثبت سهم‌بندی تسویه (۴/۷ مجری، ۱/۷ معرف، ۲/۷ ألو شتاب) همچنان فقط در بک‌اند و پایگاه داده انجام می‌شود و در هیچ رابط کاربری‌ای — وب یا اپ — ظاهر نمی‌شود."),

  // ── ۱. معماری ──
  h1("۱. معماری چندسکویی و اقلام تحویلی"),
  bodyPara("هستهٔ مشترک، همان وب‌اپ PWA است که مانیفست کامل (نام، آیکون‌های ۱۹۲ و ۵۱۲ و maskable، حالت standalone و راست‌به‌چپ) دارد و از قبل دکمه «دریافت برنامه» با کد QR در رابط کاربری آن تعبیه شده است. روی این هسته، دو پوسته بومی (اندروید و ویندوز) و یک مسیر اپل قرار گرفته است. جدول ۱ فایل‌های تحویلی را نشان می‌دهد."),
  tableCaption("جدول ۱ — اقلام تحویلی پیام ۹"),
  rtlTable([30, 38, 32],
    ["فایل", "فناوری و کارکرد", "وضعیت"],
    [
      ["AloShetab.apk", "پوسته WebView بومی اندروید؛ امضاشده با apksigner؛ API ۲۴ تا ۳۴", "آمادهٔ نصب"],
      ["AloShetab-Android-BuildKit.zip", "سورس کامل پروژه اندروید + build.sh + کلید امضا برای بازتولید با دامنهٔ نهایی", "آماده"],
      ["AloShetab-Windows-Portable-x64.zip", "زمان اجرا رسمی Electron 33؛ قابل‌حمل و بدون نیاز به نصب", "آمادهٔ اجرا"],
      ["AloShetab-iOS-BuildKit.zip", "پیکربندی Capacitor + راهنمای گام‌به‌گام ساخت روی مک", "آماده"],
      ["PWA سامانه", "هستهٔ مشترک؛ نصب مستقیم از مرورگر روی هر سه سکو", "فعال"],
    ]),

  // ── ۲. اندروید ──
  h1("۲. اندروید — APK امضاشده"),
  bodyPara("فایل AloShetab.apk یک اپ اندروید واقعی است که وب‌اپ سامانه را در WebView بومی، تمام‌صفحه و با آیکون و نام «ألو شتاب» اجرا می‌کند. مجوز آن فقط دسترسی اینترنت است، بارگذاری محتوای غیرامن (Mixed Content) مسدود است و فقط نشانی‌های HTTPS پذیرفته می‌شود. دکمه بازگشت سخت‌افزاری به تاریخچهٔ درون اپ متصل است و چرخش صفحه، وضعیت WebView را حفظ می‌کند. آدرس سرویس از فایل assets/config.json خوانده می‌شود تا پس از استقرار روی دامنهٔ نهایی، با یک بیلد مجدد از بیلدکیت، اپ به آدرس رسمی متصل شود."),
  tableCaption("جدول ۲ — مشخصات فنی AloShetab.apk"),
  rtlTable([32, 68],
    ["مشخصه", "مقدار"],
    [
      ["شناسه / نسخه", "ir.aloshetab.app — نسخه 1.0.0 (versionCode ۱)"],
      ["سازگاری", "اندروید ۷ به بالا (minSdk ۲۴، targetSdk ۳۴)"],
      ["مجوزها", "فقط INTERNET"],
      ["حجم فایل", "حدود ۴۱ کیلوبایت (پوسته سبک؛ محتوا از سرور بارگذاری می‌شود)"],
      ["امضا", "SHA-256 گواهی: 995ea90aeb7287e82971a6f4835bfd2d17b895ee23fbee7630a683d2ae02a8c2"],
      ["بازتولید", "بیلدکیت اندروید + build.sh؛ کلید امضا در بسته موجود است"],
    ]),
  bodyPara("نصب: فایل APK را به گوشی منتقل و اجرا کنید؛ در پیام «منابع ناشناس»، اجازهٔ نصب برای همان مرورگر یا فایل‌منیجر را فعال کنید. برای انتشار در گوگل‌پلی نیز همین بسته مبناست و تنها نیازمند حساب توسعه‌دهنده گوگل و انتخاب دامنهٔ نهایی پیش از بیلد نهایی است.", { after: 160 }),

  // ── ۳. ویندوز ──
  h1("۳. ویندوز — بستهٔ قابل‌حمل"),
  bodyPara("بسته AloShetab-Windows-Portable-x64.zip بر پایه زمان اجرای رسمی Electron 33 است و هیچ نصب و دسترسی مدیریتی نمی‌خواهد: کافی است محتوا را در پوشه‌ای باز کنید و AloShetab.exe را اجرا کنید؛ پنجرهٔ مستقل اپ با آیکون و عنوان «ألو شتاب» باز می‌شود. منوی پیش‌فرض حذف شده، بازکردن پنجره‌های جدید به مرورگر سیستم واگذار می‌شود و سندباکس و جداسازی کانتکست فعال است. آدرس سرویس در resources/app/config.json قرار دارد و با ویرایش همین یک فایل، اپ به دامنهٔ نهایی متصل می‌شود — بدون نیاز به بازسازی بسته."),
  bodyPara("برای کاربران خانگی، مسیر حتی ساده‌تر است: در کروم یا اج، پس از بازکردن نشانی سامانه، از منوی مرورگر گزینه Install را بزنید؛ همان اپ PWA با آیکون اختصاصی در ویندوز نصب می‌شود. هر دو مسیر در سند و راهنمای داخل بسته مستند است.", { after: 160 }),

  // ── ۴. iOS ──
  h1("۴. iOS — مسیر رسمی اپل"),
  bodyPara("تولید IPA امضاشده تنها با Xcode روی مک و با حساب Apple Developer ممکن است و هیچ ابزار متقاطعی این محدودیت اپل را دور نمی‌زند؛ به همین دلیل به‌جای تحویل فایلی غیرقابل‌استفاده، دو مسیر رسمی مستند و بسته‌بندی شده است. مسیر نخست، PWA است که همین حالا روی آیفون و آیپد کار می‌کند: در Safari با Share و Add to Home Screen، اپ تمام‌صفحه با آیکون رسمی نصب می‌شود و چون مانیفست و آیکون apple-touch از قبل آماده است، تجربه آن تفاوت محسوسی با اپ بومی ندارد. مسیر دوم، بیلدکیت Capacitor است که روی مک با چند دستور، اپ بومی iOS می‌سازد؛ پیکربندی آن شامل شناسه ir.aloshetab.app و آدرس سرویس است و آماده ارسال به TestFlight و App Store است."),
  tableCaption("جدول ۳ — دو مسیر iOS و پیش‌نیازها"),
  rtlTable([26, 44, 30],
    ["مسیر", "گام‌ها", "پیش‌نیاز"],
    [
      ["PWA (فوری)", "Safari ← Share ← Add to Home Screen", "فقط آیفون/آیپد؛ بدون هزینه"],
      ["Capacitor (بومی)", "بیلدکیت ← cap add ios ← Xcode ← امضا و انتشار", "مک با Xcode 15+ و حساب Apple Developer"],
    ]),

  // ── ۵. آدرس سرویس و محرمانگی ──
  h1("۵. آدرس سرویس، امنیت و جمع‌بندی"),
  bodyPara("هر سه پوسته آدرس سرویس را از فایل پیکربندی خود می‌خوانند و فقط HTTPS را می‌پذیرند. اکنون این آدرس به محیط پیش‌نمایش فعلی اشاره دارد تا بسته‌ها قابل آزمون باشند؛ پس از استقرار روی دامنهٔ نهایی کارفرما، در ویندوز یک ویرایش ساده و در اندروید یک بیلد مجدد از بیلدکیت، اپ‌ها را به آدرس رسمی متصل می‌کند و گام آن در راهنمای هر بسته آمده است. از منظر امنیت، پوسته‌ها هیچ منطق مالی ندارند، جاوااسکریپت محلی اجرا نمی‌کنند و محتوای ناامن مسدود است؛ قاعده محرمانگی سهم‌بندی تسویه نیز در همه سکوها برقرار است زیرا مبالغ هرگز از بک‌اند خارج نمی‌شوند. با این تحویل، سامانه الو شتاب روی هر سه سکوی اندروید، ویندوز و iOS مسیر رسمی نصب دارد و برای بهره‌برداری واقعی پس از تعیین دامنه، آماده است.", { after: 0 }),
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
            children: [faRun("اپلیکیشن‌های چندسکویی الو شتاب | پیام ۹", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/پیام-۹-اپلیکیشن‌های-چندسکویی.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
