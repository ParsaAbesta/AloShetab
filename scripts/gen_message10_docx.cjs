// پیام ۱۰ — استقرار روی دامنه، میز خدمات دو نسخه‌ای با ریز جزئیات، هوش مصنوعی، قطعات و اصلاح قیمت (Persian RTL document)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (same as پیام ۳ تا ۹)
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
  title: "استقرار دامنه و میز خدمات نسخهٔ ایران و جهانی v2.0",
  subtitle: "پیام ۱۰ — ریز جزئیات تیک‌خور، ساخت خدمت نایاب با هوش مصنوعی، سفارش خرید قطعات و جریان اصلاح قیمت",
  englishLabel: "DOMAIN DEPLOYMENT & SERVICE DESK V2.0",
  metaLines: [
    "شماره سند: پیام ۱۰ — پس از پیام ۹ (اصلاحی APK نسخهٔ 1.1.0)",
    "تاریخ تنظیم: ۲۶ آبان ۱۴۰۵ (۱۷ نوامبر ۲۰۲۶)",
    "دستاورد کلیدی: ثبت AloShetab.ir در ایرنیک + کاتالوگ دو نسخه‌ای با ۱٬۵۷۴ ریز جزئیات",
    "وضعیت: سایت نسخهٔ ۲٫۰ مستقر؛ بستهٔ انتشار alo_shetab_release_v2.0.0.zip آماده",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "پیام ۱۰ — استقرار و نسخهٔ ۲٫۰",
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
  bodyPara("این سند، پیام دهم پروژه الو شتاب است و به هشت درخواست کارفرما در یک بستهٔ منسجم پاسخ می‌دهد: دامنهٔ AloShetab.ir در ایرنیک ثبت شد و راهنمای اتصال DNS و HTTPS در سند استقرار به‌روزرسانی شد؛ میز محصولات مطابق دستور فعلاً خالی نگه داشته شد و حالت خالی شفاف آن طراحی شد؛ میز خدمات به کاتالوگ دو نسخه‌ای ارتقا یافت — نسخهٔ ایران (v1) با ۱۱۷ خدمت در ۲۱ دسته (۲۰ دستهٔ رسمی + دستهٔ جدید خدمات کامپیوتری) و نسخهٔ جهانی (v2.0) با ۱۰۹ خدمت در ۱۶ دسته جهانی به دلار؛ هر خدمت به «ریز جزئیات» تیک‌خور و شمارش‌پذیر مجهز شد و جمعاً ۱٬۵۷۴ ریز جزئیات با قیمت مستقل بارگذاری شد."),
  bodyPara("چهار سازوکار تعاملی نیز اضافه شد: نخست، اگر جستجوی مشتری بی‌نتیجه بماند، هوش مصنوعی — پس از رد شدن از فیلتر خدمات غیرمجاز — همان خدمت را به‌صورت استاندارد تعریف و بلافاصله در میز خدمات موجود می‌کند و برای بازبینی پشتیبانی علامت می‌خورد. دوم، دکمهٔ «[+] افزودن ریز جزئیات» در هر خدمت، پیشنهاد مشتری را به صف بررسی پشتیبانی می‌فرستد و پس از تأیید، برای همیشه به کاتالوگ اضافه می‌شود. سوم، در کنار سفارش خدمات، «سفارش خرید قطعات» با ۴۰ قطعهٔ پرکاربرد، ورودی مدل و تعداد و قیمت روز تقویمی فعال شد. چهارم، قیمت‌ها طبق تقویم (نرخ روز) به‌روز می‌شوند و کارشناس می‌تواند اصلاح قیمت ثبت کند که پس از تأیید پشتیبانی جایگزین رسمی می‌شود."),
  bodyPara("مطابق دستور صریح، شمارهٔ تماس پشتیبانی از سراسر رابط کاربری حذف شد و فقط در پایین صفحهٔ سایت (فوتر) نمایش داده می‌شود؛ نسخهٔ سامانه نیز «v2.0-IR+WORLD» در فوتر درج می‌گردد. قاعدهٔ محرمانگی سهم‌بندی تسویه همچنان مطلق است و در هیچ رابط کاربری یا پاسخ APIای — وب، موبایل یا دسکتاپ — اثری از مبالغ سهم‌ها دیده نمی‌شود."),

  // ── ۱. اقلام تحویلی ──
  h1("۱. اقلام تحویلی و جایگاه پیام ۱۰"),
  bodyPara("جدول ۱ اقلام تحویلی این پیام را نشان می‌دهد. بستهٔ انتشار alo_shetab_release_v2.0.0.zip جانشین کامل نسخه‌های 1.0.x است و کاتالوگ رسمی نسخهٔ ۲ در دو قالب JSON و CSV نیز جداگانه عرضه شده تا در هر سیستم دیگری قابل استفاده باشد."),
  tableCaption("جدول ۱ — اقلام تحویلی پیام ۱۰"),
  rtlTable([34, 40, 26],
    ["فایل", "محتوا", "وضعیت"],
    [
      ["alo_shetab_release_v2.0.0.zip", "کد کامل نسخهٔ ۲٫۰ + اسکیما + seed_v2 + آزمون‌ها + راهنمای استقرار", "آمادهٔ استقرار"],
      ["alo_shetab_catalog_v2.json", "کاتالوگ کامل دو نسخه + تمام ریز جزئیات + ۴۰ قطعه", "تحویل داده"],
      ["alo_shetab_catalog_v2.csv", "همان داده در قالب جدولی (سازگار با اکسل)", "تحویل داده"],
      ["پیام-۱۰-...docx/pdf", "همین سند رسمی", "امضا و تحویل"],
      ["پیش‌نمایش زنده", "سایت نسخهٔ ۲٫۰ با تمام امکانات، در محیط پیش‌نمایش فعال است", "در حال کار"],
    ]),

  // ── ۲. استقرار دامنه ──
  h1("۲. استقرار و اتصال دامنهٔ AloShetab.ir"),
  bodyPara("دامنهٔ AloShetab.ir با موفقیت در ایرنیک (nic.ir) ثبت شد. گام‌های اتصال به سرور در بخش ۸ سند DEPLOYMENT.md مستند شده است: پس از احراز هویت در verify.nic.ir، در پنل ایرنیک رکوردهای DNS تنظیم می‌شود — یا واگذاری NS به هاست رجیسترر، یا دو رکورد A برای AloShetab.ir و www.AloShetab.ir به نشانی IP سرور. سپس وب‌سرور Caddy یا Nginx روی سرور با همان دامنه بالا آورده می‌شود؛ Caddy گواهی Let's Encrypt را به‌صورت خودکار صادر و تمدید می‌کند و HTTPS از همان لحظه فعال است."),
  bodyPara("پس از فعال شدن DNS، اتصال اپ‌های چندسکویی به دامنهٔ رسمی یک‌گام‌شان است: در ویندوز فقط ویرایش فایل config.json و در اندروید ویرایش همان فایل در بیلدکیت و اجرای build.sh. پیش از آن، همهٔ اپ‌ها و سایت با نشانی پیش‌نمایش فعلی در دسترس و آزمون‌پذیرند.", { after: 160 }),
  tableCaption("جدول ۲ — گام‌های اتصال دامنه"),
  rtlTable([14, 46, 40],
    ["گام", "عملیات", "محل انجام"],
    [
      ["۱", "احراز هویت هویتی با کد ملی", "verify.nic.ir"],
      ["۲", "تنظیم NS یا رکوردهای A", "panel.nic.ir ← دامنه‌ها"],
      ["۳", "انتظار برای پروپاگیشن (دقایق تا چند ساعت)", "—"],
      ["۴", "صدور خودکار HTTPS و reverse_proxy به پورت 3000", "Caddyfile روی سرور"],
      ["۵", "تغییر url اپ‌ها به https://www.aloshetab.ir", "config.json هر پوسته"],
    ]),

  // ── ۳. میز خدمات دو نسخه‌ای ──
  h1("۳. میز خدمات دو نسخه‌ای — ایران v1 و جهان v2.0"),
  bodyPara("در بالای میز خدمات، سوییچی دو حالتی قرار گرفته است: «نسخهٔ ایران (v1)» و «نسخهٔ جهانی (v2.0)». نسخهٔ ایران، کاتالوگ رسمی ۲۰ دستهٔ پیشین را در بر می‌گیرد و به درخواست صریح کارفرما، دستهٔ جدید «خدمات کامپیوتری» با ۱۲ خدمت پرکاربرد به آن افزوده شده است؛ جمع نسخهٔ ایران اکنون ۱۱۷ خدمت با ۹۱۶ ریز جزئیات است. نسخهٔ جهانی از پایه برای بازارهای بین‌المللی نوشته شده: ۱۶ دستهٔ جهانی از فناوری اطلاعات تا املاک، ۱۰۹ خدمت با ۶۵۸ ریز جزئیات و قیمت‌گذاری دلاری بر مبنای میانگین بازار جهانی ۲۰۲۶."),
  tableCaption("جدول ۳ — آمار کاتالوگ نسخهٔ ۲٫۰"),
  rtlTable([30, 24, 24, 22],
    ["نسخه", "دسته‌ها", "خدمات", "ریز جزئیات"],
    [
      ["ایران (v1) — تومان", "۲۱", "۱۱۷", "۹۱۶"],
      ["جهانی (v2.0) — دلار", "۱۶", "۱۰۹", "۶۵۸"],
      ["جمع", "۳۷", "۲۲۶", "۱٬۵۷۴"],
    ]),

  // ── ۴. ریز جزئیات ──
  h1("۴. ریز جزئیات تیک‌خور و دکمهٔ افزودن دائمی"),
  bodyPara("هر خدمت یک پنل «ریز جزئیات» بازشدنی دارد: فهرست زیرخدمت‌ها با تیک‌چک‌باکس، قیمت مستقل هر قلم و شمارندهٔ «عدد» برای هر مورد. مشتری هر تعداد قلم را تیک می‌زند، تعداد را تنظیم می‌کند و جمع انتخاب‌ها زنده نمایش داده می‌شود؛ اقلام انتخابی به سبد سفارش می‌روند، در پیش‌فاکتور سطر‌به‌سطر می‌آیند و در فاکتور نهایی تفکیک می‌شوند. نمونهٔ درخواستی کارفرما برای دستهٔ خدمات کامپیوتری به‌صورت کامل پیاده شده است: نصب ویندوز، ویروس‌یابی، بررسی و رفع ایرادات، نصب برنامه‌های کاربردی، نصب برنامه‌های شتاب‌دهنده، نصب برنامه‌های تخصصی و نصب و راه‌اندازی حسابداری — همگی با قیمت مستقل."),
  bodyPara("دکمهٔ «[+] افزودن ریز جزئیات» در پایین پنل هر خدمت است: مشتری نام قلم، قیمت پیشنهادی (اختیاری) و راه تماس را ثبت می‌کند؛ پیشنهاد به صف پشتیبانی می‌رود و پس از بررسی و زدن «تأیید پشتیبانی» در پنل مدیریت، برای همیشه به فهرست همان خدمت افزوده می‌شود. جریان مقابل نیز در پنل مدیریت با تب اختصاصی «ریز جزئیات درخواستی» پشتیبانی می‌شود و هر تأیید در گزارش فعالیت‌ها ثبت می‌گردد.", { after: 160 }),

  // ── ۵. هوش مصنوعی ──
  h1("۵. ساخت سریع خدمت نایاب با هوش مصنوعی"),
  bodyPara("اگر جستجوی مشتری در میز خدمات بی‌نتیجه باشد، به‌جای یک پیام سادهٔ «یافت نشد»، پنل هوشمند ظاهر می‌شود: «خدمت موردنیازتان در فهرست نیست؟ هوش مصنوعی فوراً آن را می‌سازد». پیش از هر کاری، درخواست از فیلتر خدمات غیرمجاز عبور می‌کند؛ فهرست کلیدواژه‌های ممنوع (مواد مخدر، سلاح، هک و نفوذ غیرمجاز، جعل اسناد، قاچاق، شرط‌بندی، محتوای غیراخلاقی، دورزدن تحریم‌ها و معادل‌های انگلیسی) به‌صورت قطعی و سمت سرور بررسی می‌شود و درخواست ممنوع با پیام شفاف رد می‌گردد."),
  bodyPara("درخواست مجاز به موتور هوش مصنوعی می‌رسد و آن خدمت با نام دوزبانه، توضیح، دستهٔ پیشنهادی، نرخ پایهٔ منطبق بر بازار و ۴ تا ۸ ریز جزئیات قیمت‌دار تعریف و بلافاصله در میز خدمات نمایش داده می‌شود — با نشان «ساخته‌شدهٔ هوش مصنوعی» و پرچم «در انتظار تأیید پشتیبانی». به این ترتیب «سرعت» بدون قربانی‌کردن نظارت تحقق می‌شود: خدمت فوراً موجود است و پشتیبانی هم پس از آن آن را بازبینی می‌کند."),

  // ── ۶. قطعات ──
  h1("۶. سفارش خرید قطعات در کنار خدمات"),
  bodyPara("در گام نخستِ ثبت سفارش، بخش «سفارش خرید قطعات» فعال است: ۴۰ قطعهٔ پرکاربرد از لپ‌تاپ و مانیتور تا SSD، رم، دوربین مداربسته و روتر. مشتری قطعه را تیک می‌زند، «مدل / مشخصات» دلخواه را تایپ می‌کند و تعداد را می‌دهد؛ قیمت روز هر قطعه کنارش نمایش داده می‌شود و در پیش‌فاکتور، جدول جداگانهٔ قطعات با جمع مستقل و «مبلغ نهایی (خدمات + قطعات)» ارائه می‌گردد. مبالغ قطعات در تسویهٔ اجرایی لحاظ نمی‌شود؛ فقط بخش خدمات بین مجری و سایر ذی‌نفعان تقسیم می‌شود و هزینهٔ قطعات به‌عنوان خرید کالا ثبت می‌گردد."),
  bodyPara("قیمت قطعات هم تابع نرخ روز تقویمی است: ضریبی که ادمین در تب «نرخ روز» برای تاریخ‌های خاص تعریف می‌کند، هم روی خدمات و هم روی قطعات اعمال می‌شود؛ بنابراین «به‌روزرسانی طبق تقویم» بدون هیچ مداخلهٔ دستی برای همهٔ قیمت‌ها یکدست است.", { after: 160 }),

  // ── ۷. جریان اصلاح قیمت ──
  h1("۷. قیمت‌ها طبق تقویم و جریان اصلاح قیمت کارشناس ← پشتیبانی"),
  bodyPara("موتور قیمت‌گذاری پویا حفظ شد: نرخ پایه × ضریب روز هفته × ضریب ساعت × نرخ روز ثبت‌شده − تخفیف معرف؛ و اکنون افزون بر آن، جریان رسمی اصلاح قیمت ساخته شد. کارشناس در تب «اصلاح قیمت‌ها» پنل مدیریت، خدمت یا قطعهٔ هدف را انتخاب می‌کند، قیمت اصلاح‌شده و دلیل را ثبت می‌نماید؛ پیشنهاد با وضعیت «در انتظار بررسی» و قیمت فعلی و پیشنهادی ذخیره می‌شود. پشتیبانی با فشردن «تأیید پشتیبانی»، قیمت جدید را به‌صورت رسمی جایگزین می‌کند (یا پیشنهاد را رد می‌کند) و کل زنجیره در لاگ فعالیت‌ها قابل ردگیری است. این همان الگویی است که کارفرما خواسته بود: به‌روزرسانی خودکار طبق تقویم + امکان اصلاح انسانی در صورت مغایرت با قیمت روز، مشروط به تأیید پشتیبانی."),

  // ── ۸. فوتر و میز محصولات ──
  h1("۸. تلفن پشتیبانی فقط در فوتر؛ میز محصولات خالی؛ نسخهٔ ۲٫۰"),
  bodyPara("به دستور کارفرما، شمارهٔ تماس پشتیبانی از سربرگ، منوی موبایل، صفحهٔ هلدینگ، تماس، راهنما، صندوق حمایت، پیگیری سفارش و پاسخ‌های ربات حذف شد و تنها محل نمایش آن، ستون «پشتیبانی» در فوتر پایین صفحه است — که از تنظیمات سامانه خوانده می‌شود تا تغییر آن بدون بازسازی باشد. در همان فوتر، برچسب نسخهٔ «v2.0-IR+WORLD — AloShetab.ir» نیز درج شده است. میز محصولات هلدینگ مطابق سیاست «فقط تولیدات خودی» فعلاً خالی است و به‌جای فضای خالی، حالت شفافی با پیام «به‌زودی محصولات خانوادهٔ هلدینگ» نمایش می‌دهد؛ زیرساخت سفارش محصول همچنان آماده است و با افزودن اولین محصول، بلافاصله فعال می‌شود."),

  // ── ۹. پذیرش و محرمانگی ──
  h1("۹. پذیرش، آزمون‌ها و قاعدهٔ محرمانگی"),
  bodyPara("همهٔ جریان‌های جدید با آزمون یکپارچه و بازبینی مرورگر احراز شد: درخواست غیرمجاز به هوش مصنوعی با کد FORBIDDEN رد شد؛ پیشنهاد ریز جزئیات ثبت و پس از تأیید پشتیبانی به‌صورت دائمی به کاتالوگ نشست؛ پیشنهاد اصلاح قیمت ثبت، تأیید و اعمال شد و سپس بازگردانی آزمون انجام گرفت؛ سفارش ترکیبی (خدمت + ریز جزئیات + قطعه با مدل) با کد رهگیری ثبت شد و جمع نهایی در پیش‌فاکتور مرورگر، دقیقاً معادل جمع سمت سرور بود (۱٬۱۰۰٬۰۰۰ تومان خدمات + ۶٬۵۰۰٬۰۰۰ تومان قطعه = ۷٬۶۰۰٬۰۰۰ تومان). بیلد Production standalone نیز بدون خطا ساخته شد."),
  bodyPara("قاعدهٔ محرمانگی سهم‌بندی تسویه در معماری جدید نیز مطلق باقی است: ریز جزئیات و قطعات فقط قیمت مشتری دارند، هیچ سهم یا درصدی از بک‌اند به هیچ رابط کاربری‌ای — وب، موبایل یا دسکتاپ — درز نمی‌کند و تسویه همچنان تنها پس از ثبت رضایت مشتری در لایهٔ سرور انجام می‌شود. با این تحویل، همهٔ خواسته‌های پیام ۱۰ عملیاتی شده است و سامانه آمادهٔ اتصال رسمی به AloShetab.ir و بهره‌برداری نسخهٔ ۲٫۰ است.", { after: 0 }),
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
            children: [faRun("استقرار دامنه و نسخهٔ ۲٫۰ الو شتاب | پیام ۱۰", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/پیام-۱۰-استقرار-و-نسخه-۲-میز-خدمات.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
