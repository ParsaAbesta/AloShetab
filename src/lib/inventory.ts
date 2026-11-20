// ─── پیام ۱۱ + پلن جدید پیام ۱۴ (v3.0): موتور قیمت‌گذاری میز کالا ──
// قواعد مالک:
//  ۱) قیمت نمایشی میز کالا = قیمت پایهٔ فروش = «قیمت گران‌ترین فروشگاه» (پلن v3)
//     «فروش به قیمت گران‌ترین فروشگاه ها» — بروزترین استعلام هر فروشگاه ملاک است.
//  ۲) خرید و تأمین از «پائین‌ قیمت‌ترین انبارها» + موجودی فقط از بروزترین انبار
//     (لیست بروزترین قیمت انبارها در میز محصولات نمایش داده می‌شود)
//  ۳) افزودنی پرداخت = سهم کارشناس (۱۶٫۵ تا ۲۰٪ یا بیشتر) + افزایش قیمت پلتفرم
//     (۱۰ تا ۱۶٫۵٪) — پلن ۳۳٪ به‌کلی حذف شد؛ فقط در «صفحهٔ پرداخت» اعمال می‌شود
//  ۴) حداقل مبلغ دریافتی هر فاکتور = ۵٬۰۰۰٬۰۰۰ تومان (تعدیل در صفحهٔ پرداخت)
//  ۵) تمام قیمت‌ها و بروزرسانی‌ها فقط از ۲۰۲۶/۱۱/۰۱ (۱۴۰۵/۰۸/۱۰) به بعد معتبرند
// همهٔ قیمت‌ها بر اساس تقویم (تاریخ شمسی) مهر زمانی می‌شوند.
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { formatJalali, tehranDateKey, toJalali, toFaDigits } from '@/lib/jalali';
import { queueReport } from '@/lib/reports';
import { HEAVY_GOODS_CATEGORIES } from '@/lib/constants';
import { computeOfferPolicy } from '@/lib/policy';

export const PRICE_RULE_V3 = 'V3-PLAN'; // پلن v3: کارشناس + پلتفرم (جایگزین BASE+33% و SITE+15%)
export const EXPERT_SHARE_PCT_FALLBACK = 0.18; // پیش‌فرض پلن — سهم کارشناس
export const PLATFORM_MARGIN_PCT_FALLBACK = 0.12; // پیش‌فرض پلن — افزایش قیمت

/** گرد کردن به نزدیک‌ترین هزار تومان */
export function roundPrice(v: number): number {
  return Math.round(v / 1000) * 1000;
}

/** خواندن پلن v3 از تنظیمات — سهم کارشناس + افزایش قیمت پلتفرم */
export async function readMarkupPlan(): Promise<{ expertPct: number; platformPct: number; markupPct: number }> {
  const s = await getSettings();
  const expertPct = Math.max((parseFloat(s.EXPERT_SHARE_PCT) || 18) / 100, 0.165); // ≥ ۱۶٫۵٪ («یا بیشتر»)
  const platformPct = Math.min(Math.max((parseFloat(s.PLATFORM_MARGIN_PCT) || 12) / 100, 0.1), 0.165); // ۱۰ تا ۱۶٫۵٪
  return { expertPct, platformPct, markupPct: expertPct + platformPct };
}

// ─── پیام ۱۲: گیت تازگی قیمت — فقط از ۱۴۰۵/۰۸/۱۰ (۲۰۲۶/۱۱/۰۱) به بعد ──

/** کلید عددی از رشتهٔ تاریخ (شمسی 1405/08/26 یا میلادی 2026-11-01) */
function dateKeyNum(s: string | null | undefined): number | null {
  if (!s) return null;
  const fa = String(s).replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  const m = fa.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 10000 + parseInt(m[2], 10) * 100 + parseInt(m[3], 10);
}

/** مرز تازگی به کلید عددی شمسی (تنظیم PRICE_FRESH_FROM = 2026-11-01 → 14050810) */
export function freshCutoffJalaliKey(isoCutoff: string): number {
  const d = new Date(`${isoCutoff}T00:00:00Z`);
  if (isNaN(d.getTime())) return 14050810;
  const j = toJalali(d);
  return j.jy * 10000 + j.jm * 100 + j.jd;
}

