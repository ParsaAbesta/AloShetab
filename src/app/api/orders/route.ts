import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { computeQuote, allocateAmounts, dayRateFactor, type OrderMode } from '@/lib/pricing';
import { referralPercent, getSettings, isFrozen } from '@/lib/settings';
import { orderCode, ORDER_STATUS } from '@/lib/constants';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';
import { isFirstInvoiceAnyDesk } from '@/lib/referral';

export const dynamic = 'force-dynamic';

const schema = z.object({
  items: z.array(z.object({
    key: z.string().min(1),
    qty: z.number().int().min(1).max(99),
    details: z.array(z.string().min(1)).max(12).optional(),
  })).min(1),
  parts: z.array(z.object({
    key: z.string().min(1),
    model: z.string().trim().max(120).optional().nullable(),
    qty: z.number().int().min(1).max(99),
  })).max(20).optional(),
  miscNotes: z.string().trim().max(4000).optional().nullable(),
  customer: z.object({
    fullName: z.string().trim().min(3).max(120),
    nationalId: z.string().trim().regex(/^\d{10}$/, 'کد ملی باید ۱۰ رقم باشد'),
    mobile: z.string().trim().regex(/^09\d{9}$/, 'تلفن همراه باید با ۰۹ شروع شده و ۱۱ رقم باشد'),
    landline: z.string().trim().regex(/^0\d{9,10}$/).optional().nullable(),
    address: z.string().trim().min(10).max(1000),
    lat: z.number().min(-90).max(90).optional().nullable(),
    lng: z.number().min(-180).max(180).optional().nullable(),
  }),
  mode: z.enum(['ONSITE', 'REMOTE']),
  referralCode: z.string().trim().max(20).optional().nullable(),
});

const STATUS_LABEL_FA: Record<string, string> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 'ثبت شد — در انتظار پرداخت',
  [ORDER_STATUS.EXPERT_REVIEW]: 'ثبت شد — نیاز به بررسی و کارشناسی',
};

