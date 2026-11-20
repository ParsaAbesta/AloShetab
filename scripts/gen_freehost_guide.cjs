// راهنمای استقرار هاست رایگان نامحدود — AloShetab.ir (v3.1.0) (Persian RTL)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (هم‌سان با پیام ۳ تا ۱۴)
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

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    bidirectional: true,
    spacing: { before: 240, after: 120, line: 340, lineRule: "atLeast" },
    children: [faRun(text, { size: 27, bold: true, color: HEAD_COLOR })],
  });
}

function codePara(lines) {
  return lines.map((line, i) => new Paragraph({
    bidirectional: false,
    alignment: AlignmentType.LEFT,
    spacing: { line: 276, after: i === lines.length - 1 ? 160 : 20, before: i === 0 ? 80 : 0 },
    shading: { type: ShadingType.CLEAR, fill: "F2EDE8" },
    indent: { left: 300, right: 300 },
    children: [new TextRun({ text: line, font: { ascii: "Consolas", hAnsi: "Consolas", cs: "Tahoma" }, size: 19, color: "3A3A3A" })],
  }));
}

function bullet(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { line: 312, after: 60 },
    indent: { right: 420, hanging: 210 },
    children: [
      faRun("•  ", { size: 22, bold: true, color: PAL.accent }),
      faRun(text, { size: opts.size || 22 }),
    ],
  });
}

