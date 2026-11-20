import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';
import { settleGoods18, bankRouting18, plan18SettingsFromRecord } from '@/lib/plan18';
import { applyPeriodicBonusAtSettlement } from '@/lib/bonus';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** فهرست سفارش‌های محصولات برای ادمین */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const orders = await db.productOrder.findMany({
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { nameFa: true, nameEn: true, icon: true } }, services: true },
  });
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      code: o.code,
      product: o.product,
      qty: o.qty,
      unitPrice: o.unitPrice,
      total: o.total,
      fullName: o.fullName,
      mobile: o.mobile,
      address: o.address,
      // پیام ۱۱:
      plaque: o.plaque, floor: o.floor, unit: o.unit, postalCode: o.postalCode,
      leadTimeDays: o.leadTimeDays, paySheba: o.paySheba,
      // پیام ۱۲: ریزدیسکی صفحهٔ پرداخت
      listTotal: o.listTotal, markupPct: o.markupPct, markupAmount: o.markupAmount,
      courierFee: o.courierFee, minInvoiceAdj: o.minInvoiceAdj,
      services: o.services.map((s) => ({ id: s.id, title: s.title, price: s.price, qty: s.qty })),
      notes: o.notes,
      status: o.status,
      createdAt: o.createdAt,
    })),
    totalSum: orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + o.total, 0),
    count: orders.length,
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PENDING', 'CONFIRMED', 'SENT', 'DELIVERED', 'CANCELLED']),
  // پیام ۱۷: ثبت/اصلاح مبلغ واقعی خرید از انبار (توافقی) توسط ادمین
  purchaseAmount: z.number().int().min(0).max(999_999_999_999).optional(),
});

const ST_FA: Record<string, string> = {
  PENDING: 'در انتظار بررسی',
  CONFIRMED: 'تأییدشده',
  SENT: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
};

