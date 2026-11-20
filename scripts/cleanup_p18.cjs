// پاکسازی داده‌های آزمون پیام ۱۸ از دیتابیس تحویلی (هم‌سang با رویه verify_p17)
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const cust = await db.customer.findUnique({ where: { nationalId: '0034567890' } });
  if (cust) {
    const orders = await db.order.findMany({ where: { customerId: cust.id } });
    for (const o of orders) await db.order.delete({ where: { id: o.id } }).catch(() => {});
    console.log('orders deleted:', orders.length);
  }
  const g = await db.productOrder.deleteMany({ where: { mobile: '09120000300' } });
  console.log('productOrders deleted:', g.count);
  await db.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