/** ثبت سفارش — خدمات + ریز جزئیات + قطعات؛ کوت و اعتبارسنجی کامل سمت سرور */
export async function POST(req: Request) {
  // پیام ۱۹ (V4.1): توقف عملیات توسط حسابدار هوشمند — همسو با میز کالا
  const fr = await isFrozen();
  if (fr.frozen) {
    return NextResponse.json(
      { error: 'OPERATIONS_FROZEN', message: 'به دلیل حسابرسی در جریان، ثبت سفارش موقتاً متوقف است. پس از تأیید مالک/مدیر و فرمان ادامه، فعال می‌شود.' },
      { status: 423 }
    );
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'دادهٔ نامعتبر';
    return NextResponse.json({ error: 'INVALID_INPUT', message: msg }, { status: 400 });
  }
  const { items, customer, mode } = parsed.data;
  const referralCode = parsed.data.referralCode?.trim() || null;
  const miscNotes = parsed.data.miscNotes?.trim() || null;

  const services = await db.service.findMany({ where: { key: { in: items.map((i) => i.key) } } });
  const detailIds = items.flatMap((i) => i.details ?? []);
  const detailRows = detailIds.length
    ? await db.serviceDetail.findMany({ where: { id: { in: detailIds }, active: true } })
    : [];

  const resolved = items
    .map((i) => {
      const svc = services.find((s) => s.key === i.key);
      if (!svc || !svc.active) return null;
      // از راه دور فقط برای خدماتِ توانمند
      if (mode === 'REMOTE' && !svc.remoteCapable) return { svc, qty: i.qty, dets: [] as typeof detailRows, error: `«${svc.nameFa}» از راه دور قابل انجام نیست` };
      // ریز جزئیات فقط از همین خدمت
      const dets = detailRows.filter((d) => d.serviceId === svc.id && (i.details ?? []).includes(d.id));
      return { svc, qty: i.qty, dets, error: null as string | null };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const blocked = resolved.find((r) => r.error);
  if (blocked) {
    return NextResponse.json({ error: 'SERVICE_NOT_REMOTE', message: blocked.error }, { status: 400 });
  }
  if (resolved.length === 0) {
    return NextResponse.json({ error: 'NO_SERVICES', message: 'خدمتی انتخاب نشده است' }, { status: 400 });
  }

  // قطعات — قیمت روز (ضریب تقویمی)
  const partReq = parsed.data.parts ?? [];
  const partRows = partReq.length ? await db.part.findMany({ where: { key: { in: partReq.map((p) => p.key) }, active: true } }) : [];
  const dr = await dayRateFactor(new Date());
  const partLines = partReq
    .map((p) => {
      const part = partRows.find((r) => r.key === p.key);
      if (!part) return null;
      const unitPrice = Math.round(part.basePrice * dr.factor);
      return { key: part.key, nameFa: part.nameFa, partModel: p.model ?? null, qty: p.qty, unitPrice, lineTotal: unitPrice * p.qty };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const partsTotal = partLines.reduce((s, p) => s + p.lineTotal, 0);

  // متفرقه: توضیحات الزامی + قیمت‌گذاری هوش مصنوعی یا برچسب کارشناسی
  const hasMisc = resolved.some((r) => r.svc.isMisc);
  // خدمات کارمزد درصدی (مثل کارمزد معامله ملک): نیازمند تعیین قطعی توسط کارشناس
  const hasPercent = resolved.some((r) => r.svc.percentValue != null);
  let needsExpertise = hasPercent;
  let aiPrice: number | null = null;
  if (hasMisc) {
    if (!miscNotes || miscNotes.length < 15) {
      return NextResponse.json({ error: 'MISC_NOTES_REQUIRED', message: 'برای گزینهٔ متفرقه، شرح نیاز (حداقل ۱۵ کاراکتر) الزامی است' }, { status: 400 });
    }
    const est = await estimateMisc(miscNotes);
    if (est.needsExpertise) needsExpertise = true;
    aiPrice = est.price;
  }

  // اعتبارسنجی معرف — مشتری ≠ معرف (کنترل سمت سرور با کد ملی)
  let referrer: { id: string; nationalId: string; fullName: string } | null = null;
  if (referralCode) {
    if (referralCode === customer.nationalId) {
      return NextResponse.json({ error: 'REFERRAL_SELF', message: 'مشتری و معرف نمی‌توانند یک نفر باشند' }, { status: 400 });
    }
    const found = await db.customer.findUnique({ where: { nationalId: referralCode } });
    if (!found) {
      return NextResponse.json({ error: 'REFERRAL_INVALID', message: 'کد معرف نامعتبر است (کد ملی معرف باید قبلاً در سیستم ثبت شده باشد)' }, { status: 400 });
    }
    referrer = { id: found.id, nationalId: found.nationalId, fullName: found.fullName };
  }

  // مشتری (upsert با کد ملی)
  const cust = await db.customer.upsert({
    where: { nationalId: customer.nationalId },
    update: {
      fullName: customer.fullName,
      mobile: customer.mobile,
      landline: customer.landline ?? null,
      address: customer.address,
      lat: customer.lat ?? null,
      lng: customer.lng ?? null,
    },
    create: {
      fullName: customer.fullName,
      nationalId: customer.nationalId,
      mobile: customer.mobile,
      landline: customer.landline ?? null,
      address: customer.address,
      lat: customer.lat ?? null,
      lng: customer.lng ?? null,
    },
  });

  // پیام ۱۹ (V4.1): تشخیص فاکتور اول یکپارچه بین دو میز (خدمات + کالا) —
  // باگ V4.0: فقط سفارش‌های خدمات شمرده می‌شد و معرف روی همان مشتری در میز کالا هم پورسانت یک‌بارمصرف می‌گرفت.
  // این همان فاکتوری است که هم تخفیف ۱۰٪ مشتری را می‌گیرد و هم تنها فاکتورِ پورسانت معرف است
  const isFirstInvoice = !!referrer && (await isFirstInvoiceAnyDesk({ nationalId: cust.nationalId, mobile: cust.mobile }));

  // کوت نهایی سمت سرور — اقلام کارشناسی‌محور در پرداخت اولیه لحاظ نمی‌شوند
  const lines = resolved.map((r) => {
    const extraPerUnit = r.dets.reduce((s, d) => s + d.price, 0);
    const rate = r.svc.isMisc ? (aiPrice ?? 0) : r.svc.baseRate + extraPerUnit;
    const expertPending = r.svc.percentValue != null || (r.svc.isMisc && aiPrice == null);
    return {
      serviceKey: r.svc.key,
      qty: r.qty,
      baseRate: rate,
      lineTotal: rate * r.qty,
      expertPending,
      detailIds: r.dets.map((d) => d.id),
      detailsExtra: extraPerUnit * r.qty,
    };
  });
  const payableLines = needsExpertise ? lines.filter((l) => !l.expertPending) : lines;
  const settings = await getSettings();
  // پیام ۱۸ (V4.0): تخفیف ۱۰٪ فقط فاکتور اول مشتری معرفی‌شده — نرخ از تنظیمات مالک
  const firstDiscPct = Math.min(Math.max(parseFloat(settings.FIRST_INVOICE_DISCOUNT_PCT) || 10, 0), 50);
  // پیام ۱۸ (V4.0): پورسانت معرف فقط یک‌بار — در همان فاکتور اول معرفی‌شده (۱۰٪ اجرت)؛ از فاکتور دوم به بعد صفر
  const svcReferrerPct = isFirstInvoice
    ? Math.min(Math.max(parseFloat(settings.SERVICES_REFERRER_PCT_FIRST) || 10, 0), 50) / 100
    : 0;
  const quote = await computeQuote({
    items: payableLines,
    mode: mode as OrderMode,
    referralPercent: parseInt(settings.REFERRAL_PERCENT, 10) || 5,
    hasReferral: !!referrer,
    isFirstInvoice,
    firstInvoiceDiscountPct: firstDiscPct,
  });
  // تخفیف فاکتور اول روی کل فاکتور خرید (خدمات + قطعات) — پیام ۱۷
  const partsDiscount = referrer && isFirstInvoice ? Math.round((partsTotal * firstDiscPct) / 100) : 0;
  const orderTotal = quote.total + partsTotal - partsDiscount;

  // پیام ۱۲ (اصلاح ۱۴۰۵/۰۸/۲۶): حداقل مبلغ دریافتی هر فاکتور = ۵٬۰۰۰٬۰۰۰ تومان
  const minInvoice = parseInt(settings.MIN_INVOICE_AMOUNT || '5000000', 10) || 5000000;
  const minInvoiceAdj = Math.max(0, minInvoice - orderTotal);
  const finalTotal = orderTotal + minInvoiceAdj;
  const orderDiscount = quote.discount + partsDiscount; // تخفیف کل فاکتور (پیام ۱۷)

  // کد رهگیری یکتا AS-XXXXXX
  let code = orderCode();
  for (let i = 0; i < 10; i++) {
    const exists = await db.order.findUnique({ where: { code } });
    if (!exists) break;
    code = orderCode();
  }

  const totalForAllocation = quote.total; // فقط بخش خدمات بین اقلام تسهیم می‌شود؛ قطعات خرید کالاست
  const lineTotals = payableLines.map((l) => l.lineTotal);
  const allocated = allocateAmounts(totalForAllocation, lineTotals);

  const status = needsExpertise ? ORDER_STATUS.EXPERT_REVIEW : ORDER_STATUS.PENDING_PAYMENT;

  const order = await db.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        code,
        customerId: cust.id,
        mode,
        status,
        weekFactor: quote.weekFactor,
        hourFactor: quote.hourFactor,
        dayFactor: quote.dayFactor,
        modeFactor: quote.modeFactor,
        subtotal: quote.subtotal,
        grossTotal: quote.grossTotal,
        serviceMarkup: quote.serviceMarkup, // سود ۳۳٪ میز خدمات — درون اجرت (پیام ۱۷)
        discount: orderDiscount,
        total: finalTotal,
        minInvoiceAdj,
        partsTotal,
        referralCode: referrer?.nationalId ?? null,
        referrerId: referrer?.id ?? null,
        needsExpertise,
        miscNotes,
        aiPrice,
      },
    });
    // همهٔ اقلام (حتی متفرقهٔ کارشناسی با نرخ ۰) ثبت می‌شوند تا ادمین بتواند قیمت قطعی بگذارد
    for (const l of lines) {
      const payableIdx = payableLines.findIndex((p) => p.serviceKey === l.serviceKey);
      await tx.orderItem.create({
        data: {
          orderId: o.id,
          serviceId: (resolved.find((r) => r.svc.key === l.serviceKey))!.svc.id,
          qty: l.qty,
          baseRate: l.baseRate,
          lineTotal: l.lineTotal,
          detailIds: l.detailIds.length ? JSON.stringify(l.detailIds) : null,
          detailsExtra: l.detailsExtra,
          itemAmount: payableIdx >= 0 ? (allocated[payableIdx] ?? 0) : 0, // متفرقهٔ کارشناسی فعلاً ۰
        },
      });
    }
    for (const p of partLines) {
      await tx.orderPart.create({
        data: {
          orderId: o.id,
          partKey: p.key,
          partName: p.nameFa,
          partModel: p.partModel,
          qty: p.qty,
          unitPrice: p.unitPrice,
          lineTotal: p.lineTotal,
        },
      });
    }
    await tx.orderEvent.create({
      data: {
        orderId: o.id,
        status,
        noteFa: STATUS_LABEL_FA[status] ?? 'ثبت سفارش',
        noteEn: needsExpertise ? 'Order registered — expert review required' : 'Order registered — awaiting payment',
      },
    });
    if (referrer && isFirstInvoice) {
      // پیام ۱۸ (V4.0): پورسانت معرف فقط یک‌بار — فقط در فاکتور اول معرفی‌شده (۱۰٪ اجرت) — محرمانه؛ فقط سمت سرور
      await tx.referral.create({
        data: { orderId: o.id, referrerNat: referrer.nationalId, amount: Math.round(quote.grossTotal * svcReferrerPct) },
      });
    }
    return o;
  });

  await queueReport(
    'ORDER',
    `سفارش جدید ${order.code} — ${cust.fullName}`,
    [
      `کد سفارش: ${order.code}`,
      `مشتری: ${cust.fullName} (کد ملی: ${cust.nationalId})`,
      `همراه: ${cust.mobile} | آدرس: ${cust.address}`,
      `حالت انجام: ${mode === 'REMOTE' ? 'از راه دور' : 'در محل مشتری'}`,
      `خدمات: ${resolved.map((r) => `${r.svc.nameFa} ×${r.qty}${r.dets.length ? ` (+${r.dets.length} ریز جزئیات)` : ''}`).join('، ')}`,
      partLines.length ? `قطعات: ${partLines.map((p) => `${p.nameFa}${p.partModel ? ` (${p.partModel})` : ''} ×${p.qty}`).join('، ')}` : '',
      hasMisc ? `توضیحات متفرقه: ${miscNotes}` : '',
      needsExpertise ? '⚠ نیاز به بررسی و کارشناسی' : `مبلغ قابل پرداخت: ${finalTotal.toLocaleString('fa-IR')} تومان${minInvoiceAdj > 0 ? ` (شامل تعدیل به حداقل فاکتور ${minInvoice.toLocaleString('fa-IR')} تومان: +${minInvoiceAdj.toLocaleString('fa-IR')})` : ''}${partsTotal ? ` (خدمات: ${quote.total.toLocaleString('fa-IR')} + قطعات: ${partsTotal.toLocaleString('fa-IR')}${partsDiscount ? ` − تخفیف فاکتور اول: ${partsDiscount.toLocaleString('fa-IR')}` : ''}${minInvoiceAdj > 0 ? ` + تعدیل: ${minInvoiceAdj.toLocaleString('fa-IR')}` : ''})` : ''}`,
      `پلن ۱۸ (V4.0): سود میز خدمات = ۳۳٪ اجرت (${quote.serviceMarkup.toLocaleString('fa-IR')} تومان درون اجرت) — کارشناس ۶۷٪ + معرف ${isFirstInvoice ? '۱۰٪ (فقط همین فاکتور اول)' : '۰ (پورسانت معرف فقط در فاکتور اول)'} + شرکت باقیمانده؛ افزودنی ۳۳٪ حذف شد و پلن ۳۳٪ فقط در میز خدمات باقی است.`,
      minInvoiceAdj > 0 ? `💳 فاکتور ≥ ${minInvoice.toLocaleString('fa-IR')} تومان — دریافت از طریق شبای حساب دریافت انجام شود.` : '',
      referrer ? `معرف: ${referrer.fullName} (${referrer.nationalId})${isFirstInvoice ? ` — پورسانت خدمات این فاکتور: ${Math.round(quote.grossTotal * svcReferrerPct).toLocaleString('fa-IR')} تومان (تنها پورسانت معرف — همراه با تخفیف ۱۰٪ مشتری)` : ' — پورسانت معرف تعلق نمی‌گیرد (فقط فاکتور اول — V4.0)'}` : '',
      `زمان ثبت: ${formatJalaliTime(new Date())}`,
    ].filter(Boolean).join('\n')
  );
  await logActivity('CUSTOMER', `ثبت سفارش ${order.code}`, `مشتری: ${cust.fullName} | مبلغ: ${finalTotal}${minInvoiceAdj > 0 ? ` (تعدیل حداقل فاکتور +${minInvoiceAdj})` : ''}`);

  return NextResponse.json({
    code: order.code,
    status: order.status,
    needsExpertise,
    total: finalTotal,
    minInvoice,
    minInvoiceAdj,
    quote: { ...quote, parts: partLines, partsTotal, lines: payableLines },
  });
}

// ─── برآورد قیمت «متفرقه» با هوش مصنوعی (سمت سرور) ──────────
async function estimateMisc(description: string): Promise<{ price: number | null; needsExpertise: boolean }> {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await Promise.race([
      zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'تو کارشناس قیمت‌گذاری خدمات در ایران هستی. کاربر نیاز خود را توضیح می‌دهد. اگر بتوانی نرخ انجام را برآورد کردی، فقط JSON برگردان: {"price": <مبلغ به تومان عدد صحیح>, "needsExpert": false}. اگر کار پیچیده است و کارشناسی لازم است، فقط JSON: {"price": null, "needsExpert": true}. هیچ متن دیگری ننویس.',
          },
          { role: 'user', content: description.slice(0, 1500) },
        ],
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 25000)),
    ]);
    const content = (completion as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]) as { price?: number | null; needsExpert?: boolean };
      if (typeof obj.price === 'number' && obj.price > 0) return { price: Math.round(obj.price), needsExpertise: false };
      if (obj.needsExpert) return { price: null, needsExpertise: true };
    }
    return { price: null, needsExpertise: true };
  } catch {
    return { price: null, needsExpertise: true };
  }
}
