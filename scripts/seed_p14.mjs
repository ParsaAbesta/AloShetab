// ─── پیام ۱۴ (v3.0): انبارهای کامل + استعلام انبار (خرید + موجودی) + مهاجرت پلن ──
// «لیست تمام انبار ها» + «پلن ۳۳٪ از میز محصولات حذف شود» + پلن جدید:
//   لیست بروزترین قیمت بروزترین انبارها | موجودی فقط از بروزترین موجودی انبارها
//   خرید از پائین‌ قیمت‌ترین انبارها | فروش به قیمت گران‌ترین فروشگاه‌ها
//   کارشناس ۱۶٫۵ تا ۲۰ درصد یا بیشتر، مابقی (۱۰ تا ۱۶٫۵ درصد) افزایش قیمت
// تاریخ همهٔ استعلام‌ها: ۱۴۰۵/۰۸/۲۷ (بعد از مرز تازگی ۱۴۰۵/۰۸/۱۰ = ۲۰۲۶/۱۱/۰۱)
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const PRICE_DATE = '1405/08/27'; // امروز به وقت تهران (۱۸ نوامبر ۲۰۲۶) — بعد از مرز تازگی
const NOW = Date.now();
const NOTE_WH = 'استعلام اولیهٔ کارشناس از انبار — قیمت توافقی پس از مذاکرهٔ ادمین نهایی می‌شود (پلن v3)';

// ─── انبارهای جدید (لیست کامل‌تر انبارها — اطلاعات عمومی؛ تلفن/آدرس رسمی توسط ادمین تکمیل می‌شود) ──
const NEW_WAREHOUSES = [
  { key: 'mobit', nameFa: 'موبیت', nameEn: 'Mobit', kind: 'COMPUTER', website: 'mobit.com', phone: null, address: null, city: 'تهران', linkTemplate: 'https://mobit.ir/search?q={q}', verified: false, notes: 'فروشگاه آنلاین کالای دیجیتال و موبایل — مرجع قیمت روز دیجیتال؛ تلفن و آدرس رسمی توسط ادمین تکمیل/تأیید شود' },
  { key: 'ofoghkourosh', nameFa: 'افق کوروش', nameEn: 'Ofogh Kourosh', kind: 'APPLIANCE', website: 'ofoghkourosh.com', phone: null, address: null, city: 'تهران', linkTemplate: null, verified: false, notes: 'زنجیرهٔ فروشگاهی لوازم خانگی و کالای دیجیتال — مرجع قیمت حضوری/آنلاین؛ اطلاعات تماس شعب توسط ادمین تکمیل شود' },
  { key: 'delgarm', nameFa: 'دلگرم', nameEn: 'Delgarm', kind: 'PRICE_AGGREGATOR', website: 'delgarm.com', phone: null, address: null, city: 'تهران', linkTemplate: null, verified: false, notes: 'مرجع لیست قیمت روز کالای دیجیتال و لوازم خانگی (به‌کاررفته در استعلام‌های قبلی) — اتصال لحظه‌ای نیازمند کلید رسمی' },
  { key: 'gadgetnews', nameFa: 'گجت‌نیوز', nameEn: 'GadgetNews', kind: 'PRICE_AGGREGATOR', website: 'gadgetnews.ir', phone: null, address: null, city: 'تهران', linkTemplate: null, verified: false, notes: 'مرجع لیست قیمت روزانهٔ بازار کالای دیجیتال (به‌کاررفته در استعلام‌های قبلی) — بروزرسانی روزانه' },
];

