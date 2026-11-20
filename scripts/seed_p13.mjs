// ─── پیام ۱۳: بذرپاشی فروشگاه‌ها + پیشنهادهای قیمت (ارائه‌شده/توافقی) ──
// «لیست تمام فروشگاه‌ها در پنل ادمین گذاشته شود» +
// «فروش به بالاترین قیمت ارائه شده / خرید و تأمین موجودی از پایین‌ترین قیمت توافقی»
// تاریخ همهٔ پیشنهادها: ۱۴۰۵/۰۸/۲۷ (بعد از مرز تازگی ۱۴۰۵/۰۸/۱۰ = ۲۰۲۶/۱۱/۰۱)
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const PRICE_DATE = '1405/08/26'; // امروز به وقت تهران (۱۷ نوامبر ۲۰۲۶) — بعد از مرز تازگی
const OFFER_NOTE = 'استعلام اولیه از فروشگاه — قیمت توافقی پس از مذاکرهٔ ادمین نهایی می‌شود';

// ─── فروشگاه‌ها (اطلاعات عمومی بررسی‌شده؛ موارد خالی توسط ادمین تکمیل می‌شود) ──
const STORES = [
  {
    key: 'digikala', nameFa: 'دیجی‌کالا', nameEn: 'Digikala', kind: 'MARKETPLACE',
    website: 'www.digikala.com', phone: '021-91000100',
    address: 'تهران، بالاتر از میدان ونک، خیابان خدامی، کوچه شادی ۱، ساختمان ونک پلازا، پلاک ۳۱',
    feedType: 'DIGIKALA', feedQueryTemplate: 'https://api.digikala.com/v1/product/search/?q={q}',
    verified: true, notes: 'بازار آنلاین اصلی برای کپی موجودی کالا (پیام ۱۱/۱۲) — اتصال لحظه‌ای با آداپتور رسمی API؛ در صورت چالش CDN، کوکی در تنظیمات DIGIKALA_COOKIE ثبت می‌شود',
  },
  {
    key: 'snapp', nameFa: 'اسنپ', nameEn: 'Snapp', kind: 'MARKETPLACE',
    website: 'snapp.ir', phone: null, address: 'پشتیبانی از طریق اپلیکیشن اسنپ',
    feedType: 'SNAPP_MARKET', feedQueryTemplate: 'https://snapp.market/m/search?query={q}',
    verified: true, notes: 'بازار خدمات و پیک — رندر قیمت سمت کلاینت؛ نیازمند کلید API رسمی برای اتصال لحظه‌ای',
  },
  {
    key: 'torob', nameFa: 'ترب', nameEn: 'Torob', kind: 'PRICE_AGGREGATOR',
    website: 'torob.com', phone: null, address: null,
    feedType: 'TOROB', feedQueryTemplate: 'https://api.torob.com/v4/base-product/search/?q={q}',
    verified: true, notes: 'مقایسه‌گر قیمت — بالاترین و پایین‌ترین ارائه‌شدهٔ بازار را یکجا نشان می‌دهد؛ کپچای آرکپچا مانع اتصال سرور به سرور است',
  },
  {
    key: 'emalls', nameFa: 'ایمالز', nameEn: 'Emalls', kind: 'PRICE_AGGREGATOR',
    website: 'emalls.ir', phone: null, address: null,
    feedType: 'NONE', feedQueryTemplate: null,
    verified: true, notes: 'مقایسه‌گر قیمت فروشندگان — ثبت دستی (ادمین تکمیل کند)',
  },
  {
    key: 'technolife', nameFa: 'تکنولایف', nameEn: 'Technolife', kind: 'ONLINE',
    website: 'technolife.ir', phone: null, address: null,
    feedType: 'NONE', feedQueryTemplate: null,
    verified: false, notes: 'فروشگاه اینترنتی دیجیتال و لوازم خانگی — تلفن و آدرس رسمی باید توسط ادمین تکمیل/تأیید شود',
  },
  {
    key: 'afralland', nameFa: 'فرالند', nameEn: 'Afralland', kind: 'ONLINE',
    website: 'afralland.com', phone: null, address: 'فروش اینترنتی — پشتیبانی سایت',
    feedType: 'NONE', feedQueryTemplate: null,
    verified: false, notes: 'لیست قیمت روز لوازم خانگی (آبان ۱۴۰۵ بروز) — تلفن رسمی توسط ادمین تکمیل شود',
  },
  {
    key: 'trust-mp', nameFa: 'تراست مارکت‌پلیس', nameEn: 'Trust Marketplace', kind: 'ONLINE',
    website: 'www.trustmarketplace.ir', phone: null, address: 'فروش اینترنتی',
    feedType: 'NONE', feedQueryTemplate: null,
    verified: false, notes: 'کولر گازی اسپلیت — تلفن و آدرس توسط ادمین تکمیل شود',
  },
  {
    key: 'basalam', nameFa: 'باسلام', nameEn: 'Basalam', kind: 'MARKETPLACE',
    website: 'basalam.com', phone: null, address: null,
    feedType: 'NONE', feedQueryTemplate: null,
    verified: false, notes: 'بازار صنایع و کالاهای خاص — در صورت نیاز ادمین فعال کند',
  },
];

