// راهنمای استقرار کامل و خلاصه — AloShetab.ir v4.0.0 (Persian RTL)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  TableLayoutType, PageOrientation,
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

function faRun(text, opts = {}) {
  const size = opts.size || 24;
  return new TextRun({ text, font: FONT, rightToLeft: true, size, sizeComplexScript: size, bold: !!opts.bold, boldComplexScript: !!opts.bold, italics: !!opts.italics, color: opts.color || BODY_COLOR, characterSpacing: opts.characterSpacing });
}
function bodyPara(text, opts = {}) {
  return new Paragraph({ bidirectional: true, alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: opts.after != null ? opts.after : 120 }, children: [faRun(text, opts)] });
}
function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, bidirectional: true, spacing: { before: 360, after: 160, line: 380, lineRule: "atLeast" }, children: [faRun(text, { size: 32, bold: true, color: HEAD_COLOR })] });
}
function bullet(text, opts = {}) {
  return new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { line: 312, after: 60 }, indent: { right: 420, hanging: 210 }, children: [faRun("•  ", { size: 22, bold: true, color: PAL.accent }), faRun(text, { size: opts.size || 22 })] });
}
function codePara(lines) {
  return lines.map((line, i) => new Paragraph({
    bidirectional: false, alignment: AlignmentType.LEFT,
    spacing: { line: 276, after: i === lines.length - 1 ? 160 : 20, before: i === 0 ? 80 : 0 },
    shading: { type: ShadingType.CLEAR, fill: "F2EDE8" }, indent: { left: 300, right: 300 },
    children: [new TextRun({ text: line, font: { ascii: "Consolas", hAnsi: "Consolas", cs: "Tahoma" }, size: 19, color: "3A3A3A" })],
  }));
}
function tableCaption(text) {
  return new Paragraph({ bidirectional: true, keepNext: true, spacing: { before: 160, after: 80, line: 312 }, children: [faRun(text, { size: 21, bold: true, color: "505A64" })] });
}
function rtlTable(widths, headerCells, dataRows) {
  const borders = { top: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine }, bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine }, left: NB, right: NB, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine }, insideVertical: NB };
  const mkCell = (text, i, isHeader) => new TableCell({
    width: { size: widths[i], type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: isHeader ? { type: ShadingType.CLEAR, fill: PAL.table.headerBg } : undefined,
    children: String(text).split("\n").map(line => new Paragraph({
      bidirectional: true, alignment: isHeader ? AlignmentType.CENTER : undefined, spacing: { line: 312 },
      children: [faRun(line, { size: 21, bold: isHeader, color: isHeader ? PAL.table.headerText : BODY_COLOR })],
    })),
  });
  return new Table({ visuallyRightToLeft: true, width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [
    new TableRow({ tableHeader: true, cantSplit: true, children: headerCells.map((t, i) => mkCell(t, i, true)) }),
    ...dataRows.map(r => new TableRow({ cantSplit: true, children: r.map((t, i) => mkCell(t, i, false)) })),
  ] });
}
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."،؛:！？", ..."-_—–·/", ..." \t"]);
  const lines = []; let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) { if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; } }
    if (breakAt === -1) { const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3)); for (let i = charsPerLine + 1; i < limit; i++) { if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; } } }
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
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, Math.floor(maxWidthTwips / charWidth(minPt))); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false, metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
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
  const spacing = calcCoverSpacing({ titleLineCount: titleLines.length, titlePt, hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel, metaLineCount: (config.metaLines || []).length, fixedHeight: 400 });
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
  children.push(new Paragraph({ bidirectional: true, indent: { left: padStart }, spacing: { after: 800, line: 380, lineRule: "atLeast" }, children: [faRun(config.subtitle, { size: 24, color: P.cover.subtitleColor })] }));
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({ bidirectional: true, indent: { left: padStart + 200 }, spacing: { after: 80 }, border: { left: accentStart }, children: [faRun(line, { size: 24, color: P.cover.metaColor })] }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    bidirectional: true, indent: { left: padStart, right: padEnd },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } }, spacing: { before: 200 },
    children: [faRun(config.footerLeft || "", { size: 16, color: P.cover.footerColor }), new TextRun({ text: "                                        ", font: FONT }), faRun(config.footerRight || "", { size: 16, color: P.cover.footerColor })],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: allNoBorders,
    rows: [new TableRow({ height: { value: 16838, rule: "exact" }, children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children })] })],
  })];
}