/** قیمت با تاریخ گiven تازه است؟ (فقط از مرز تنظیم‌شده به بعد) */
export function isPriceFresh(priceDate: string | null | undefined, cutoffJalaliKey: number): boolean {
  const k = dateKeyNum(priceDate);
  if (k == null) return false; // بدون تاریخ = کهنه و غیرقابل نمایش
  return k >= cutoffJalaliKey;
}

/** برچسب شمسی مرز تازگی برای نمایش: ۱۴۰۵/۰۸/۱۰ */
export function freshCutoffLabel(isoCutoff: string): string {
  const d = new Date(`${isoCutoff}T00:00:00Z`);
  if (isNaN(d.getTime())) return toFaDigits('1405/08/10');
  return formatJalali(d, 'fa');
}

/** کلید رشته‌ای شمسی مرز تازگی برای مقایسهٔ رشته‌ای در دیتابیس: 1405/08/10 */
export function freshCutoffJalaliStr(isoCutoff: string): string {
  const d = new Date(`${isoCutoff}T00:00:00Z`);
  if (isNaN(d.getTime())) return '1405/08/10';
  const j = toJalali(d);
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}

/** هزینهٔ ارسال و بسته‌بندی (پیک) بر اساس دستهٔ کالا */
export function courierFeeFor(category: string, section: string, small: number, heavy: number): number {
  if (section === 'SOFTWARE') return 0; // ارسال دیجیتال — هزینهٔ پیک ندارد
  return HEAVY_GOODS_CATEGORIES.some((c) => category.includes(c)) ? heavy : small;
}

export interface CheckoutBreakdown {
  listTotal: number; // جمع قیمت فروش پایه (گران‌ترین فروشگاه) × تعداد — بدون افزودنی
  expertSharePct: number; // سهم کارشناس (۰٫۱۶۵ تا ۰٫۲+)
  platformMarginPct: number; // افزایش قیمت پلتفرم (۰٫۱ تا ۰٫۱۶۵)
  markupPct: number; // جمع افزودنی پرداخت
  expertShareAmount: number; // مبلغ سهم کارشناس
  platformMarginAmount: number; // مبلغ افزایش قیمت
  markupAmount: number; // جمع افزودنی (= سهم کارشناس + افزایش قیمت)
  courierFee: number; // هزینهٔ ارسال و بسته‌بندی (پیک)
  servicesTotal: number; // سفارش خدمات کنار خرید
  beforeMin: number;
  minInvoiceAdj: number; // تعدیل به حداقل فاکتور
  payable: number; // مبلغ قابل پرداخت نهایی
}

/** محاسبهٔ صفحهٔ پرداخت طبق پلن v3 (پیام ۱۴):
 *  پایهٔ فروش + سهم کارشناس + افزایش قیمت پلتفرم + پیک + تعدیل حداقل فاکتور */
export function computeCheckout(params: {
  listTotal: number;
  expertSharePct: number;
  platformMarginPct: number;
  courierFee: number;
  servicesTotal?: number;
  minInvoice: number;
}): CheckoutBreakdown {
  const servicesTotal = params.servicesTotal ?? 0;
  const markupPct = params.expertSharePct + params.platformMarginPct;
  const expertShareAmount = roundPrice(params.listTotal * params.expertSharePct);
  const platformMarginAmount = roundPrice(params.listTotal * params.platformMarginPct);
  const markupAmount = expertShareAmount + platformMarginAmount;
  const beforeMin = params.listTotal + markupAmount + params.courierFee + servicesTotal;
  const minInvoiceAdj = Math.max(0, params.minInvoice - beforeMin);
  const payable = beforeMin + minInvoiceAdj;
  return { listTotal: params.listTotal, expertSharePct: params.expertSharePct, platformMarginPct: params.platformMarginPct, markupPct, expertShareAmount, platformMarginAmount, markupAmount, courierFee: params.courierFee, servicesTotal, beforeMin, minInvoiceAdj, payable };
}

/** قیمت نهایی با مهر تقویم (تاریخ شمسی امروز) */
export function priceStamp(now: Date = new Date()): string {
  return formatJalali(now, 'en'); // 1405/08/26
}

