// ─── پیام ۱۱ + اصلاح پیام ۱۲: بذرپاشی انبارها، موجودی میز کالا،
//     قیمت نمایشی = همان قیمت مرجع (بدون افزودنی — افزودنی در صفحهٔ پرداخت)،
//     بخش نرم‌افزار، کاربران پنل (مالک/ادمین) و تنظیمات حساب‌ها ──
// تاریخ منابع قیمت: ۱۴۰۵/۰۸/۱۱ تا ۱۴۰۵/۰۸/۲۶ (بعد از مرز تازگی ۱۴۰۵/۰۸/۱۰ = ۲۰۲۶/۱۱/۰۱)
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const db = new PrismaClient();

const SALT = 'aloshetab::p11::secure::panel';
const hash = (p) => createHash('sha256').update(`${SALT}:${p}`).digest('hex');
const round1000 = (v) => Math.round(v / 1000) * 1000;

// پیام ۱۲: قیمت نمایشی = همان قیمت مرجع (بدون افزودنی)؛
// قاعدهٔ رقابتی فقط «افزودنی پرداخت» را تعیین می‌کند: +۳۳٪ عادی / +۱۵٪ اگر سایت مرجع گران‌تر بود
function price(basePrice, refPrice = null) {
  const computed = round1000(basePrice * 1.33);
  if (refPrice && refPrice > computed) {
    return { list: basePrice, rule: 'SITE+15%' };
  }
  return { list: basePrice, rule: 'BASE+33%' };
}

const PRICE_DATE = '1405/08/26';
const INTERNAL_SRC = 'قیمت‌گذاری داخلی الو شتاب — نیاز به استعلام روز انبار';

// ─── انبارها و مراجع (اطلاعات عمومی بررسی‌شده) ───────────────
const WAREHOUSES = [
  { key: 'ofogh-computer', nameFa: 'کامپیوتر افق', nameEn: 'Ofogh Computer', kind: 'COMPUTER', website: 'iranfso.com', phone: '021-57853000', address: 'تهران، خیابان ولی‌عصر، خیابان طالقانی، خیابان برادران مظفر، پلاک ۱۰۰', linkTemplate: null, verified: true, notes: 'فروشگاه سخت‌افزار و لپ‌تاپ — فعال (طبق نقشه‌ها و سایت رسمی)' },
  { key: 'ofogh-system', nameFa: 'افق سیستم', nameEn: 'Ofogh System', kind: 'COMPUTER', website: 'www.ofoghsystem.com', phone: '021-66451589', address: 'تهران، خیابان ولی‌عصر، بعد از تقاطع طالقانی', linkTemplate: null, verified: true, notes: 'تعمیرگاه تخصصی لپ‌تاپ و فروش قطعات — فعال' },
  { key: 'digikala', nameFa: 'دیجی‌کالا', nameEn: 'Digikala', kind: 'MARKETPLACE', website: 'www.digikala.com', phone: '021-91000100', address: 'تهران، بالاتر از میدان ونک، خیابان خدامی، کوچه شادی ۱، ساختمان ونک پلازا، پلاک ۳۱', linkTemplate: 'https://www.digikala.com/search/?q={q}', verified: true, notes: 'مرجع مقایسه قیمت کالا (طبق پیام ۱۱)' },
  { key: 'snapp', nameFa: 'اسنپ', nameEn: 'Snapp', kind: 'MARKETPLACE', website: 'snapp.ir', phone: null, address: 'پشتیبانی از طریق اپلیکیشن اسنپ', linkTemplate: null, verified: true, notes: 'مرجع خدمات و پیک — فعال' },
  { key: 'achareh', nameFa: 'آچاره', nameEn: 'Achareh', kind: 'SERVICES', website: 'achareh.com', phone: null, address: 'پشتیبانی از طریق سایت', linkTemplate: null, verified: true, notes: 'مرجع خدمات ساختمانی/خانه (طبق پیام ۱۱) — شماره تماس رسمی باید توسط ادمین تکمیل/تأیید شود' },
  { key: 'torob', nameFa: 'ترب', nameEn: 'Torob', kind: 'PRICE_AGGREGATOR', website: 'torob.com', phone: null, address: null, linkTemplate: 'https://torob.com/search/?query={q}', verified: true, notes: 'مقایسه قیمت مراجع' },
  { key: 'emalls', nameFa: 'ایمالز', nameEn: 'Emalls', kind: 'PRICE_AGGREGATOR', website: 'emalls.ir', phone: null, address: null, linkTemplate: 'https://emalls.ir/سبد?q={q}', verified: true, notes: 'مقایسه قیمت فروشندگان' },
  { key: 'afralland', nameFa: 'فرالند (لوازم خانگی)', nameEn: 'Afralland', kind: 'APPLIANCE', website: 'afralland.com', phone: null, address: 'فروش اینترنتی — پشتیبانی سایت', linkTemplate: 'https://afralland.com/pricelist/washing-machine-price', verified: true, notes: 'لیست قیمت روز لوازم خانگی (آبان ۱۴۰۵ بروز)' },
  { key: 'trust-mp', nameFa: 'تراست مارکت‌پلیس', nameEn: 'Trust Marketplace', kind: 'APPLIANCE', website: 'www.trustmarketplace.ir', phone: null, address: 'فروش اینترنتی', linkTemplate: null, verified: true, notes: 'کولر گازی اسپلیت — لیست آبان ۱۴۰۵' },
];

