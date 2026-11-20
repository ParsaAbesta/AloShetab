import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

/** معرفی‌ها: حق معرف‌ها با وضعیت واریز — پیام ۱۹ (V4.1): + پورسانت‌های میز کالا */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const referrals = await db.referral.findMany({
    orderBy: [{ paid: 'asc' }, { createdAt: 'desc' }],
    include: {
      order: {
        select: { code: true, total: true, status: true, settledAt: true, customer: { select: { fullName: true, mobile: true } } },
      },
    },
  });
  // پیام ۱۹ (V4.1): پورسانت‌های کالا (فقط فاکتور اول، ۲۰٪ سود) — هنگام تسویهٔ تحویل در ProductOrder ثبت می‌شود
  const goods = await db.productOrder.findMany({
    where: { referralAmount: { gt: 0 } },
    orderBy: [{ referralPaid: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true, code: true, fullName: true, mobile: true, referrerCode: true,
      firstInvoice: true, referralPaid: true, referralPaidAt: true, createdAt: true, status: true,
    },
  });
  const allNats = Array.from(new Set([...referrals.map((r) => r.referrerNat), ...goods.map((g) => g.referrerCode ?? '')].filter(Boolean)));
  const referrerCustomers = await db.customer.findMany({
    where: { nationalId: { in: allNats } },
    select: { nationalId: true, fullName: true, mobile: true },
  });
  const nameOf = new Map(referrerCustomers.map((c) => [c.nationalId, c]));
  return NextResponse.json({
    referrals: referrals.map((r) => ({
      id: r.id,
      referrerNat: r.referrerNat,
      referrer: nameOf.get(r.referrerNat) ?? null,
      // محرمانگی: مبلغ حق معرف هرگز به رابط کاربری ارسال نمی‌شود؛ فقط در پایگاه داده و ایمیل گزارش بک‌اند
      paid: r.paid,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
      order: r.order,
    })),
    goodsReferrals: goods.map((g) => ({
      id: g.id,
      code: g.code,
      referrerNat: g.referrerCode ?? '',
      referrer: g.referrerCode ? nameOf.get(g.referrerCode) ?? null : null,
      buyer: g.fullName,
      buyerMobile: g.mobile,
      status: g.status,
      paid: g.referralPaid,
      paidAt: g.referralPaidAt,
      createdAt: g.createdAt,
      // مبلغ پورسانت کالا ارسال نمی‌شود (محرمانگی مثل حق معرف خدمات)
    })),
    unpaidCount: referrals.filter((r) => !r.paid).length + goods.filter((g) => !g.referralPaid).length,
    paidCount: referrals.filter((r) => r.paid).length + goods.filter((g) => g.referralPaid).length,
  });
}

const patchSchema = z.object({ id: z.string().min(1).optional(), goodsId: z.string().min(1).optional() });

/** دکمهٔ «واریز شد» برای حق معرف — خدمات (id) یا کالا (goodsId) */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.id && !parsed.data.goodsId)) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  // ── کالا ──
  if (parsed.data.goodsId) {
    const g = await db.productOrder.findUnique({ where: { id: parsed.data.goodsId } });
    if (!g) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (g.referralPaid) return NextResponse.json({ error: 'ALREADY_PAID', message: 'این حق معرف قبلاً واریز شده است' }, { status: 400 });
    if (g.referralAmount <= 0) return NextResponse.json({ error: 'NO_COMMISSION', message: 'برای این سفارش کالا پورسانت معرفی ثبت نشده است' }, { status: 400 });
    await db.productOrder.update({ where: { id: g.id }, data: { referralPaid: true, referralPaidAt: new Date() } });
    await queueReport('REFERRAL', `واریز پورسانت معرف کالا برای سفارش ${g.code}`, [
      `معرف (کد ملی): ${g.referrerCode}`,
      `سفارش کالا: ${g.code} | فروش: ${g.listTotal.toLocaleString('fa-IR')} تومان`,
      `پورسانت واریزشده: ${g.referralAmount.toLocaleString('fa-IR')} تومان`,
      `زمان: ${formatJalaliTime(new Date())}`,
    ].join('\n'));
    await logActivity('ADMIN', `واریز پورسانت معرف کالا ${g.code}`, `پورسانت واریزشده: ${g.referralAmount.toLocaleString('fa-IR')} تومان`);
    return NextResponse.json({ ok: true });
  }
  // ── خدمات ──
  const r = await db.referral.findUnique({ where: { id: parsed.data.id! }, include: { order: { include: { customer: true } } } });
  if (!r) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (r.paid) return NextResponse.json({ error: 'ALREADY_PAID', message: 'این حق معرف قبلاً واریز شده است' }, { status: 400 });
  await db.referral.update({ where: { id: r.id }, data: { paid: true, paidAt: new Date() } });
  await queueReport('REFERRAL', `واریز حق معرف برای سفارش ${r.order.code}`, [
    `معرف (کد ملی): ${r.referrerNat}`,
    `سفارش: ${r.order.code} | مبلغ کل: ${r.order.total.toLocaleString('fa-IR')} تومان`,
    `حق معرف واریزشده: ${r.amount.toLocaleString('fa-IR')} تومان`,
    `زمان: ${formatJalaliTime(new Date())}`,
  ].join('\n'));
  await logActivity('ADMIN', `واریز حق معرف ${r.order.code}`, `حق معرف واریزشده: ${r.amount.toLocaleString('fa-IR')} تومان`);
  return NextResponse.json({ ok: true });
}
