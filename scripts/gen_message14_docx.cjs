// پیام ۱۴ — پلن جدید قیمت‌گذاری v3.0، لیست تمام انبارها، نسخه ایران fa / نسخه جهانی en (Persian RTL)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (هم‌سان با پیام ۳ تا ۱۳)
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
  title: "پلن جدید قیمت‌گذاری v3.0 و لیست تمام انبارها",
  subtitle: "پیام ۱۴ — حذف کامل پلن ۳۳٪؛ فروش به قیمت گران‌ترین فروشگاه؛ خرید از پائین‌ قیمت‌ترین انبارها؛ موجودی فقط از بروزترین انبار؛ سهم کارشناس ۱۶٫۵ تا ۲۰ درصد یا بیشتر و مابقی (۱۰ تا ۱۶٫۵ درصد) افزایش قیمت؛ تحویل کامل همهٔ فایل‌ها با شماره‌گذاری v3.0 — نسخهٔ ایران fa و نسخهٔ جهانی en",
  englishLabel: "PRICING PLAN v3.0, FULL WAREHOUSE DIRECTORY, IRAN-FA / WORLD-EN EDITIONS",
  metaLines: [
    "شماره سند: پیام ۱۴ — تحویل نسخهٔ ۳٫۰ (تاریخ پیام: ۱۸ نوامبر ۲۰۲۶)",
    "تاریخ تنظیم: ۲۷ آبان ۱۴۰۵",
    "دستاورد کلیدی: پلن v3 اجرا شد (کارشناس ۱۸٪ + پلتفرم ۱۲٪) | ۱۳ انبار در فهرست کامل | ۳۸ استعلام انبار با موجودی",
    "وضعیت: ۷۴ آزمون دود سبز | دو APK نسخهٔ ۳٫۰ (ایران/جهانی) امضاشده | بستهٔ کامل فایل‌ها با شماره‌گذاری v3.0",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "پیام ۱۴ — پلن v3.0 و انبارها",
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
  bodyPara("این سند، پیام چهاردهم را در سامانه الو شتاب اعمال و نسخهٔ ۳٫۰ را تحویل می‌دهد. پیام ۱۴ پنج دستور اصلی دارد. نخست «لیست تمام انبار ها» — فهرست انبارهای پنل ادمین به ۱۳ مجموعه گسترش یافت و برای هر کالا استعلام جداگانهٔ انبار با «قیمت انبار، قیمت توافقی خرید و موجودی لحظهٔ استعلام» ساخته شد. دوم «پلن ۳۳٪ از میز محصولات حذف شود» — افزودنی ثابت ۳۳٪ (و قاعدهٔ رقابتی ۱۵٪) به‌کلی از سامانه حذف شد و هیچ اثری از آن در میز محصولات، صفحهٔ پرداخت، تنظیمات و گزارش روزانه باقی نمانده است. سوم، پلن جدید جایگزین شد: لیست بروزترین قیمت بروزترین انبارها در میز محصولات نمایش داده می‌شود؛ موجودی هر کالا فقط از بروزترین استعلام انبار خوانده می‌شود؛ خرید و تأمین موجودی از پائین‌ قیمت‌ترین انبارها انجام می‌شود و پایهٔ فروش هر کالا، قیمت گران‌ترین فروشگاه است. چهارم، ساختار افزودنی پرداخت به «سهم کارشناس ۱۶٫۵ تا ۲۰ درصد یا بیشتر + مابقی (۱۰ تا ۱۶٫۵ درصد) افزایش قیمت پلتفرم» تغییر کرد — پیش‌فرض سامانه ۱۸٪ کارشناس + ۱۲٪ پلتفرم (مجموع ۳۰٪) است و هر دو عدد فقط مالک می‌تواند در بازهٔ مجاز تغییر دهد. پنجم، آخرین نسخهٔ همهٔ فایل‌ها با شماره‌گذاری v3.0 تحویل شد: بستهٔ کامل کد، دو اپلیکیشن اندروید امضاشده (نسخهٔ ایران fa و نسخهٔ جهانی en)، فایل چک‌سام، به‌روزرسانی راهنما و همین سند."),
  bodyPara("همهٔ قواعد تثبیت‌شدهٔ پیام‌های قبل — حداقل مبلغ دریافتی هر فاکتور ۵٬۰۰۰٬۰۰۰ تومان، گیت تازگی قیمت‌ها (فقط بعد از ۱۴۰۵/۰۸/۱۰)، شبای حساب دریافت، آدرس دقیق مشتری، سفارش خدمات کنار خرید، مراحل فاکتور، حسابدار هوشمند و محرمانگی کامل قیمت توافقی و سهم‌بندی تسویه — دست‌نخورده و فعال باقی‌مانده‌اند. مجموعهٔ آزمون دود نسخهٔ ۳٫۰ با ۷۴ سنجه اجرا شد و همه سبز شدند؛ ریزدیسکی‌های عددی همین سند مستقیماً از پاسخ واقعی سامانه در آزمون تولید برداشته شده است.", { after: 160 }),

  // ── ۱. انبارها ──
  h1("۱. لیست تمام انبارها در پنل ادمین"),
  bodyPara("تب «انبارها و مراجع قیمت» پنل ادمین اکنون فهرست کامل ۱۳ مجموعه را نگه می‌دارد: انبارهای سخت‌افزار (کامپیوتر افق، افق سیستم)، منابع لوازم خانگی (فرالند، افق کوروش، تراست مارکت‌پلیس)، بازارهای آنلاین (دیجی‌کالا، اسنپ)، مقایسه‌گرها و مراجع قیمت (ترب، ایمالز، دلگرم، گجت‌نیوز، موبیت) و مرجع خدمات (آچاره). برای هر انبار، راه‌های ارتباطی (تلفن)، آدرس، سایت، قالب لینک استعلام کالا، تعداد کالاهای متصل، وضعیت «تأیید فعال بودن» و وضعیت «بروز بودن لیست قیمت» نمایش داده می‌شود؛ ادمین با یک کلیک هر مجموعه را تأیید یا از فهرست فعال خارج می‌کند. چهار مجموعهٔ جدید (موبیت، افق کوروش، دلگرم و گجت‌نیوز) با اطلاعات عمومی قابل استناد اضافه شده‌اند و فیلدهای تلفن/آدرس آن‌ها عمداً خالی است تا ادمین فقط اطلاعات رسمی و تأییدشده را ثبت کند — سامانه هیچ تماس یا آدرس ساختگی تولید نمی‌کند."),
  tableCaption("جدول ۱ — فهرست انبارها و مراجع قیمت (۱۳ مجموعه)"),
  rtlTable([22, 20, 16, 42],
    ["انبار / مرجع", "نوع", "سایت", "نقش در پلن v3 و یادداشت"],
    [
      ["کامپیوتر افق", "سخت‌افزار", "iranfso.com", "تأییدشده — انبار خرید لپ‌تاپ، مانیتور و ماوس؛ تلفن و آدرس ثبت است"],
      ["افق سیستم", "سخت‌افزار", "ofoghsystem.com", "تأییدشده — انبار دوم قطعات؛ استعلام دوم برای مقایسه"],
      ["فرالند (لوازم خانگی)", "لوازم خانگی", "afralland.com", "تأییدشده — انبار خرید یخچال، لباسشویی، تلویزیون و بخاری"],
      ["تراست مارکت‌پلیس", "لوازم خانگی", "trustmarketplace.ir", "تأییدشده — انبار کولر گازی اسپلیت"],
      ["دیجی‌کالا", "بازار آنلاین", "digikala.com", "تأییدشده — مرجع قیمت فروش (گران‌ترین بازار) و اتصال لحظه‌ای"],
      ["اسنپ", "بازار آنلاین", "snapp.ir", "تأییدشده — مرجع خدمات و پیک"],
      ["ترب", "مقایسه‌گر قیمت", "torob.com", "تأییدشده — سقف و کف قیمت بازار را یکجا نشان می‌دهد"],
      ["ایمالز", "مقایسه‌گر قیمت", "emalls.ir", "تأییدشده — مقایسهٔ چند فروشنده"],
      ["آچاره", "خدمات", "achareh.com", "تأییدشده — مرجع مقایسهٔ خدمات (پیام ۱۱)"],
      ["موبیت", "سخت‌افزار", "mobit.com", "جدید — مرجع قیمت روز کالای دیجیتال؛ تلفن/آدرس توسط ادمین تکمیل شود"],
      ["افق کوروش", "لوازم خانگی", "ofoghkourosh.com", "جدید — انبار دوم لوازم خانگی؛ اطلاعات شعب توسط ادمین تکمیل شود"],
      ["دلگرم", "مقایسه‌گر قیمت", "delgarm.com", "جدید — مرجع لیست قیمت روز دیجیتال و لوازم خانگی"],
      ["گجت‌نیوز", "مقایسه‌گر قیمت", "gadgetnews.ir", "جدید — مرجع لیست قیمت روزانهٔ بازار (به‌کاررفته در استعلام‌های قبلی)"],
    ]),

  // ── ۲. پلن جدید ──
  h1("۲. پلن جدید قیمت‌گذاری v3 — چهار قاعده و افزودنی دومولفه‌ای"),
  bodyPara("پلن v3 چهار قاعدهٔ معاملاتی را به‌صورت خودکار روی هر کالا اجرا می‌کند. قاعدهٔ اول «لیست بروزترین قیمت بروزترین انبارها»: برای هر کالا، بروزترین استعلامِ هر انبار فعال در یک فهرست مرتب (ارزان‌ترین اول) در کارت کالا در میز محصولات نمایش داده می‌شود؛ قیمت توافقی خرید در این فهرست عمومی هرگز نمایش داده نمی‌شود و فقط در پنل ادمین دیده می‌شود. قاعدهٔ دوم «موجودی فقط از بروزترین موجودی انبارها»: عدد موجودی هر کالا از تازه‌ترین استعلام انبار خوانده می‌شود (نام انبار کنار موجودی نمایش داده می‌شود) و ثبت استعلام انبار بدون موجودی، سامانه رد می‌کند. قاعدهٔ سوم «خرید از پائین‌ قیمت‌ترین انبارها»: هدف خرید و تأمین موجودی هر کالا، ارزان‌ترین انبار بر مبنای قیمت توافقی است و در پنل ادمین با برچسب «خرید» مشخص است. قاعدهٔ چهارم «فروش به قیمت گران‌ترین فروشگاه‌ها»: پایهٔ فروش هر کالا، بالاترین قیمت ارائه‌شدهٔ بین فروشگاه‌ها (بروزترین استعلام هر فروشگاه) است و نام همان فروشگاه کنار قیمت نمایش داده می‌شود."),
  bodyPara("افزودنی صفحهٔ پرداخت نیز دومولفه‌ای شد. سهم کارشناس — پاداش کارشناسِ پایش و استعلام قیمت — در بازهٔ ۱۶٫۵ تا ۲۰ درصد یا بیشتر تنظیم می‌شود (پیش‌فرض ۱۸٪) و هیچ مقدار کمتر از ۱۶٫۵٪ با پیام خطای شفاف رد می‌شود؛ مابقی، «افزایش قیمت پلتفرم» است که فقط بین ۱۰ تا ۱۶٫۵ درصد مجاز است (پیش‌فرض ۱۲٪). در صفحهٔ پرداخت هر دو مؤلفه جدا نشان داده می‌شوند و در پایگاه دادهٔ سفارش هم جدا ثبت می‌شوند تا حسابداری دقیق بماند. ویرایش هر دو درصد فقط با دسترسی مالک انجام می‌شود — آزمون دود نشان داد ادمین با خطای ۴۰۳ و مالک با اعتبارسنجی بازه مواجه می‌شود."),
  tableCaption("جدول ۲ — ریزدیسکی واقعی صفحهٔ پرداخت با پلن v3 (تومان — از آزمون تولید)"),
  rtlTable([30, 17, 17, 17, 19],
    ["کالا", "پایهٔ فروش (گران‌ترین فروشگاه)", "سهم کارشناس +۱۸٪", "افزایش قیمت +۱۲٪", "مبلغ قابل پرداخت (با پیک)"],
    [
      ["کالای آزمون سیاست (پایهٔ فروش ۱۲٬۰۰۰٬۰۰۰)", "۱۲٬۰۰۰٬۰۰۰", "۲٬۱۶۰٬۰۰۰", "۱٬۴۴۰٬۰۰۰", "۱۵٬۸۵۰٬۰۰۰ (۲٬۵۰۰٬۰۰۰ پیک سبک + جمع افزودنی)"],
      ["ماوس بی‌سیم Q5 (پایهٔ فروش ۱٬۳۱۲٬۰۰۰)", "۱٬۳۱۲٬۰۰۰", "۲۳۶٬۰۰۰", "۱۵۸٬۰۰۰", "۵٬۰۰۰٬۰۰۰ — تعدیل به حداقل فاکتور (+۳٬۰۴۵٬۰۰۰)"],
    ]),
  bodyPara("نمونهٔ سیاست کامل ماوس Q5 از پاسخ واقعی سامانه: فروش به دیجی‌کالا ۱٬۳۱۲٬۰۰۰ (گران‌ترین فروشگاه)، خرید از کامپیوتر افق با توافقی ۱٬۱۲۰٬۰۰۰ (ارزان‌ترین انبار از دو انبار)، موجودی ۱۵ عدد از بروزترین استعلام کامپیوتر افق، و فهرست عمومی قیمت انبارها به‌ترتیب کامپیوتر افق ۱٬۱۵۰٬۰۰۰ و افق سیستم ۱٬۱۹۰٬۰۰۰ — بدون انتشار هیچ قیمت توافقی.", { after: 160 }),

  // ── ۳. میز محصولات ──
  h1("۳. میز محصولات جدید — شفافیت انبار و پرداخت"),
  bodyPara("کارت هر کالا در میز محصولات (هر دو نسخهٔ کالا و نرم‌افزار) بازطراحی شد: بلوک «بروزترین قیمت انبارها» با برچسب «خرید» روی ارزان‌ترین انبار و موجودی ثبت‌شدهٔ هر انبار؛ سطر «پایهٔ فروش — گران‌ترین فروشگاه» با نام فروشگاه مرجع و تاریخ تازه‌ترین استعلام؛ نشان «موجودی: X · نام انبار» که موجودی را فقط از بروزترین انبار می‌خواند؛ و برچسب قاعدهٔ قیمت که به‌جای «+۳۳٪» حالا «پلن v3: کارشناس + پلتفرم» را نشان می‌دهد. ریزدیسکی صفحهٔ پرداخت هم دقیقاً مطابق پلن جدید شد: پایهٔ فروش × تعداد، سهم کارشناس +۱۸٪، افزایش قیمت پلتفرم +۱۲٪، هزینهٔ ارسال و بسته‌بندی (پیک)، خدمات کنار خرید و تعدیل حداقل فاکتور ۵٬۰۰۰٬۰۰۰ تومان. سمت سرور، مقادیر نهایی با محاسبهٔ مستقل بازتولید می‌شوند و در پیام ایمیلی به پنل ادمین همان تفکیک (کارشناس/پلتفرم/پیک/حداقل فاکتور) گزارش می‌شود."),

  // ── ۴. پنل ادمین ──
  h1("۴. پنل ادمین — استعلام انبار، اعمال پلن و تنظیم درصد کارشناس"),
  bodyPara("دیالوگ «فروشگاه‌ها و انبارهای کالا» در تب موجودی بازطراحی شد: دو دکمهٔ انتخاب نوع استعلام («فروشگاه — پایهٔ فروش» و «انبار — خرید + موجودی»)، فهرست انتخاب از مجموعه‌های ثبت‌شدهٔ هر سمت، فیلد اجباری «موجودی انبار» هنگام ثبت استعلام انبار، فیلد قیمت توافقی (محرمانه) و تاریخ استعلام با گیت تازگی. کارت خلاصهٔ سیاست برای هر کالا چهار خانه دارد: فروش (گران‌ترین فروشگاه + تعداد فروشگاه‌ها)، خرید/تأمین (ارزان‌ترین انبار — محرمانه)، موجودی (فقط از بروزترین انبار) و حاشیهٔ ناخالص بازار همراه با درصد افزودنی جاری؛ زیر آن، فهرست کامل قیمت انبارها و دکمهٔ «اعمال پلن v3» که پایهٔ فروش را از گران‌ترین فروشگاه و پایهٔ خرید را از ارزان‌ترین انبار (با ثبت ردّ در سابقهٔ پیشنهادها) روی کالا اعمال می‌کند. در تب تنظیمات، دو فیلد «سهم کارشناس» و «افزایش قیمت پلتفرم» جایگزین فیلدهای پلن ۳۳٪ شده‌اند؛ مقادیر خارج از بازه حتی با درخواست مستقیم به API ذخیره نمی‌شوند."),

  // ── ۵. نسخهٔ ایران/جهانی ──
  h1("۵. نسخهٔ ایران fa و نسخهٔ جهانی en — یک سامانه، دو نسخه"),
  bodyPara("سامانه اکنون دو نسخهٔ رسمی دارد: «نسخهٔ ایران» با رابط فارسی (fa) و واحد تومان، و «نسخهٔ جهانی» با رابط انگلیسی (en) و کاتالوگ جهانی v2.0 به دلار. سوییچ نسخه در هدر هر دو صفحهٔ دسکتاپ و موبایل قرار گرفته و با انتخاب هر نسخه، زبان رابط به‌طور خودکار تنظیم می‌شود (ایران ← fa، جهانی ← en)؛ انتخاب کاربر ذخیره می‌شود. شمارهٔ نسخهٔ فوتر هم دینامیک است: v3.0-IR در نسخهٔ ایران و v3.0-WORLD در نسخهٔ جهانی. برای اپلیکیشن‌ها، پارامتر آدرس (?lang=…&edition=…) اضافه شد تا نسخهٔ نصب‌شده از لحظهٔ باز شدن با نسخهٔ صحیح بالا بیاید؛ در نتیجه دو APK جدا ساخته و امضا شد: AloShetab-v3.0-IR.apk (versionCode 3 — بازکردن نسخهٔ ایران fa) و AloShetab-v3.0-World.apk (versionCode 3 — بازکردن نسخهٔ جهانی en)، هر دو روی دامنهٔ اصلی www.aloshetab.ir. هر دو فایل با apksigner (امضای v2+v3) تأیید و با ابزار ساختارسنجی داخلی بررسی شدند: resources.arsc تراز ۴ بایت، dex سالم، بدجینگ versionName=3.0.0.", { after: 160 }),

  // ── ۶. گیت تازگی + حداقل فاکتور ──
  h1("۶. گیت تازگی و حداقل فاکتور — حفظ‌شده و در خدمت پلن جدید"),
  bodyPara("مرز تازگی قیمت‌ها همچنان ۱۴۰۵/۰۸/۱۰ (۲۰۲۶/۱۱/۰۱) است: هیچ استعلام انبار یا فروشگاه با تاریخ قدیمی‌تر ثبت یا نمایش داده نمی‌شود — در آزمون، استعلام انبار با تاریخ ۱۴۰۵/۰۵/۰۱ با خطای PRICE_STALE رد شد. اگر منظور کارفرما از «از 2026/8/1 به بعد» آبان ۱ (۱۴۰۵/۰۸/۰۱ = ۲۳ اکتبر ۲۰۲۶) باشد، مالک می‌تواند در تنظیمات پنل «مرز تازگی قیمت» را به 2026-10-23 تغییر دهد؛ همهٔ گیت‌ها بدون تغییر کد با مرز جدید کار می‌کنند. حداقل مبلغ دریافتی هر فاکتور نیز همچنان ۵٬۰۰۰٬۰۰۰ تومان است و سفارش ماوس آزمونی با تعدیل +۳٬۰۴۵٬۰۰۰ تومان دقیقاً به همین سقف رسید؛ به همین دلیل دریافت همهٔ فاکتورها از طریق شبای حساب دریافت (IR430170000000345884841004 — بانک مهر ایران، mod-97 صحیح) انجام می‌شود و دو کارت محرمانه تقسیم‌بندی (ملی) و سهم شرکت (مهر ایران) پس از حسابرسی Luhn سالم‌اند.", { after: 160 }),

  // ── ۷. آزمون‌ها ──
  h1("۷. آزمون‌ها و کنترل کیفیت نسخهٔ ۳٫۰"),
  bodyPara("مجموعهٔ آزمون دود پیام ۱۴ با ۷۴ سنجه اجرا شد و هر ۷۴ سبز شد: حذف کامل پلن ۳۳٪ از پاسخ میز محصولات؛ پیوستن فهرست بروزترین قیمت انبارها با ترتیب ارزان‌ترین اول و بدون انتشار قیمت توافقی؛ موجودی فقط از بروزترین انبار (۱۵ عدد از کامپیوتر افق)؛ فهرست ۱۳ انبار با اطلاعات تماس و ردّ دسترسی بدون ورود (۴۰۱)؛ سیاست کامل ماوس Q5 (فروش ۱٬۳۱۲٬۰۰۰ / خرید توافقی ۱٬۱۲۰٬۰۰۰ / موجودی بروزترین انبار)؛ ردّ استعلام کهنه و استعلام انبار بدون موجودی؛ بازمحاسبهٔ فوری سیاست پس از استعلام تازه (انبار سوم ارزان‌تر → هدف خرید و موجودی جدید)؛ اعمال پلن v3 روی کالای آزمایشی (پایهٔ فروش ۱۲٬۰۰۰٬۰۰۰، قاعدهٔ V3-PLAN، پایهٔ خرید توافقی ۹٬۸۰۰٬۰۰۰)؛ محاسبهٔ دقیق صفحهٔ پرداخت (کارشناس ۲٬۱۶۰٬۰۰۰ + پلتفرم ۱٬۴۴۰٬۰۰۰ + پیک ۲۵۰٬۰۰۰ = پرداخت ۱۵٬۸۵۰٬۰۰۰)؛ تعدیل حداقل فاکتور روی سفارش ماوس؛ اعتبارسنجی بازهٔ درصد کارشناس/پلتفرم با دسترسی مالک و ردّ دسترسی ادمین؛ نسخهٔ v3.0-IR و چرخهٔ شبانهٔ گزارش قیمت (۲۸ قلم) با اتصال زندهٔ نرخ‌ها."),
  tableCaption("جدول ۳ — بستهٔ تحویل نسخهٔ ۳٫۰ (آخرین نسخهٔ همهٔ فایل‌ها)"),
  rtlTable([40, 24, 36],
    ["فایل", "نسخه", "شرح"],
    [
      ["alo_shetab_release_v3.0.zip", "v3.0", "بستهٔ کامل کد سامانه: اسکیما، موتور پلن v3، APIها، میز محصولات جدید، پنل ادمین، بذر و آزمون"],
      ["AloShetab-v3.0-IR.apk", "3.0.0 (code 3)", "اپلیکیشن اندروید نسخهٔ ایران — بازکردن fa/IRAN روی AloShetab.ir؛ امضای v2+v3"],
      ["AloShetab-v3.0-World.apk", "3.0.0 (code 3)", "اپلیکیشن اندروید نسخهٔ جهانی — بازکردن en/WORLD روی AloShetab.ir؛ امضای v2+v3"],
      ["CHECKSUMS-v3.0.0.sha256", "v3.0", "چک‌سام SHA-256 همهٔ اقلام تحویل نسخهٔ ۳٫۰"],
      ["README.md (بستهٔ کد)", "v3.0", "راهنمای استقرار و عملیات به‌روزشده — پلن v3، انبارها، نسخهٔ ایران/جهانی"],
      ["پیام-۱۴-پلن-v3-و-انبارها.docx/.pdf", "v3.0", "همین سند — شرح کامل تغییرات، آزمون‌ها و راهنمای مالک"],
    ]),

  // ── ۸. راهنمای مالک ──
  h1("۸. راهنمای عملیاتی مالک پس از v3.0"),
  bodyPara("برای راه‌اندازی روزانهٔ پلن v3 چهار قدم کافی است. یکم، در تب «انبارها» هر مجموعهٔ تماس‌گرفته‌شده را «تأیید فعال بودن» کنید و تلفن و آدرس رسمی مجموعه‌های جدید (موبیت، افق کوروش، دلگرم، گجت‌نیوز) را تکمیل کنید. دوم، برای هر کالا در دیالوگ «فروشگاه‌ها و انبارهای کالا» استعلام تازه ثبت کنید: برای فروشگاه، قیمت ارائه‌شدهٔ سایت؛ برای انبار، قیمت انبار، قیمت توافقی (محرمانه) و موجودی — پس از مذاکره، قیمت توافقی را بروزرسانی کنید تا هدف خرید دقیق بماند. سوم، با دکمهٔ «اعمال پلن v3» یا تأیید گزارش روزانه، پایهٔ فروش (گران‌ترین فروشگاه) را روی کالا اعمال کنید؛ افزودنی پرداخت به‌طور خودکار ۱۸٪ کارشناس + ۱۲٪ پلتفرم محاسبه می‌شود و اگر مالک درصدها را بخواهد تغییر دهد، فقط از تنظیمات (با رعایت بازهٔ ۱۶٫۵–۲۰+ و ۱۰–۱۶٫۵) امکان‌پذیر است. چهارم، هر شب چرخهٔ /api/tick گزارش روزانهٔ قیمت و حسابرسی حسابدار هوشمند را اجرا می‌کند؛ گزارش روزانه پس از تأیید ادمین در میز کالا لحاظ می‌شود."),
  bodyPara("اقلام باز برای مالک: تکمیل تلفن و آدرس رسمی چهار مجموعهٔ جدید فهرست انبارها؛ نهایی‌کردن قیمت‌های توافقی پس از مذاکره با هر انبار؛ فعال‌سازی اتصال لحظه‌ای دیجی‌کالا با ثبت کوکی معتبر یا سرور داخل ایران (اگر مصرف لحظه‌ای بالاتر از ثبت دستی موردنیاز بود)؛ و در صورت تفسیر متفاوت مرز تازگی، تغییر یک مقدار در تنظیمات. قاعدهٔ محرمانگی همچنان مطلق است: قیمت توافقی انبارها، درصدها و مبالغ سهم‌بندی تسویه فقط در پایگاه داده و ایمیل بک‌اند می‌مانند و هیچ‌گاه در رابط کاربری عمومی یا پاسخ APIهای عمومی ظاهر نمی‌شوند — آزمون دود این مورد را برای فهرست عمومی قیمت انبارها صریحاً سنجید.", { after: 0 }),
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
            children: [faRun("پلن v3.0 و انبارها | پیام ۱۴", { size: 18, color: "808080" })],
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

const OUT = "/home/z/my-project/download/پیام-۱۴-پلن-v3-و-انبارها.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE:", OUT, buf.length, "bytes");
});
