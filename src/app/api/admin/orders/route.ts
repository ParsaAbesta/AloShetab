import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { ORDER_STATUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/** فهرست سفارش‌های ادمین — با فیلتر وضعیت و جستجو */
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const q = (url.searchParams.get('q') ?? '').trim();
  const take = Math.min(parseInt(url.searchParams.get('take') ?? '100', 10) || 100, 200);

  const where: Prisma.OrderWhereInput = {};
  if (status && status !== 'ALL') where.status = status;
  if (q) {
    where.OR = [
      { code: { contains: q } },
      { customer: { fullName: { contains: q } } },
      { customer: { mobile: { contains: q } } },
      { customer: { nationalId: { contains: q } } },
    ];
  }

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      customer: { select: { fullName: true, mobile: true, nationalId: true, address: true } },
      items: {
        include: {
          service: { select: { key: true, nameFa: true, nameEn: true } },
          worker: { select: { id: true, fullName: true, field: true } },
        },
      },
      rating: { select: { skill: true, ethics: true } },
      referral: { select: { amount: true, paid: true, referrerNat: true } },
      payments: { select: { id: true, method: true, status: true, amount: true, rrn: true, cardMask: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      mode: o.mode,
      needsExpertise: o.needsExpertise,
      miscNotes: o.miscNotes,
      aiPrice: o.aiPrice,
      subtotal: o.subtotal,
      grossTotal: o.grossTotal,
      serviceMarkup: o.serviceMarkup, // پلن ۳۳٪ میز خدمات
      discount: o.discount,
      total: o.total,
      weekFactor: o.weekFactor,
      hourFactor: o.hourFactor,
      dayFactor: o.dayFactor,
      modeFactor: o.modeFactor,
      referralCode: o.referralCode,
      settledAt: o.settledAt,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
      customer: o.customer,
      items: o.items.map((i) => ({
        id: i.id,
        qty: i.qty,
        baseRate: i.baseRate,
        lineTotal: i.lineTotal,
        itemAmount: i.itemAmount,
        // محرمانگی: workerShare/companyShare هرگز در پاسخ API و رابط کاربری نمایش داده نمی‌شود
        settled: i.settledAt !== null,
        service: i.service,
        worker: i.worker,
      })),
      rating: o.rating,
      referral: o.referral,
      payments: o.payments,
    })),
    statuses: Object.values(ORDER_STATUS),
  });
}
