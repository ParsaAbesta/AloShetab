// ─── پیام ۱۴: خروجی فهرست کامل انبارها (تلفن / سایت / موجودی / آدرس) ──
// export: download/alo_shetab_warehouses_v3.0.csv + .json
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const db = new PrismaClient();

async function main() {
  const warehouses = await db.warehouse.findMany({ orderBy: [{ kind: 'asc' }, { nameFa: 'asc' }] });
  const offers = await db.productOffer.findMany({
    where: { side: 'WAREHOUSE', active: true },
    include: { product: { select: { nameFa: true, key: true } } },
  });

  const rows = [];
  for (const w of warehouses) {
    const whOffers = offers.filter((o) => o.storeName === w.nameFa);
    const totalStock = whOffers.reduce((s, o) => s + (o.stockQty ?? 0), 0);
    const freshest = whOffers.reduce((m, o) => (o.fetchedAt > m ? o.fetchedAt : m), new Date(0));
    const products = whOffers.map((o) => o.product?.nameFa).filter(Boolean);
    rows.push({
      key: w.key,
      nameFa: w.nameFa,
      nameEn: w.nameEn,
      kind: w.kind,
      phone: w.phone ?? '',
      website: w.website ?? '',
      address: w.address ?? '',
      city: w.city ?? '',
      productsCount: products.length,
      totalStock,
      freshestQuoteShamsi: whOffers.length ? String(whOffers[0]?.fetchedShamsi ?? '') : '',
      products: products.join(' | '),
      notes: w.notes ?? '',
    });
  }

  writeFileSync('download/alo_shetab_warehouses_v3.0.json', JSON.stringify(rows, null, 2), 'utf8');
  const header = 'key,nameFa,nameEn,kind,phone,website,city,address,productsCount,totalStock,products,notes';
  const csv = [header, ...rows.map((r) => [r.key, r.nameFa, r.nameEn, r.kind, r.phone, r.website, r.city, r.address, r.productsCount, r.totalStock, r.products, r.notes].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  writeFileSync('download/alo_shetab_warehouses_v3.0.csv', '\uFEFF' + csv, 'utf8');

  console.log(`✔ ${rows.length} انبار خروجی گرفته شد — CSV + JSON`);
  for (const r of rows) console.log(`  ${r.nameFa} | ${r.phone} | ${r.city} | کالاها: ${r.productsCount} | موجودی کل: ${r.totalStock}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
