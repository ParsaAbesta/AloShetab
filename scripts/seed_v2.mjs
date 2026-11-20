// seed_v2.mjs — پیام ۱۰: کاتالوگ دو نسخه‌ای (ایران v1 + جهانی v2.0) با ریز جزئیات + دستهٔ خدمات کامپیوتری + کاتالوگ قطعات
// اجرا:  DATABASE_URL=file:/home/z/my-project/db/custom.db node scripts/seed_v2.mjs
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const db = new PrismaClient();
const ROOT = process.env.PROJECT_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'download', 'alo_shetab_services_rates_1405-08-24.json');
const I18N = path.join(ROOT, 'scripts', 'catalog104_enriched.json');
const DET = [
  path.join(ROOT, 'scripts', 'details_iran_a.json'),
  path.join(ROOT, 'scripts', 'details_iran_b.json'),
  path.join(ROOT, 'scripts', 'details_iran_c.json'),
];
const WORLD = path.join(ROOT, 'scripts', 'world_catalog_v2.json');

function parseRate(x) {
  const s = String(x).trim().replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  if (s.endsWith('%')) return { percent: parseFloat(s.slice(0, -1)) };
  return { toman: Math.floor(parseFloat(s.replace(/,/g, ''))) };
}

// فایل‌های عامل، کلید ۱-مبنا دارند؛ کلید پلتفرم ۰-مبناست
function platKey(agentKey) {
  const m = agentKey.match(/^c(\d+)-(\d+)$/);
  if (!m) return null;
  return `c${parseInt(m[1], 10) - 1}-${parseInt(m[2], 10) - 1}`;
}

// خدمت «تدریس برنامه‌نویسی و کامپیوتر»: اقلام عامل آموزشی‌سازی شوند (نصب ⇐ آموزش نصب)
const TEACH_RENAME = new Map([
  ['نصب ویندوز', 'آموزش عملی نصب ویندوز'],
  ['ویروس‌یابی', 'آموزش ویروس‌یابی و امنیت'],
  ['بررسی و رفع ایرادات', 'آموزش عیب‌یابی و رفع ایرادات'],
  ['نصب برنامه‌های کاربردی', 'آموزش نصب برنامه‌های کاربردی'],
  ['نصب برنامه‌های شتاب‌دهنده', 'آموزش بهینه‌سازی و شتاب‌دهی سیستم'],
  ['نصب برنامه‌های تخصصی', 'آموزش نرم‌افزارهای تخصصی'],
  ['نصب و راه‌اندازی حسابداری', 'آموزش نصب و راه‌اندازی نرم‌افزار حسابداری'],
]);

