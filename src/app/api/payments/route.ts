import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, maskCard } from '@/lib/constants';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

const initSchema = z.object({
  action: z.literal('init'),
  code: z.string().trim().min(3).max(20),
  mobile: z.string().trim().regex(/^09\d{9}$/),
  method: z.enum(['GATEWAY', 'CARD_TRANSFER']),
});

const gatewayConfirmSchema = z.object({
  action: z.literal('gateway-confirm'),
  paymentId: z.string().min(3),
  cardNumber: z.string().trim().regex(/^\d{16}$/, 'شمارهٔ کارت باید ۱۶ رقم باشد'),
  pin2: z.string().trim().min(4).max(12),
  otp: z.string().trim().min(4).max(8),
});

const failSchema = z.object({ action: z.literal('gateway-fail'), paymentId: z.string().min(3) });

const transferSchema = z.object({
  action: z.literal('card-transfer'),
  code: z.string().trim().min(3).max(20),
  mobile: z.string().trim().regex(/^09\d{9}$/),
  fromCard: z.string().trim().regex(/^\d{16}$/, 'شمارهٔ کارت مبدأ باید ۱۶ رقم باشد'),
  rrn: z.string().trim().min(4).max(40),
});

function rrn(): string {
  return String(Math.floor(1e11 + Math.random() * 9e11));
}

