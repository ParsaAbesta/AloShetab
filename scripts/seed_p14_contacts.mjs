// ─── پیام ۱۴ (v3.0): تکمیل فهرست تماس «تمام انبارها» — شماره تلفن، سایت، موجودی، آدرس ──
// منبع: صفحات رسمی «تماس با ما» هر مجموعه (بازبینی عمومی ۱۴۰۵/۰۸/۲۷).
// این اسکریپت فقط فیلدهای تماس را بروزرسانی می‌کند (idempotent) و به استعلام‌ها دست نمی‌زند.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const CONTACTS = [
  {
    key: 'ofogh-computer',
    phone: '021-57853000',
    website: 'iranfso.com',
    address: 'تهران، خیابان ولی‌عصر، خیابان طالقانی، خیابان برادران مظفر، پلاک ۱۰۰',
    city: 'تهران',
    notes: 'انبار سخت‌افزار کامپیوتر افق — فروش عمده و خرده؛ موجودی روز از استعلام کارشناس',
  },
  {
    key: 'ofogh-system',
    phone: '021-66451589',
    website: 'www.ofoghsystem.com',
    address: 'تهران، خیابان ولی‌عصر، بعد از تقاطع طالقانی',
    city: 'تهران',
    notes: 'انبار سیستم و قطعات افق سیستم — استعلام حضوری و تلفنی',
  },
  {
    key: 'digikala',
    phone: '021-91000100',
    website: 'www.digikala.com',
    address: 'تهران، بالاتر از میدان ونک، خیابان خدامی، کوچه شادی ۱، ساختمان ونک پلازا، پلاک ۳۱',
    city: 'تهران',
    notes: 'بزرگ‌ترین فروشگاه آنلاین ایران — مرجع «گران‌ترین فروشگاه» در پلن v3 (فروش به قیمت دیجی‌کالا)',
  },
  {
    key: 'snapp',
    phone: '021-91039000',
    website: 'snapp.ir',
    address: 'پشتیبانی از طریق اپلیکیشن اسنپ — خط تاکسی تلفنی ۱۵۵۱',
    city: 'تهران',
    notes: 'سوپراپلیکیشن اسنپ — مرجع مقایسهٔ قیمت خدمات شهری؛ پشتیبانی اسنپ‌فود: 021-91006655',
  },
  {
    key: 'achareh',
    phone: '1471 (سراسری) / 021-54536600',
    website: 'achareh.co',
    address: 'تهران، میدان انقلاب، خیابان کارگر شمالی، بن‌بست امین، پلاک ۵',
    city: 'تهران',
    notes: 'سامانهٔ آنلاین خدمات منزل آچاره — رقیب اصلی خدمات روزمره؛ info@achareh.ir',
  },
  {
    key: 'torob',
    phone: '021-91096888',
    website: 'torob.com',
    address: 'پشتیبانی تلفنی و چت آنلاین (۸ الی ۲۲) — مرجع مقایسهٔ قیمت آنلاین',
    city: 'تهران',
    notes: 'ترب — جستجوگر قیمت میان هزاران فروشگاه؛ پشتیبانی فروشندگان از همان شماره',
  },
  {
    key: 'emalls',
    phone: '021-91003933',
    website: 'emalls.ir',
    address: 'تهران، بالاتر از چهارراه ولیعصر، نرسیده به بزرگمهر، بن‌بست گلساز، پلاک ۲',
    city: 'تهران',
    notes: 'ایمالز — مرجع لیست قیمت روز فروشگاه‌ها؛ info@emalls.ir؛ ساعت پاسخگویی ۱۰ تا ۱۸',
  },
  {
    key: 'afralland',
    phone: '09199012668',
    website: 'afralland.com',
    address: 'فروش حضوری و اینترنتی لوازم خانگی — هماهنگی خرید با کارشناس فروش (واتساپ/تماس ۹ تا ۲۳)',
    city: 'تهران',
    notes: 'افرالند — مرجع قیمت تلویزیون و لوازم خانگی؛ انبار اصلی خرید لوازم‌خانگی در پلن v3',
  },
  {
    key: 'trust-mp',
    phone: '09173384364 / 09177163909',
    website: 'www.trustmarketplace.ir',
    address: 'نمایندگی مرکزی کولرگازی اسپلیت تراست — شیراز',
    city: 'شیراز',
    notes: 'تراست مارکت‌پلیس — مرجع فروش کولر گازی اسپلیت؛ مشاوره و ثبت سفارش تلفنی',
  },
  {
    key: 'mobit',
    phone: '034-91002425',
    website: 'mobit.ir',
    address: 'شعبهٔ حضوری (مبیت استور — عصرارتباط): کرمان، بلوار سرباز، بعد از کوچه ۲۴، روبروی بانک سپه',
    city: 'کرمان',
    notes: 'موبیت — فروشگاه آنلاین موبایل و کالای دیجیتال؛ info@mobit.ir؛ شنبه تا چهارشنبه ۸–۲۱، پنجشنبه ۸–۲۰:۳۰',
  },
  {
    key: 'ofoghkourosh',
    phone: '021-42701000 (ستاد مرکزی) / 1572 (پشتیبانی سراسری)',
    website: 'ofoghkourosh.com',
    address: 'دفتر مرکزی: تهران، خیابان ولیعصر، بین اکبری و زرین (محلهٔ آرژانتین-ساعی)',
    city: 'تهران',
    notes: 'زنجیرهٔ فروشگاهی افق کوروش — شعب حضوری سراسر کشور؛ مرجع قیمت لوازم‌خانگی حضوری',
  },
  {
    key: 'delgarm',
    phone: '021-28424354',
    website: 'delgarm.com',
    address: 'رسانهٔ برخط — صفحهٔ تماس: delgarm.com/contact-us',
    city: 'تهران',
    notes: 'دلگرم — مرجع لیست قیمت روز کالای دیجیتال و لوازم خانگی (بدون فروش حضوری)',
  },
  {
    key: 'gadgetnews',
    phone: '09120757428',
    website: 'gadgetnews.ir',
    address: 'رسانهٔ برخط — info@gadgetnews.net',
    city: 'تهران',
    notes: 'گجت‌نیوز — مرجع خبر و لیست قیمت روزانهٔ بازار کالای دیجیتال',
  },
];

async function main() {
  console.log('— پیام ۱۴ تکمیل تماس انبارها (تلفن / سایت / آدرس / یادداشت) —');
  for (const c of CONTACTS) {
    const exists = await db.warehouse.findUnique({ where: { key: c.key } });
    if (!exists) { console.log(`  ⚠ انبار ${c.key} یافت نشد — از seedهای قبلی اجرا شود`); continue; }
    await db.warehouse.update({
      where: { key: c.key },
      data: { phone: c.phone, website: c.website, address: c.address, city: c.city, notes: c.notes, verified: true },
    });
    console.log(`  ✔ ${c.key} — ${c.phone} | ${c.city}`);
  }
  const n = await db.warehouse.count();
  const withPhone = await db.warehouse.count({ where: { phone: { not: null } } });
  const withAddr = await db.warehouse.count({ where: { address: { not: null } } });
  console.log(`— انبارها: ${n} | دارای تلفن: ${withPhone} | دارای آدرس: ${withAddr} —`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