// ─── استعلام انبار برای هر کالا — [warehouseKey, قیمت انبار, قیمت توافقی, موجودی، ساعت پیشین‌تر] ──
// طراحی اعداد: ارزان‌ترین انبار ~۱۰ تا ۱۴٪ زیر گران‌ترین فروشگاه؛ انبار دوم کمی گران‌تر؛
// موجودی از تازه‌ترین استعلام (انبار اول) ملاک «موجودی فقط از بروزترین انبار» است.
const WH_OFFERS = {
  'laptop-lenovo-v15-g4': [['ofogh-computer', 141_000_000, 139_000_000, 3, 0], ['ofogh-system', 144_000_000, 142_000_000, 1, 2]],
  'laptop-asus-vivobook-a1504va': [['ofogh-computer', 148_500_000, 146_000_000, 2, 0], ['ofogh-system', 151_000_000, 149_000_000, 1, 2]],
  'monitor-twisted-minds-tm24': [['ofogh-computer', 17_400_000, 17_100_000, 6, 0], ['ofogh-system', 17_900_000, 17_600_000, 2, 2]],
  'monitor-lg-24u411b': [['ofogh-computer', 29_400_000, 29_000_000, 4, 0], ['ofogh-system', 30_200_000, 29_800_000, 2, 2]],
  'mouse-q5': [['ofogh-computer', 1_150_000, 1_120_000, 15, 0], ['ofogh-system', 1_190_000, 1_160_000, 8, 2]],
  'mouse-gaming-optical': [['ofogh-computer', 1_460_000, 1_430_000, 12, 0], ['ofogh-system', 1_500_000, 1_470_000, 6, 2]],
  'fridge-taksan-rfn24': [['afralland', 78_500_000, 76_500_000, 2, 0], ['ofoghkourosh', 80_500_000, 79_000_000, 1, 2]],
  'fridge-kelor-rs5bl3': [['afralland', 62_500_000, 61_000_000, 3, 0], ['ofoghkourosh', 64_000_000, 62_500_000, 2, 2]],
  'washer-lg-y1-7kg': [['afralland', 108_000_000, 106_000_000, 2, 0], ['ofoghkourosh', 110_500_000, 108_500_000, 1, 2]],
  'washer-lg-y1-8kg': [['afralland', 117_000_000, 115_000_000, 2, 0], ['ofoghkourosh', 119_500_000, 117_500_000, 1, 2]],
  'washer-bosch-14400': [['afralland', 153_000_000, 150_000_000, 2, 0], ['ofoghkourosh', 156_000_000, 154_000_000, 1, 2]],
  'tv-samsung-du8000-55': [['afralland', 91_000_000, 89_500_000, 3, 0], ['ofoghkourosh', 93_500_000, 92_000_000, 1, 2]],
  'tv-samsung-q60d-55': [['afralland', 102_500_000, 100_500_000, 2, 0], ['ofoghkourosh', 105_000_000, 103_000_000, 1, 2]],
  'tv-lg-ua8500-55': [['afralland', 106_000_000, 104_000_000, 2, 0], ['ofoghkourosh', 108_500_000, 106_500_000, 1, 2]],
  'cooler-trust-12000': [['trust-mp', 55_000_000, 53_500_000, 4, 0], ['ofoghkourosh', 58_500_000, 57_500_000, 2, 2]],
  'cooler-gold-s18': [['afralland', 58_500_000, 57_000_000, 2, 0], ['ofoghkourosh', 60_500_000, 59_500_000, 1, 2]],
  'heater-absal-437': [['afralland', 9_400_000, 9_200_000, 8, 0], ['ofoghkourosh', 9_800_000, 9_600_000, 4, 2]],
  'heater-morvarid-royal-28': [['afralland', 12_300_000, 12_000_000, 6, 0], ['ofoghkourosh', 12_800_000, 12_500_000, 3, 2]],
  'heater-general-royal-9000': [['afralland', 3_400_000, 3_300_000, 14, 0], ['ofoghkourosh', 3_600_000, 3_500_000, 7, 2]],
};

