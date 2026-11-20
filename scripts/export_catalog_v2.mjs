// export_catalog_v2.mjs — خروجی کامل کاتالوگ نسخهٔ ۲ (ایران + جهانی + قطعات) به JSON/CSV
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const db = new PrismaClient();
const ROOT = process.env.PROJECT_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const services = await db.service.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { details: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
  });
  const parts = await db.part.findMany({ orderBy: { sortOrder: 'asc' } });

  const catalog = {
    system: 'سامانه الو شتاب',
    version: 'v2.0',
    generated_at: new Date().toISOString(),
    pricing_rule_fa: 'ایران: نرخ الو شتاب = ۰٫۹۹ × بالاترین نرخ بازار ۱۴۰۵؛ جهان: میانگین بازار جهانی ۲۰۲۶ به دلار. ضریب‌های روز/ساعت/نرخ روز تقویمی روی همهٔ نرخ‌ها اعمال می‌شود.',
    editions: {},
    parts: parts.map((p) => ({ key: p.key, nameFa: p.nameFa, nameEn: p.nameEn, category: p.category, basePrice: p.basePrice, icon: p.icon, active: p.active })),
  };

  for (const ed of ['IRAN', 'WORLD']) {
    const list = services.filter((s) => s.edition === ed);
    const byCat = [];
    for (const s of list) {
      let c = byCat.find((x) => x.name === s.category);
      if (!c) { c = { name: s.category, services: [] }; byCat.push(c); }
      c.services.push({
        key: s.key, nameFa: s.nameFa, nameEn: s.nameEn, descFa: s.descFa, descEn: s.descEn,
        baseRate: s.baseRate, currency: s.currency, remoteCapable: s.remoteCapable,
        percentValue: s.percentValue, isMisc: s.isMisc, aiGenerated: s.aiGenerated,
        details: s.details.map((d, i) => ({ id: d.id, nameFa: d.nameFa, nameEn: d.nameEn, price: d.price, sortOrder: i + 1 })),
      });
    }
    const svcCount = list.length;
    const detCount = list.reduce((n, s) => n + s.details.length, 0);
    catalog.editions[ed] = { label: ed === 'IRAN' ? 'نسخهٔ ایران (v1)' : 'نسخهٔ جهانی (v2.0)', currency: ed === 'IRAN' ? 'IRT (تومان)' : 'USD (دلار)', categories: byCat, servicesCount: svcCount, detailsCount: detCount };
  }

  fs.writeFileSync(path.join(ROOT, 'download', 'alo_shetab_catalog_v2.json'), JSON.stringify(catalog, null, 2), 'utf-8');

  // CSV تخت: نسخه,دسته,خدمت,نرخ خدمت,ارز,ریز جزئیات,قیمت جزئیات
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = ['edition,category,service,service_key,service_rate,currency,detail,detail_price'];
  for (const ed of ['IRAN', 'WORLD']) {
    for (const c of catalog.editions[ed].categories) {
      for (const s of c.services) {
        if (s.details.length === 0) rows.push([ed, c.name, s.nameFa, s.key, s.baseRate, s.currency, '', ''].map(esc).join(','));
        for (const d of s.details) rows.push([ed, c.name, s.nameFa, s.key, s.baseRate, s.currency, d.nameFa, d.price].map(esc).join(','));
      }
    }
  }
  fs.writeFileSync(path.join(ROOT, 'download', 'alo_shetab_catalog_v2.csv'), '\uFEFF' + rows.join('\n'), 'utf-8');

  console.log('IRAN:', catalog.editions.IRAN.servicesCount, 'services /', catalog.editions.IRAN.detailsCount, 'details');
  console.log('WORLD:', catalog.editions.WORLD.servicesCount, 'services /', catalog.editions.WORLD.detailsCount, 'details');
  console.log('PARTS:', parts.length, '| exports written to download/');
}

main().finally(() => db.$disconnect());