// ─── پیام ۱۷ (v3.2): پلن خرید و فروش میز کالا ──────────────────
// مشتری «بالاترین قیمت معتبرترین فروشگاه‌ها» را می‌پردازد (بدون افزودنی کارشناس/پلتفرم)؛
// سود کالا = فروش − خرید (ارزان‌ترین انبار، توافقی) − پیک؛ معرف ۳۰٪ سود (فاکتور اول ۲۰٪)؛
// شرکت ۷۰٪ سود؛ تخفیف ۱۰٪ فقط فاکتور اول مشتری معرفی‌شده.
export interface CheckoutBreakdown17 {
  listTotal: number; // فروش = بالاترین قیمت معتبر × تعداد
  purchaseTotal: number; // خرید از انبار (توافقی) × تعداد
  courierFee: number; // پیک — از سود کالا کسر می‌شود
  servicesTotal: number;
  discount: number; // تخفیف فاکتور اول معرفی‌شده
  goodsProfit: number; // فروش − خرید − پیک
  beforeMin: number;
  minInvoiceAdj: number;
  payable: number;
}

export function computeCheckout17(params: {
  listTotal: number;
  purchaseTotal: number;
  courierFee: number;
  servicesTotal?: number;
  discount?: number;
  minInvoice: number;
}): CheckoutBreakdown17 {
  const servicesTotal = params.servicesTotal ?? 0;
  const discount = params.discount ?? 0;
  const beforeMin = params.listTotal + servicesTotal - discount;
  const minInvoiceAdj = Math.max(0, params.minInvoice - beforeMin);
  const payable = beforeMin + minInvoiceAdj;
  const goodsProfit = params.listTotal - params.purchaseTotal - params.courierFee;
  return { listTotal: params.listTotal, purchaseTotal: params.purchaseTotal, courierFee: params.courierFee, servicesTotal, discount, goodsProfit, beforeMin, minInvoiceAdj, payable };
}

// ─── گزارش روزانهٔ قیمت‌ها ──────────────────────────────────

interface ReportItem {
  productId: string;
  title: string;
  listPrice: number; // قیمت پایهٔ فروش جدید = گران‌ترین فروشگاه (پلن v3)
  oldPrice: number;
  basePrice: number; // ارزان‌ترین انبار — هدف خرید/تأمین (محرمانه)
  refPrice: number | null;
  rule: string; // V3-PLAN — سهم کارشناس + افزایش قیمت
  source: string;
  priceDate: string;
  fresh: boolean;
  changed: boolean;
}

/** تولید گزارش روزانه (پلن v3 — پیام ۱۴): برای همهٔ کالاهای فعال، پایهٔ فروش =
 *  گران‌ترین فروشگاه، هدف خرید = ارزان‌ترین انبار، موجودی = بروزترین انبار؛
 *  گیت تازگی (بعد از ۱۴۰۵/۰۸/۱۰) اعمال و گزارش برای تأیید ادمین ثبت می‌شود. */
