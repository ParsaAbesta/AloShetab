// راهنمای کامل و گام‌به‌گام استقرار — سامانه الو شتاب v3.0 (Persian RTL)
// Skill: docx | Route: Create | Scene: report | Cover: R1 + GO-1 (هم‌سان با پیام ۳ تا ۱۴)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, TableOfContents,
  TableLayoutType,
} = require("docx");
const fs = require("fs");

// ─────────────────────────── Palette GO-1 ───────────────────────────
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
      children: [faRun(line, { size: 20, bold: isHeader, color: isHeader ? PAL.table.headerText : BODY_COLOR })],
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

// ─────────────────────────── Cover (R1) ───────────────────────────
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."،؛:！؟", ..."-_—–·/", ..." \t"]);
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

// ─────────────────────────── دادهٔ انبارها از خروجی واقعی ───────────────────────────
const whRows = JSON.parse(fs.readFileSync("/home/z/my-project/download/alo_shetab_warehouses_v3.0.json", "utf8"));
const KIND_FA = {
  COMPUTER: "سخت‌افزار", APPLIANCE: "لوازم خانگی", MARKETPLACE: "بازار آنلاین",
  ONLINE: "فروش آنلاین", PRICE_AGGREGATOR: "مقایسه‌گر قیمت", SERVICES: "خدمات",
};
const whTableRows = whRows.map(w => [
  w.nameFa,
  KIND_FA[w.kind] || w.kind,
  `${w.phone || "—"}\n${w.website || "—"}`,
  `${w.city || "—"}\n${w.address || "—"}`,
  String(w.productsCount),
]);

