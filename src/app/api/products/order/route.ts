import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';
import { getSettings, isFrozen } from '@/lib/settings';
import { GOODS_LEAD_DAYS, SERVICE_LEAD_DAYS } from '@/lib/constants';
import { computeCheckout17, courierFeeFor, isPriceFresh, freshCutoffJalaliKey, freshCutoffLabel } from '@/lib/inventory';
import { isFirstInvoiceAnyDesk } from '@/lib/referral';

export const dynamic = 'force-dynamic';

const serviceItemSchema = z.object({
  title: z.string().trim().min(2).max(120),
  price: z.number().int().min(0).max(999_999_999).default(0),
  qty: z.number().int().min(1).max(9).default(1),
});

const schema = z.object({
  productKey: z.string().trim().min(1).max(60),
  qty: z.number().int().min(1).max(99),
  fullName: z.string().trim().min(3).max(120),
  mobile: z.string().trim().regex(/^09\d{9}$/, 'تلفن همراه باید با ۰۹ شروع شده و ۱۱ رقم باشد'),
  address: z.string().trim().min(10).max(1000),
  // پیام ۱۱: آدرس دقیق الزامی — پلاک، طبقه، واحد / کدپستی اختیاری ولی ترجیحی
  plaque: z.string().trim().min(1).max(20),
  floor: z.string().trim().min(1).max(20),
  unit: z.string().trim().min(1).max(20),
  postalCode: z.string().trim().regex(/^\d{10}$/).optional().nullable().or(z.literal('')),
  // سفارش خدمات کنار خرید (نصب، راه‌اندازی و ...)
  serviceItems: z.array(serviceItemSchema).max(10).optional().default([]),
  // پیام ۱۸ (V4.0): کد معرف (کد ملی معرف) — پورسانت ۲۰٪ سود کالا فقط در فاکتور اول + تخفیف ۱۰٪ همان فاکتور
  referralCode: z.string().trim().max(20).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

/** کد سفارش محصول ASP-XXXXXX */
function productOrderCode(): string {
  return `ASP-${Math.floor(100000 + Math.random() * 900000)}`;
}

/** ثبت سفارش میز کالا/نرم‌افزار — پلن ۱۸ (V4.0):
 *  فروش = بالاترین قیمت معتبرترین فروشگاه‌ها (بدون هیچ افزودنی)؛
 *  سود کالا = فروش − خرید (ارزان‌ترین انبار، توافقی) − پیک؛ معرف فقط فاکتور اول ۲۰٪ سود؛ شرکت باقیمانده؛
 *  تخفیف ۱۰٪ فقط فاکتور اول مشتری معرفی‌شده؛ پیک و خرید از سهم بانک مهر (در گردش) پرداخت می‌شود؛
 *  تعدیل به حداقل فاکتور ۵٬۰۰۰٬۰۰۰ تومان (پیام ۱۲). */
export async function POST(req: Request) {
  // توقف عملیات توسط حسابدار هوشمند
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
  const { productKey, qty, fullName, mobile, address, plaque, floor, unit, postalCode, serviceItems, notes } = parsed.data;
  const referralCode17 = parsed.data.referralCode?.trim() || null;

  const product = await db.product.findUnique({ where: { key: productKey }, include: { warehouse: { select: { nameFa: true } } } });
  if (!product || !product.active) {
    return NextResponse.json({ error: 'PRODUCT_NOT_FOUND', message: 'کالا یافت نشد' }, { status: 404 });
  }
  if (product.priceStatus === 'FROZEN') {
    return NextResponse.json({ error: 'PRODUCT_FROZEN', message: 'این کالا در جریان بررسی قیمت است' }, { status: 409 });
  }

  const s = await getSettings();
  const cutoff = freshCutoffJalaliKey(s.PRICE_FRESH_FROM);
  // پیام ۱۲: فقط قیمت‌های تازه (از ۱۴۰۵/۰۸/۱۰ به بعد) قابل سفارش‌اند
  if (!isPriceFresh(product.priceDate, cutoff)) {
    return NextResponse.json(
      { error: 'PRICE_STALE', message: `قیمت این کالا کهنه است (قبل از ${freshCutoffLabel(s.PRICE_FRESH_FROM)}) — پس از استعلام تازهٔ انبار و تأیید ادمین، دوباره قابل سفارش می‌شود.` },
      { status: 409 }
    );
  }

  const minInvoice = parseInt(s.MIN_INVOICE_AMOUNT || '5000000', 10) || 5000000;
  const threshold = parseInt(s.SHEBA_THRESHOLD || '5000000', 10) || 5000000;
  const courierSmall = parseInt(s.COURIER_FEE_SMALL || '250000', 10) || 250000;
  const courierHeavy = parseInt(s.COURIER_FEE_HEAVY || '750000', 10) || 750000;
  // ─── پیام ۱۷ (v3.2): پلن خرید و فروش — بدون افزودنی ───
  const unitPrice = product.price; // فروش = بالاترین قیمت معتبرترین فروشگاه‌ها
  const listTotal = unitPrice * qty;
  const purchaseTotal = (product.basePrice > 0 ? Math.min(product.basePrice, product.price) : 0) * qty; // خرید از انبار (توافقی)
  const courierFee = courierFeeFor(product.category, product.section, courierSmall, courierHeavy);
  const servicesTotal = serviceItems.reduce((t, x) => t + x.price * x.qty, 0);
  // اعتبارسنجی معرف — پیام ۱۹ (V4.1): سخت‌گیرانه و همسو با میز خدمات
  // باگ V4.0: کد نامعتبر بی‌صدا نادیده گرفته می‌شد و سلف-رفرال کنترل نمی‌شد (سوراخ تخفیف/پورسانت)
  let referrer17: { nationalId: string; fullName: string } | null = null;
  if (referralCode17) {
    const found = await db.customer.findUnique({ where: { nationalId: referralCode17 } });
    if (!found) {
      return NextResponse.json({ error: 'REFERRAL_INVALID', message: 'کد معرف نامعتبر است (کد ملی معرف باید قبلاً در سیستم ثبت شده باشد)' }, { status: 400 });
    }
    if (found.mobile === mobile) {
      return NextResponse.json({ error: 'REFERRAL_SELF', message: 'خریدار و معرف نمی‌توانند یک نفر باشند' }, { status: 400 });
    }
    referrer17 = { nationalId: found.nationalId, fullName: found.fullName };
  }
  // پیام ۱۹ (V4.1): تشخیص فاکتور اول یکپارچه بین دو میز (خدمات + کالا) — باگ V4.0: فقط سفارش‌های کالا شمرده می‌شد
  const isFirstInvoice17 = referrer17 ? await isFirstInvoiceAnyDesk({ nationalId: null, mobile }) : false;
  const firstDiscPct17 = Math.min(Math.max(parseFloat(s.FIRST_INVOICE_DISCOUNT_PCT) || 10, 0), 50) / 100;
  const discount17 = referrer17 && isFirstInvoice17 ? Math.round((listTotal + servicesTotal) * firstDiscPct17) : 0;
  const bd = computeCheckout17({ listTotal, purchaseTotal, courierFee, servicesTotal, discount: discount17, minInvoice });
  const total = bd.payable;
  // پیام ۱۲: حداقل فاکتور ۵م → همهٔ فاکتورها از طریق شبا/پل حساب دریافت دریافت می‌شوند
  const paySheba = total >= threshold || bd.minInvoiceAdj > 0 || total >= minInvoice;

  // امور کالا ۳ تا ۷ روز؛ در صورت سفارش خدمات، هماهنگی خدمات ۱ تا ۳ روز پس از کالا
  const leadTimeDays = serviceItems.length > 0 ? `${GOODS_LEAD_DAYS} (+${SERVICE_LEAD_DAYS} برای خدمات)` : GOODS_LEAD_DAYS;

  let code = productOrderCode();
  for (let i = 0; i < 10; i++) {
    const exists = await db.productOrder.findUnique({ where: { code } });
    if (!exists) break;
    code = productOrderCode();
  }

  const order = await db.productOrder.create({
    data: {
      code, productId: product.id, qty, unitPrice,
      total,
      listTotal: bd.listTotal,
      markupPct: 0,
      expertSharePct: 0,
      platformMarginPct: 0,
      markupAmount: 0, // افزودنی از v3.2 حذف شد — پلن ۱۸ (V4.0)
      purchaseAmount: bd.purchaseTotal,
      referrerCode: referrer17?.nationalId ?? null,
      firstInvoice: isFirstInvoice17,
      courierFee: bd.courierFee,
      minInvoiceAdj: bd.minInvoiceAdj,
      fullName, mobile, address,
      plaque, floor, unit,
      postalCode: postalCode || null,
      leadTimeDays,
      paySheba,
      notes: notes ?? null,
      services: { create: serviceItems },
    },
    include: { services: true, product: { select: { nameFa: true } } },
  });

  const fmt = (v: number) => v.toLocaleString('fa-IR');
  // ارسال به پنل ادمین (ایمیل گزارش) — آدرس دقیق + تماس + لینک کالا + ریزدیسکی پرداخت
  await queueReport(
    'PRODUCT',
    `سفارش میز کالا ${order.code} — ${product.nameFa}`,
    [
      `کد سفارش: ${order.code}`,
      `کالا: ${product.nameFa} ×${qty}`,
      `مرجع پایهٔ فروش: ${product.baseSource ?? '—'} | تاریخ قیمت: ${product.priceDate ?? '—'} | لینک: ${product.sourceUrl ?? '—'}`,
      product.warehouse ? `انبار تأمین: ${product.warehouse.nameFa}` : '',
      '— ریزدیسکی صفحهٔ پرداخت (پلن ۱۸ — V4.0) —',
      `فروش (بالاترین قیمت معتبرترین فروشگاه‌ها) × تعداد: ${fmt(bd.listTotal)} تومان (بدون افزودنی)`,
      `خرید از انبار (توافقی): ${fmt(bd.purchaseTotal)} تومان`,
      `هزینهٔ ارسال و بسته‌بندی (پیک — از سود کالا): ${fmt(bd.courierFee)} تومان${product.section === 'SOFTWARE' ? ' (ارسال دیجیتال — صفر)' : ''}`,
      `سود کالا (فروش − خرید − پیک): ${fmt(bd.goodsProfit)} تومان`,
      referrer17 && isFirstInvoice17 ? `تخفیف ۱۰٪ فاکتور اول معرفی‌شده: −${fmt(bd.discount)} تومان` : '',
      referrer17 ? `معرف: ${referrer17.fullName} (${referrer17.nationalId}) — پورسانت کالا فقط در همین فاکتور اول: ${isFirstInvoice17 ? '۲۰٪ سود در زمان تسویه (تنها پورسانت معرف — V4.0)' : '۰ (پورسانت معرف فقط در فاکتور اول — V4.0)'}` : '',
      serviceItems.length ? `سفارش خدمات کنار خرید: ${serviceItems.map((x) => `${x.title} ×${x.qty} = ${fmt(x.price * x.qty)}`).join('، ')} | جمع: ${fmt(bd.servicesTotal)} تومان` : '',
      bd.minInvoiceAdj > 0 ? `تعدیل به حداقل فاکتور ${fmt(minInvoice)} تومان: +${fmt(bd.minInvoiceAdj)} تومان` : '',
      `مبلغ قابل پرداخت: ${fmt(total)} تومان`,
      '— — —',
      `خریدار: ${fullName} | همراه: ${mobile}`,
      `آدرس دقیق: ${address} | پلاک: ${plaque} | طبقه: ${floor} | واحد: ${unit}${postalCode ? ` | کدپستی: ${postalCode}` : ' | کدپستی: ثبت نشده'}`,
      `بازهٔ رسیدگی: ${leadTimeDays}`,
      `💳 فاکتور ≥ ${fmt(minInvoice)} تومان — دریافت از طریق شبای حساب دریافت (بانک مهر ایران) انجام شود: ${s.SHEBA_RECEIVING}`,
      notes ? `توضیحات: ${notes}` : '',
      `زمان ثبت: ${formatJalaliTime(new Date())}`,
    ].filter(Boolean).join('\n')
  );
  await logActivity('CUSTOMER', `سفارش کالا ${order.code}`, `کالا: ${product.nameFa} ×${qty} | مرجع: ${listTotal} | پرداخت: ${total} | خدمات کنار خرید: ${serviceItems.length}`);

  return NextResponse.json({
    code: order.code,
    total,
    goodsTotal: bd.listTotal, // فروش (بالاترین قیمت معتبر) × تعداد
    purchaseAmount: bd.purchaseTotal,
    goodsProfit: bd.goodsProfit,
    discount: bd.discount,
    courierFee: bd.courierFee,
    servicesTotal: bd.servicesTotal,
    minInvoice: minInvoice,
    minInvoiceAdj: bd.minInvoiceAdj,
    leadTimeDays,
    paySheba,
    referrerValid: !!referrer17,
    isFirstInvoice: isFirstInvoice17,
    // شبای حساب دریافت — همهٔ فاکتورها ≥ ۵م تومان
    sheba: s.SHEBA_RECEIVING,
    pol: s.POL_RECEIVING || null,
    accountName: s.ACCOUNT_NAME,
    nameFa: product.nameFa,
    breakdown: bd,
  });
}