// ─── کالاهای پژوهش‌شده (قیمت پایه = پائین‌ترین قیمت بروز مراجع) ──
const GOODS = [
  // ── کامپیوتر ──
  { key: 'laptop-lenovo-v15-g4', nameFa: 'لپ‌تاپ لنوو V15 G4 — Core i5-13420H، ۱۶GB، 512GB SSD', nameEn: 'Lenovo V15 G4 Core i5-13420H 16GB 512GB', descFa: 'لپ‌تاپ اداری و دانشجویی — پائین‌ترین قیمت بروز مراجع (ایمالز، ۱۱ آبان ۱۴۰۵).', category: 'لپ‌تاپ', brand: 'لنوو', model: 'V15 G4', basePrice: 157_000_000, baseSource: 'ایمالز (۱۴۰۵/۰۸/۱۱)', icon: 'laptop', stock: 3, sort: 10 },
  { key: 'laptop-asus-vivobook-a1504va', nameFa: 'لپ‌تاپ ایسوس Vivobook A1504VA — Core i5-1334U، ۸GB، 512GB', nameEn: 'ASUS Vivobook A1504VA i5-1334U 8GB 512GB', descFa: 'لپ‌تاپ همه‌کاره با اثر انگشت و صفحه روشن — مرجع: ایمالز (۱۷ آبان ۱۴۰۵).', category: 'لپ‌تاپ', brand: 'ایسوس', model: 'Vivobook A1504VA', basePrice: 165_000_000, baseSource: 'ایمالز (۱۴۰۵/۰۸/۱۷)', icon: 'laptop', stock: 3, sort: 11 },
  { key: 'monitor-twisted-minds-tm24', nameFa: 'مانیتور تویستد مایندز TM24FHD — ۲۴ اینچ IPS صد هرتز', nameEn: 'Twisted Minds TM24FHD 24" IPS 100Hz', descFa: 'مانیتور ۲۴ اینچ Full HD — پائین‌ترین قیمت مراجع (دلگرم/ترب، ۲۴ آبان ۱۴۰۵).', category: 'مانیتور', brand: 'تویستد مایندز', model: 'TM24FHD', basePrice: 19_499_000, baseSource: 'دلگرم/ترب (۱۴۰۵/۰۸/۲۴)', icon: 'monitor', stock: 5, sort: 12 },
  { key: 'monitor-lg-24u411b', nameFa: 'مانیتور ال‌جی 24U411B-B — ۲۴ اینچ IPS ۱۴۴ هرتز', nameEn: 'LG 24U411B-B 24" IPS 144Hz', descFa: 'مانیتور Full HD ال‌جی — مرجع: دیجی‌کالا (۲۶ آبان ۱۴۰۵).', category: 'مانیتور', brand: 'ال‌جی', model: '24U411B-B', basePrice: 32_888_000, baseSource: 'دیجی‌کالا (۱۴۰۵/۰۸/۲۶)', icon: 'monitor', stock: 3, sort: 13 },
  { key: 'mouse-q5', nameFa: 'ماوس بی‌سیم کیو مدل Q5', nameEn: 'Q5 Wireless Mouse', descFa: 'ماوس بی‌سیم اقتصادی — مرجع: دیجی‌کالا (۲۶ آبان ۱۴۰۵).', category: 'ماوس', brand: 'کیو', model: 'Q5', basePrice: 1_312_000, baseSource: 'دیجی‌کالا (۱۴۰۵/۰۸/۲۶)', icon: 'mouse', stock: 10, sort: 14 },
  { key: 'mouse-gaming-optical', nameFa: 'ماوس بی‌سیم مخصوص بازی — سنسور اپتیکال', nameEn: 'Wireless Gaming Mouse (Optical)', descFa: 'ماوس گیمینگ بی‌سیم — مرجع: دیجی‌کالا (۲۶ آبان ۱۴۰۵).', category: 'ماوس', brand: 'متفرقه', model: 'Optical Gaming', basePrice: 1_669_000, baseSource: 'دیجی‌کالا (۱۴۰۵/۰۸/۲۶)', icon: 'mouse', stock: 10, sort: 15 },

  // ── لوازم خانگی ──
  { key: 'fridge-taksan-rfn24', nameFa: 'یخچال‌فریزر تکسان RFN-24 — ۲۷ فوت', nameEn: 'Taksan RFN-24 Fridge-Freezer 27cuft', descFa: 'یخچال‌فریزر بزرگ تکسان — مرجع: گجت‌نیوز (۲۰ آبان ۱۴۰۵).', category: 'یخچال', brand: 'تکسان', model: 'RFN-24', basePrice: 88_000_000, baseSource: 'گجت‌نیوز (۱۴۰۵/۰۸/۲۰)', icon: 'fridge', stock: 2, sort: 20 },
  { key: 'fridge-kelor-rs5bl3', nameFa: 'یخچال کلور RS5BL3 — ۸ فوت', nameEn: 'Kelor RS5BL3 Fridge 8cuft', descFa: 'یخچال کوچک کلور — مرجع: گجت‌نیوز (۲۰ آبان ۱۴۰۵).', category: 'یخچال', brand: 'کلور', model: 'RS5BL3', basePrice: 71_000_000, baseSource: 'گجت‌نیوز (۱۴۰۵/۰۸/۲۰)', icon: 'fridge', stock: 3, sort: 21 },
  { key: 'washer-lg-y1-7kg', nameFa: 'لباسشویی ال‌جی Y1 — ۷ کیلویی (سفید)', nameEn: 'LG Y1 Washer 7kg White', descFa: 'لباسشویی اتومات ال‌جی — مرجع: فرالند (۲۵ آبان ۱۴۰۵).', category: 'لباسشویی', brand: 'ال‌جی', model: 'F2J3 (Y1) 7kg', basePrice: 121_950_000, baseSource: 'فرالند (۱۴۰۵/۰۸/۲۵)', icon: 'washer', stock: 2, sort: 22 },
  { key: 'washer-lg-y1-8kg', nameFa: 'لباسشویی ال‌جی Y1 — ۸ کیلویی (سفید)', nameEn: 'LG Y1 Washer 8kg White', descFa: 'لباسشویی اتومات ال‌جی — مرجع: فرالند (۲۵ آبان ۱۴۰۵).', category: 'لباسشویی', brand: 'ال‌جی', model: 'F4Y1 8kg', basePrice: 131_950_000, baseSource: 'فرالند (۱۴۰۵/۰۸/۲۵)', icon: 'washer', stock: 2, sort: 23 },
  { key: 'washer-bosch-14400', nameFa: 'لباسشویی بوش مدل 14400 — ۹ کیلویی (مونتاژ ترکیه)', nameEn: 'Bosch 14400 Washer 9kg (TR)', descFa: 'لباسشویی بوش — مرجع: فرالند (۲۵ آبان ۱۴۰۵).', category: 'لباسشویی', brand: 'بوش', model: 'WGG14400', basePrice: 172_950_000, baseSource: 'فرالند (۱۴۰۵/۰۸/۲۵)', icon: 'washer', stock: 2, sort: 24 },
  { key: 'tv-samsung-du8000-55', nameFa: 'تلویزیون سامسونگ DU8000 — ۵۵ اینچ 4K', nameEn: 'Samsung DU8000 55" 4K LED', descFa: 'تلویزیون هوشمند سامسونگ — مرجع: فرالند (۲۵ آبان ۱۴۰۵).', category: 'تلویزیون', brand: 'سامسونگ', model: 'DU8000 55"', basePrice: 102_990_000, baseSource: 'فرالند (۱۴۰۵/۰۸/۲۵)', icon: 'tv', stock: 3, sort: 25 },
  { key: 'tv-samsung-q60d-55', nameFa: 'تلویزیون سامسونگ Q60D — ۵۵ اینچ QLED 4K', nameEn: 'Samsung Q60D 55" QLED 4K', descFa: 'تلویزیون QLED سامسونگ — مرجع: فرالند (۲۵ آبان ۱۴۰۵).', category: 'تلویزیون', brand: 'سامسونگ', model: 'Q60D 55"', basePrice: 115_990_000, baseSource: 'فرالند (۱۴۰۵/۰۸/۲۵)', icon: 'tv', stock: 2, sort: 26 },
  { key: 'tv-lg-ua8500-55', nameFa: 'تلویزیون ال‌جی UA8500 — ۵۵ اینچ 4K', nameEn: 'LG UA8500 55" UHD 4K', descFa: 'تلویزیون ال‌جی — مرجع: ایمالز (۲۶ آبان ۱۴۰۵، ۱۲ فروشنده).', category: 'تلویزیون', brand: 'ال‌جی', model: 'UA8500 55"', basePrice: 119_500_000, baseSource: 'ایمالز (۱۴۰۵/۰۸/۲۶)', icon: 'tv', stock: 2, sort: 27 },
  { key: 'cooler-trust-12000', nameFa: 'کولر گازی اسپلیت تراست — ۱۲۰۰۰ گرید A', nameEn: 'Trust Split AC 12000 BTU Grade A', descFa: 'کولر گازی اسپلیت (نصب رایگان فروشنده) — پایه: تراست مارکت‌پلیس (آبان ۱۴۰۵)؛ مرجع بازار بالاتر (داماپا: ۷۵ تا ۱۲۵ میلیون) → قیمت طبق قاعدهٔ «سایت مرجع +۱۵٪».', category: 'کولر', brand: 'تراست', model: '12000 Grade A', basePrice: 55_000_000, baseSource: 'تراست مارکت‌پلیس (۱۴۰۵/۰۸)', refPrice: 75_000_000, refSource: 'داماپا — کف بازهٔ بازار آبان ۱۴۰۵', icon: 'cooler', stock: 3, sort: 28 },
  { key: 'cooler-gold-s18', nameFa: 'کولر گازی جنرال گلد پلاتینیوم GG-S18 — ۱۸۰۰۰', nameEn: 'General Gold GG-S18 AC 18000 BTU', descFa: 'کولر گازی جنرال گلد — مرجع: دلگرم (۲۴ آبان ۱۴۰۵).', category: 'کولر', brand: 'جنرال گلد', model: 'GG-S18', basePrice: 66_500_000, baseSource: 'دلگرم (۱۴۰۵/۰۸/۲۴)', icon: 'cooler', stock: 2, sort: 29 },
  { key: 'heater-absal-437', nameFa: 'بخاری گازی آبسال مدل 437 — دیواری/زمین تابشی', nameEn: 'Absal 437 Gas Heater', descFa: 'بخاری گازی تابشی آبسال — مرجع: دلگرم (۲۵ آبان ۱۴۰۵).', category: 'بخاری', brand: 'آبسال', model: '437', basePrice: 11_000_000, baseSource: 'دلگرم (۱۴۰۵/۰۸/۲۵)', icon: 'heater', stock: 5, sort: 30 },
  { key: 'heater-morvarid-royal-28', nameFa: 'بخاری گازی مرواریدسوز رویال — ۲۸ هزار', nameEn: 'Morvaridsooz Royal 28000 Gas Heater', descFa: 'بخاری گازی مرواریدسوز — مرجع: ترب (۲۵ آبان ۱۴۰۵).', category: 'بخاری', brand: 'مرواریدسوز', model: 'Royal 28000', basePrice: 14_200_000, baseSource: 'ترب (۱۴۰۵/۰۸/۲۵)', icon: 'heater', stock: 4, sort: 31 },
  { key: 'heater-general-royal-9000', nameFa: 'بخاری گازی جنرال شرق رویال ۹۰۰۰ (مشکی)', nameEn: 'General Shargh Royal 9000 Gas Heater', descFa: 'بخاری گازی جنرال شرق — مرجع: دلگرم (۲۵ آبان ۱۴۰۵).', category: 'بخاری', brand: 'جنرال شرق', model: 'Royal 9000', basePrice: 3_950_000, baseSource: 'دلگرم (۱۴۰۵/۰۸/۲۵)', icon: 'heater', stock: 8, sort: 32 },
];

