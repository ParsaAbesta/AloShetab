// ─── پیام ۱۴ (v3.0): موتور سیاست قیمت — انبارها و فروشگاه‌ها ──
// پلن جدید مالک (پلن ۳۳٪ حذف شد):
//  ۱) «لیست بروزترین قیمت بروزترین انبارها» — برای هر کالا، تازه‌ترین قیمتِ
//     هر انبار فعال ملاک است و فهرست کامل در میز محصولات نمایش داده می‌شود.
//  ۲) «موجودی فقط از بروزترین موجودی انبارها» — عدد موجودی هر کالا فقط از
//     تازه‌ترین استعلام انبار خوانده می‌شود؛ هرگز از رکوردهای کهنه.
//  ۳) «خرید از پائین‌ قیمت‌ترین انبارها» — هدف خرید/تأمین = ارزان‌ترین انبار
//     (بر مبنای قیمت توافقی در صورت وجود، وگرنه قیمت انبار).
//  ۴) «فروش به قیمت گران‌ترین فروشگاه‌ها» — پایهٔ فروش هر کالا = بالاترین
//     قیمت ارائه‌شدهٔ بین فروشگاه‌ها (دیجی‌کالا، اسنپ، ...).
//  ۵) ساختار افزودنی پرداخت: سهم کارشناس ۱۶٫۵ تا ۲۰ درصد یا بیشتر +
//     افزایش قیمت پلتفرم ۱۰ تا ۱۶٫۵ درصد — مجموع ۲۶٫۵ تا ۳۶٫۵٪ (یا بیشتر).
//  ۶) «قیمت‌ها از بروزترین‌ها بروز شود» — تازه‌ترین استعلامِ هر مجموعه ملاک است
//     و گیت تازگی (فقط بعد از ۱۴۰۵/۰۸/۱۰) در لایهٔ بالاتر اعمال می‌شود.
// قیمت توافقی خرید (negotiatedPrice) محرمانه است و فقط در پنل ادمین نمایش داده می‌شود.

export type OfferSide = 'STORE' | 'WAREHOUSE';

export interface OfferLike {
  side?: OfferSide; // پیش‌فرض STORE (سازگار با رکوردهای پیام ۱۳)
  offeredPrice: number;
  negotiatedPrice?: number | null;
  stockQty?: number | null;
  storeName: string;
  fetchedAt: Date | string;
  active: boolean;
}

/** یک سطر «لیست بروزترین قیمت انبارها» در میز محصولات */
export interface WarehousePriceLine {
  name: string;
  price: number; // قیمت انبار (ارائه‌شده) — عمومی
  stockQty: number | null; // موجودی ثبت‌شده در همان استعلام
  fetchedAt: string; // ISO
  shamsi?: string; // تاریخ شمسی (در صورت پاس دادن)
}

export interface OfferPolicy {
  storeCount: number; // تعداد فروشگاه‌های فعال
  warehouseCount: number; // تعداد انبارهای فعال
  sellBase: number | null; // قیمت گران‌ترین فروشگاه — پایهٔ فروش
  sellBaseStore: string | null;
  buyTarget: number | null; // ارزان‌ترین انبار — پایهٔ خرید/تأمین (محرمانه)
  buyTargetStore: string | null;
  margin: number | null; // sellBase − buyTarget — محرمانه داخلی ادمین
  warehousePrices: WarehousePriceLine[]; // لیست بروزترین قیمت بروزترین انبارها (ارزان‌ترین اول)
  freshestStock: number | null; // موجودی فقط از بروزترین انبار
  freshestStockWarehouse: string | null;
  freshestStockAt: string | null;
  freshestAt: string | null; // ISO تازه‌ترین استعلام
  expertPct: number; // سهم کارشناس (۰٫۱۶۵ تا ۰٫۲+)
  platformPct: number; // افزایش قیمت پلتفرم (۰٫۱ تا ۰٫۱۶۵)
  markupPct: number; // جمع افزودنی پرداخت
}

const asTs = (v: Date | string): number => new Date(v).getTime();