/** تغییر وضعیت سفارش محصول — در تحویل، تسویهٔ پلن ۱۸ (V4.0): سود کالا = فروش − خرید − پیک؛ پورسانت معرف فقط فاکتور اول */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

  const o = await db.productOrder.findUnique({ where: { id: parsed.data.id }, include: { product: true } });
  if (!o) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  await db.productOrder.update({
    where: { id: o.id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.purchaseAmount != null ? { purchaseAmount: parsed.data.purchaseAmount } : {}),
    },
  });
  await queueReport('PRODUCT', `تغییر وضعیت سفارش محصول ${o.code}`, [
    `محصول: ${o.product.nameFa} ×${o.qty}`,
    `خریدار: ${o.fullName} | ${o.mobile}`,
    `وضعیت جدید: ${ST_FA[parsed.data.status] ?? parsed.data.status}`,
    `زمان: ${formatJalaliTime(new Date())}`,
  ].join('\n'));
  await logActivity('ADMIN', `وضعیت سفارش محصول ${o.code} → ${parsed.data.status}`);

  // ─── پیام ۱۸ (V4.0): تسویهٔ میز کالا هنگام تحویل — پورسانت معرف فقط فاکتور اول ───
  let settlement: { profit: number; referrer: number; company: number; melli: number; bonusFunded: number; bonusTriggered: boolean; banks: ReturnType<typeof bankRouting18>; ok: boolean; issues: string[] } | null = null;
  if (parsed.data.status === 'DELIVERED' && o.status !== 'DELIVERED') {
    const settings = await getSettings();
    const plan = plan18SettingsFromRecord(settings as unknown as Record<string, string>);
    const st = settleGoods18({
      saleTotal: o.listTotal,
      purchaseTotal: parsed.data.purchaseAmount ?? o.purchaseAmount,
      courierFee: o.courierFee,
      referred: !!o.referrerCode,
      isFirstInvoice: o.firstInvoice,
      settings: plan,
    });
    // ─── پیام ۲۰ (V5.0): پاداش سقف‌دار دوره‌ای معرف — در فاکتور پنجم/دهمِ دوره، ۵۰۰ هزار تومان
    // از واریزی ملی کسر و به مهر منتقل می‌شود؛ شمارش فاکتورها یکپارچهٔ دو میز است ───
    const bonus = await applyPeriodicBonusAtSettlement(o.referrerCode ?? null, st.company);
    const banks = bankRouting18({ company: bonus.melliAmount, expert: 0, referrer: st.referrer, purchaseTotal: st.purchaseTotal, courierFee: st.courierFee });
    banks.mehr.amount += bonus.funded; // پاداش معرف از جریان مهر پرداخت می‌شود
    settlement = { profit: st.profit, referrer: st.referrer, company: st.company, melli: bonus.melliAmount, bonusFunded: bonus.funded, bonusTriggered: bonus.triggered, banks, ok: st.ok, issues: st.issues };
    // پیام ۱۹ (V4.1): پورسانت معرف کالا در دیتابیس ثبت می‌شود (تا کنون فقط در ایمیل بود — باگ)
    if (o.referrerCode && o.firstInvoice && st.ok && st.referrer > 0) {
      await db.productOrder.update({ where: { id: o.id }, data: { referralAmount: st.referrer } });
    }
    await queueReport('PRODUCT', `تسویهٔ میز کالا ${o.code} (پلن ۱۸ — V4.0)`, [
      `کالا: ${o.product.nameFa} ×${o.qty} | خریدار: ${o.fullName}`,
      `فروش (بالاترین قیمت معتبر): ${st.saleTotal.toLocaleString('fa-IR')} تومان`,
      `خرید از انبار (توافقی): ${st.purchaseTotal.toLocaleString('fa-IR')} تومان | پیک: ${st.courierFee.toLocaleString('fa-IR')} تومان`,
      `سود کالا (فروش − خرید − پیک): ${st.profit.toLocaleString('fa-IR')} تومان${!st.ok ? ' — منفی؛ نیازمند بررسی خرید گران‌تر از فروش' : ''}`,
      o.referrerCode && o.firstInvoice
        ? `معرف: ${o.referrerCode} — پورسانت ۲۰٪ سود (فقط فاکتور اول — V4.0): ${st.referrer.toLocaleString('fa-IR')} تومان${st.referrer > 0 ? ' (در تب «معرفی‌ها» ثبت شد برای واریز — V4.1)' : ''}`
        : o.referrerCode
          ? `معرف: ${o.referrerCode} — پورسانت معرف تعلق نمی‌گیرد (فقط فاکتور اول — V4.0)`
          : 'معرفی‌ای ثبت نشده است',
      `سود خالص شرکت کالا: ${st.company.toLocaleString('fa-IR')} تومان | واریزی به بانک ملی (${banks.melli.card}): ${bonus.melliAmount.toLocaleString('fa-IR')} تومان`,
      bonus.triggered
        ? `⚡ پاداش سقف‌دار دوره‌ای معرف (پیام ۲۰ — V5.0): این فاکتور، ${bonus.invoices.toLocaleString('fa-IR')}-ام دورهٔ معرف ${o.referrerCode} است — ۵۰۰٬۰۰۰ تومان از واریزی ملی کسر و به بانک مهر منتقل شد${bonus.debtLeft > 0 ? ` | مابه‌التفاوت از تسویه‌های بعدی: ${bonus.debtLeft.toLocaleString('fa-IR')} تومان` : ''}`
        : bonus.funded > 0
          ? `پاداش دوره‌ای معرف (→ بانک مهر): ${bonus.funded.toLocaleString('fa-IR')} تومان | بدهی باقی‌ماندهٔ شرکت: ${bonus.debtLeft.toLocaleString('fa-IR')} تومان`
          : '',
      `در گردش (→ بانک مهر ${banks.mehr.card}): خرید ${st.purchaseTotal.toLocaleString('fa-IR')} + پیک ${st.courierFee.toLocaleString('fa-IR')} + معرف ${st.referrer.toLocaleString('fa-IR')} + پاداش ${bonus.funded.toLocaleString('fa-IR')} تومان`,
      `زمان تسویه: ${formatJalaliTime(new Date())}`,
    ].filter(Boolean).join('\n'));
    await logActivity('ADMIN', `تسویهٔ کالا ${o.code}`, `سود: ${st.profit} | شرکت(ملی): ${bonus.melliAmount} | معرف: ${st.referrer}${bonus.funded > 0 ? ` | پاداش دوره‌ای(مهر): ${bonus.funded}` : ''}${!st.ok ? ' | ⚠ سود منفی' : ''}`);
  }

  return NextResponse.json({ ok: true, status: parsed.data.status, settlement });
}