// ─────────────────────────── Cover config ───────────────────────────
const coverConfig = {
  title: "راهنمای کامل و گام‌به‌گام استقرار — سامانه الو شتاب v3.0",
  subtitle: "استقرار وب‌اپ روی دامنهٔ AloShetab.ir؛ اپلیکیشن مجزای پنل مدیریت با دو سطح دسترسی مالک/ادمین؛ انتشار برنامه‌ها روی سه پلتفرم Android (APK ایران/جهانی/مدیریت)، iOS و Windows؛ فهرست کامل انبارها با تلفن، سایت، موجودی و آدرس",
  englishLabel: "FULL STEP-BY-STEP DEPLOYMENT GUIDE — ALO SHETAB PLATFORM v3.0",
  metaLines: [
    "شماره سند: راهنمای استقرار نسخهٔ ۳٫۰ — پیام ۱۴ (تاریخ پیام: ۱۸ نوامبر ۲۰۲۶)",
    "تاریخ تنظیم: ۲۷ آبان ۱۴۰۵",
    "دامنهٔ سرویس: www.aloshetab.ir (نسخهٔ ایران fa) — نسخهٔ جهانی en روی همان دامنه",
    "مخاطب: کارفرما، کارشناس استقرار/DevOps و مدیر سامانه",
  ],
  footerLeft: "سری اسناد تحویل پروژه الو شتاب",
  footerRight: "راهنمای استقرار v3.0",
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

// ─────────────────────────── Body ───────────────────────────
const bodyChildren = [
  h1("خلاصهٔ بستهٔ تحویل v3.0"),
  bodyPara("این سند، نقشهٔ راه کامل استقرار نسخهٔ ۳٫۰ سامانه الو شتاب است و همهٔ الزامات پیام ۱۴ را پوشش می‌دهد: فهرست کامل انبارها با شماره تلفن، سایت، موجودی و آدرس؛ استخراج بالاترین قیمت‌های ارائه‌شده از مطرح‌ترین فروشگاه‌ها به‌عنوان پایهٔ فروش؛ اپلیکیشن مجزای پنل مدیریت با دو سطح دسترسی مالک و ادمین؛ و تحویل تمام برنامه‌ها روی سه پلتفرم Android و iOS و Windows. پیش از شروع، بستهٔ انتشار (alo_shetab_release_v3.0.zip) و برنامه‌ها را از فهرست تحویل دریافت کنید و هش SHA-256 هر فایل را با فایل CHECKSUMS-v3.0.0.sha256 تطبیق دهید."),
  tableCaption("جدول ۱ — نقشهٔ کامل فایل‌های تحویل نسخهٔ ۳٫۰"),
  rtlTable([30, 44, 26],
    ["فایل", "محتوا", "مقصد استقرار"],
    [
      ["alo_shetab_release_v3.0.zip", "کد کامل وب‌اپ (Next.js + Prisma)، اسکیمای پایگاه داده، seedها، آزمون‌ها و راهنما", "سرور Production"],
      ["AloShetab-v3.0-IR.apk", "اپ مشتریان — نسخهٔ ایران fa (پلن v3)", "اندروید — نصب مستقیم"],
      ["AloShetab-v3.0-World.apk", "اپ مشتریان — نسخهٔ جهانی en", "اندروید — نصب مستقیم"],
      ["AloShetab-Admin-v3.0.apk", "اپلیکیشن مجزای پنل مدیریت (مالک/ادمین)", "اندروید — نصب مستقیم"],
      ["AloShetab-Windows-v3.0-x64.zip", "پوستهٔ Portable ویندوز برای اپ مشتریان", "ویندوز x64"],
      ["AloShetab-Admin-Windows-v3.0-x64.zip", "پوستهٔ Portable ویندوز برای پنل مدیریت", "ویندوز x64"],
      ["AloShetab-iOS-BuildKit-v3.0.zip", "پیکربندی Capacitor برای دو اپ iOS (مشتریان + مدیریت) و راهنمای PWA", "مک با Xcode"],
      ["AloShetab-Android-BuildKit-v3.0.zip", "کد منبع هر دو اپ اندروید + اسکریپت ساخت و کلید امضا", "بازسازی APK"],
      ["alo_shetab_warehouses_v3.0.csv / .json", "فهرست کامل ۱۳ انبار — تلفن، سایت، موجودی، آدرس", "مرجع ادمین"],
      ["CHECKSUMS-v3.0.0.sha256", "هش SHA-256 همهٔ فایل‌های تحویل", "تأیید صحت"],
    ]),

  h1("۱) گام ۱ — آماده‌سازی سرور و دامنه"),
  ...stepPara("۱", "تهیهٔ سرور و دامنه", "یک سرور مجازی با حداقل ۲ گیگابایت حافظه و ۱۰ گیگابایت دیسک (اوبونتو ۲۲٫۰۴ یا بالاتر توصیه می‌شود) تهیه کنید. دامنهٔ aloshetab.ir باید پیش از استقرار ثبت شده باشد؛ رکورد A دامنهٔ www را به IP سرور اشاره دهید و در صورت تمایل رکورد اختصاصی admin را هم به همان IP تنظیم کنید (برای جدا‌سازی سطح دوم پنل مدیریت). گواهی TLS را با Caddy به‌صورت خودکار صادر می‌کنیم؛ نیازی به خرید گواهی نیست."),
  tableCaption("جدول ۲ — پیش‌نیازهای سرور"),
  rtlTable([30, 35, 35],
    ["نیاز", "حداقل", "توضیح"],
    [
      ["سیستم‌عامل", "Ubuntu 22.04 LTS", "یا هر توزیع با systemd"],
      ["Node.js", "22 LTS", "برای مسیر بدون Docker؛ مسیر Docker فقط Docker 24+ می‌خواهد"],
      ["حافظه / دیسک", "2GB / 10GB", "SQLite سبک است؛ رشد به سفارش‌ها بستگی دارد"],
      ["دامنه", "aloshetab.ir + www", "رکورد A به IP سرور؛ admin به‌صورت اختیاری"],
      ["پورت‌ها", "80 و 443 باز، 3010 داخلی", "وب‌اپ روی 127.0.0.1:3010 و Caddy جلو آن"],
    ]),

  h1("۲) گام ۲ — استقرار وب‌اپ روی سرور"),
  ...stepPara("۲", "بازکردن بسته و نصب وابستگی‌ها", "بستهٔ انتشار را روی سرور باز کنید، وابستگی‌ها را نصب و اسکیمای پایگاه داده را بسازید. ترمینال را در ریشهٔ پروژه باز نگه دارید و دستورها را به‌ترتیب اجرا کنید:"),
  ...codePara([
    "unzip alo_shetab_release_v3.0.zip && cd alo_shetab_release",
    "npm install --legacy-peer-deps",
    'echo "DATABASE_URL=file:/opt/aloshetab/db/custom.db" > .env',
    "npx prisma generate",
    "npx prisma db push",
  ]),
  bodyPara("نکته: مسیر DATABASE_URL را به پوشه‌ای پایدار خارج از پوشهٔ کد ببرید تا در هر انتشار بازنویسی نشود (در مثال /opt/aloshetab/db)."),
  ...stepPara("۳", "بارگذاری داده‌ها (seed chain)", "پنج اسکریپت seed به‌ترتیب اجرا شوند؛ اسکریپت آخر، فهرست تماس کامل انبارها (تلفن، سایت، آدرس) را ثبت می‌کند:"),
  ...codePara([
    "node scripts/seed_v2.mjs          # کاتالوگ ایران fa + جهانی en + قطعات",
    "node scripts/seed_p11.mjs         # پنل مدیریت + انبارها + میز کالا/نرم‌افزار",
    "node scripts/seed_p13.mjs         # فروشگاه‌ها + پیشنهادهای قیمت فروش",
    "node scripts/seed_p14.mjs         # پلن v3: انبارهای کامل + استعلام انبار (خرید+موجودی)",
    "node scripts/seed_p14_contacts.mjs # تکمیل تلفن/سایت/آدرس تمام انبارها (پیام ۱۴)",
  ]),
  ...stepPara("۴", "ساخت و اجرا", "نسخهٔ production را بسازید و به‌صورت سرویس پایدار اجرا کنید:"),
  ...codePara([
    "npm run build",
    'PORT=3010 HOSTNAME=127.0.0.1 NODE_ENV=production node .next/standalone/server.js',
  ]),
  bodyPara("برای اجرای پایدار، سرویس systemd بسازید. فایل /etc/systemd/system/aloshetab.service با محتوای زیر تعریف کنید و سرویس را فعال کنید:"),
  ...codePara([
    "[Unit]",
    "Description=AloShetab Platform v3.0",
    "After=network.target",
    "",
    "[Service]",
    "WorkingDirectory=/opt/aloshetab/alo_shetab_release",
    'Environment=PORT=3010 HOSTNAME=127.0.0.1 NODE_ENV=production',
    'Environment=DATABASE_URL=file:/opt/aloshetab/db/custom.db',
    "ExecStart=/usr/bin/node .next/standalone/server.js",
    "Restart=always",
    "RestartSec=5",
    "",
    "[Install]",
    "WantedBy=multi-user.target",
  ]),
  ...codePara([
    "sudo systemctl daemon-reload",
    "sudo systemctl enable --now aloshetab",
    "curl http://127.0.0.1:3010/api   # باید پاسخ JSON برگرداند",
  ]),
  ...stepPara("۵", "وب‌سرور، HTTPS و دامنه", "Caddy را نصب کنید و فایل Caddyfile را با دو بلاک زیر تنظیم کنید — بلاک اول اپ مشتریان و بلاک دوم (اختیاری) سطح اختصاصی پنل مدیریت:"),
  ...codePara([
    "www.aloshetab.ir {",
    "    reverse_proxy 127.0.0.1:3010",
    "}",
    "admin.aloshetab.ir {",
    "    reverse_proxy 127.0.0.1:3010",
    "}",
  ]),
  ...codePara([
    "sudo systemctl reload caddy",
    "# گواهی TLS برای هر دو نام به‌صورت خودکار صادر می‌شود",
  ]),

  h1("۳) گام ۳ — راه‌اندازی اپلیکیشن مجزای پنل مدیریت (مالک/ادمین)"),
  ...stepPara("۶", "ورود اولیه و تغییر رمزها", "پنل مدیریت در مسیر اختصاصی https://www.aloshetab.ir/admin سرویس می‌شود — همان اپلیکیشن مجزایی که برای آن APK و بستهٔ ویندوز و پیکربندی iOS جداگانه ساخته شده است. دو سطح دسترسی داریم: مالک (OWNER) با نام کاربری owner و رمز اولیهٔ AloShetab1404، و ادمین (ADMIN) با نام کاربری admin و رمز اولیهٔ AloShetabAdmin1405. در نخستین ورود، از تب «تنظیمات ← تغییر رمز» هر دو رمز را عوض کنید (تغییر رمز هر دو فقط با دسترسی مالک انجام می‌شود)."),
  bodyPara("تفکیک اختیارات: تغییر پلن مالی v3 — سهم کارشناس (حداقل ۱۶٫۵ درصد، بدون سقف) و افزایش قیمت پلتفرم (۱۰ تا ۱۶٫۵ درصد) — فقط از دست مالک است؛ ادمین با این تنظیمات مواجه با خطای دسترسی می‌شود. ادمین مسئول انبارها، فروشگاه‌ها، استعلام‌ها، سفارش‌ها، گزارش‌های روزانه و حسابدار هوشمند است."),
  ...stepPara("۷", "بررسی فهرست کامل انبارها", "در پنل ادمین تب «انبارها و مراجع قیمت» را باز کنید؛ باید ۱۳ مجموعه با تلفن، سایت و آدرس تکمیل‌شده ببینید. خروجی آمادهٔ همین فهرست (CSV و JSON) در فایل‌های alo_shetab_warehouses_v3.0.csv و alo_shetab_warehouses_v3.0.json کنار بسته است — پیوست الف همین سند هم نسخهٔ کامل آن را نشان می‌دهد. برای هر کالا، استعلام انبار (قیمت انبار، قیمت توافقی و موجودی) در تب «استعلام‌ها» ثبت شده است؛ قیمت توافقی فقط در پنل ادمین دیده می‌شود و در هیچ پاسخ عمومی منتشر نمی‌شود."),
  ...stepPara("۸", "اتصال لحظه‌ای قیمت و گزارش روزانه", "زیرساخت اتصال لحظه‌ای (خوراک ترب و مراجع قیمت) فعال است؛ کرن شبانه هر شب قیمت‌های تازه را می‌کشد، گزارش روزانه می‌سازد و حسابدار هوشمند بررسی و در صورت خطا سفارش‌دهی را فیلتر می‌کند. کلید فراخوانی کرن: /api/tick?key=AloShetab-Tick-1405. یک کرون سرور تعریف کنید:"),
  ...codePara([
    "0 2 * * * curl -s 'https://www.aloshetab.ir/api/tick?key=AloShetab-Tick-1405' >/dev/null",
  ]),

  h1("۴) گام ۴ — انتشار برنامه‌های اندروید (سه APK)"),
  ...stepPara("۹", "نصب مستقیم APK", "سه فایل APK نسخهٔ ۳٫۰ آماده و با همان کلید نسخه‌های قبلی امضا شده‌اند — نصب به‌روزرسانی روی گوشی‌های دارای نسخهٔ قبل بدون حذف برنامه ممکن است:"),
  tableCaption("جدول ۳ — بسته‌های اندروید نسخهٔ ۳٫۰"),
  rtlTable([30, 35, 35],
    ["فایل", "شناسهٔ بسته", "آدرس سرویس"],
    [
      ["AloShetab-v3.0-IR.apk", "ir.aloshetab.app — نسخهٔ ایران fa", "www.aloshetab.ir/?lang=fa&edition=IRAN"],
      ["AloShetab-v3.0-World.apk", "ir.aloshetab.app — نسخهٔ جهانی en", "www.aloshetab.ir/?lang=en&edition=WORLD"],
      ["AloShetab-Admin-v3.0.apk", "ir.aloshetab.admin — پنل مدیریت", "www.aloshetab.ir/admin"],
    ]),
  bodyPara("روش نصب: فایل APK را به گوشی منتقل و باز کنید؛ در پیام «نصب از منابع ناشناس» اجازهٔ نصب برای مرورگر/فایل‌منیجر بدهید. اگر دامنه هنوز فعال نیست، در بیلدکیت مقدار url در assets/config.json را با آدرس موقت جایگزین و با اسکریپت build.sh بازسازی کنید."),
  ...stepPara("۱۰", "بازسازی APK در صورت نیاز (بیلدکیت)", "بستهٔ AloShetab-Android-BuildKit-v3.0.zip شامل کد منبع هر دو اپ، اسکریپت‌های ساخت و کلید امضاست؛ زنجیرهٔ ساخت aapt2 → ecj → d8 → zipalign → apksigner بدون Android Studio اجرا می‌شود:"),
  ...codePara([
    "bash main/build.sh IR       # اپ مشتریان — ایران fa",
    "bash main/build.sh WORLD    # اپ مشتریان — جهانی en",
    "bash admin/build.sh         # پنل مدیریت (مالک/ادمین)",
  ]),

  h1("۵) گام ۵ — انتشار iOS"),
  ...stepPara("۱۱", "نصب فوری PWA (توصیه‌شده برای شروع)", "در آیفون/آیپد با Safari به آدرس سرویس بروید؛ دکمهٔ Share ← Add to Home Screen. اپ با نام «ألو شتاب» تمام‌صفحه نصب می‌شود. برای پنل مدیریت همین کار با آدرس /admin انجام می‌شود تا آیکون مستقل «الو شتاب — پنل مدیریت» ساخته شود."),
  ...stepPara("۱۲", "اپ بومی با Capacitor (روی مک)", "بستهٔ AloShetab-iOS-BuildKit-v3.0.zip دو پیکربندی آماده دارد: capacitor.config.json برای اپ مشتریان (ir.aloshetab.app) و capacitor.admin.config.json برای اپلیکیشن مجزای مدیریت (ir.aloshetab.admin). روی مک با Xcode 15+، هر پیکربندی را در پروژهٔ جداگانه کپی کنید و با npx cap add ios و تنظیم تیم امضا، Build بگیرید. ریزدستورها در README-fa.md داخل بسته آمده است."),

  h1("۶) گام ۶ — انتشار Windows"),
  ...stepPara("۱۳", "اجرای پوستهٔ Portable", "دو بستهٔ آماده وجود دارد: AloShetab-Windows-v3.0-x64.zip برای اپ مشتریان و AloShetab-Admin-Windows-v3.0-x64.zip برای اپلیکیشن مجزای پنل مدیریت. هر بسته را باز کنید و AloShetab.exe (یا AdminPanel.exe) را اجرا کنید — بدون نصب، بدون نیاز به دسترسی ادمین ویندوز. آدرس سرویس از فایل resources/app/config.json داخل همان پوشه خوانده می‌شود؛ در صورت تغییر دامنه، فقط همان فایل را ویرایش کنید."),

  h1("۷) گام ۷ — اعتبارسنجی پس از استقرار"),
  bodyPara("پیش از اعلام بهره‌برداری، چک‌لیست زیر را اجرا کنید. آزمون دود کامل نسخهٔ ۳٫۰ شامل ۷۴ سنجه است و با سرور در حال اجرا روی پورت 3010 از ریشهٔ پروژه فراخوانی می‌شود:"),
  ...codePara([
    "node scripts/smoke_p14.mjs",
    "# خروجی مورد انتظار: === نتیجه: ۷۴ موفق / ۰ ناموفق ===",
  ]),
  tableCaption("جدول ۴ — چک‌لیست پذیرش v3.0"),
  rtlTable([40, 60],
    ["کنترل", "معیار سبز"],
    [
      ["صفحهٔ اصلی", "میز خدمات با ۱۰۴ خدمت در نسخهٔ fa و نسخهٔ en بار می‌شود؛ جستجو کار می‌کند"],
      ["میز محصولات", "پلن v3: پایهٔ فروش = گران‌ترین فروشگاه؛ فهرست قیمت انبارها؛ موجودی از بروزترین انبار؛ هیچ اثری از پلن ۳۳٪"],
      ["صفحهٔ پرداخت", "تفکیک سهم کارشناس +۱۸٪ و افزایش قیمت +۱۲٪؛ حداقل فاکتور ۵٬۰۰۰٬۰۰۰ تومان؛ شبا برای مبالغ بالای ۵ میلیون"],
      ["پنل مدیریت", "ورود owner و admin جدا؛ تغییر پلن فقط با مالک؛ تب انبارها با تلفن/سایت/آدرس تکمیل"],
      ["گیت تازگی", "استعلام با تاریخ قبل از ۱۴۰۵/۰۸/۱۰ رد می‌شود (خطای STALE)"],
      ["آزمون دود", "۷۴/۷۴ سبز؛ گزارش‌های ایمیل در صف یا ارسال‌شده"],
    ]),

  h1("۸) گام ۸ — عملیات روزانه، پشتیبان‌گیری و نگهداشت"),
  bullet("کرن شبانه (گام ۸ بخش ۳) قیمت‌های لحظه‌ای را تازه نگه می‌دارد؛ گزارش روزانه در تب «گزارش‌ها»ی پنل ادمین و ایمیل مدیر ثبت می‌شود."),
  bullet("پشتیبان‌گیری روزانه از SQLite: یک کرون ساده کافی است — فایل پایگاه داده تک‌فایلی است."),
  bullet("به‌روزرسانی نسخه: بستهٔ انتشار جدید را باز کنید، npm install و npm run build و راه‌اندازی مجدد سرویس؛ داده‌ها در DATABASE_URL پایدار می‌مانند."),
  ...codePara([
    "0 3 * * * sqlite3 /opt/aloshetab/db/custom.db \".backup /opt/aloshetab/backup/custom-$(date +\\%F).db\"",
  ]),
  bullet("نظافت: لاگ سرویس با journalctl -u aloshetab -f رصد می‌شود؛ در صورت خطا سرویس در ۵ ثانیه خودش بالا می‌آید."),

  h1("پیوست الف — فهرست کامل انبارها (تلفن / سایت / موجودی / آدرس)"),
  bodyPara("این جدول مستقیماً از پایگاه دادهٔ نسخهٔ ۳٫۰ خروجی گرفته شده است و همان چیزی است که در تب «انبارها و مراجع قیمت» پنل ادمین نمایش داده می‌شود. ستون «کالاهای متصل» تعداد کالاهایی را نشان می‌دهد که برای آن‌ها استعلام انبار (قیمت خرید و موجودی) ثبت شده است؛ موجودی ریز هر کالا در پنل ادمین و در کارت کالا در میز محصولات دیده می‌شود."),
  tableCaption("جدول ۵ — فهرست ۱۳ انبار و مرجع قیمت نسخهٔ ۳٫۰"),
  rtlTable([16, 13, 24, 33, 14],
    ["انبار / مرجع", "نوع", "تلفن و سایت", "شهر و آدرس", "کالاهای متصل"],
    whTableRows),
  bodyPara("منبع داده‌ها: صفحات رسمی «تماس با ما» هر مجموعه (بازبینی ۲۷ آبان ۱۴۰۵). شماره‌ها و آدرس‌ها عمومی و قابل استنادند؛ مسئول تأیید نهایی هر تماس پیش از استعلام حضوری، ادمین سامانه است. برای انبارهای مرجع قیمتی برخط (ترب، ایمالز، دلگرم، گجت‌نیوز) آدرس فیزیکی معنای شعبهٔ فروش ندارد و صفحهٔ تماس رسمی ثبت شده است.", { after: 160 }),

  h1("پیوست ب — پلن مالی v3 و حساب‌های دریافت"),
  bodyPara("پلن v3 دو مؤلفه دارد: سهم کارشناس ۱۶٫۵ تا ۲۰ درصد یا بیشتر (پیش‌فرض ۱۸٪) و افزایش قیمت پلتفرم ۱۰ تا ۱۶٫۵ درصد (پیش‌فرض ۱۲٪). پایهٔ فروش هر کالا، بالاترین قیمت ارائه‌شدهٔ مطرح‌ترین فروشگاه‌ها (اکنون دیجی‌کالا و دیگر مراجع در تب فروشگاه‌ها) است و خرید از ارزان‌ترین انبار با قیمت توافقی انجام می‌شود — اختلاف همین دو، حاشیهٔ معامله است که بین کارشناس و پلتفرم تقسیم می‌شود. حداقل مبلغ هر فاکتور ۵٬۰۰۰٬۰۰۰ تومان است و سفارش‌های کوچک‌تر به همان حداقل تعدیل می‌شوند."),
  bodyPara("حساب‌های دریافت سامانه: شبای اصلی IR430170000000345884841004 و دو کارت 6037-9981-4097-4550 و 6063-7311-2146-8624 — در سامانه با اعتبارسنجی رسمی ثبت‌اند (تعبیق شبا با الگوریتم mod-97 و کارت با الگوریتم Luhn)؛ برای مبالغ بالای ۵٬۰۰۰٬۰۰۰ تومان پرداخت به شبا هدایت می‌شود. این حساب‌ها و مقادیر پلن فقط از پنل مدیریت و فقط با دسترسی مالک قابل ویرایش‌اند."),

  h1("پیوست ج — عیب‌یابی‌های رایج"),
  tableCaption("جدول ۶ — خطاهای رایج و راه‌حل"),
  rtlTable([34, 66],
    ["نشانه", "راه‌حل"],
    [
      ["APK «اتصال برقرار نشد»", "دامنه هنوز فعال نیست — در بیلدکیت url را در assets/config.json به آدرس موقت تغییر و بازسازی کنید؛ یا در ویندوز resources/app/config.json را ویرایش کنید"],
      ["پنل ادمین پاسخ نمی‌دهد", "سرویس را بررسی کنید: systemctl status aloshetab؛ لاگ: journalctl -u aloshetab -f"],
      ["خطای STALE در ثبت استعلام", "تاریخ استعلام قبل از ۱۴۰۵/۰۸/۱۰ است — فقط استعلام‌های تازه پذیرفته می‌شوند"],
      ["خطای STOCK_REQUIRED", "استعلام انبار بدون موجودی ثبت نمی‌شود — موجودی همان لحظه را وارد کنید"],
      ["خطای ۴۰۳ در تنظیمات پلن", "تغییر سهم کارشناس/حاشیهٔ پلتفرم فقط با دسترسی مالک است — با owner وارد شوید"],
      ["گزارش ایمیل ارسال نمی‌شود", "متغیرهای SMTP_* در .env را تنظیم کنید؛ تا آن زمان گزارش‌ها در تب «گزارش‌ها» صف می‌شوند"],
      ["کرون شبانه اجرا نشد", "کلید را در URL فراموش نکنید: /api/tick?key=AloShetab-Tick-1405"],
    ]),
];

// ─────────────────────────── Assemble ───────────────────────────
const pageHeader = new Paragraph({
  bidirectional: true, alignment: AlignmentType.RIGHT,
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.accent, space: 4 } },
  spacing: { after: 120 },
  children: [faRun("راهنمای کامل و گام‌به‌گام استقرار — الو شتاب v3.0", { size: 18, color: "777777" })],
});

const footer = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: "صفحه ", font: FONT, size: 16, color: "888888", rightToLeft: true }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "888888" }),
    ],
  })],
});

const doc = new Document({
  creator: "AloShetab Platform",
  title: "راهنمای کامل و گام‌به‌گام استقرار — سامانه الو شتاب v3.0",
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
  },
  features: { updateFields: true },
  sections: [{
    properties: { page: { margin: { top: 1200, bottom: 1100, left: 1000, right: 1000 } } },
    children: [
      ...buildCoverR1(coverConfig),
      new Paragraph({ pageBreakBefore: true }),
      ...tocChildren,
      new Paragraph({ pageBreakBefore: true }),
      pageHeader,
      ...bodyChildren,
    ],
    footers: { default: footer },
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/download/راهنمای-استقرار-v3.0-گام-به-گام.docx", buf);
  console.log("OK docx written:", buf.length, "bytes");
});
