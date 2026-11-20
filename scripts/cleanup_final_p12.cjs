// ─── پاک‌سازی نهایی داده‌های آزمون جلسات قبلی ─────────────────
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // سفارش کالای آزمون قبلی (مدل قدیمی — بدون ریزدیسکی)
  const po = await db.productOrder.deleteMany({ where: { OR: [{ fullName: 'محمد رضایی' }, { code: 'ASP-710042' }] } });
  console.log(`✓ ${po.count} سفارش کالای جلسات قبل حذف شد`);
  // سفارش خدماتی «تست مشتری پیام ۱۰»
  const tc = await db.customer.findMany({ where: { fullName: { contains: 'تست مشتری' } } });
  for (const c of tc) {
    await db.order.deleteMany({ where: { customerId: c.id } });
    await db.customer.delete({ where: { id: c.id } });
  }
  console.log(`✓ مشتری تست پیام ۱۰ حذف شد (${tc.length})`);
  const mails = await db.reportItem.deleteMany({ where: { OR: [{ title: { contains: 'ASP-710042' } }, { body: { contains: 'محمد رضایی' } }, { body: { contains: 'تست مشتری' } }] } });
  console.log(`✓ ${mails.count} ایمیل مرتبط حذف شد`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
