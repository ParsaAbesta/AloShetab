import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  code: z.string().trim().min(3).max(20),
  mobile: z.string().trim().regex(/^09\d{9}$/),
});

/** پیگیری سفارش با کد رهگیری + موبایل همراه */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'کد رهگیری یا موبایل نامعتبر است' }, { status: 400 });
  }
  const code = parsed.data.code.toUpperCase().replace(/^AS-/i, '').trim();
  const fullCode = `AS-${code}`;

  const order = await db.order.findUnique({
    where: { code: fullCode },
    include: {
      customer: true,
      items: { include: { service: true, worker: true } },
      events: { orderBy: { createdAt: 'asc' } },
      rating: true,
      payments: { orderBy: { createdAt: 'desc' } },
      referral: true,
    },
  });
  if (!order || order.customer.mobile !== parsed.data.mobile) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'سفارشی با این کد رهگیری و موبایل یافت نشد' }, { status: 404 });
  }

  // پاسخ عمومی: فقط داده‌های مورد نیاز مشتری؛ فیلدهای مالی محرمانه (سهم‌ها) هرگز به کلاینت نمی‌روند
  const safeItems = order.items.map((i) => ({
    id: i.id,
    qty: i.qty,
    baseRate: i.baseRate,
    lineTotal: i.lineTotal,
    workerId: i.workerId,
    service: { key: i.service.key, nameFa: i.service.nameFa, nameEn: i.service.nameEn },
  }));
  const safePayments = order.payments.map((p) => ({
    id: p.id, method: p.method, status: p.status, amount: p.amount, rrn: p.rrn, cardMask: p.cardMask, createdAt: p.createdAt,
  }));
  return NextResponse.json({
    order: {
      id: order.id,
      code: order.code,
      status: order.status,
      mode: order.mode,
      total: order.total,
      discount: order.discount,
      grossTotal: order.grossTotal,
      serviceMarkup: order.serviceMarkup, // پلن ۳۳٪ میز خدمات
      needsExpertise: order.needsExpertise,
      miscNotes: order.miscNotes,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      settledAt: order.settledAt ? true : null, // فقط نشان «تسویه‌شده»، بدون جزئیات
      customer: { fullName: order.customer.fullName, address: order.customer.address, lat: order.customer.lat, lng: order.customer.lng },
      items: safeItems,
      events: order.events,
      rating: order.rating,
      payments: safePayments,
      hasReferral: !!order.referral, // وجود معرف، بدون مبلغ محرمانه
    },
  });
}
