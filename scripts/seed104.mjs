// یکپارچه‌سازی پایگاه دادهٔ وب‌اپ با کاتالوگ رسمی ۲۰ دسته / ۱۰۴ خدمت (پیام ۲)
// + تنظیم تخفیف معرف = ۵٪ طبق آخرین اصلاحات کارفرما + همکاران نمونه برای آزمون
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const db = new PrismaClient();
// مسیرها مستقل از محل استقرار: ریشهٔ پروژه = پوشهٔ بالای scripts (یا PROJECT_ROOT)
const ROOT = process.env.PROJECT_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'download', 'alo_shetab_services_rates_1405-08-24.json');
const I18N = path.join(ROOT, 'scripts', 'catalog104_enriched.json');

function parseRate(x) {
  const s = String(x).trim().replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  if (s.endsWith('%')) return { percent: parseFloat(s.slice(0, -1)) };
  return { toman: Math.floor(parseFloat(s.replace(/,/g, ''))) };
}

async function main() {
  const cat = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
  const i18n = JSON.parse(fs.readFileSync(I18N, 'utf-8'));

  // پاک‌سازی داده‌های توسعه (ترتیب وابستگی FK)
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

  // ۱۰۴ خدمت رسمی + متفرقه (هوش مصنوعی/کارشناسی)
  let n = 0;
  for (let ci = 0; ci < cat.categories.length; ci++) {
    const c = cat.categories[ci];
    for (let si = 0; si < c.services.length; si++) {
      const s = c.services[si];
      const en = i18n[`c${ci}-${si}`] ?? { nameEn: s.name, descFa: `خدمت ${s.name}`, descEn: `Service ${s.name}` };
      const r = parseRate(s.alo_rate);
      const isPercent = r.percent != null;
      await db.service.create({
        data: {
          key: `c${ci}-${si}`,
          nameFa: s.name,
          nameEn: en.nameEn,
          descFa: en.descFa,
          descEn: en.descEn,
          baseRate: isPercent ? 0 : r.toman,
          percentValue: isPercent ? r.percent : null,
          category: c.name,
          remoteCapable: !isPercent, // خدمات درصدی نیازمند توافق/کارشناسی حضوری‌اند
          isMisc: false,
          sortOrder: ci * 100 + si,
        },
      });
      n++;
    }
  }
  await db.service.create({
    data: {
      key: 'misc',
      nameFa: 'متفرقه — هر نیاز دیگر',
      nameEn: 'Misc — any other need',
      descFa: 'نیاز خود را شرح دهید؛ هوش مصنوعی نرخ انجام را برآورد می‌کند یا سفارش برای کارشناسی علامت می‌خورد و پس از تعیین قیمت قطعی، کار استارت می‌خورد.',
      descEn: 'Describe your need; AI estimates the project rate, or the order is flagged for expert review and starts once the final price is set.',
      baseRate: 0,
      remoteCapable: true,
      isMisc: true,
      category: 'سایر خدمات روزمره',
      sortOrder: 9999,
    },
  });
  console.log('services seeded:', n + 1);

  // تنظیمات: تخفیف معرف ۵٪ (اصلاح کارفرما)
  const settings = {
    ACCOUNT_NAME: 'ألو شتاب', CARD_1: '6037-9981-4097-4550', CARD_2: '6063-7311-2146-8624',
    SUPPORT_PHONE: '09014700109', EMAIL_1: 'AloShetabOwner@Gmail.com', EMAIL_2: 'AloShetabAdmin@Gmail.com',
    REFERRAL_PERCENT: '5', REMOTE_FACTOR: '0.7', ADMIN_PASSWORD: 'AloShetab1404', VERSION: 'v1.0-IR',
  };
  for (const [k, v] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } });
  }

  // همکاران نمونه (تأییدشده) برای اعزام و تسویه
  await db.worker.createMany({
    data: [
      { fullName: 'علی رضایی', nationalId: '0079123456', mobile: '09121110001', city: 'تهران', field: 'تعمیرات ساختمان و تأسیسات', resume: '۱۰ سال سابقه لوله‌کشی و برق‌کاری ساختمان', status: 'APPROVED', level: 'SILVER', points: 45 },
      { fullName: 'مریم احمدی', nationalId: '0064587412', mobile: '09121110002', city: 'تهران', field: 'نظافت و خدمات منزل', resume: '۶ سال سابقه نظافت اداری و منزل', status: 'APPROVED', level: 'BRONZE', points: 12 },
    ],
  });
  console.log('settings + demo workers done; REFERRAL_PERCENT=5');
}

main().finally(() => db.$disconnect());
