import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { isPriceFresh, freshCutoffJalaliKey, freshCutoffLabel, courierFeeFor, roundPrice, PRICE_RULE_V3 } from '@/lib/inventory';
import { HEAVY_GOODS_CATEGORIES } from '@/lib/constants';
import { computeOfferPolicy } from '@/lib/policy';

export const dynamic = 'force-dynamic';

/** فهرست میز محصولات — دو بخش: نرم‌افزار (SOFTWARE) و کالا (GOODS)
 *  پلن v3 (پیام ۱۴) — پلن ۳۳٪ حذف شد:
 *  • پایهٔ فروش هر کالا = «قیمت گران‌ترین فروشگاه» (بروزترین استعلام هر فروشگاه)
 *  • «لیست بروزترین قیمت بروزترین انبارها» برای هر کالا نمایش داده می‌شود
 *  • «موجودی فقط از بروزترین موجودی انبارها» — عدد موجودی از تازه‌ترین استعلام انبار
 *  • افزودنی پرداخت = سهم کارشناس (۱۶٫۵–۲۰٪+) + افزایش قیمت پلتفرم (۱۰–۱۶٫۵٪)
 *    + هزینهٔ ارسال و بسته‌بندی (پیک) — فقط در صفحهٔ پرداخت
 *  فقط قیمت‌های تازه (از ۱۴۰۵/۰۸/۱۰ = ۲۰۲۶/۱۱/۰۱ به بعد) نمایش داده می‌شوند. */
export async function GET() {
  const s = await getSettings();
  const cutoff = freshCutoffJalaliKey(s.PRICE_FRESH_FROM);
  const minInvoice = parseInt(s.MIN_INVOICE_AMOUNT || '5000000', 10) || 5000000;
  const courierSmall = parseInt(s.COURIER_FEE_SMALL || '250000', 10) || 250000;
  const courierHeavy = parseInt(s.COURIER_FEE_HEAVY || '750000', 10) || 750000;
  const expertPct = Math.max((parseFloat(s.EXPERT_SHARE_PCT) || 18) / 100, 0.165);
  const platformPct = Math.min(Math.max((parseFloat(s.PLATFORM_MARGIN_PCT) || 12) / 100, 0.1), 0.165);

  const rows = await db.product.findMany({
    where: { active: true, priceStatus: { not: 'FROZEN' } },
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true, key: true, nameFa: true, nameEn: true, descFa: true, descEn: true,
      price: true, icon: true, warranty: true,
      section: true, category: true, brand: true, model: true,
      basePrice: true, baseSource: true, sourceUrl: true, priceDate: true, priceRule: true,
      refPrice: true, refSource: true,
      priceStatus: true, stock: true, priceUpdatedAt: true,
      warehouse: { select: { nameFa: true, website: true, linkTemplate: true } },
    },
  });

  // پلن v3: پیشنهادهای فعال فروشگاه‌ها + انبارها برای هر کالا
  const ids = rows.map((p) => p.id);
  const offerRows = ids.length
    ? await db.productOffer.findMany({ where: { productId: { in: ids }, active: true } })
    : [];
  const offersBy = new Map<string, typeof offerRows>();
  for (const o of offerRows) {
    const arr = offersBy.get(o.productId) ?? [];
    arr.push(o);
    offersBy.set(o.productId, arr);
  }

  // گیت تازگی — قیمت‌های کهنه (قبل از مرز تنظیم‌شده) نمایش داده نمی‌شوند
  const freshRows = rows.filter((p) => isPriceFresh(p.priceDate, cutoff));

  const products = freshRows.map((p) => {
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
        shamsi: o.fetchedShamsi,
      })),
      { expertPct, platformPct }
    );

    // پایهٔ فروش = گران‌ترین فروشگاه؛ بدون فروشگاه فعال ← قیمت ثبت‌شدهٔ کالا (دستی/انبار)
    const sellBase = policy.sellBase ? roundPrice(policy.sellBase) : p.price;
    // موجودی فقط از بروزترین استعلام انبار (fallback: موجودی ثبت‌شدهٔ کالا)
    const stock = policy.freshestStock ?? p.stock;
    const courierFee = courierFeeFor(p.category, p.section, courierSmall, courierHeavy);
    const cheapestWarehouse = policy.warehousePrices[0] ?? null; // ارزان‌ترین انبار (لیست، بدون قیمت توافقی)

    return {
      ...p,
      price: sellBase, // پایهٔ فروش = گران‌ترین فروشگاه
      priceRule: PRICE_RULE_V3,
      stock,
      stockSource: policy.freshestStockWarehouse, // نام انبار بروزترین موجودی
      stockDate: policy.freshestStockAt,
      offersCount: policy.storeCount + policy.warehouseCount, // مجموعه‌های مقایسه‌شده
      sellBaseStore: policy.sellBaseStore, // نام گران‌ترین فروشگاه (مرجع پایهٔ فروش)
      warehousePrices: policy.warehousePrices.map((w) => ({
        name: w.name,
        price: w.price,
        stockQty: w.stockQty,
        shamsi: w.shamsi ?? null,
      })), // لیست بروزترین قیمت بروزترین انبارها — ارزان‌ترین اول (قیمت توافقی محرمانه می‌ماند)
      buyWarehouse: cheapestWarehouse ? { name: cheapestWarehouse.name, price: cheapestWarehouse.price } : null,
      expertSharePct: policy.expertPct,
      platformMarginPct: policy.platformPct,
      markupPct: policy.markupPct,
      courierFee,
      priceHint:
        p.section === 'SOFTWARE'
          ? { courierFee: 0, note: 'ارسال دیجیتال — بدون هزینهٔ پیک' }
          : { courierFee, note: HEAVY_GOODS_CATEGORIES.some((c) => p.category.includes(c)) ? 'کالای سنگین' : 'کالای سبک' },
    };
  });

  const goods = products.filter((p) => p.section === 'GOODS');
  const software = products.filter((p) => p.section === 'SOFTWARE');
  return NextResponse.json({
    products,
    goods,
    software,
    checkout: {
      minInvoice,
      freshFromIso: s.PRICE_FRESH_FROM,
      freshFromJalali: freshCutoffLabel(s.PRICE_FRESH_FROM),
      expertSharePct: expertPct, // سهم کارشناس — ۱۶٫۵ تا ۲۰٪ یا بیشتر
      platformMarginPct: platformPct, // افزایش قیمت پلتفرم — ۱۰ تا ۱۶٫۵٪
      markupPctTotal: expertPct + platformPct,
    },
  });
}