// ─── دستهٔ جدید: خدمات کامپیوتری (خواستهٔ صریح پیام ۱۰) ───────
const COMPUTER_CATEGORY = {
  name: 'خدمات کامپیوتری',
  services: [
    {
      nameFa: 'نصب و راه‌اندازی ویندوز و سیستم‌عامل', nameEn: 'Windows & OS Installation',
      descFa: 'نصب تمیز ویندوز/لینوکس با درایور کامل، پارتیشن‌بندی و انتقال اطلاعات.', descEn: 'Clean OS installation with full drivers, partitioning and data transfer.',
      baseRate: 450000, remote: false,
      details: [
        { nameFa: 'نصب ویندوز', price: 450000 }, { nameFa: 'نصب ویندوز سرور', price: 1800000 },
        { nameFa: 'نصب لینوکس', price: 600000 }, { nameFa: 'نصب درایورهای کامل', price: 150000 },
        { nameFa: 'پارتیشن‌بندی و انتقال داده', price: 350000 }, { nameFa: 'فعال‌سازی رسمی و آفیس', price: 400000 },
        { nameFa: 'بهینه‌سازی اولیه پس از نصب', price: 250000 }, { nameFa: 'بکاپ قبل از نصب', price: 200000 },
        { nameFa: 'رفع خطای بوت و گراب', price: 500000 },
      ],
    },
    {
      nameFa: 'ویروس‌یابی و امنیت', nameEn: 'Antivirus & Security',
      descFa: 'ویروس‌یابی عمیق، حذف بدافزار و امن‌سازی سیستم و حساب‌ها.', descEn: 'Deep virus scan, malware removal and system hardening.',
      baseRate: 500000, remote: true,
      details: [
        { nameFa: 'ویروس‌یابی', price: 400000 }, { nameFa: 'حذف بدافزار و باج‌افزار', price: 800000 },
        { nameFa: 'نصب آنتی‌ویروس اورجینال', price: 350000 }, { nameFa: 'تنظیم فایروال', price: 200000 },
        { nameFa: 'امن‌سازی حساب‌ها و رمزها', price: 300000 }, { nameFa: 'رمزنگاری اطلاعات حساس', price: 900000 },
        { nameFa: 'کانفیگ VPN سازمانی', price: 700000 },
      ],
    },
    {
      nameFa: 'بررسی و رفع ایرادات', nameEn: 'Diagnostics & Troubleshooting',
      descFa: 'عیب‌یابی کامل نرم‌افزاری و سخت‌افزاری با گزارش شفاف.', descEn: 'Full software/hardware diagnostics with a clear report.',
      baseRate: 600000, remote: false,
      details: [
        { nameFa: 'بررسی و رفع ایرادات نرم‌افزاری', price: 400000 }, { nameFa: 'عیب‌یابی سخت‌افزار', price: 500000 },
        { nameFa: 'رفع مشکل صفحهٔ آبی', price: 450000 }, { nameFa: 'رفع مشکل روشن‌نشدن', price: 600000 },
        { nameFa: 'پاک‌سازی و خنک‌کاری', price: 300000 }, { nameFa: 'تعویض خمیر سیلیکون', price: 350000 },
        { nameFa: 'تست باتری و شارژر', price: 250000 }, { nameFa: 'رفع مشکل صدای فن', price: 250000 },
      ],
    },
    {
      nameFa: 'نصب برنامه‌های کاربردی', nameEn: 'Application Setup',
      descFa: 'نصب و پیکربندی نرم‌افزارهای عمومی، آفیس و ابزارهای روزمره.', descEn: 'Installing and configuring everyday office and utility software.',
      baseRate: 300000, remote: true,
      details: [
        { nameFa: 'نصب برنامه‌های کاربردی', price: 300000 }, { nameFa: 'نصب پکیج آفیس', price: 350000 },
        { nameFa: 'نصب برنامه‌های شتاب‌دهنده', price: 250000 }, { nameFa: 'نصب نرم‌افزار گرافیکی', price: 400000 },
        { nameFa: 'نصب نرم‌افزار مهندسی (اتوکد و…)', price: 500000 }, { nameFa: 'لایسنس و فعال‌سازی', price: 300000 },
        { nameFa: 'بهینه‌سازی استارتاپ و حافظه', price: 200000 },
      ],
    },
    {
      nameFa: 'نصب برنامه‌های تخصصی', nameEn: 'Specialized Software Setup',
      descFa: 'نصب و راه‌اندازی نرم‌افزارهای تخصصی مالی، مهندسی، طراحی و مدیریتی.', descEn: 'Installing specialized financial, engineering and design software.',
      baseRate: 500000, remote: true,
      details: [
        { nameFa: 'نصب برنامه‌های تخصصی', price: 500000 }, { nameFa: 'نصب نرم‌افزار سه‌بعدی و رندر', price: 600000 },
        { nameFa: 'نصب نرم‌افزار مالی و بورسی', price: 550000 }, { nameFa: 'نصب نرم‌افزار آماری و علمی', price: 600000 },
        { nameFa: 'پیکربندی چندکاربره', price: 800000 }, { nameFa: 'ساخت شورتکات و پروفایل کاری', price: 150000 },
      ],
    },
    {
      nameFa: 'نصب و راه‌اندازی حسابداری', nameEn: 'Accounting Software Setup',
      descFa: 'نصب نرم‌افزار حسابداری با کدینگ، انبار، گزارشات و آموزش اولیه.', descEn: 'Accounting software setup with chart of accounts, inventory and training.',
      baseRate: 900000, remote: true,
      details: [
        { nameFa: 'نصب و راه‌اندازی حسابداری', price: 900000 }, { nameFa: 'نصب نرم‌افزار حسابداری', price: 500000 },
        { nameFa: 'تعریف سرگروه‌ها و کدینگ', price: 600000 }, { nameFa: 'انتقال اطلاعات مالی', price: 700000 },
        { nameFa: 'راه‌اندازی انبار و گردش کالا', price: 500000 }, { nameFa: 'تنظیم گزارشات و مالیات', price: 600000 },
        { nameFa: 'پیکربندی شبکه‌ای چندکاربره', price: 800000 }, { nameFa: 'آموزش اولیه اپراتور', price: 400000 },
      ],
    },
    {
      nameFa: 'آپگرید و ارتقای قطعات', nameEn: 'Hardware Upgrade',
      descFa: 'ارتقای RAM، SSD، کارت گرافیک و خنک‌کاری با مشاورهٔ خرید.', descEn: 'RAM/SSD/GPU upgrades with cooling service and buying advice.',
      baseRate: 400000, remote: false,
      details: [
        { nameFa: 'نصب رم', price: 200000 }, { nameFa: 'نصب SSD و انتقال سیستم‌عامل', price: 400000 },
        { nameFa: 'تعویض CPU', price: 450000 }, { nameFa: 'نصب کارت گرافیک', price: 300000 },
        { nameFa: 'پاک‌سازی و خنک‌کاری کامل', price: 250000 }, { nameFa: 'مشاورهٔ خرید قطعه', price: 100000 },
        { nameFa: 'تست پایداری پس از ارتقا', price: 200000 },
      ],
    },
    {
      nameFa: 'تعمیر لپ‌تاپ و مادربرد', nameEn: 'Laptop & Motherboard Repair',
      descFa: 'تعمیر برد، تعویض صفحه‌نمایش و قطعات لپ‌تاپ با قطعهٔ اصل.', descEn: 'Board-level repair, screen and part replacement with genuine parts.',
      baseRate: 800000, remote: false,
      details: [
        { nameFa: 'تعویض صفحه‌نمایش', price: 800000 }, { nameFa: 'تعویض کیبورد', price: 500000 },
        { nameFa: 'تعمیر مادربرد (برد)', price: 1200000 }, { nameFa: 'تعویض فن و سیستم خنک‌کننده', price: 400000 },
        { nameFa: 'تعمیر شارژر و سوکت برق', price: 350000 }, { nameFa: 'تعویض لولا و بدنه', price: 450000 },
        { nameFa: 'شست‌وشوی برد پس از نفوذ مایعات', price: 900000 },
      ],
    },
    {
      nameFa: 'بازیابی اطلاعات (دیتا ریکاوری)', nameEn: 'Data Recovery',
      descFa: 'بازیابی اطلاعات هارد، SSD و فلز در سطح حرفه‌ای با محرمانگی کامل.', descEn: 'Professional recovery from HDD/SSD/flash with full confidentiality.',
      baseRate: 1200000, remote: false,
      details: [
        { nameFa: 'بازیابی فایل‌های حذف‌شده', price: 600000 }, { nameFa: 'ریکاوری هارد منطقی', price: 1200000 },
        { nameFa: 'ریکاوری فلش و حافظهٔ موبایل', price: 900000 }, { nameFa: 'ریکاوری پارتیشن فرمت‌شده', price: 1500000 },
        { nameFa: 'تحلیل هارد آسیب فیزیکی (کارشناسی)', price: 800000 }, { nameFa: 'تحویل روی رسانهٔ جدید', price: 250000 },
      ],
    },
    {
      nameFa: 'نصب و راه‌اندازی شبکه و وای‌فای', nameEn: 'Network & Wi-Fi Setup',
      descFa: 'راه‌اندازی شبکهٔ خانگی/اداری، وای‌فای، شیرینگ فایل و پرینتر.', descEn: 'Home/office LAN, Wi-Fi, file and printer sharing.',
      baseRate: 800000, remote: false,
      details: [
        { nameFa: 'کانفیگ مودم و روتر', price: 400000 }, { nameFa: 'کابل‌کشی و پچ‌پنل', price: 600000 },
        { nameFa: 'راه‌اندازی وای‌فای اداری', price: 700000 }, { nameFa: 'شیرینگ فایل و پرینتر', price: 350000 },
        { nameFa: 'تنظیم سرور فایل (NAS)', price: 1200000 }, { nameFa: 'کنترل دسترسی و محدودسازی', price: 500000 },
      ],
    },
    {
      nameFa: 'خدمات پرینتر و اسکنر', nameEn: 'Printer & Scanner Services',
      descFa: 'نصب، شیرینگ و تعمیر پرینتر لیزری/جوهرافشان و اسکنر.', descEn: 'Install, share and repair laser/inkjet printers and scanners.',
      baseRate: 450000, remote: false,
      details: [
        { nameFa: 'نصب و درایور پرینتر', price: 250000 }, { nameFa: 'شیرینگ شبکه‌ای پرینتر', price: 300000 },
        { nameFa: 'رفع خطای پرینت و صف چاپ', price: 300000 }, { nameFa: 'شارژ و تعویض کارتریج', price: 350000 },
        { nameFa: 'تنظیم اسکنر و OCR', price: 350000 },
      ],
    },
    {
      nameFa: 'پشتیبان‌گیری ابری و زمان‌بندی‌شده', nameEn: 'Cloud Backup & Scheduling',
      descFa: 'بکاپ خودکار اطلاعات روی ابر/NAS با زمان‌بندی و بازیابی آزمایشی.', descEn: 'Automated scheduled backups to cloud/NAS with restore drills.',
      baseRate: 400000, remote: true,
      details: [
        { nameFa: 'تنظیم بکاپ خودکار', price: 400000 }, { nameFa: 'پیکربندی بکاپ ابری', price: 500000 },
        { nameFa: 'بکاپ سیستم‌عامل (ایمیج)', price: 600000 }, { nameFa: 'آزمون بازیابی', price: 200000 },
        { nameFa: 'رمزنگاری نسخهٔ پشتیبان', price: 300000 },
      ],
    },
  ],
};

