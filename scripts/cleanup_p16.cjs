// پاک‌سازی داده‌های آزمون پیام ۱۶ (مشتری/سفارش آزمون پلن ۳۳٪)
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const cust = await p.customer.findUnique({ where: { nationalId: '0012345678' } });
  if (!cust) { console.log('no test customer — clean'); return; }
  const orders = await p.order.findMany({ where: { customerId: cust.id }, select: { id: true, code: true } });
  for (const o of orders) {
    await p.order.delete({ where: { id: o.id } }).catch(() => {});
    console.log('deleted order', o.code);
  }
  await p.customer.delete({ where: { id: cust.id } });
  console.log('deleted test customer 0012345678');
})()
  .catch((e) => { console.error('ERR', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