// ─── بخش نرم‌افزار (قیمت‌گذاری داخلی الو شتاب) ────────────────
const SOFTWARE = [
  { key: 'sw-windows-original', nameFa: 'ویندوز اورجینال ۱۰/۱۱ + نصب و فعال‌سازی', nameEn: 'Original Windows 10/11 license + install', descFa: 'لایسنس اورجینال، نصب در محل یا از راه دور، درایور کامل و فعال‌سازی قانونی.', price: 4_500_000, icon: 'software', sort: 40 },
  { key: 'sw-office-2021', nameFa: 'آفیس ۲۰۲۱ اورجینال + نصب', nameEn: 'Original Office 2021 + install', descFa: 'لایسنس اورجینال مایکروسافت آفیس با نصب و آموزش کوتاه.', price: 5_500_000, icon: 'software', sort: 41 },
  { key: 'sw-antivirus', nameFa: 'آنتی‌ویروس اورجینال یک‌ساله + نصب', nameEn: '1-year original antivirus + install', descFa: 'کسپرسکی/اِست/اِست اورجینال با نصب و تنظیم کامل حفاظت.', price: 2_800_000, icon: 'shield', sort: 42 },
  { key: 'sw-accounting', nameFa: 'نصب و راه‌اندازی نرم‌افزار حسابداری (سپیدار/هلپران/پیام‌گستر)', nameEn: 'Accounting software setup', descFa: 'نصب، راه‌اندازی دیتابیس، آموزش اولیه و پشتیبانی یک‌ماهه.', price: 6_000_000, icon: 'software', sort: 43 },
  { key: 'sw-windows-server', nameFa: 'ویندوز سرور + راه‌اندازی شبکه اداری', nameEn: 'Windows Server + office network setup', descFa: 'نصب سرور، دامین کنترلر، اشتراک فایل و کاربران — تا ۱۰ کلاینت.', price: 18_000_000, icon: 'server', sort: 44 },
  { key: 'sw-linux-setup', nameFa: 'لینوکس (اوبونتو/فدورا) + راه‌اندازی کامل', nameEn: 'Linux (Ubuntu/Fedora) full setup', descFa: 'نصب لینوکس، پارتیشن‌بندی، محیط کاربری و نرم‌افزارهای پایه.', price: 2_500_000, icon: 'software', sort: 45 },
  { key: 'sw-office-bundle', nameFa: 'بستهٔ نرم‌افزاری اداری (آفیس + آنتی‌ویروس + بهینه‌سازی)', nameEn: 'Office software bundle', descFa: 'بستهٔ کامل آماده‌سازی یک سیستم اداری با نرم‌افزارهای اورجینال.', price: 8_500_000, icon: 'software', sort: 46 },
  { key: 'sw-design-suite', nameFa: 'نرم‌افزارهای طراحی گرافیک + نصب و آموزش', nameEn: 'Design suite + install & training', descFa: 'نصب مجموعه طراحی (فتوشاپ/ایلاستریتور/...) با آموزش اولیه.', price: 5_000_000, icon: 'software', sort: 47 },
];

