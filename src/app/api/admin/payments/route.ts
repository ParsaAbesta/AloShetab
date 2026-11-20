import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { ORDER_STATUS, PAYMENT_STATUS } from '@/lib/constants';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

/** فهرست پرداخت‌های در انتظار تأیید ادمین (کارت‌به‌کارت) */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const payments = await db.payment.findMany({
    where: { status: { in: [PAYMENT_STATUS.AWAITING_ADMIN, PAYMENT_STATUS.PENDING] } },
    orderBy: { createdAt: 'desc' },
    include: { order: { include: { customer: { select: { fullName: true, mobile: true } } } } },
  });
  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      method: p.method,
      status: p.status,
      amount: p.amount,
      cardMask: p.cardMask,
      rrn: p.rrn,
      createdAt: p.createdAt,
      order: { id: p.order.id, code: p.order.code, total: p.order.total, customer: p.order.customer },
    })),
  });
}

const patchSchema = z.object({
  action: z.enum(['confirm', 'reject']),
  note: z.string().trim().max(300).optional().nullable(),
});

/** تأیید/رد پرداخت کارت‌به‌کارت توسط ادمین */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  const paymentId = new URL(req.url).searchParams.get('id') ?? '';
  if (!parsed.success || !paymentId) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'درخواست نامعتبر است' }, { status: 400 });
  }

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { customer: true, items: { include: { service: true } } } } },
  });
  if (!payment) return NextResponse.json({ error: 'NOT_FOUND', message: 'پرداخت یافت نشد' }, { status: 404 });
  if (payment.status === PAYMENT_STATUS.SUCCESS) {
    return NextResponse.json({ error: 'ALREADY_CONFIRMED', message: 'این پرداخت قبلاً تأیید شده است' }, { status: 400 });
  }

  if (parsed.data.action === 'reject') {
    await db.payment.update({ where: { id: payment.id }, data: { status: PAYMENT_STATUS.FAILED } });
    await queueReport('PAYMENT', `رد رسید کارت‌به‌کارت سفارش ${payment.order.code}`, [
      `کد سفارش: ${payment.order.code} | مبلغ: ${payment.amount.toLocaleString('fa-IR')} تومان`,
      `کارت: ${payment.cardMask ?? '—'} | رسید: ${payment.rrn ?? '—'}`,
      parsed.data.note ? `دلیل رد: ${parsed.data.note}` : '',
      `زمان: ${formatJalaliTime(new Date())}`,
    ].filter(Boolean).join('\n'));
    await logActivity('ADMIN', `رد رسید ${payment.order.code}`);
    return NextResponse.json({ ok: true, status: PAYMENT_STATUS.FAILED });
  }

  // تأیید: وضعیت پرداخت فقط با تأیید ادمین/درگاه تغییر می‌کند
  await db.payment.update({
    where: { id: payment.id },
    data: { status: PAYMENT_STATUS.SUCCESS, confirmedAt: new Date() },
  });
  await db.order.update({ where: { id: payment.orderId }, data: { status: ORDER_STATUS.PAID, paidAt: new Date() } });
  await db.orderEvent.create({
    data: {
      orderId: payment.orderId,
      status: ORDER_STATUS.PAID,
      noteFa: `پرداخت تأیید شد (کارت‌به‌کارت) — ${payment.amount.toLocaleString('fa-IR')} تومان`,
      noteEn: `Payment confirmed (card transfer) — ${payment.amount} Toman`,
    },
  });
  await queueReport('PAYMENT', `تأیید کارت‌به‌کارت سفارش ${payment.order.code}`, [
    `کد سفارش: ${payment.order.code} | مشتری: ${payment.order.customer.fullName} (${payment.order.customer.mobile})`,
    `مبلغ: ${payment.amount.toLocaleString('fa-IR')} تومان (در کیف پول شرکت نگه داشته می‌شود)`,
    `کارت: ${payment.cardMask ?? '—'} | رسید: ${payment.rrn ?? '—'}`,
    `خدمات: ${payment.order.items.map((i) => `${i.service.nameFa} ×${i.qty}`).join('، ')}`,
    `زمان: ${formatJalaliTime(new Date())}`,
  ].join('\n'));
  await logActivity('ADMIN', `تأیید پرداخت ${payment.order.code}`);
  return NextResponse.json({ ok: true, status: PAYMENT_STATUS.SUCCESS });
}