function stepPara(num, title, text) {
  return [
    new Paragraph({
      bidirectional: true,
      spacing: { before: 220, after: 100, line: 340, lineRule: "atLeast" },
      children: [
        faRun(`گام ${num} — ${title}`, { size: 26, bold: true, color: "8A4B22" }),
      ],
    }),
    bodyPara(text),
  ];
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
  title: "راه‌اندازی سرور AloShetab.ir روی هاست رایگان نامحدود",
  subtitle: "v3.1.0 — سه مسیر کامل رایگان (ClawCloud Run / Vercel Hobby + Neon / Cloudflare)، رکوردهای دقیق DNS دامنهٔ ir، مهاجرت دیتابیس SQLite→Postgres، اتصال اپ‌های Android/iOS/Windows و آزمون پذیرش روی دامنهٔ نهایی",
  englishLabel: "FREE UNLIMITED HOSTING DEPLOYMENT GUIDE — ALOSHETAB.IR",
  metaLines: [
    "شماره سند: v3.1.0 — پیام استقرار هاست رایگان (تاریخ: ۱۸ نوامبر ۲۰۲۶ / ۲۷ آبان ۱۴۰۵)",
    "وضعیت سامانه: ۷۴ آزمون دود v3.0 سبز | آزمون پذیرش دامنه ۱۸ سنجه | پلن v3 فعال",
    "دامنه: aloshetab.ir ثبت‌شده — NSهای فعلی hostiran بی‌پاسخ (lame delegation) و نیازمند ثبت رکوردها",
    "اپ‌ها: APK ایران/جهانی و پنل مدیریت از قبل به www.aloshetab.ir اشاره می‌کنند — با انتشار دامنه، بدون بازسازی کار می‌کنند",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "v3.1.0 — هاست رایگان نامحدود",
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
  bodyPara("این سند، دستور «سرور دامنهٔ AloShetab.ir را بر روی هاست رایگان نامحدود راه‌اندازی کن» را به کامل‌ترین شکل ممکن اجرا می‌کند. آنچه در این انتشار (v3.1.0) انجام شد: نخست، وضعیت دامنه بررسی شد — دامنهٔ aloshetab.ir ثبت شده ولی سرورهای نام (ns2.hostiran.net و 5.144.130.130) فعلاً به هیچ فایلی پاسخ نمی‌دهند (lame delegation)، پس تنها اقدام دامنه‌ای باقی‌مانده، ثبت رکوردهای DNS است. دوم، سه مسیر رایگان واقعی با داده‌های به‌روز ۲۰۲۶ شناسایی و مقایسه شد: ClawCloud Run (اعتبار ماهانهٔ ~۵ دلاری بدون کارت)، Vercel Hobby + دیتابیس ابری Neon، و Cloudflare — و مسیر پیشنهادی اصلی برای مخاطب ایرانی، ClawCloud Run تعیین شد چون بدون هیچ تغییری در کد، همین کانتینر Docker موجود را با دیتابیس SQLite ماندگار اجرا می‌کند و بازدیدکنندهٔ داخل ایران را نیز بدون خطا سرو می‌کند. سوم، کل ابزار استقرار ساخته شد: پیکربندی Vercel، اسکیمای کامل Postgres، اسکریپت انتقال خودکار دادهٔ SQLite به Postgres (۲٬۳۴۳ ردیف فعلی، با تبدیل خودکار تاریخ و مقادیر منطقی)، مستندات گام‌به‌گام هر سه مسیر، جدول دقیق رکوردهای DNS و اسکریپت آزمون پذیرش ۱۸ سنجه‌ای روی دامنهٔ نهایی. چهارم، برای اینکه اپلیکیشن مجزای پنل مدیریت (پیام ۱۴) روی دامنه کار کند، مسیر مستقل /admin به‌صورت صفحهٔ واقعی ساخته شد — پیش از این، پنل فقط نمای داخلی صفحهٔ اصلی بود و آدرس /admin خطای 404 می‌داد."),
  bodyPara("دو گام فقط با اقدام خودِ مالک ممکن است و در اختیار هیچ توسعه‌دهنده‌ای نیست: (۱) ساختن حساب روی سرویس هاست منتخب (نیاز به تأیید ایمیل/حساب GitHub دارد) و (۲) ثبت رکوردهای DNS در پنل ثبت‌کنندهٔ دامنه. برای هر دو، راهنمای گام‌به‌گام و رکوردهای آمادهٔ کپی در همین سند و در بستهٔ alo_shetab_freehost_v3.1.0.zip موجود است؛ پس از انجام این دو گام، سایت روی https://www.aloshetab.ir بالا می‌آید و همهٔ اپ‌های تحویل‌شده (APK ایران fa، APK جهانی en، پنل مدیریت اندروید، نسخه‌های Windows و iOS) بدون هیچ بازسازی به همان آدرس وصل می‌شوند.", { after: 160 }),

  // ── ۱. وضعیت فعلی ──
  h1("۱. وضعیت فعلی — آنچه بررسی شد و آنچه آماده است"),
  bodyPara("برای تصمیم‌گیری درست، وضعیت هر جزء سامانه و دامنه در تاریخ ۲۷ آبان ۱۴۰۵ (۱۸ نوامبر ۲۰۲۶) بررسی و ثبت شد. نکتهٔ کلیدی: دامنه ثبت است ولی هنوز «باز نمی‌شود»، چون NSهای فعلی هیچ فایل DNS سرو نمی‌کنند؛ یعنی هیچ رکورد فعلی نباید حفظ شود و می‌توان مستقیم رکوردهای هاست جدید را ثبت کرد."),
  tableCaption("جدول ۱ — وضعیت اجزای انتشار (بررسی‌شده در ۱۴۰۵/۰۸/۲۷)"),
  rtlTable([30, 22, 48],
    ["جزء", "وضعیت", "یادداشت"],
    [
      ["دامنهٔ aloshetab.ir", "ثبت‌شده", "NS فعلی: ns2.hostiran.net (37.27.81.177) و 5.144.130.130 — بی‌پاسخ (lame delegation)"],
      ["سرور وب (Next.js 16 + Prisma)", "آماده و تست‌شده", "ساخت production کامل؛ smoke رسمی v3.0: ۷۴/۷۴ سبز"],
      ["مسیر مستقل پنل مدیریت /admin", "جدید در v3.1.0", "قبلاً 404 می‌داد؛ اکنون صفحهٔ واقعی است و اپ مجزای مدیریت روی دامنه کار می‌کند"],
      ["APK نسخهٔ ایران (fa) و جهانی (en)", "آمادهٔ دامنه", "هر دو به https://www.aloshetab.ir اشاره می‌کنند — بدون بازسازی کار می‌کنند"],
      ["پنل مدیریت اندروید/ویندوز/iOS", "آمادهٔ دامنه", "آدرس https://www.aloshetab.ir/admin روی هر سه پوسته ثبت است"],
      ["پلن قیمت‌گذاری v3", "فعال", "کارشناس ۱۶٫۵–۲۰٪+ (پیش‌فرض ۱۸) + پلتفرم ۱۰–۱۶٫۵٪ (پیش‌فرض ۱۲)؛ پلن ۳۳٪ حذف‌شده"],
      ["دیتابیس SQLite محلی", "۹۴۸ کیلوبایت", "۲٬۳۴۳ ردیف در ۳۴ جدول — آمادهٔ انتقال با اسکریپت مهاجرت"],
    ]),

  // ── ۲. مقایسهٔ سه مسیر ──
  h1("۲. سه مسیر رایگان واقعی — مقایسه و انتخاب"),
  bodyPara("«هاست رایگان نامحدود» در دنیای Next.js یعنی یکی از سه خانوادهٔ زیر؛ هاست‌های رایگان PHP (مثل InfinityFree) اصلاً قادر به اجرای Node.js نیستند و از فهرست حذف شدند. برای هر مسیر، محدودیت‌های رسمی پلن رایگان در ۲۰۲۶ بررسی شد و مهم‌ترین یافته، مشکل دسترسی Vercel برای بازدیدکنندهٔ داخل ایران است: به دلیل NAT سراسری اینترنت ایران و فیلترینگِ اشتباهِ IPهای مشترک، سایت‌های روی Vercel برای بازدیدکنندهٔ ایرانی خطای 403 می‌دهند — برای سرویسی که مشتریانش داخل ایران‌اند، این یعنی Vercel به‌تنهایی گزینهٔ اصلی نیست."),
  tableCaption("جدول ۲ — مقایسهٔ سه مسیر رایگان (وضعیت ۲۰۲۶)"),
  rtlTable([24, 26, 25, 25],
    ["معیار", "الف) ClawCloud Run — پیشنهاد اصلی", "ب) Vercel Hobby + Neon", "ج) Cloudflare (پیشرفته)"],
    [
      ["هزینه", "صفر — اعتبار ~۵ دلار/ماه دائمی، بدون کارت", "صفر — بدون کارت", "صفر — پلن Free"],
      ["تغییر کد", "هیچ — همان Dockerfile موجود", "SQLite→Postgres؛ فایل‌ها آماده است", "بازنویسی لایهٔ دیتا به D1 + OpenNext (سنگین)"],
      ["دیتابیس", "همان SQLite روی Volume ماندگار", "Neon Postgres رایگان (۱ گیگابایت)", "D1 یا Hyperdrive"],
      ["پهنای باند", "آزاد تا سقف اعتبار", "۱۰۰ گیگابایت/ماه", "واقعاً نامحدود"],
      ["بازدیدکننده از ایران", "بدون مشکل", "خطای 403 (NAT/تحریم) — با CDN واسط فقط دورزدنی است", "بهترین دسترسی"],
      ["دامنهٔ سفارشی + HTTPS", "بله — خودکار", "بله — خودکار", "بله"],
      ["نکتهٔ حقوقی پلن", "مصرف سبک داخل اعتبار", "Hobby «غیرتجاری» است — سرویس تجاری نیاز به Pro دارد", "مجاز برای تجاری"],
      ["زمان راه‌اندازی", "حدود ۲۰ دقیقه", "حدود ۴۵ دقیقه (با VPN هنگام ثبت‌نام)", "چند روز (بازنویسی دیتا)"],
    ]),
  bodyPara("جمع‌بندی: مسیر الف را اجرا کنید — کمترین ریسک، هیچ تغییر کد، دیتابیس همان SQLite شناخته‌شده، و دسترسی مطمئن بازدیدکنندهٔ ایرانی. اگر در آینده ترافیک بالا رفت، NS دامنه را به Cloudflare منتقل کنید تا کش و محافظت رایگان هم روی همان مسیر اضافه شود. مسیر ب به‌عنوان گزینهٔ دوم مستند شده (ساده‌ترین بیلد Next.js، مناسب اگر مشتریان خارج از ایران باشند یا Cloudflare واسط شود) و مسیر ج برای بعد از رشد ذخیره شده است.", { after: 160 }),

  // ── ۳. مسیر الف ──
  h1("۳. مسیر الف — ClawCloud Run (پیشنهاد اصلی)"),
  bodyPara("ClawCloud Run پلتفرم کانتینری است که به هر حساب واجد شرایط اعتبار ماهانهٔ ~۵ دلاری دائمی می‌دهد (بدون کارت بانکی؛ شرط: حساب GitHub با عمر حداقل ۱۸۰ روز). پیکربندی پیشنهادی (۰٫۵ vCPU و ۱ گیگابایت رم) مصرفی در حدود چند دلار در ماه دارد و داخل سقف رایگان می‌ماند. چون اپلیکیشن دقیقاً همان کانتینر مستند DEPLOYMENT.md است، هیچ تغییری در کد لازم نیست."),
  ...stepPara("۱", "ساخت و ارسال ایمیج Docker", "در پوشهٔ پروژهٔ الو شتاب (بستهٔ alo_shetab_release_v3.0.zip باز‌شده)، ایمیج بسازید و به Docker Hub بفرستید. نام کاربری Docker Hub خود را جای <user> بگذارید:"),
  ...codePara([
    "# در ریشهٔ پروژه (کنار Dockerfile)",
    "docker build -t <user>/aloshetab:3.1.0 .",
    "docker login",
    "docker push <user>/aloshetab:3.1.0",
  ]),
  ...stepPara("۲", "ثبت‌نام و ورود", "به run.claw.cloud بروید و با GitHub وارد شوید. پس از ورود، کنسول باز می‌شود و اعتبار رایگان به‌صورت خودکار فعال است. اپلیکیشن‌ها را از بخش App Launchpad می‌سازید."),
  ...stepPara("۳", "ساخت اپلیکیشن", "در App Launchpad → Create Application، مطابق جدول زیر پر کنید:"),
  tableCaption("جدول ۳ — پیکربندی اپلیکیشن در App Launchpad"),
  rtlTable([30, 70],
    ["فیلد", "مقدار"],
    [
      ["Application Name", "aloshetab"],
      ["Image", "<user>/aloshetab:3.1.0 — نوع Public"],
      ["Usage (CPU / RAM)", "0.5 vCPU — 1 GB RAM"],
      ["Replicas", "1"],
      ["Network → Container Port", "3000"],
      ["Network → Enable Internet", "روشن"],
    ]),
  ...stepPara("۴", "متغیرهای محیطی", "در Advanced → Environment چهار مقدار پایه را ثبت کنید:"),
  tableCaption("جدول ۴ — متغیرهای محیطی الزامی"),
  rtlTable([34, 66],
    ["کلید", "مقدار"],
    [
      ["DATABASE_URL", "file:/app/db/custom.db"],
      ["NODE_ENV", "production"],
      ["SEED_ON_START", "true — فقط در نخستین راه‌اندازی؛ بعداً false کنید"],
      ["SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS", "در صورت تمایل به ایمیل گزارش‌ها (بخش ۶)"],
    ]),
  ...stepPara("۵", "Volume ماندگار دیتابیس", "در بخش Storage یک Volume بسازید تا پایگاه داده با ری‌استارت و آپدیت نسخه از بین نرود: مسیر بستن /app/db و حجم 1 GB. بدون این مرحله، هر بازنشر، داده‌ها را خالی می‌کند."),
  ...stepPara("۶", "دامنهٔ سفارشی و HTTPS", "در بخش Network → Custom Domain دو دامنه را اضافه کنید: aloshetab.ir و www.aloshetab.ir. کنسول یک مقدار CNAME (مشابه xxxx.<region>.clawcloud.run) نمایش می‌دهد؛ همین مقدار را در گام DNS استفاده می‌کنید. گواهی HTTPS هر دو دامنه به‌صورت خودکار صادر می‌شود."),
  ...stepPara("۷", "ثبت رکوردهای DNS", "طبق بخش ۵ همین سند، رکوردها را در پنل ثبت‌کننده ثبت کنید. پروپاگیشن معمولاً چند دقیقه تا چند ساعت طول می‌کشد؛ با دستورات بررسی بخش ۵ از باز شدن دامنه مطمئن شوید."),
  ...stepPara("۸", "اولین بوت و بارگذاری کامل داده‌ها", "در نخستین اجرا، خودِ کانتینر اسکیمای دیتابیس را می‌سازد و کاتالوگ رسمی را بارگذاری می‌کند (SEED_ON_START=true). برای بارگذاری کامل داده‌های نسخهٔ ۳ (انبارها، فروشگاه‌ها، میز کالا، قطعات)، یک‌بار از کنسول اپ ترمینال باز کنید و اجرا کنید:"),
  ...codePara([
    "cd /app",
    "node scripts/seed_v2.mjs",
    "node scripts/seed_p11.mjs",
    "node scripts/seed_p13.mjs",
    "node scripts/seed_p14.mjs",
    "node scripts/seed_p14_contacts.mjs",
  ]),
  bodyPara("سپس در تنظیمات اپ، SEED_ON_START را روی false بگذارید و یک بار Deploy دوباره بزنید تا کانتینر با پیکربندی نهایی بالا بیاید."),
  ...stepPara("۹", "آزمون پذیرش روی دامنهٔ نهایی", "از سیستم خودتان اسکریپت ۱۸ سنجه‌ای بسته را اجرا کنید؛ همهٔ سنجه‌ها باید PASS باشند:"),
  ...codePara([
    "python3 deploy/post_deploy_check.py https://www.aloshetab.ir",
    "# مورد انتظار: PASS=18 FAIL=0 و در پایان FINAL_OK",
  ]),
  ...stepPara("۱۰", "بهره‌برداری و نگهداری", "سه کار روزانه/ماهانه: کرون شبانهٔ tick از سرویس رایگان خارجی (cron-job.org — ساعت ۲۱:۳۰ تهران، آدرس https://www.aloshetab.ir/api/tick?key=<کلید تب تنظیمات>) تا گزارش روزانهٔ قیمت و حسابرسی حسابدار هوشمند اجرا شود؛ بکاپ روزانهٔ فایل /app/db/custom.db از کنسول؛ و بازبینی مصرف اعتبار در داشبورد. برای آپدیت نسخهٔ جدید فقط ایمیج جدید بسازید و مقدار Image را عوض کنید — داده‌ها روی Volume می‌مانند."),
  tableCaption("جدول ۵ — عیب‌یابی مسیر الف"),
  rtlTable([36, 64],
    ["نشانه", "علت و راه‌حل"],
    [
      ["داده‌ها بعد از Deploy از بین می‌روند", "Volume روی /app/db نبسته — گام ۵ را کامل کنید"],
      ["خطای Prisma در استارت", "DATABASE_URL تعریف نشده — گام ۴"],
      ["کاتالوگ خالی است", "SEED_ON_START در نخستین بوت true نبود یا زنجیرهٔ seed اجرا نشده — گام ۸"],
      ["دامنه باز نمی‌شود", "رکورد CNAME اشتباه یا پروپاگیشن ناتمام — بخش ۵ و دستورات بررسی"],
      ["خطای 522/524 در Cloudflare", "حالت SSL باید Full باشد، نه Full (strict)"],
      ["قیمت‌ها بروز نمی‌شوند", "کرون شبانهٔ tick فعال نیست — گام ۱۰"],
    ]),

  // ── ۴. مسیر ب ──
  h1("۴. مسیر ب — Vercel Hobby + Neon Postgres"),
  bodyPara("دو هشدار مهم پیش از شروع (بررسی‌شده در ۲۰۲۶): نخست، بازدیدکنندهٔ داخل ایران از IPهای مشترک دروازهٔ اینترنت، هنگام باز کردن سایت‌های Vercel خطای 403 می‌گیرد؛ اگر مشتریان داخل ایران‌اند یا مسیر الف را اجرا کنید یا پس از انتشار NS دامنه را به Cloudflare رایگان منتقل کنید تا بازدیدکننده از لبهٔ Cloudflare سرویس بگیرد. دوم، پلن Hobby برای پروژهٔ غیرتجاری است؛ برای سرویس تجاری باید پلن Pro شود — تا پیش از آن، مسیر الف جایگزین درست‌تری است. با این وجود، اگر هدف انتشار سریع Next.js با بهترین DX است، مسیر ب کامل مستند شده:"),
  ...stepPara("۱", "دیتابیس رایگان Neon", "در neon.com ثبت‌نام کنید (بدون کارت). پروژه‌ای با نام aloshetab بسازید و Region نزدیک ایران یعنی AWS Frankfurt را انتخاب کنید. Connection String (نوع Pooled) را کپی کنید."),
  ...stepPara("۲", "کد روی GitHub", "فایل‌های vercel.json و prisma/schema.postgres.prisma از بستهٔ v3.1.0 را در ریشهٔ پروژه بگذارید و مخزن را به GitHub بفرستید:"),
  ...codePara([
    "git init && git add -A && git commit -m \"AloShetab v3.1.0 - free host deploy\"",
    "git branch -M main",
    "git remote add origin https://github.com/<user>/aloshetab.git",
    "git push -u origin main",
  ]),
  ...stepPara("۳", "Import در Vercel و Deploy", "در vercel.com با GitHub وارد شوید، مخزن را Import کنید و فقط یک متغیر محیطی بسازید: DATABASE_URL = Connection String Neon (برای هر سه محیط Production/Preview/Development). vercel.json خودش دستور build صحیح (تولید کلاینت Prisma + ساخت اسکیما روی Neon + build) را اعمال می‌کند. اولین build حدود ۲ تا ۳ دقیقه است."),
  ...stepPara("۴", "بارگذاری داده‌ها — دو راه", "راه اول (انتقال کامل دادهٔ واقعی SQLite): اسکریپت مهاجرت خودکار، مدل‌ها، فیلدهای منطقی و تاریخ‌ها را تبدیل و خروجی SQL سازگار با psql می‌سازد:"),
  ...codePara([
    "export PG=\"<Connection String Neon>\"",
    "npx prisma db push --schema prisma/schema.postgres.prisma",
    "python3 scripts/migrate_sqlite_to_postgres.py",
    "psql \"$PG\" -f alo_shetab_migration.sql",
  ]),
  bodyPara("راه دوم (کاتالوگ رسمی از نو، بدون دادهٔ قدیمی): زنجیرهٔ seed رسمی نسخهٔ ۳ اجرا می‌شود:"),
  ...codePara([
    "export PG=\"<Connection String Neon>\"",
    "for s in seed104 seed_v2 seed_p11 seed_p13 seed_p14 seed_p14_contacts; do",
    "  DATABASE_URL=\"$PG\" node scripts/$s.mjs",
    "done",
  ]),
  ...stepPara("۵", "اتصال دامنه", "در Project → Settings → Domains هر دو دامنهٔ aloshetab.ir و www.aloshetab.ir را اضافه کنید؛ Vercel رکوردهای لازم (جدول بخش ۵) را نشان می‌دهد و گواهی HTTPS خودکار صادر می‌شود."),
  ...stepPara("۶", "بهره‌برداری", "رمزهای مالک/ادمین را از تب تنظیمات پنل عوض کنید، SMTP را در متغیرهای محیطی اضافه و Redeploy کنید، کرون شبانهٔ tick را از cron-job.org تنظیم کنید و مصرف ماهانه را در Project → Usage ببینید (سقف Hobby: ۱۰۰ گیگابایت انتقال، ۱ میلیون درخواست CDN، ۱ میلیون فراخوانی تابع)."),

  // ── ۵. DNS ──
  h1("۵. DNS دامنهٔ AloShetab.ir — رکوردهای دقیق"),
  bodyPara("وضعیت فعلی دامنه (بررسی‌شده با dns.google): سرورهای نام فعلی ns2.hostiran.net و 5.144.130.130 هستند ولی به هیچ فایلی پاسخ نمی‌دهند (پیام lame delegation). یعنی هیچ رکورد فعلی وجود ندارد و باید یکی از دو راه زیر انتخاب شود. راه ساده: در همان پنل فعلی رکورد بسازید. راه پیشنهادی: NS دامنه را به Cloudflare رایگان بدهید (دامنهٔ ir تغییر NS را در ایرنیک کامل پشتیبانی می‌کند) تا مدیریت DNS ساده شود، CNAME روی دامنهٔ ریشه به‌طور خودکار flatten شود و کش و محافظت رایگان هم اضافه شود."),
  tableCaption("جدول ۶ — رکوردهای مسیر الف (ClawCloud) — مقدار CNAME را از کنسول کپی کنید"),
  rtlTable([16, 18, 40, 26],
    ["نوع", "نام/Host", "مقدار", "توضیح"],
    [
      ["CNAME", "www", "<CNAME-CLAWCLOUD>", "دامنهٔ اصلی اپ‌ها (www.aloshetab.ir)"],
      ["CNAME/ALIAS", "@", "<CNAME-CLAWCLOUD>", "دامنهٔ ریشه؛ اگر پنل اجازه نداد، فقط www را ثبت و دامنهٔ سفارشی کنسول را روی www نگه دارید — یا راه Cloudflare"],
    ]),
  tableCaption("جدول ۷ — رکوردهای مسیر ب (Vercel)"),
  rtlTable([16, 18, 40, 26],
    ["نوع", "نام/Host", "مقدار", "توضیح"],
    [
      ["A", "@", "76.76.21.21", "دامنهٔ ریشه"],
      ["CNAME", "www", "cname.vercel-dns.com", "دامنهٔ www — گواهی خودکار"],
    ]),
  h2("۵-۱) راه پیشنهادی — انتقال NS به Cloudflare رایگان"),
  ...codePara([
    "1) dash.cloudflare.com -> Add a Site -> aloshetab.ir -> پلن Free",
    "2) دو NS که Cloudflare می‌دهد را کپی کنید (مثلاً ada.ns.cloudflare.com و bob.ns.cloudflare.com)",
    "3) در پنل ثبت‌کننده/ایرنیک: Nameserverهای دامنه را به همان دو مقدار تغییر دهید",
    "4) در DNS records کلادفلر:",
    "   CNAME  @    -> <CNAME-CLAWCLOUD>   (Proxy: روشن)",
    "   CNAME  www  -> <CNAME-CLAWCLOUD>   (Proxy: روشن)",
    "5) SSL/TLS -> Overview -> حالت Full",
  ]),
  bodyPara("برای مسیر ب روی Cloudflare، همان دو رکورد جدول ۷ را ثبت کنید ولی پروکسی را خاموش (خاکستری) بگذارید تا Vercel خودش گواهی صادر کند."),
  h2("۵-۲) بررسی صحت DNS"),
  ...codePara([
    "# وضعیت NS و رکوردها (باید پاسخ بدهد؛ دیگر REFUSED نباشد)",
    "curl -s \"https://dns.google/resolve?name=aloshetab.ir&type=NS\"",
    "curl -s \"https://dns.google/resolve?name=www.aloshetab.ir&type=A\"",
    "curl -s \"https://dns.google/resolve?name=aloshetab.ir&type=A\"",
    "",
    "# آزمون کامل سامانه روی دامنهٔ نهایی",
    "python3 deploy/post_deploy_check.py https://www.aloshetab.ir",
  ]),
  bodyPara("TTL را برای روزهای اول ۳۶۰۰ ثانیه بگذارید. اگر NS همچنان REFUSED داد، رکوردها ثبت نشده‌اند یا تغییر NS هنوز اعمال نشده است؛ اگر رکورد درست بود ولی سایت باز نشد، چند دقیقه صبر و کش مرورگر را خالی کنید."),

  // ── ۶. پس از انتشار ──
  h1("۶. پس از انتشار — چک‌لیست بهره‌برداری"),
  bodyPara("پس از سبز شدن دامنه، هشت مورد زیر را به‌ترتیب انجام دهید؛ آیتم‌های ۱ تا ۳ امنیتی‌اند و نباید به بعدِ فردا موکول شوند:"),
  bullet("آزمون کامل post_deploy_check.py روی https://www.aloshetab.ir — همهٔ سنجه‌ها PASS (DNS، HTTPS و گواهی، صفحهٔ اصلی، کاتالوگ ایران ۱۱۸ خدمت و جهانی ۱۰۹ خدمت، میز کالا با پلن v3، حداقل فاکتور ۵٬۰۰۰٬۰۰۰، انبارها، قطعات، پنل /admin، محرمانگی سهم‌ها، PWA و robots)."),
  bullet("تغییر رمزهای مالک (owner) و ادمین (admin) از تب تنظیمات پنل — رمزهای اولیه فقط برای استقرار بود."),
  bullet("تکمیل SMTP_* و دریافت ایمیل آزمایشی گزارش تا صف گزارش‌های بک‌اند خالی شود."),
  bullet("تنظیم کرون شبانهٔ tick روی ساعت ۲۱:۳۰ تهران از cron-job.org (رایگان) با همان کلید تب تنظیمات."),
  bullet("بکاپ روزانهٔ فایل دیتابیس (در مسیر الف: دانلود /app/db/custom.db از کنسول؛ در مسیر ب: پشتیبان‌گیری Neon)."),
  bullet("بازبینی مصرف پلن (ClawCloud: داشبورد اعتبار؛ Vercel: Project → Usage؛ Neon: داشبورد مصرف)."),
  bullet("نصب APK نسخهٔ ایران روی گوشی و تست کامل سفارش تا پرداخت روی دامنهٔ واقعی."),
  bullet("ثبت دامنه در Search Console و ساخت sitemap برای شروع نمای گوگل (اختیاری ولی توصیه‌شده)."),

  // ── ۷. عیب‌یابی عمومی ──
  h1("۷. عیب‌یابی عمومی"),
  tableCaption("جدول ۸ — نشانه‌های رایج و راه‌حل"),
  rtlTable([36, 64],
    ["نشانه", "علت و راه‌حل"],
    [
      ["دامنه REFUSED می‌دهد", "NSها فایل سرو نمی‌کنند — رکوردها یا تغییر NS ثبت نشده (بخش ۵)"],
      ["گواهی HTTPS خطا می‌دهد", "چند دقیقه صبر برای صدور خودکار؛ در Cloudflare حالت SSL باید Full باشد"],
      ["خطای 403 برای بازدیدکنندهٔ ایرانی روی Vercel", "محدودیت شناخته‌شدهٔ ۲۰۲۶ — مسیر الف یا NS→Cloudflare"],
      ["صفحهٔ پنل مدیریت باز نمی‌شود", "از v3.1.0 مسیر /admin صفحهٔ واقعی است — بستهٔ قدیمی‌تر را با نسخهٔ جدید بروزرسانی کنید"],
      ["سفارش ثبت نمی‌شود روی مسیر ب", "Connection String باید Pooled با sslmode=require باشد"],
      ["گزارش روزانهٔ قیمت ساخته نمی‌شود", "کرون tick فعال نیست یا کلید تغییر کرده — بخش ۶"],
      ["مصرف اعتبار ClawCloud زود تمام می‌شود", "CPU/RAM را به 0.5/1GB برگردانید و Replicas را روی 1 نگه دارید"],
      ["قیمت توافقی انبار در API عمومی دیده می‌شود", "هرگز نباید رخ دهد — post_deploy_check آن را می‌سنجد؛ اگر دیدید، نسخهٔ بسته را با v3.1.0 هم‌تراز کنید"],
    ]),

  // ── ۸. پیوست ──
  h1("۸. پیوست — بستهٔ استقرار v3.1.0 و محرمانگی"),
  bodyPara("همهٔ فایل‌های این انتشار در بستهٔ alo_shetab_freehost_v3.1.0.zip (کنار همین سند) جمع شده‌اند و هش SHA-256 همهٔ اقلام تحویل در CHECKSUMS-v3.1.0.sha256 ثبت است؛ پیش از استفاده، با دستور sha256sum -c CHECKSUMS-v3.1.0.sha256 تطبیق دهید."),
  tableCaption("جدول ۹ — محتوای بستهٔ alo_shetab_freehost_v3.1.0.zip"),
  rtlTable([40, 60],
    ["فایل", "نقش"],
    [
      ["README-FA.md", "نمای کلی سه مسیر + شروع سریع ۱۰ گام"],
      ["clawcloud-FA.md", "راهنمای گام‌به‌گام مسیر الف"],
      ["vercel-FA.md", "راهنمای گام‌به‌گام مسیر ب"],
      ["dns-FA.md", "رکوردهای DNS هر دو مسیر + پنل ثبت‌کننده + Cloudflare"],
      ["vercel.json", "پیکربندی مسیر ب — در ریشهٔ پروژه کپی شود"],
      [".env.production.example", "قالب متغیرهای محیطی (SQLite و Neon)"],
      ["prisma/schema.postgres.prisma", "اسکیمای کامل Postgres (مسیر ب)"],
      ["scripts/migrate_sqlite_to_postgres.py", "انتقال خودکار دادهٔ SQLite به Postgres"],
      ["deploy/post_deploy_check.py", "آزمون پذیرش ۱۸ سنجه‌ای روی دامنهٔ نهایی"],
    ]),
  bodyPara("قاعدهٔ محرمانگی همچنان مطلق و دست‌نخورده است: درصدهای سهم‌بندی تسویه (۴/۷ انجام‌دهنده، ۱/۷ معرف، ۲/۷ ألو شتاب)، قیمت توافقی انبارها و مبالغ حسابرسی فقط در پایگاه داده و ایمیل بک‌اند می‌مانند و در هیچ پاسخ API و هیچ صفحه‌ای از رابط عمومی نمایش داده نمی‌شوند؛ اسکریپت آزمون پذیرش این مورد را روی دامنهٔ نهایی نیز کنترل می‌کند. هاست رایگان هیچ تغییری در این سیاست نمی‌دهد و توصیه می‌شود پس از انتشار، دسترسی پنل مدیریت فقط با رمزهای تازه‌تعیین‌شده انجام شود.", { after: 0 }),
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
            children: [faRun("راه‌اندازی AloShetab.ir روی هاست رایگان نامحدود | v3.1.0", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/راهنمای-هاست-رایگان-گام-به-گام-v3.1.0.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