// ─── محصولات قدیمی — مهاجرت به مدل جدید ─────────────────────
const LEGACY_KEEP = ['cctv-kit', 'cctv-camera', 'nvr', 'router', 'switch', 'ups', 'smartlock', 'smartbulb', 'powerbank'];
const LEGACY_DEACTIVATE = ['laptop', 'desktop', 'printer']; // قیمت‌های کهنهٔ ۱۴۰۴ — جایگزین با قیمت‌های پژوهش‌شده

async function main() {
  console.log('— پیام ۱۱ seed —');

  // ۱) کاربران پنل
  await db.adminUser.upsert({
    where: { username: 'owner' },
    update: { active: true },
    create: { username: 'owner', role: 'OWNER', passHash: hash('AloShetab1404'), displayName: 'مالک ألو شتاب' },
  });
  await db.adminUser.upsert({
    where: { username: 'admin' },
    update: { active: true },
    create: { username: 'admin', role: 'ADMIN', passHash: hash('AloShetabAdmin1405'), displayName: 'ادمین ألو شتاب' },
  });
  console.log('  ✔ کاربران پنل: owner (رمز فعلی ADMIN_PASSWORD) / admin');

  // ۲) انبارها
  for (const w of WAREHOUSES) {
    await db.warehouse.upsert({
      where: { key: w.key },
      update: { ...w, verifiedAt: new Date() },
      create: { ...w, verifiedAt: new Date() },
    });
  }
  console.log(`  ✔ ${WAREHOUSES.length} انبار/مرجع ثبت شد`);

  // ۳) کالاهای پژوهش‌شده
  const whOfogh = await db.warehouse.findUnique({ where: { key: 'ofogh-computer' } });
  const whDigikala = await db.warehouse.findUnique({ where: { key: 'digikala' } });
  const whAfralland = await db.warehouse.findUnique({ where: { key: 'afralland' } });
  const whTrust = await db.warehouse.findUnique({ where: { key: 'trust-mp' } });

  for (const g of GOODS) {
    const p = price(g.basePrice, g.refPrice ?? null);
    const warehouseId =
      g.category === 'لپ‌تاپ' || g.category === 'مانیتور' || g.category === 'ماوس' ? whOfogh?.id :
      g.category === 'کولر' ? whTrust?.id :
      g.category === 'تلویزیون' ? whDigikala?.id :
      whAfralland?.id;
    await db.product.upsert({
      where: { key: g.key },
      update: {
        nameFa: g.nameFa, nameEn: g.nameEn, descFa: g.descFa, descEn: g.nameEn,
        price: p.list, section: 'GOODS', category: g.category, brand: g.brand, model: g.model,
        basePrice: g.basePrice, baseSource: g.baseSource, priceDate: PRICE_DATE,
        refPrice: g.refPrice ?? null, refSource: g.refSource ?? null,
        priceRule: p.rule, priceStatus: 'ACTIVE', priceUpdatedAt: new Date(),
        stock: g.stock, sortOrder: g.sort, active: true,
        warehouseId: warehouseId ?? null,
      },
      create: {
        key: g.key, nameFa: g.nameFa, nameEn: g.nameEn, descFa: g.descFa, descEn: g.nameEn,
        price: p.list, icon: g.icon, section: 'GOODS', category: g.category, brand: g.brand, model: g.model,
        basePrice: g.basePrice, baseSource: g.baseSource, priceDate: PRICE_DATE,
        refPrice: g.refPrice ?? null, refSource: g.refSource ?? null,
        priceRule: p.rule, priceDate: PRICE_DATE, priceUpdatedAt: new Date(),
        stock: g.stock, sortOrder: g.sort, warehouseId: warehouseId ?? null,
      },
    });
    console.log(`  ✔ کالا: ${g.nameFa} → قیمت مرجع ${p.list.toLocaleString('fa-IR')} تومان (افزودنی پرداخت ${p.rule})`);
  }

  // ۴) نرم‌افزارها
  for (const s of SOFTWARE) {
    await db.product.upsert({
      where: { key: s.key },
      update: { price: s.price, section: 'SOFTWARE', category: 'نرم‌افزار', priceRule: 'MANUAL', priceDate: PRICE_DATE, priceUpdatedAt: new Date(), active: true, sortOrder: s.sort },
      create: {
        key: s.key, nameFa: s.nameFa, nameEn: s.nameEn, descFa: s.descFa, descEn: s.nameEn,
        price: s.price, icon: s.icon, section: 'SOFTWARE', category: 'نرم‌افزار',
        basePrice: s.price, baseSource: 'قیمت‌گذاری داخلی الو شتاب', priceRule: 'MANUAL',
        priceDate: PRICE_DATE, priceUpdatedAt: new Date(), stock: 999, sortOrder: s.sort,
      },
    });
    console.log(`  ✔ نرم‌افزار: ${s.nameFa} → ${s.price.toLocaleString('fa-IR')} تومان`);
  }

  // ۵) مهاجرت محصولات قدیمی — قیمت‌های داخلی ۱۴۰۴ «کهنه»‌اند و طبق پیام ۱۲
  //    (فقط قیمت‌های بعد از ۱۴۰۵/۰۸/۱۰) نباید نمایش داده شوند:
  //    بدون تاریخ قیمت → فیلتر تازگی آن‌ها را از میز عمومی حذف می‌کند تا
  //    ادمین با استعلام تازهٔ انبار قیمت را ثبت و تأیید کند.
  for (const key of LEGACY_KEEP) {
    const p = await db.product.findUnique({ where: { key } });
    if (!p) continue;
    await db.product.update({
      where: { key },
      data: {
        section: 'GOODS', basePrice: p.price, baseSource: INTERNAL_SRC,
        priceRule: 'MANUAL', priceDate: null, priceStatus: 'PENDING_REVIEW', priceUpdatedAt: new Date(),
      },
    });
  }
  for (const key of LEGACY_DEACTIVATE) {
    const p = await db.product.findUnique({ where: { key } });
    if (p && p.active) {
      await db.product.update({ where: { key }, data: { active: false, baseSource: INTERNAL_SRC, priceRule: 'MANUAL', priceDate: null, priceStatus: 'PENDING_REVIEW' } });
      console.log(`  ⤫ غیرفعال شد (قیمت کهنه): ${key}`);
    }
  }

  console.log('— پایان seed پیام ۱۱ —');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