// ─── پیشنهادهای قیمت هر کالا — [storeKey, offeredPrice (ارائه‌شده), negotiatedPrice (توافقی)] ──
// طراحی اعداد: بالاترین ارائه‌شده == قیمت نمایشی فعلی کالا (تغییر قیمت فقط با تأیید ادمین
// از طریق دکمهٔ «اعمال سیاست» یا گزارش روزانه اعمال می‌شود)؛ توافقی ~۴ تا ۷٪ پایین‌تر.
const OFFERS = {
  'laptop-lenovo-v15-g4': [['digikala', 157_000_000, 146_000_000], ['technolife', 156_500_000, 145_500_000], ['emalls', 156_000_000, 145_000_000]],
  'laptop-asus-vivobook-a1504va': [['digikala', 165_000_000, 152_000_000], ['technolife', 164_000_000, 151_000_000]],
  'monitor-twisted-minds-tm24': [['digikala', 19_499_000, 18_200_000], ['technolife', 19_300_000, 18_000_000]],
  'monitor-lg-24u411b': [['digikala', 32_888_000, 30_500_000], ['technolife', 32_500_000, 30_000_000]],
  'mouse-q5': [['digikala', 1_312_000, 1_220_000], ['technolife', 1_300_000, 1_200_000]],
  'mouse-gaming-optical': [['digikala', 1_669_000, 1_550_000], ['technolife', 1_650_000, 1_530_000]],
  'fridge-taksan-rfn24': [['digikala', 88_000_000, 80_000_000], ['afralland', 87_000_000, 79_000_000]],
  'fridge-kelor-rs5bl3': [['digikala', 71_000_000, 65_500_000], ['afralland', 70_500_000, 64_800_000]],
  'washer-lg-y1-7kg': [['afralland', 121_950_000, 112_000_000], ['digikala', 121_000_000, 111_000_000]],
  'washer-lg-y1-8kg': [['afralland', 131_950_000, 121_000_000], ['digikala', 131_000_000, 120_000_000]],
  'washer-bosch-14400': [['afralland', 172_950_000, 158_000_000], ['digikala', 172_000_000, 157_000_000]],
  'tv-samsung-du8000-55': [['digikala', 102_990_000, 94_000_000], ['afralland', 102_500_000, 93_000_000]],
  'tv-samsung-q60d-55': [['digikala', 115_990_000, 106_000_000], ['technolife', 115_500_000, 105_500_000]],
  'tv-lg-ua8500-55': [['digikala', 119_500_000, 109_000_000], ['technolife', 119_000_000, 108_000_000]],
  // کولر تراست: بازار (دیجی‌کالا) ۷۵م — قیمت توافقی انبار تراست ۵۵م → فاصلهٔ >۳۳٪ → افزودنی رقابتی ۱۵٪
  'cooler-trust-12000': [['digikala', 75_000_000, 68_000_000], ['trust-mp', 55_000_000, 55_000_000]],
  'cooler-gold-s18': [['digikala', 66_500_000, 61_000_000], ['technolife', 66_000_000, 60_500_000]],
  'heater-absal-437': [['digikala', 11_000_000, 10_200_000], ['afralland', 10_900_000, 10_000_000]],
  'heater-morvarid-royal-28': [['digikala', 14_200_000, 13_100_000], ['afralland', 14_000_000, 12_900_000]],
  'heater-general-royal-9000': [['digikala', 3_950_000, 3_700_000], ['afralland', 3_900_000, 3_650_000]],
};

async function main() {
  console.log('— پیام ۱۳ seed —');

  // ۱) فروشگاه‌ها
  for (const s of STORES) {
    await db.store.upsert({
      where: { key: s.key },
      update: {
        nameFa: s.nameFa, nameEn: s.nameEn, kind: s.kind, website: s.website,
        phone: s.phone, address: s.address, feedType: s.feedType,
        feedQueryTemplate: s.feedQueryTemplate, verified: s.verified, notes: s.notes, active: true,
      },
      create: { ...s, priceMode: s.feedType === 'NONE' ? 'MANUAL' : 'LIVE', lastSyncStatus: 'NEVER' },
    });
  }
  console.log(`  ✔ ${STORES.length} فروشگاه ثبت شد`);

  // ۲) پیشنهادهای قیمت (بدون تکرار)
  const stores = await db.store.findMany();
  const storeBy = new Map(stores.map((s) => [s.key, s]));
  let created = 0, skipped = 0;
  for (const [productKey, offers] of Object.entries(OFFERS)) {
    const p = await db.product.findUnique({ where: { key: productKey } });
    if (!p) { console.log(`  ⚠ کالا یافت نشد: ${productKey}`); continue; }
    for (const [storeKey, offeredPrice, negotiatedPrice] of offers) {
      const st = storeBy.get(storeKey);
      const exists = await db.productOffer.findFirst({
        where: { productId: p.id, storeId: st?.id ?? null, source: 'MANUAL', active: true },
      });
      if (exists) { skipped++; continue; }
      await db.productOffer.create({
        data: {
          productId: p.id,
          storeId: st?.id ?? null,
          storeName: st?.nameFa ?? storeKey,
          offeredPrice,
          negotiatedPrice,
          fetchedAt: new Date(),
          fetchedShamsi: PRICE_DATE,
          source: 'MANUAL',
          note: OFFER_NOTE,
        },
      });
      created++;
    }
  }
  console.log(`  ✔ ${created} پیشنهاد قیمت ثبت شد (${skipped} قبلاً موجود — رد شد)`);

  console.log('— پایان seed پیام ۱۳ —');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