/** پرداخت — درگاه شبیه‌سازی‌شدهٔ شاپرک/شتاب + کارت‌به‌کارت */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'درخواست نامعتبر' }, { status: 400 });
  }

  // ── شروع تراکنش درگاه ──
  if (body.action === 'init') {
    const p = initSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: 'INVALID_INPUT', message: 'اطلاعات سفارش ناقص است' }, { status: 400 });
    const code = `AS-${p.data.code.toUpperCase().replace(/^AS-/i, '').trim()}`;
    const order = await db.order.findUnique({ where: { code }, include: { customer: true } });
    if (!order || order.customer.mobile !== p.data.mobile) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'سفارش یافت نشد' }, { status: 404 });
    }
    if ([ORDER_STATUS.PAID, ORDER_STATUS.SCHEDULED, ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.DONE].includes(order.status as never)) {
      return NextResponse.json({ error: 'ALREADY_PAID', message: 'این سفارش قبلاً پرداخت شده است' }, { status: 400 });
    }
    if (order.needsExpertise && order.total === 0) {
      return NextResponse.json({ error: 'EXPERT_PENDING', message: 'این سفارش در انتظار کارشناسی است؛ پس از تعیین قیمت قطعی، پرداخت فعال می‌شود' }, { status: 400 });
    }
    const payment = await db.payment.create({
      data: { orderId: order.id, method: p.data.method, status: PAYMENT_STATUS.PENDING, amount: order.total },
    });
    await logActivity('CUSTOMER', `شروع پرداخت ${order.code}`, `روش: ${p.data.method} | مبلغ: ${order.total}`);
    return NextResponse.json({ paymentId: payment.id, amount: order.total, code: order.code });
  }

  // ── تأیید پرداخت درگاه (شبیه‌سازی چرخهٔ کارت→رمز دوم→OTP) ──
  if (body.action === 'gateway-confirm') {
    const p = gatewayConfirmSchema.safeParse(body);
    if (!p.success) {
      const msg = p.error.issues[0]?.message ?? 'اطلاعات پرداخت نامعتبر است';
      return NextResponse.json({ error: 'GATEWAY_INVALID', message: msg }, { status: 400 });
    }
    const payment = await db.payment.findUnique({ where: { id: p.data.paymentId }, include: { order: { include: { customer: true, items: { include: { service: true } } } } } });
    if (!payment) return NextResponse.json({ error: 'NOT_FOUND', message: 'تراکنش یافت نشد' }, { status: 404 });
    if (payment.status === PAYMENT_STATUS.SUCCESS) {
      return NextResponse.json({ error: 'ALREADY_CONFIRMED', message: 'این تراکنش قبلاً تأیید شده است' }, { status: 400 });
    }

    const txRrn = rrn();
    await db.payment.update({
      where: { id: payment.id },
      data: { status: PAYMENT_STATUS.SUCCESS, cardMask: maskCard(p.data.cardNumber), rrn: txRrn, confirmedAt: new Date() },
    });
    await db.order.update({
      where: { id: payment.orderId },
      data: { status: ORDER_STATUS.PAID, paidAt: new Date() },
    });
    await db.orderEvent.create({
      data: {
        orderId: payment.orderId,
        status: ORDER_STATUS.PAID,
        noteFa: `پرداخت موفق — مبلغ ${payment.amount.toLocaleString('fa-IR')} تومان (شتاب/شاپرک)`,
        noteEn: `Payment successful — ${payment.amount} Toman (Shaparak/Shetab)`,
      },
    });

    // کل مبلغ تا اطلاع ثانوی در کیف پول شرکت نگه داشته می‌شود
    await queueReport(
      'PAYMENT',
      `پرداخت موفق ${payment.order.code} — ${payment.amount.toLocaleString('fa-IR')} تومان`,
      [
        `کد سفارش: ${payment.order.code}`,
        `مشتری: ${payment.order.customer.fullName} | همراه: ${payment.order.customer.mobile}`,
        `مبلغ: ${payment.amount.toLocaleString('fa-IR')} تومان (در کیف پول شرکت نگه داشته می‌شود)`,
        `روش: درگاه شاپرک/شتاب | کارت: ${maskCard(p.data.cardNumber)} | شماره پیگیری: ${txRrn}`,
        `خدمات: ${payment.order.items.map((i) => `${i.service.nameFa} ×${i.qty}`).join('، ')}`,
        `زمان: ${formatJalaliTime(new Date())}`,
      ].join('\n')
    );
    await logActivity('SYSTEM', `پرداخت موفق ${payment.order.code}`, `RRN: ${txRrn}`);
    return NextResponse.json({ ok: true, rrn: txRrn, code: payment.order.code });
  }

  // ── انصراف/خطای درگاه ──
  if (body.action === 'gateway-fail') {
    const p = failSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    await db.payment.updateMany({ where: { id: p.data.paymentId, status: PAYMENT_STATUS.PENDING }, data: { status: PAYMENT_STATUS.FAILED } });
    return NextResponse.json({ ok: true });
  }

  // ── کارت‌به‌کارت (وقتی درگاه قطع است) — نیاز به تأیید ادمین ──
  if (body.action === 'card-transfer') {
    const p = transferSchema.safeParse(body);
    if (!p.success) {
      const msg = p.error.issues[0]?.message ?? 'اطلاعات رسید نامعتبر است';
      return NextResponse.json({ error: 'INVALID_INPUT', message: msg }, { status: 400 });
    }
    const code = `AS-${p.data.code.toUpperCase().replace(/^AS-/i, '').trim()}`;
    const order = await db.order.findUnique({ where: { code }, include: { customer: true } });
    if (!order || order.customer.mobile !== p.data.mobile) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'سفارش یافت نشد' }, { status: 404 });
    }
    if ([ORDER_STATUS.PAID, ORDER_STATUS.SCHEDULED, ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.DONE].includes(order.status as never)) {
      return NextResponse.json({ error: 'ALREADY_PAID', message: 'این سفارش قبلاً پرداخت شده است' }, { status: 400 });
    }
    const payment = await db.payment.create({
      data: {
        orderId: order.id, method: PAYMENT_METHOD.CARD_TRANSFER,
        status: PAYMENT_STATUS.AWAITING_ADMIN, amount: order.total,
        cardMask: maskCard(p.data.fromCard), rrn: p.data.rrn,
      },
    });
    await queueReport(
      'PAYMENT',
      `کارت‌به‌کارت برای سفارش ${order.code} — نیاز به تأیید ادمین`,
      [
        `کد سفارش: ${order.code} | مشتری: ${order.customer.fullName} (${order.customer.mobile})`,
        `مبلغ: ${order.total.toLocaleString('fa-IR')} تومان`,
        `کارت مبدأ: ${maskCard(p.data.fromCard)} | شماره رسید: ${p.data.rrn}`,
        `زمان: ${formatJalaliTime(new Date())}`,
      ].join('\n')
    );
    return NextResponse.json({ ok: true, paymentId: payment.id });
  }

  return NextResponse.json({ error: 'UNKNOWN_ACTION', message: 'عملیات ناشناخته' }, { status: 400 });
}