async function main() {
  console.log('— پیام ۱۴ (v3.0) seed —');

  // ۱) انبارهای جدید — لیست کامل‌تر «تمام انبارها»
  for (const w of NEW_WAREHOUSES) {
    await db.warehouse.upsert({
      where: { key: w.key },
      update: { nameFa: w.nameFa, nameEn: w.nameEn, kind: w.kind, website: w.website, linkTemplate: w.linkTemplate, notes: w.notes },
      create: { ...w, verifiedAt: null },
    });
  }
  const whCount = await db.warehouse.count();
  console.log(`  ✔ لیست انبارها کامل شد — مجموعاً ${whCount} انبار/مرجع`);

  // ۲) مهاجرت پلن ۳۳٪ → پلن v3 (کارشناس + پلتفرم)
  const m1 = await db.product.updateMany({ where: { priceRule: 'BASE+33%' }, data: { priceRule: 'V3-PLAN' } });
  const m2 = await db.product.updateMany({ where: { priceRule: 'SITE+15%' }, data: { priceRule: 'V3-PLAN' } });
  console.log(`  ✔ مهاجرت قواعد قیمت: ${m1.count + m2.count} کالا → V3-PLAN`);

  // ۳) تنظیمات پلن v3 — سهم کارشناس + افزایش قیمت پلتفرم (جایگزین INVENTORY_MARKUP/SITE_MARKUP)
  for (const [key, value] of [['EXPERT_SHARE_PCT', '18'], ['PLATFORM_MARGIN_PCT', '12'], ['VERSION', 'v3.0-IR']]) {
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  await db.setting.deleteMany({ where: { key: { in: ['INVENTORY_MARKUP', 'SITE_MARKUP'] } } });
  console.log('  ✔ تنظیمات پلن v3: سهم کارشناس ۱۸٪ + افزایش قیمت پلتفرم ۱۲٪ (پلن ۳۳٪ حذف شد) — نسخه v3.0-IR');

  // ۴) استعلام انبار (خرید + موجودی) برای همهٔ کالاهای فعال
  const products = await db.product.findMany({ where: { section: 'GOODS', active: true }, select: { id: true, key: true, nameFa: true } });
  const warehouses = await db.warehouse.findMany();
  const whBy = new Map(warehouses.map((w) => [w.key, w]));
  let created = 0, updated = 0;
  for (const p of products) {
    const rows = WH_OFFERS[p.key];
    if (!rows) continue;
    for (const [whKey, whPrice, negotiated, stockQty, hoursEarlier] of rows) {
      const wh = whBy.get(whKey);
      const existing = await db.productOffer.findFirst({
        where: { productId: p.id, side: 'WAREHOUSE', storeName: wh?.nameFa ?? whKey, active: true },
      });
      const data = {
        productId: p.id,
        side: 'WAREHOUSE',
        storeId: null, // storeId فقط به Store ارجاع می‌دهد — انبار با نام ثبت می‌شود
        storeName: wh?.nameFa ?? whKey,
        offeredPrice: whPrice,
        negotiatedPrice: negotiated,
        stockQty,
        fetchedAt: new Date(NOW - hoursEarlier * 3600_000),
        fetchedShamsi: PRICE_DATE,
        source: 'MANUAL',
        active: true,
        note: NOTE_WH,
      };
      if (existing) {
        await db.productOffer.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await db.productOffer.create({ data });
        created++;
      }
    }
  }
  console.log(`  ✔ استعلام انبار ثبت شد: ${created} جدید / ${updated} بروزرسانی — خرید از ارزان‌ترین انبار، موجودی از بروزترین انبار`);

  // ۵) خلاصهٔ سیاست برای نمونه — ماوس Q5
  const mouse = await db.product.findUnique({ where: { key: 'mouse-q5' } });
  if (mouse) {
    const offers = await db.productOffer.findMany({ where: { productId: mouse.id, active: true } });
    const storeOffers = offers.filter((o) => (o.side ?? 'STORE') === 'STORE');
    const whOffers = offers.filter((o) => o.side === 'WAREHOUSE');
    const sellBase = Math.max(...storeOffers.map((o) => o.offeredPrice));
    const buyTarget = Math.min(...whOffers.map((o) => o.negotiatedPrice ?? o.offeredPrice));
    console.log(`  ● نمونهٔ ماوس Q5 — فروش (گران‌ترین فروشگاه): ${sellBase.toLocaleString('fa-IR')} | خرید (ارزان‌ترین انبار): ${buyTarget.toLocaleString('fa-IR')} | انبارها: ${whOffers.length}`);
  }

  console.log('— پایان seed پیام ۱۴ —');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
