// ─── پاک‌سازی پس از تست پیام ۱۲ ──────────────────────────────
// ۱) گزارش‌های روزانهٔ مدل قدیمی (newPrice) حذف می‌شوند تا گزارش مدل جدید (listPrice) تولید شود
// ۲) سفارش‌ها/مشتریان/ایمیل‌های «آزمون» حذف می‌شوند تا دیتابیس تحویلی پاک باشد
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // ۱) گزارش‌های مدل قدیمی
  const reports = await db.dailyPriceReport.findMany();
  let purged = 0;
  for (const r of reports) {
    let items = [];
    try { items = JSON.parse(r.itemsJson); } catch {}
    if (!items.length || !('listPrice' in (items[0] || {}))) {
      await db.dailyPriceReport.delete({ where: { id: r.id } });
      purged++;
    }
  }
  console.log(`✓ ${purged} گزارش مدل قدیمی حذف شد`);

  // ۲) سفارش‌های آزمون
  const po = await db.productOrder.deleteMany({ where: { fullName: { contains: 'آزمون' } } });
  console.log(`✓ ${po.count} سفارش کالای آزمون حذف شد`);

  const testCustomers = await db.customer.findMany({ where: { fullName: { contains: 'آزمون' } } });
  for (const c of testCustomers) {
    await db.order.deleteMany({ where: { customerId: c.id } });
    await db.customer.delete({ where: { id: c.id } });
  }
  console.log(`✓ مشتریان/سفارش‌های خدماتی آزمون حذف شد (${testCustomers.length})`);

  // ۳) ایمیل‌های صف مرتبط با آزمون
  const mails = await db.reportItem.deleteMany({ where: { OR: [{ title: { contains: 'آزمون' } }, { body: { contains: 'آزمون' } }] } });
  console.log(`✓ ${mails.count} ایمیل آزمون از صف حذف شد`);

  // ۴) لاگ‌های آزمون
  const logs = await db.activityLog.deleteMany({ where: { OR: [{ detail: { contains: 'آزمون' } }, { action: { contains: 'آزمون' } }] } });
  console.log(`✓ ${logs.count} لاگ آزمون حذف شد`);

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