// ─── کاتالوگ قطعات (سفارش خرید قطعات پیام ۱۰) ────────────────
const PARTS = [
  ['laptop', 'لپ‌تاپ', 'Laptop', 'laptop', 45000000], ['desktop-pc', 'کیس دسکتاپ آماده', 'Desktop PC', 'computer', 18000000],
  ['monitor', 'مانیتور', 'Monitor', 'monitor', 12000000], ['mouse', 'ماوس', 'Mouse', 'mouse', 800000],
  ['keyboard', 'کیبورد', 'Keyboard', 'keyboard', 1200000], ['headset', 'هدست', 'Headset', 'headphones', 2500000],
  ['speaker', 'اسپیکر', 'Speaker', 'speaker', 3000000], ['webcam', 'وبکم', 'Webcam', 'camera', 2000000],
  ['ssd-nvme-1tb', 'SSD NVMe یک ترابایت', 'SSD NVMe 1TB', 'hard-drive', 6500000], ['ssd-sata-512', 'SSD ساتا ۵۱۲ گیگ', 'SSD SATA 512GB', 'hard-drive', 3800000],
  ['hdd-ext-1tb', 'هارد اکسترنال یک ترابایت', 'External HDD 1TB', 'hard-drive', 4500000], ['hdd-2tb', 'هارد داخلی دو ترابایت', 'Internal HDD 2TB', 'hard-drive', 5500000],
  ['ram-ddr4-8', 'رم DDR4 هشت گیگ', 'RAM DDR4 8GB', 'memory-stick', 3500000], ['ram-ddr4-16', 'رم DDR4 شانزده گیگ', 'RAM DDR4 16GB', 'memory-stick', 6500000],
  ['gpu', 'کارت گرافیک', 'Graphics Card', 'gpu', 25000000], ['cpu', 'پردازنده', 'CPU', 'cpu', 15000000],
  ['motherboard', 'مادربرد', 'Motherboard', 'cpu', 12000000], ['psu', 'پاور', 'Power Supply', 'zap', 4000000],
  ['cooler-fan', 'فن خنک‌کننده', 'Cooling Fan', 'fan', 800000], ['case', 'کیس خالی', 'PC Case', 'box', 3500000],
  ['printer-laser', 'پرینتر لیزری', 'Laser Printer', 'printer', 8000000], ['printer-ink', 'پرینتر جوهرافشان', 'Inkjet Printer', 'printer', 5500000],
  ['scanner', 'اسکنر', 'Scanner', 'scan', 6000000], ['cartridge', 'کارتریج', 'Cartridge', 'printer', 1200000],
  ['router-wifi', 'روتر وای‌فای', 'Wi-Fi Router', 'wifi', 3500000], ['modem', 'مودم', 'Modem', 'router', 2500000],
  ['switch-8p', 'سوئیچ هشت پورت', '8-Port Switch', 'network', 4000000], ['cable-lan', 'کابل شبکه', 'LAN Cable', 'cable', 150000],
  ['cable-hdmi', 'کابل HDMI', 'HDMI Cable', 'cable', 300000], ['ups', 'UPS', 'UPS', 'battery-charging', 5000000],
  ['cctv-camera', 'دوربین مداربسته', 'CCTV Camera', 'cctv', 4500000], ['cctv-dvr-4ch', 'دستگاه DVR چهار کانال', '4ch DVR', 'cctv', 8000000],
  ['cctv-hdd-2tb', 'هارد نظارتی دو ترابایت', 'Surveillance HDD 2TB', 'hard-drive', 7000000], ['antivirus-1y', 'آنتی‌ویروس یک‌ساله', 'Antivirus 1-Year', 'shield-check', 2500000],
  ['win-license', 'لایسنس ویندوز', 'Windows License', 'key-round', 9500000], ['office-license', 'لایسنس آفیس', 'Office License', 'file-text', 6500000],
  ['laptop-charger', 'آداپتور شارژ لپ‌تاپ', 'Laptop Charger', 'plug', 1500000], ['laptop-battery', 'باتری لپ‌تاپ', 'Laptop Battery', 'battery-full', 3000000],
  ['tablet', 'تبلت', 'Tablet', 'tablet', 25000000], ['screen-guard', 'محافظ صفحه‌نمایش', 'Screen Protector', 'shield', 300000],
];

