import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { logActivity } from '@/lib/reports';
import { computeOfferPolicy } from '@/lib/policy';
import { isPriceFresh, freshCutoffJalaliKey, freshCutoffLabel, priceStamp, roundPrice, PRICE_RULE_V3 } from '@/lib/inventory';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** پیشنهادهای قیمت یک کالا + خلاصهٔ سیاست پلن v3:
 *  فروش = گران‌ترین فروشگاه | خرید = ارزان‌ترین انبار | موجودی = بروزترین انبار */
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');
  if (!productId) return NextResponse.json({ error: 'NO_PRODUCT', message: 'شناسهٔ کالا لازم است' }, { status: 400 });

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, key: true, nameFa: true, price: true, basePrice: true, refPrice: true, priceRule: true, priceDate: true, priceStatus: true, section: true },
  });
  if (!product) return NextResponse.json({ error: 'NOT_FOUND', message: 'کالا یافت نشد' }, { status: 404 });

  const offers = await db.productOffer.findMany({
    where: { productId },
    orderBy: { fetchedAt: 'desc' },
    include: { store: { select: { id: true, nameFa: true, website: true, feedType: true } } },
  });

  const s = await getSettings();
  const expertPct = Math.max((parseFloat(s.EXPERT_SHARE_PCT) || 18) / 100, 0.165);
  const platformPct = Math.min(Math.max((parseFloat(s.PLATFORM_MARGIN_PCT) || 12) / 100, 0.1), 0.165);
  const policy = computeOfferPolicy(
    offers.map((o) => ({
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

  const stores = await db.store.findMany({ where: { active: true }, select: { id: true, nameFa: true, feedType: true } });
  const warehouses = await db.warehouse.findMany({ where: { active: true }, select: { id: true, nameFa: true, kind: true } });

  return NextResponse.json({ product, offers, policy, stores, warehouses });
}

const addSchema = z.object({
  action: z.literal('add'),
  productId: z.string().trim().min(1),
  storeId: z.string().trim().optional().nullable(),
  storeName: z.string().trim().min(2).max(120),
  // پیام ۱۴: side — فروشگاه (پایهٔ فروش) یا انبار (پایهٔ خرید + موجودی)
  side: z.enum(['STORE', 'WAREHOUSE']).default('STORE'),
  offeredPrice: z.number().int().min(1000).max(99_999_999_999),
  negotiatedPrice: z.number().int().min(0).max(99_999_999_999).optional().nullable(),
  stockQty: z.number().int().min(0).max(1_000_000).optional().nullable(), // موجودی انبار در لحظهٔ استعلام
  sourceUrl: z.string().trim().max(500).optional().nullable(),
  fetchedShamsi: z.string().trim().max(10).optional().nullable(), // 1405/08/27 — پیش‌فرض امروز
  note: z.string().trim().max(300).optional().nullable(),
});

const deactivateSchema = z.object({ action: z.literal('deactivate'), offerId: z.string().trim().min(1) });

const applySchema = z.object({ action: z.literal('apply-policy'), productId: z.string().trim().min(1) });

/** افزودن پیشنهاد قیمت (فروشگاه/انبار)، غیرفعال‌سازی، و اعمال سیاست پلن v3 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = await req.json().catch(() => null);

  const add = addSchema.safeParse(body);
  if (add.success) {
    const d = add.data;
    const s = await getSettings();
    const cutoff = freshCutoffJalaliKey(s.PRICE_FRESH_FROM);
    const shamsi = d.fetchedShamsi?.trim() || priceStamp();
    // گیت تازگی — فقط قیمت‌های بعد از مرز تنظیم‌شده (پیام ۱۲)
    if (!isPriceFresh(shamsi, cutoff)) {
      return NextResponse.json(
        { error: 'PRICE_STALE', message: `تاریخ قیمت باید بعد از ${freshCutoffLabel(s.PRICE_FRESH_FROM)} باشد (فقط قیمت‌های تازه).` },
        { status: 400 }
      );
    }
    const product = await db.product.findUnique({ where: { id: d.productId }, select: { id: true, nameFa: true } });
    if (!product) return NextResponse.json({ error: 'NOT_FOUND', message: 'کالا یافت نشد' }, { status: 404 });
    if (d.side === 'WAREHOUSE' && d.stockQty == null) {
      return NextResponse.json(
        { error: 'STOCK_REQUIRED', message: 'برای استعلام انبار، ثبت موجودی در لحظهٔ استعلام الزامی است (موجودی فقط از بروزترین انبار).' },
        { status: 400 }
      );
    }

    const offer = await db.productOffer.create({
      data: {
        productId: d.productId,
        side: d.side,
        // storeId فقط به Store ارجاع می‌دهد؛ استعلام انبار با نام ثبت می‌شود
        storeId: d.side === 'WAREHOUSE' ? null : (d.storeId || null),
        storeName: d.storeName,
        offeredPrice: d.offeredPrice,
        negotiatedPrice: d.negotiatedPrice ?? null,
        stockQty: d.side === 'WAREHOUSE' ? (d.stockQty ?? null) : null,
        sourceUrl: d.sourceUrl ?? null,
        fetchedAt: new Date(),
        fetchedShamsi: shamsi,
        source: 'MANUAL',
        note: d.note ?? null,
      },
    });
    await logActivity('ADMIN', `${d.side === 'WAREHOUSE' ? 'استعلام انبار' : 'پیشنهاد فروشگاه'} برای ${product.nameFa}`, `${d.storeName}: قیمت ${d.offeredPrice.toLocaleString('fa-IR')}${d.side === 'WAREHOUSE' ? ` | موجودی ${d.stockQty ?? '—'}` : ''} | توافقی ${d.negotiatedPrice?.toLocaleString('fa-IR') ?? '—'} | ${shamsi}`);
    return NextResponse.json({ ok: true, offer });
  }

  const deact = deactivateSchema.safeParse(body);
  if (deact.success) {
    const o = await db.productOffer.update({ where: { id: deact.data.offerId }, data: { active: false } });
    await logActivity('ADMIN', 'غیرفعال‌سازی پیشنهاد قیمت', `${o.storeName} — ${o.offeredPrice.toLocaleString('fa-IR')}`);
    return NextResponse.json({ ok: true });
  }

  const apply = applySchema.safeParse(body);
  if (apply.success) {
    // اعمال سیاست پلن v3 (پیام ۱۴): پایهٔ فروش = گران‌ترین فروشگاه؛
    // پایهٔ خرید/تأمین = ارزان‌ترین انبار (محرمانه)؛ افزودنی پرداخت = کارشناس + پلتفرم.
    const s = await getSettings();
    const offers = await db.productOffer.findMany({ where: { productId: apply.data.productId, active: true } });
    const expertPct = Math.max((parseFloat(s.EXPERT_SHARE_PCT) || 18) / 100, 0.165);
    const platformPct = Math.min(Math.max((parseFloat(s.PLATFORM_MARGIN_PCT) || 12) / 100, 0.1), 0.165);
    const policy = computeOfferPolicy(
      offers.map((o) => ({
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
    if (policy.storeCount === 0 || !policy.sellBase) {
      return NextResponse.json({ error: 'NO_OFFERS', message: 'هیچ پیشنهاد فعالی از فروشگاه‌ها برای این کالا ثبت نشده است — پایهٔ فروش لازم است' }, { status: 409 });
    }
    const product = await db.product.findUnique({ where: { id: apply.data.productId } });
    if (!product) return NextResponse.json({ error: 'NOT_FOUND', message: 'کالا یافت نشد' }, { status: 404 });

    const freshestShamsi = offers.sort((a, b) => (a.fetchedAt > b.fetchedAt ? -1 : 1))[0].fetchedShamsi || priceStamp();
    const sellBase = roundPrice(policy.sellBase);
    const stockNote = policy.freshestStockWarehouse ? ` | موجودی از بروزترین انبار: ${policy.freshestStockWarehouse}` : '';
    const updated = await db.product.update({
      where: { id: apply.data.productId },
      data: {
        price: sellBase, // پایهٔ فروش = قیمت گران‌ترین فروشگاه (پلن v3)
        basePrice: policy.buyTarget ?? product.basePrice, // ارزان‌ترین انبار — پایهٔ خرید/تأمین (محرمانه)
        refPrice: sellBase,
        refSource: `گران‌ترین فروشگاه بین ${policy.storeCount} فروشگاه (${policy.sellBaseStore ?? '—'}) — پلن v3`,
        baseSource: policy.buyTargetStore
          ? `ارزان‌ترین انبار از ${policy.warehouseCount} انبار (${policy.buyTargetStore})${stockNote}`
          : product.baseSource,
        priceRule: PRICE_RULE_V3,
        priceDate: freshestShamsi, // تازگی از بروزترین استعلام
        priceUpdatedAt: new Date(),
      },
    });
    // ردّ شفاف تغییر قیمت در سابقهٔ پیشنهادها
    await db.productPriceProposal.create({
      data: {
        productId: apply.data.productId,
        oldPrice: product.price,
        newPrice: sellBase,
        basePrice: policy.buyTarget ?? product.basePrice,
        rule: PRICE_RULE_V3,
        reason: `پلن v3 — فروش به گران‌ترین فروشگاه (${policy.sellBaseStore}) / خرید از ارزان‌ترین انبار (${policy.buyTargetStore ?? '—'})${stockNote}`,
        source: 'EXPERT',
        status: 'APPROVED',
        proposedBy: 'POLICY:V3',
        decidedBy: 'ADMIN_PANEL',
        decidedAt: new Date(),
        appliedAt: new Date(),
      },
    });
    await logActivity('ADMIN', `اعمال پلن v3 روی ${updated.nameFa}`, `پایهٔ فروش: ${sellBase.toLocaleString('fa-IR')} | خرید از: ${policy.buyTargetStore ?? '—'} | افزودنی پرداخت: کارشناس ${(policy.expertPct * 100).toLocaleString('fa-IR')}٪ + پلتفرم ${(policy.platformPct * 100).toLocaleString('fa-IR')}٪${stockNote}`);
    return NextResponse.json({ ok: true, product: updated, policy: { ...policy, sellBase } });
  }

  return NextResponse.json({ error: 'INVALID_ACTION', message: 'عملیات نامعتبر است' }, { status: 400 });
}
