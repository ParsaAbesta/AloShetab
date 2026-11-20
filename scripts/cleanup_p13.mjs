// پاکسازی داده‌های آزمون پیام ۱۳ — قبل از هر اجرای smoke
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  // کالاهای آزمایشی قبلی
  const scratch = await db.product.findMany({ where: { key: { startsWith: 'p13-scratch' } }, select: { id: true, key: true } });
  for (const p of scratch) {
    // زنجیرهٔ وابستگی: InvoiceStage → CoordinationLog → ProductOrderService → ProductOrder → Proposal → Offer → Product
    const orders = await db.productOrder.findMany({ where: { productId: p.id }, select: { id: true } });
    for (const o of orders) {
      await db.invoiceStage.deleteMany({ where: { productOrderId: o.id } });
      await db.coordinationLog.deleteMany({ where: { productOrderId: o.id } });
      await db.productOrderService.deleteMany({ where: { productOrderId: o.id } });
      await db.productOrder.delete({ where: { id: o.id } });
    }
    await db.productPriceProposal.deleteMany({ where: { productId: p.id } });
    await db.productOffer.deleteMany({ where: { productId: p.id } });
    await db.product.delete({ where: { id: p.id } });
    console.log('deleted scratch product', p.key);
  }
  // پیشنهادهای آزمون قبلی
  const gone = await db.productOffer.deleteMany({ where: { storeName: { in: ['کالای برتر آزمون', 'فروشگاه الف', 'فروشگاه آزمون کهنه'] } } });
  console.log('deleted test offers:', gone.count);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