async function main() {
  const cat = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
  const i18n = JSON.parse(fs.readFileSync(I18N, 'utf-8'));
  const det = {};
  for (const p of DET) Object.assign(det, JSON.parse(fs.readFileSync(p, 'utf-8')));
  const world = JSON.parse(fs.readFileSync(WORLD, 'utf-8'));

  // پاک‌سازی (ترتیب FK)
  await db.serviceDetail.deleteMany();
  await db.orderPart.deleteMany();
  await db.detailRequest.deleteMany();
  await db.priceChangeRequest.deleteMany();
  await db.part.deleteMany();
  await db.orderEvent.deleteMany();
  await db.orderItem.deleteMany();
  await db.payment.deleteMany();
  await db.rating.deleteMany();
  await db.referral.deleteMany();
  await db.productOrder.deleteMany();
  await db.contactMessage.deleteMany();
  await db.investorRequest.deleteMany();
  await db.fundRequest.deleteMany();
  await db.activityLog.deleteMany();
  await db.reportItem.deleteMany();
  await db.order.deleteMany();
  await db.dayRate.deleteMany();
  await db.worker.deleteMany();
  await db.customer.deleteMany();
  await db.service.deleteMany();

  // ─── نسخهٔ ایران v1: ۱۰۴ خدمت + متفرقه + ریز جزئیات ──
  let nIran = 0, nDetIran = 0;
  for (let ci = 0; ci < cat.categories.length; ci++) {
    const c = cat.categories[ci];
    for (let si = 0; si < c.services.length; si++) {
      const s = c.services[si];
      const key = `c${ci}-${si}`;
      const en = i18n[key] ?? { nameEn: s.name, descFa: `خدمت ${s.name}`, descEn: `Service ${s.name}` };
      const r = parseRate(s.alo_rate);
      const isPercent = r.percent != null;
      const svc = await db.service.create({
        data: {
          key, nameFa: s.name, nameEn: en.nameEn, descFa: en.descFa, descEn: en.descEn,
          baseRate: isPercent ? 0 : r.toman, percentValue: isPercent ? r.percent : null,
          category: c.name, remoteCapable: !isPercent, isMisc: false,
          edition: 'IRAN', currency: 'IRT', sortOrder: ci * 100 + si,
        },
      });
      nIran++;
      // ریز جزئیات عامل‌نویسی‌شده
      const agentKey = `c${ci + 1}-${si + 1}`;
      const pack = det[agentKey];
      if (pack?.details?.length) {
        let di = 0;
        for (const d of pack.details) {
          const nm = key === 'c0-5' && TEACH_RENAME.get(d.nameFa) ? TEACH_RENAME.get(d.nameFa) : d.nameFa;
          await db.serviceDetail.create({
            data: { serviceId: svc.id, nameFa: nm, price: Math.max(0, Math.floor(d.price || 0)), sortOrder: di++ },
          });
          nDetIran++;
        }
      }
    }
  }
  const misc = await db.service.create({
    data: {
      key: 'misc', nameFa: 'متفرقه — هر نیاز دیگر', nameEn: 'Misc — any other need',
      descFa: 'نیاز خود را شرح دهید؛ هوش مصنوعی نرخ انجام را برآورد می‌کند یا سفارش برای کارشناسی علامت می‌خورد.',
      descEn: 'Describe your need; AI estimates the rate or the order is flagged for expert review.',
      baseRate: 0, remoteCapable: true, isMisc: true, category: 'سایر خدمات روزمره',
      edition: 'IRAN', currency: 'IRT', sortOrder: 9999,
    },
  });
  nIran++;
  console.log('IRAN services:', nIran, '| IRAN details:', nDetIran);

  // ─── دستهٔ جدید: خدمات کامپیوتری ──
  let nPc = 0, nDetPc = 0;
  for (let i = 0; i < COMPUTER_CATEGORY.services.length; i++) {
    const s = COMPUTER_CATEGORY.services[i];
    const svc = await db.service.create({
      data: {
        key: `cpc-${i + 1}`, nameFa: s.nameFa, nameEn: s.nameEn, descFa: s.descFa, descEn: s.descEn,
        baseRate: s.baseRate, category: COMPUTER_CATEGORY.name, remoteCapable: s.remote,
        edition: 'IRAN', currency: 'IRT', sortOrder: 810 + i, icon: 'monitor',
      },
    });
    let di = 0;
    for (const d of s.details) {
      await db.serviceDetail.create({ data: { serviceId: svc.id, nameFa: d.nameFa, price: d.price, sortOrder: di++ } });
      nDetPc++;
    }
    nPc++;
  }
  console.log('COMPUTER services:', nPc, '| COMPUTER details:', nDetPc);

  // ─── نسخهٔ جهانی v2.0 ──
  let nWorld = 0, nDetWorld = 0;
  for (let ci = 0; ci < world.categories.length; ci++) {
    const c = world.categories[ci];
    for (let si = 0; si < c.services.length; si++) {
      const s = c.services[si];
      const svc = await db.service.create({
        data: {
          key: s.key, nameFa: s.nameFa, nameEn: s.nameEn, descFa: s.descFa, descEn: s.descEn,
          baseRate: Math.floor(s.basePrice), category: c.nameFa, remoteCapable: !!s.remoteCapable,
          icon: c.icon || 'globe', edition: 'WORLD', currency: 'USD', sortOrder: (ci + 1) * 100 + si,
        },
      });
      let di = 0;
      for (const d of s.details) {
        await db.serviceDetail.create({
          data: { serviceId: svc.id, nameFa: d.nameFa, nameEn: d.nameEn || '', price: Math.floor(d.price || 0), sortOrder: di++ },
        });
        nDetWorld++;
      }
      nWorld++;
    }
  }
  console.log('WORLD services:', nWorld, '| WORLD details:', nDetWorld);

  // ─── قطعات ──
  let pi = 0;
  for (const [key, nameFa, nameEn, icon, basePrice] of PARTS) {
    await db.part.create({ data: { key, nameFa, nameEn, icon, basePrice, category: 'سخت‌افزار و تجهیزات', sortOrder: pi++ } });
  }
  console.log('PARTS:', PARTS.length);

  // ─── تنظیمات + همکاران نمونه ──
  const settings = {
    ACCOUNT_NAME: 'ألو شتاب', CARD_1: '6037-9981-4097-4550', CARD_2: '6063-7311-2146-8624',
    SUPPORT_PHONE: '09014700109', EMAIL_1: 'AloShetabOwner@Gmail.com', EMAIL_2: 'AloShetabAdmin@Gmail.com',
    REFERRAL_PERCENT: '5', REMOTE_FACTOR: '0.7', ADMIN_PASSWORD: 'AloShetab1404', VERSION: 'v2.0-IR+WORLD',
  };
  for (const [k, v] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } });
  }
  await db.worker.createMany({
    data: [
      { fullName: 'علی رضایی', nationalId: '0079123456', mobile: '09121110001', city: 'تهران', field: 'خدمات کامپیوتری و شبکه', resume: '۱۰ سال سابقه نصب و تعمیر سیستم، شبکه و دوربین مداربسته', status: 'APPROVED', level: 'SILVER', points: 45 },
      { fullName: 'مریم احمدی', nationalId: '0064587412', mobile: '09121110002', city: 'تهران', field: 'نظافت و خدمات منزل', resume: '۶ سال سابقه نظافت اداری و منزل', status: 'APPROVED', level: 'BRONZE', points: 12 },
    ],
  });
  console.log('settings done; VERSION=v2.0-IR+WORLD');
}

main().finally(() => db.$disconnect());
