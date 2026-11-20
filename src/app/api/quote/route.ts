import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { computeQuote, dayRateFactor, type OrderMode } from '@/lib/pricing';
import { referralPercent, getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const schema = z.object({
  items: z.array(z.object({
    key: z.string().min(1),
    qty: z.number().int().min(1).max(99),
    details: z.array(z.string().min(1)).max(12).optional(),
  })).min(1),
  parts: z.array(z.object({
    key: z.string().min(1),
    qty: z.number().int().min(1).max(99),
  })).max(20).optional(),
  mode: z.enum(['ONSITE', 'REMOTE']),
  referralCode: z.string().trim().max(20).optional().nullable(),
  customerNationalId: z.string().trim().max(20).optional().nullable(),
});

/** پیش‌فاکتور زنده — خدمات + ریز جزئیات + قطعات؛ تمام محاسبات سمت سرور */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'دادهٔ نامعتبر' }, { status: 400 });
  }
  const { items, mode } = parsed.data;
  const referralCode = parsed.data.referralCode?.trim() || null;
  const customerNationalId = parsed.data.customerNationalId?.trim() || null;

  const services = await db.service.findMany({ where: { key: { in: items.map((i) => i.key) } } });
  const detailIds = items.flatMap((i) => i.details ?? []);
  const detailRows = detailIds.length
    ? await db.serviceDetail.findMany({ where: { id: { in: detailIds }, active: true } })
    : [];

  const lines = items
    .map((i) => {
      const svc = services.find((s) => s.key === i.key);
      if (!svc || !svc.active) return null;
      // ریز جزئیات انتخابی فقط از همین خدمت
      const dets = detailRows.filter((d) => d.serviceId === svc.id && (i.details ?? []).includes(d.id));
      const extraPerUnit = dets.reduce((s, d) => s + d.price, 0);
      const effRate = svc.baseRate + extraPerUnit;
      return { serviceKey: svc.key, qty: i.qty, baseRate: effRate, lineTotal: effRate * i.qty };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (lines.length === 0) {
    return NextResponse.json({ error: 'NO_SERVICES', message: 'خدمتی انتخاب نشده است' }, { status: 400 });
  }

  // قطعات — قیمت روز (ضریب نرخ روز تقویمی)
  const partKeys = (parsed.data.parts ?? []).map((p) => p.key);
  const partRows = partKeys.length ? await db.part.findMany({ where: { key: { in: partKeys }, active: true } }) : [];
  const dr = await dayRateFactor(new Date());
  const partLines = (parsed.data.parts ?? [])
    .map((p) => {
      const part = partRows.find((r) => r.key === p.key);
      if (!part) return null;
      const unitPrice = Math.round(part.basePrice * dr.factor);
      return { key: part.key, nameFa: part.nameFa, nameEn: part.nameEn, unitPrice, qty: p.qty, lineTotal: unitPrice * p.qty };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const partsTotal = partLines.reduce((s, p) => s + p.lineTotal, 0);

  // اعتبارسنجی معرف: کد ملی باید قبلاً مشتری شده باشد و خودِ مشتری نباشد
  let referralValid = false;
  let referralBlockedSelf = false;
  if (referralCode) {
    const referrer = await db.customer.findUnique({ where: { nationalId: referralCode } });
    if (referrer) {
      referralBlockedSelf = !!customerNationalId && customerNationalId === referralCode;
      referralValid = !referralBlockedSelf;
    }
  }

  // پیام ۱۷: اولین فاکتور خرید مشتری — ملاک، سفارش‌های ثبت‌شدهٔ قبلی همان مشتری (لغوشده‌ها شمارش نمی‌شوند)
  let isFirstInvoice = false;
  if (customerNationalId && referralValid) {
    const prior = await db.order.count({
      where: { customer: { nationalId: customerNationalId }, status: { not: 'CANCELLED' } },
    });
    isFirstInvoice = prior === 0;
  }

  const settings = await getSettings();
  const firstDiscPct = Math.min(Math.max(parseFloat(settings.FIRST_INVOICE_DISCOUNT_PCT) || 10, 0), 50);

  const quote = await computeQuote({
    items: lines,
    mode: mode as OrderMode,
    referralPercent: await referralPercent(),
    hasReferral: referralValid,
    isFirstInvoice,
    firstInvoiceDiscountPct: firstDiscPct,
  });
  // پیام ۱۷: تخفیف ۱۰٪ فاکتور اول روی کل فاکتور خرید (خدمات + قطعات)
  const partsDiscount = referralValid && isFirstInvoice ? Math.round((partsTotal * firstDiscPct) / 100) : 0;
  const rawGrand = quote.total + partsTotal - partsDiscount;
  // پیام ۱۲: حداقل مبلغ دریافتی هر فاکتور = ۵٬۰۰۰٬۰۰۰ تومان — در پیش‌فاکتور هم نمایش داده می‌شود
  const minInvoice = parseInt(settings.MIN_INVOICE_AMOUNT || '5000000', 10) || 5000000;
  const minInvoiceAdj = Math.max(0, minInvoice - rawGrand);
  const grandTotal = rawGrand + minInvoiceAdj;

  return NextResponse.json({
    quote: { ...quote, parts: partLines, partsTotal, partsDiscount, minInvoice, minInvoiceAdj, grandTotal, dayLabelFa: quote.dayLabelFa || dr.labelFa },
    referralValid,
    referralBlockedSelf,
    isFirstInvoice,
  });
}