const coverConfig = {
  title: "راهنمای استقرار AloShetab.ir — کامل و خلاصه",
  subtitle: "v4.0.0 — مسیر شش‌گامی: بیلد Docker → ClawCloud Run (رایگان دائمی) → Volume دیتابیس → دامنهٔ سفارشی → رکوردهای DNS → TLS و اتصال اپ‌ها | با چک‌لیست نهایی و جدول عیب‌یابی",
  englishLabel: "COMPLETE & CONCISE DEPLOYMENT GUIDE — ALOSHETAB.IR",
  metaLines: [
    "شماره سند: پیام ۱۸ (بخش استقرار) — تاریخ: ۱۹ نوامبر ۲۰۲۶ / ۲۸ آبان ۱۴۰۵",
    "مبنا: deploy/clawcloud-FA.md و deploy/dns-FA.md و DEPLOYMENT.md — نسخهٔ فشردهٔ اجرایی",
    "وضعیت دامنه: aloshetab.ir ثبت‌شده؛ NSهای hostiran بی‌پاسخ — ثبت رکوردها تنها گام مالک",
    "زمان لازم کل: حدود ۴۵ تا ۹۰ دقیقه (بدون احتساب انتشار DNS)",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "v4.0.0 — استقرار",
  palette: PAL,
};

const tocChildren = [
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360, line: 380, lineRule: "atLeast" },
    children: [faRun("فهرست مطالب", { size: 32, bold: true, color: HEAD_COLOR })],
  }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({
    bidirectional: true, spacing: { before: 200, line: 312 },
    children: [faRun("توضیح: برای به‌روزرسانی شماره صفحات، روی فهرست راست‌کلیک و Update Field را انتخاب کنید.", { size: 18, italics: true, color: "888888" })],
  }),
];