export async function generateDailyReport(actor: string = 'SYSTEM'): Promise<{ id: string; itemCount: number; changedCount: number; staleCount: number; dateShamsi: string }> {
  const dateKey = tehranDateKey(new Date());
  const existing = await db.dailyPriceReport.findUnique({ where: { dateKey } });
  if (existing) {
    return { id: existing.id, itemCount: existing.itemCount, changedCount: 0, staleCount: 0, dateShamsi: existing.dateShamsi };
  }

  const s = await getSettings();
  const expertPct = Math.max((parseFloat(s.EXPERT_SHARE_PCT) || 18) / 100, 0.165);
  const platformPct = Math.min(Math.max((parseFloat(s.PLATFORM_MARGIN_PCT) || 12) / 100, 0.1), 0.165);
  const cutoff = freshCutoffJalaliKey(s.PRICE_FRESH_FROM);
  const cutoffLabel = freshCutoffLabel(s.PRICE_FRESH_FROM);

  const products = await db.product.findMany({
    where: { active: true, section: 'GOODS', priceStatus: { not: 'FROZEN' } },
    orderBy: { sortOrder: 'asc' },
  });

  // پلن v3: پیشنهادهای فعال فروشگاه‌ها (پایهٔ فروش) و انبارها (پایهٔ خرید + موجودی) ملاک است
  const offerRows = products.length
    ? await db.productOffer.findMany({ where: { productId: { in: products.map((p) => p.id) }, active: true } })
    : [];
  const offersBy = new Map<string, typeof offerRows>();
  for (const o of offerRows) {
    const arr = offersBy.get(o.productId) ?? [];
    arr.push(o);
    offersBy.set(o.productId, arr);
  }

  const items: ReportItem[] = products.map((p) => {
    const pos = offersBy.get(p.id) ?? [];
    const policy = computeOfferPolicy(
      pos.map((o) => ({
        side: (o.side as 'STORE' | 'WAREHOUSE') ?? 'STORE',
        offeredPrice: o.offeredPrice,
        negotiatedPrice: o.negotiatedPrice,
        stockQty: o.stockQty,
        storeName: o.storeName,
        fetchedAt: o.fetchedAt,
        active: o.active,
      })),
      { expertPct, platformPct }
    );
    if (policy.storeCount + policy.warehouseCount > 0) {
      const freshestShamsi = [...pos].sort((a, b) => (a.fetchedAt > b.fetchedAt ? -1 : 1))[0].fetchedShamsi || '';
      // فروش به قیمت گران‌ترین فروشگاه؛ بدون فروشگاه فعال ← قیمت ثبت‌شدهٔ فعلی (دستی/انبار)
      const listPrice = policy.sellBase ? roundPrice(policy.sellBase) : p.price;
      const srcParts: string[] = [];
      if (policy.sellBase) srcParts.push(`گران‌ترین فروشگاه: ${policy.sellBaseStore} (${policy.storeCount} فروشگاه)`);
      if (policy.buyTarget) srcParts.push(`ارزان‌ترین انبار: ${policy.buyTargetStore} (${policy.warehouseCount} انبار)`);
      if (policy.freshestStockWarehouse) srcParts.push(`موجودی از بروزترین انبار: ${policy.freshestStockWarehouse}`);
      return {
        productId: p.id,
        title: p.nameFa,
        listPrice,
        oldPrice: p.price,
        basePrice: policy.buyTarget ?? p.basePrice,
        refPrice: policy.sellBase,
        rule: PRICE_RULE_V3,
        source: srcParts.join(' | ') || p.baseSource || '—',
        priceDate: freshestShamsi,
        fresh: isPriceFresh(freshestShamsi, cutoff),
        changed: listPrice !== p.price,
      };
    }
    const fresh = isPriceFresh(p.priceDate, cutoff);
    return {
      productId: p.id,
      title: p.nameFa,
      listPrice: p.price,
      oldPrice: p.price,
      basePrice: p.basePrice,
      refPrice: p.refPrice ?? null,
      rule: p.priceRule === 'MANUAL' ? 'MANUAL' : PRICE_RULE_V3,
      source: p.baseSource ?? '—',
      priceDate: p.priceDate ?? '',
      fresh,
      changed: false,
    };
  });

  const changedCount = items.filter((i) => i.changed).length;
  const staleCount = items.filter((i) => !i.fresh).length;
  const report = await db.dailyPriceReport.create({
    data: {
      dateKey,
      dateShamsi: formatJalali(new Date(), 'en'),
      itemsJson: JSON.stringify(items),
      itemCount: items.length,
      status: 'PENDING',
    },
  });

  await queueReport(
    'SYSTEM',
    `گزارش روزانهٔ قیمت میز کالا (پلن v3) — ${report.dateShamsi}`,
    [
      `گزارش قیمت‌گذاری روزانهٔ میز کالا — پلن v3 (طبق تقویم ${report.dateShamsi})`,
      `مرز تازگی قیمت‌ها: ${cutoffLabel} — فقط قیمت‌های بعد از این تاریخ معتبرند (پیام ۱۲)`,
      `پلن افزودنی پرداخت: سهم کارشناس ${(expertPct * 100).toLocaleString('fa-IR')}٪ + افزایش قیمت پلتفرم ${(platformPct * 100).toLocaleString('fa-IR')}٪ (پلن ۳۳٪ حذف شده است)`,
      `تعداد اقلام بررسی‌شده: ${items.length}`,
      `اقلام با پایهٔ فروش جدید (گران‌ترین فروشگاه): ${changedCount}`,
      `اقلام با قیمت کهنه (نیاز به استعلام روز انبار): ${staleCount}`,
      '',
      ...items.filter((i) => i.changed).slice(0, 30).map(
        (i) => `• ${i.title}: ${i.oldPrice.toLocaleString('fa-IR')} → ${i.listPrice.toLocaleString('fa-IR')} تومان (پایهٔ فروش=گران‌ترین فروشگاه | ${i.source}${i.fresh ? '' : ' | ⚠ کهنه'})`
      ),
      ...items.filter((i) => !i.fresh && !i.changed).slice(0, 20).map(
        (i) => `⚠ ${i.title}: قیمت ثبت‌شده «${i.priceDate || 'بدون تاریخ'}» است — باید با استعلام تازهٔ انبار (بعد از ${cutoffLabel}) بروزرسانی شود`
      ),
      '',
      'پس از تأیید ادمین، پایهٔ فروش جدید (گران‌ترین فروشگاه) در میز کالا لحاظ می‌شود؛ افزودنی پرداخت = سهم کارشناس + افزایش قیمت و هزینهٔ پیک فقط در صفحهٔ پرداخت اعمال می‌شود.',
    ].join('\n')
  );

  return { id: report.id, itemCount: items.length, changedCount, staleCount, dateShamsi: report.dateShamsi };
}