/** بروزترین استعلامِ هر مجموعه (قیمت‌ها از بروزترین‌ها بروز شود) */
function freshestPerSource(offers: OfferLike[], side: OfferSide): OfferLike[] {
  const per = new Map<string, OfferLike>();
  for (const o of offers) {
    if (!o.active || o.offeredPrice <= 0) continue;
    if ((o.side ?? 'STORE') !== side) continue;
    const prev = per.get(o.storeName);
    if (!prev || asTs(o.fetchedAt) > asTs(prev.fetchedAt)) per.set(o.storeName, o);
  }
  return [...per.values()];
}

/** سیاست v3 از روی پیشنهادهای فعال فروشگاه‌ها و انبارها */
export function computeOfferPolicy(
  offers: OfferLike[],
  opts?: { expertPct?: number; platformPct?: number }
): OfferPolicy {
  // پیش‌فرض پلن: کارشناس ۱۸٪ + پلتفرم ۱۲٪ (در بازه‌های مجاز پیام ۱۴)
  const expertPct = Math.max(opts?.expertPct ?? 0.18, 0.165);
  const platformPct = Math.min(Math.max(opts?.platformPct ?? 0.12, 0.1), 0.165);
  const empty: OfferPolicy = {
    storeCount: 0, warehouseCount: 0,
    sellBase: null, sellBaseStore: null, buyTarget: null, buyTargetStore: null, margin: null,
    warehousePrices: [], freshestStock: null, freshestStockWarehouse: null, freshestStockAt: null,
    freshestAt: null, expertPct, platformPct, markupPct: expertPct + platformPct,
  };

  // ── فروش: بروزترین استعلام هر فروشگاه → گران‌ترین قیمت ارائه‌شده ──
  const stores = freshestPerSource(offers, 'STORE');
  let sellBase = 0;
  let sellBaseStore = '';
  for (const o of stores) {
    if (o.offeredPrice > sellBase) {
      sellBase = o.offeredPrice;
      sellBaseStore = o.storeName;
    }
  }

  // ── خرید: بروزترین استعلام هر انبار → ارزان‌ترین قیمت (توافقی اگر ثبت شده) ──
  const warehouses = freshestPerSource(offers, 'WAREHOUSE');
  let buyTarget = Infinity;
  let buyTargetStore = '';
  const warehousePrices: WarehousePriceLine[] = warehouses.map((o) => ({
    name: o.storeName,
    price: o.offeredPrice,
    stockQty: o.stockQty ?? null,
    fetchedAt: new Date(o.fetchedAt).toISOString(),
    shamsi: (o as { shamsi?: string }).shamsi,
  }));
  for (const o of warehouses) {
    const t = o.negotiatedPrice && o.negotiatedPrice > 0 ? Math.min(o.negotiatedPrice, o.offeredPrice) : o.offeredPrice;
    if (t < buyTarget) {
      buyTarget = t;
      buyTargetStore = o.storeName;
    }
  }
  warehousePrices.sort((a, b) => a.price - b.price); // ارزان‌ترین انبار اول

  // ── موجودی: فقط از بروزترین استعلام انبار (مستقل از ارزان‌ترین قیمت) ──
  let freshestStock: number | null = null;
  let freshestStockWarehouse: string | null = null;
  let freshestStockAt: string | null = null;
  for (const o of warehouses) {
    if (o.stockQty == null) continue;
    const t = new Date(o.fetchedAt).toISOString();
    if (!freshestStockAt || t > freshestStockAt) {
      freshestStockAt = t;
      freshestStock = o.stockQty;
      freshestStockWarehouse = o.storeName;
    }
  }

  const freshestAll = [...stores, ...warehouses];
  const freshestAt = freshestAll.length
    ? freshestAll.reduce<string | null>((acc, o) => {
        const t = new Date(o.fetchedAt).toISOString();
        return !acc || t > acc ? t : acc;
      }, null)
    : null;

  return {
    storeCount: stores.length,
    warehouseCount: warehouses.length,
    sellBase: sellBase || null,
    sellBaseStore: sellBaseStore || null,
    buyTarget: Number.isFinite(buyTarget) ? buyTarget : null,
    buyTargetStore: buyTargetStore || null,
    margin: Number.isFinite(buyTarget) ? sellBase - buyTarget : null,
    warehousePrices,
    freshestStock, freshestStockWarehouse, freshestStockAt,
    freshestAt,
    expertPct, platformPct, markupPct: expertPct + platformPct,
  };
}