const bodyChildren = [
  h1("خلاصه اجرایی"),
  bodyPara("این سند نسخهٔ «کامل و خلاصه» راهنمای استقرار است: کل مسیر در شش گام خلاصه شده و هر گام فقط دستورها و مقادیر ضروری را دارد؛ شرح کامل هر مسیر در اسناد قبلی (deploy/clawcloud-FA.md، dns-FA.md، vercel-FA.md و DEPLOYMENT.md) باقی است. خلاصهٔ معماری: کاربر از مرورگر یا اپلیکیشن به https://www.aloshetab.ir وصل می‌شود؛ درخواست به کانتینر Next.js (پورت ۳۰۰۰ داخل کانتینر) روی پلتفرم رایگان می‌رسد و پایگاه دادهٔ SQLite روی Volume ماندگار همان کانتینر ذخیره می‌شود. پلتفرم پیشنهادی ClawCloud Run است که ماهانه حدود ۵ دلار اعتبار دائمی رایگان می‌دهد و همین اپلیکیشن Docker موجود را بدون تغییر کد اجرا می‌کند."),
  tableCaption("جدول ۱ — مسیر استقرار در یک نگاه (شش گام)"),
  rtlTable([8, 30, 38, 24],
    ["#", "گام", "اقدام", "خروجی مورد انتظار"],
    [
      ["۱", "بیلد ایمیج", "docker build با تگ aloshetab:4.0.0 و push به Docker Hub", "ایمیج آماده در رجیستری"],
      ["۲", "ساخت اپ", "ClawCloud Run → App Launchpad → ایمیج + 0.5 CPU / 1GB", "آدرس دامنهٔ موقت سرو می‌شود"],
      ["۳", "Volume", "PVC روی مسیر /app/db برای SQLite", "دیتابیس با ری‌استارت می‌ماند"],
      ["۴", "دامنهٔ سفارشی", "App → Network → Custom Domain → aloshetab.ir و www", "مقدار CNAME داده می‌شود"],
      ["۵", "رکوردهای DNS", "در پنل hostiran یا Cloudflare: CNAME برای @ و www", "dig پاسخ درست می‌دهد"],
      ["۶", "TLS و تست", "گواهی خودکار پلتفرم/Cloudflare (حالت Full) + curl و پنل", "قفل سبز روی aloshetab.ir"],
    ]),
  bodyPara("دو گام فقط با اقدام خود مالک ممکن است: ساختن حساب ClawCloud (ورود با GitHub با عمر حداقل ۱۸۰ روز) و ثبت رکوردهای DNS در پنل ثبت‌کننده. بقیهٔ گام‌ها دستورهای کپی‌شدنی هستند و همهٔ اپ‌های تحویل‌شده (APK ایران fa، APK جهانی en، پنل مدیریت اندروید/ویندوز/iOS) از قبل به www.aloshetab.ir اشاره می‌کنند و با فعال شدن دامنه بدون بازسازی وصل می‌شوند.", { after: 160 }),

  h1("۱. انتخاب هاست رایگان — جدول تصمیم"),
  bodyPara("«هاست رایگان نامحدود» به معنای واقعی وجود ندارد؛ معیار درست، سه الزام سامانه است: پروسهٔ Node همیشه‌روشن، دیسک پایدار برای SQLite و دسترسی آزاد از داخل ایران. با استعلام به‌روز ۲۰۲۶، جدول تصمیم چنین است:"),
  tableCaption("جدول ۲ — مقایسهٔ گزینه‌های رایگان (استعلام ۱۹ نوامبر ۲۰۲۶)"),
  rtlTable([26, 20, 18, 36],
    ["گزینه", "دیسک پایدار", "خواب خودکار", "حکم"],
    [
      ["ClawCloud Run (~۵$ اعتبار ماهانهٔ دائمی، بدون کارت)", "بله (PVC)", "خیر", "توصیهٔ اول — بدون تغییر کد"],
      ["Oracle Cloud Always Free (ARM تا 2 OCPU/12GB پس از نصف‌شدن ۲۰۲۶)", "بله (200GB)", "خیر", "توصیهٔ دوم — VM کامل لینوکسی"],
      ["Google Cloud Always Free (e2-micro + 30GB)", "بله", "خیر", "جایگزین — فقط مناطق آمریکا"],
      ["Render Free", "خیر (پاک‌شدنی)", "۱۵ دقیقه", "مردود — SQLite از بین می‌رود"],
      ["Fly.io", "بله (پولی از ۲۰۲۵)", "خیر", "جایگزین ارزان (~۲$/ماه)، بدون سطح رایگان"],
      ["Vercel / Netlify / Cloudflare Pages", "—", "Serverless", "مردود — بدون پروسهٔ دائمی/دیسک"],
    ]),
  bodyPara("پس از انتخاب پلتفرم، تفاوت گام‌ها فقط در بخش ساخت اپ است؛ گام‌های DNS، TLS و تست یکسان‌اند. برای Oracle/GCP همان Dockerfile با docker compose یا نصب مستقیم Node 20 استفاده می‌شود (شرح در DEPLOYMENT.md).", { after: 160 }),

  h1("۲. گام‌های ۱ تا ۳ — ایمیج، اپ و Volume"),
  bodyPara("در پوشهٔ پروژه (بستهٔ alo_shetab_release_v4.0.zip باز‌شده یا نسخهٔ v4.0.0 جدید)، ایمیج بسازید و به Docker Hub بفرستید:"),
  ...codePara([
    "# نام کاربری Docker Hub خود را جای <user> بگذارید",
    "docker build -t <user>/aloshetab:4.0.0 .",
    "docker login && docker push <user>/aloshetab:4.0.0",
  ]),
  bodyPara("سپس در run.claw.cloud با GitHub وارد شوید و از App Launchpad اپ را با مقادیر زیر بسازید:"),
  tableCaption("جدول ۳ — پیکربندی اپ در App Launchpad"),
  rtlTable([30, 70],
    ["فیلد", "مقدار"],
    [
      ["Application Name", "aloshetab"],
      ["Image", "<user>/aloshetab:4.0.0 (Public)"],
      ["Usage", "CPU 0.5 — Memory 1 GB | Replicas: 1"],
      ["Network → Container Port", "3000 | Enable Internet: روشن"],
      ["Advanced → Environment", "DATABASE_URL=file:/app/db/custom.db | NODE_ENV=production | SEED_ON_START=true (فقط اولین بار)"],
      ["Storage (PVC)", "Mount Path: /app/db — حجم ۱ گیگابایت"],
      ["Update Strategy", "Mostly یا AfterReady"],
    ]),
  bodyPara("بعد از راه افتادن اپ، از بخش Network → Custom Domain دو دامنهٔ aloshetab.ir و www.aloshetab.ir را ثبت کنید؛ ClawCloud مقدار CNAME هدف را به شما می‌دهد (در ادامه <CNAME-CLAWCLOUD> نامیده می‌شود).", { after: 160 }),

  bodyPara("تنظیمات مالی V4.0 (پلن ۱۸): پس از استقرار، نرخ‌ها از پنل مالک قابل بازبینی است — دستمزد کارشناس ۶۷٪ اجرت، پورسانت معرف فقط در فاکتور اول معرفی‌شده (۱۰٪ سود خدمات + ۲۰٪ سود کالا — همان فاکتورِ تخفیف ۱۰٪)، و از فاکتور دوم به بعد سود شرکت = باقیمانده کامل. دو کلید منسوخ SERVICES_REFERRER_PCT_NORMAL و GOODS_REFERRER_PCT_NORMAL بی‌اثرند؛ صحت‌سنجی نهایی پلن: BASE=https://www.aloshetab.ir node scripts/verify_p18.cjs — انتظار: ۳۰/۳۰ سبز.", { after: 160 }),

  h1("۳. گام ۴ — رکوردهای DNS دامنهٔ aloshetab.ir"),
  bodyPara("بررسی ۲۷ آبان نشان داد NSهای فعلی hostiran بی‌پاسخ‌اند (lame delegation)؛ پس هیچ رکورد فعلی نباید حفظ شود. دو راه دارید — راه ساده مستقیم در پنل hostiran و راه پیشنهادی با Cloudflare رایگان (مدیریت راحت‌تر، CNAME روی ریشه خودکار flatten می‌شود، SSL و کش رایگان):"),
  tableCaption("جدول ۴ — رکوردهای DNS (هر دو راه)"),
  rtlTable([14, 14, 40, 12, 20],
    ["نوع", "نام", "مقدار", "TTL", "پروکسی کلادفلر"],
    [
      ["CNAME", "www", "<CNAME-CLAWCLOUD>", "3600", "روشن (نارنجی)"],
      ["CNAME", "@", "<CNAME-CLAWCLOUD>", "3600", "روشن (نارنجی)"],
    ]),
  ...codePara([
    "# راه hostiran (ساده): در پنل DNS همین دو CNAME را ثبت کنید",
    "# راه پیشنهادی Cloudflare: Add a Site → aloshetab.ir → Free →",
    "#   NSهای داده‌شده را در ایرنیک/hostiran جایگزین کنید → همان دو رکورد CNAME",
    "#   SSL/TLS → Overview → حالت Full (نه Full strict)",
    "# بررسی پس از ثبت:",
    "dig +short www.aloshetab.ir CNAME",
    "dig +short aloshetab.ir",
  ]),
  bodyPara("اگر پنل hostiran اجازهٔ CNAME روی ریشه را نداد، فقط www را فعال کنید و در گام ۵ تنها www.aloshetab.ir را دامنهٔ سفارشی بگذارید — اپ‌ها به www اشاره می‌کنند. انتشار DNS معمولاً کمتر از یک ساعت طول می‌کشد.", { after: 160 }),

  h1("۴. گام‌های ۵ و ۶ — TLS، تست و اتصال اپ‌ها"),
  bodyPara("ClawCloud برای دامنهٔ سفارشی گواهی TLS را خودکار صادر می‌کند؛ در مسیر Cloudflare، گواهی لبه از کلادفلر است و حالت Full گواهی origin را می‌پذیرد. تست پذیرش:"),
  ...codePara([
    "curl -I https://www.aloshetab.ir            # انتظار: HTTP/2 200",
    "curl -I https://www.aloshetab.ir/admin      # پنل مدیریت (لاگین owner/admin)",
    "curl -s https://www.aloshetab.ir/api/products | head -c 200",
    "python3 deploy/post_deploy_check.py https://www.aloshetab.ir   # ۱۸ سنجهٔ پذیرش",
  ]),
  tableCaption("جدول ۵ — چک‌لیست نهایی استقرار (۱۲ مورد)"),
  rtlTable([10, 90],
    ["#", "مورد کنترل"],
    [
      ["۱", "ایمیج 4.0.0 با موفقیت push شد"],
      ["۲", "اپ در ClawCloud با وضعیت Running"],
      ["۳", "PVC روی /app/db مانت شده و فایل custom.db ساخته شده"],
      ["۴", "SEED_ON_START پس از اولین راه‌اندازی به false برگردانده شد"],
      ["۵", "دامنهٔ سفارشی در App → Network ثبت شد"],
      ["۶", "دو رکورد CNAME (@ و www) ثبت و dig پاسخ می‌دهد"],
      ["۷", "https://www.aloshetab.ir قفل سبز و کد 200"],
      ["۸", "http → https ریدایرکت می‌شود"],
      ["۹", "/admin بالا می‌آید و ورود owner کار می‌کند"],
      ["۱۰", "node scripts/verify_p18.cjs روی دامنه (BASE=https://www.aloshetab.ir) سبز است"],
      ["۱۱", "پشتیبان‌گیری دوره‌ای فایل /app/db/custom.db تنظیم شد"],
      ["۱۲", "APKها یک بار باز و اتصال به دامنه تست شد (بدون بازسازی)"],
    ]),
  tableCaption("جدول ۶ — عیب‌یابی سریع"),
  rtlTable([34, 66],
    ["نشانه", "راه‌حل"],
    [
      ["دامنه باز نمی‌شود / lame delegation", "رکوردها ثبت نشده‌اند یا NS هنوز عوض نشده — جدول ۴ و انتظار تا یک ساعت"],
      ["خطای SSL / حلقهٔ ریدایرکت", "در Cloudflare حالت SSL را Full بگذارید (نه Flexible و نه Full strict)"],
      ["502 در دامنهٔ موقت", "کانتینر بالا نیامده — لاگ اپ و متغیر DATABASE_URL را بررسی کنید"],
      ["داده‌ها بعد از آپدیت پاک شدند", "PVC روی /app/db مانت نیست — جدول ۳"],
      ["خطای PRICE_STALE در سفارش کالا", "قیمت کالا از تاریخ PRICE_FRESH_FROM عقب‌تر است — استعلام تازه و تأیید ادمین"],
      ["401 در پنل", "کوکی لاگین منقضی — دوباره owner/AloShetab1404 (بعداً رمز را از پنل عوض کنید)"],
    ]),
  bodyPara("اتصال اپ‌ها به دامنهٔ نهایی: هر سه پوستهٔ اندروید (ایران/جهانی/مدیریت) و نسخه‌های ویندوز و iOS از قبل به https://www.aloshetab.ir اشاره می‌کنند؛ پس از استقرار فقط یک بار اپ را باز کنید و اتصال را ببینید. اگر بعداً نسخهٔ v4.0.0 APK خواستید، فقط version-code/version-name در build.sh بالا ببرید و با همان keystore aloshetab.keystore بازسازی و در CHECKSUMS ثبت کنید — بقیهٔ چیزها ثابت است.", { after: 200 }),
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
    { properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin } }, children: tocChildren },
    {
      properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: new Header({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { line: 240 }, children: [faRun("راهنمای استقرار کامل و خلاصه | v4.0.0", { size: 18, color: "808080" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240 }, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, sizeComplexScript: 18, color: "808080", font: FONT })] })] }) },
      children: bodyChildren,
    },
  ],
});

const OUT = "/home/z/my-project/download/راهنمای-استقرار-کامل-و-خلاصه-V4.0.docx";
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("WROTE:", OUT, buf.length, "bytes"); });