/** تأیید گزارش روزانه توسط ادمین → لحاظ شدن قیمت‌های نمایشی جدید در میز کالا */
export async function applyDailyReport(reportId: string, approvedBy: string): Promise<{ applied: number }> {
  const report = await db.dailyPriceReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error('گزارش یافت نشد');
  if (report.status === 'APPLIED') return { applied: 0 };
  const items: ReportItem[] = JSON.parse(report.itemsJson);
  let applied = 0;
  for (const it of items) {
    if (!it.changed) continue;
    await db.product.update({
      where: { id: it.productId },
      data: {
        price: it.listPrice, // پایهٔ فروش = گران‌ترین فروشگاه (پلن v3)
        priceRule: PRICE_RULE_V3,
        priceUpdatedAt: new Date(),
        // تاریخ قیمت = تاریخ ثبت قیمت در مرجع (نه تاریخ تأیید) تا گیت تازگی صادق بماند
        priceDate: it.priceDate || priceStamp(),
      },
    });
    // ثبت پیشنهاد تأییدشده برای ردّ قیمت‌گذاری
    await db.productPriceProposal.create({
      data: {
        productId: it.productId,
        oldPrice: it.oldPrice,
        newPrice: it.listPrice,
        basePrice: it.basePrice,
        rule: it.rule,
        reason: `گزارش روزانهٔ ${report.dateShamsi} — پلن v3: پایهٔ فروش=گران‌ترین فروشگاه، افزودنی پرداخت=کارشناس+پلتفرم`,
        source: 'DAILY_REPORT',
        status: 'APPROVED',
        proposedBy: actorName(approvedBy),
        decidedBy: approvedBy,
        decidedAt: new Date(),
        appliedAt: new Date(),
      },
    });
    applied += 1;
  }
  await db.dailyPriceReport.update({
    where: { id: reportId },
    data: { status: 'APPLIED', approvedBy, approvedAt: new Date() },
  });
  return { applied };
}

function actorName(ref: string): string {
  return ref.startsWith('OWNER') ? 'مالک' : ref.startsWith('ADMIN') ? 'ادمین' : 'کارشناس';
}

/** پیشنهاد قیمت از سوی کارشناس → در انتظار تأیید پشتیبانی/ادمین (پایهٔ فروش دستی) */
export async function proposeExpertPrice(productId: string, newPrice: number, reason: string | null, proposedBy: string) {
  const p = await db.product.findUnique({ where: { id: productId } });
  if (!p) throw new Error('کالا یافت نشد');
  return db.productPriceProposal.create({
    data: {
      productId,
      oldPrice: p.price,
      newPrice,
      basePrice: p.basePrice,
      rule: 'MANUAL',
      reason,
      source: proposedBy.includes('OWNER') ? 'EXPERT' : 'EXPERT',
      status: 'PENDING',
      proposedBy,
    },
  });
}

/** اعمال یک پیشنهاد تأییدشده */
export async function applyProposal(proposalId: string, decidedBy: string, approve: boolean): Promise<boolean> {
  const pr = await db.productPriceProposal.findUnique({ where: { id: proposalId } });
  if (!pr || pr.status !== 'PENDING') return false;
  if (approve) {
    await db.product.update({
      where: { id: pr.productId },
      data: { price: pr.newPrice, priceRule: pr.rule ?? 'MANUAL', priceUpdatedAt: new Date(), priceDate: priceStamp() },
    });
    await db.productPriceProposal.update({
      where: { id: proposalId },
      data: { status: 'APPROVED', decidedBy, decidedAt: new Date(), appliedAt: new Date() },
    });
  } else {
    await db.productPriceProposal.update({
      where: { id: proposalId },
      data: { status: 'REJECTED', decidedBy, decidedAt: new Date() },
    });
  }
  return true;
}
