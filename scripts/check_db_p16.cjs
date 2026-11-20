// بررسی سریع ستون serviceMarkup و نمونهٔ داده‌ها
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const cols = await p.$queryRawUnsafe(`PRAGMA table_info('Order')`);
  console.log('Order has serviceMarkup column:', cols.some((c) => c.name === 'serviceMarkup'));
  const svcs = await p.service.findMany({ where: { active: true, isMisc: false, percentValue: null }, take: 2, select: { key: true, nameFa: true, baseRate: true } });
  console.log('services:', JSON.stringify(svcs));
  const prods = await p.product.findMany({ take: 3, select: { key: true, priceRule: true, price: true } });
  console.log('products:', JSON.stringify(prods));
})()
  .catch((e) => { console.error('ERR', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
