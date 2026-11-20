import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, getSession, unauthorized } from '@/lib/adminAuth';
import { priceStamp, proposeExpertPrice, applyProposal, PRICE_RULE_V3 } from '@/lib/inventory';
import { logActivity } from '@/lib/reports';
import { computeOfferPolicy } from '@/lib/policy';
import { validateCard } from '@/lib/accounts';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** فهرست موجودی میز کالا + نرم‌افزار (پنل ادمین) — پلن v3 (پیام ۱۴):
 *  برای هر کالا خلاصهٔ سیاست ضمیمه می‌شود: فروش = گران‌ترین فروشگاه،
 *  خرید = ارزان‌ترین انبار، موجودی = بروزترین انبار، افزودنی = کارشناس + پلتفرم */
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section');
  const products = await db.product.findMany({
    where: section ? { section } : {},
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    include: {
      warehouse: { select: { id: true, nameFa: true, website: true, phone: true, address: true, linkTemplate: true, verified: true, priceListFresh: true } },
      priceProposals: { where: { status: 'PENDING' }, select: { id: true, newPrice: true, status: true } },
    },
  });

  const s = await getSettings();
  const ids = products.map((p) => p.id);
  const offers = ids.length ? await db.productOffer.findMany({ where: { productId: { in: ids }, active: true } }) : [];
  const byProduct = new Map<string, typeof offers>();
  for (const o of offers) {
    const arr = byProduct.get(o.productId) ?? [];
    arr.push(o);
    byProduct.set(o.productId, arr);
  }
  const expertPct = Math.max((parseFloat(s.EXPERT_SHARE_PCT) || 18) / 100, 0.165);
  const platformPct = Math.min(Math.max((parseFloat(s.PLATFORM_MARGIN_PCT) || 12) / 100, 0.1), 0.165);

  const rows = products.map((p) => {
    const pos = byProduct.get(p.id) ?? [];
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
    return {
      ...p,
      offersSummary: {
        storeCount: policy.storeCount,
        warehouseCount: policy.warehouseCount,
        count: policy.storeCount + policy.warehouseCount, // سازگاری با رابط قبلی
        sellBase: policy.sellBase, // گران‌ترین فروشگاه (پایهٔ فروش)
        sellBaseStore: policy.sellBaseStore,
        buyTarget: policy.buyTarget, // ارزان‌ترین انبار (خرید/تأمین) — محرمانه داخلی
        buyTargetStore: policy.buyTargetStore,
        freshestStock: policy.freshestStock, // موجودی فقط از بروزترین انبار
        freshestStockWarehouse: policy.freshestStockWarehouse,
        warehousePrices: policy.warehousePrices, // لیست بروزترین قیمت انبارها
        freshestShamsi: pos.sort((a, b) => (a.fetchedAt > b.fetchedAt ? -1 : 1))[0]?.fetchedShamsi ?? null,
        expertPct: policy.expertPct,
        platformPct: policy.platformPct,
      },
    };
  });
  return NextResponse.json({ products: rows });
}

const createSchema = z.object({
  action: z.literal('create'),
  key: z.string().trim().min(2).max(60),
  nameFa: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().max(120).default(''),
  descFa: z.string().trim().max(1000).default(''),
  descEn: z.string().trim().max(1000).default(''),
  section: z.enum(['GOODS', 'SOFTWARE']).default('GOODS'),
  category: z.string().trim().max(60).default('سایر'),
  brand: z.string().trim().max(60).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable(),
  basePrice: z.number().int().min(0).max(999_999_999_9).default(0),
  baseSource: z.string().trim().max(120).optional().nullable(),
  sourceUrl: z.string().trim().max(500).optional().nullable(),
  refPrice: z.number().int().min(0).max(999_999_999_9).optional().nullable(),
  refSource: z.string().trim().max(120).optional().nullable(),
  warehouseId: z.string().trim().optional().nullable(),
  stock: z.number().int().min(0).max(9999).default(5),
  warranty: z.string().trim().max(120).optional().nullable(),
  icon: z.string().trim().max(40).default('package'),
});

const priceSchema = z.object({
  action: z.literal('propose-price'),
  productId: z.string().trim().min(1),
  newPrice: z.number().int().min(1000).max(999_999_999_9),
  reason: z.string().trim().max(300).optional().nullable(),
});

const decideSchema = z.object({
  action: z.literal('decide-proposal'),
  proposalId: z.string().trim().min(1),
  approve: z.boolean(),
});

const patchSchema = z.object({
  action: z.literal('patch'),
  productId: z.string().trim().min(1),
  active: z.boolean().optional(),
  stock: z.number().int().min(0).max(9999).optional(),
  basePrice: z.number().int().min(0).max(999_999_999_9).optional(),
  refPrice: z.number().int().min(0).max(999_999_999_9).optional().nullable(),
  baseSource: z.string().trim().max(120).optional().nullable(),
  sourceUrl: z.string().trim().max(500).optional().nullable(),
  priceStatus: z.enum(['ACTIVE', 'PENDING_REVIEW', 'FROZEN']).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

/** ایجاد کالا، پیشنهاد قیمت کارشناس، تصمیم پیشنهاد، ویرایش موجودی */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const session = await getSession();
  const body = await req.json().catch(() => null);

  const createParsed = createSchema.safeParse(body);
  if (createParsed.success) {
    const d = createParsed.data;
    const key = d.section === 'GOODS' ? d.key.toLowerCase().replace(/\s+/g, '-') : d.key;
    const product = await db.product.create({
      data: {
        key, nameFa: d.nameFa, nameEn: d.nameEn || d.nameFa,
        descFa: d.descFa, descEn: d.descEn || d.descFa,
        price: d.basePrice || d.refPrice || 0, // پایهٔ فروش اولیه = قیمت مرجع/انبار (بدون افزودنی)
        icon: d.icon, warranty: d.warranty ?? null,
        section: d.section, category: d.category,
        brand: d.brand ?? null, model: d.model ?? null,
        basePrice: d.basePrice, baseSource: d.baseSource ?? null,
        sourceUrl: d.sourceUrl ?? null,
        refPrice: d.refPrice ?? null, refSource: d.refSource ?? null,
        priceRule: d.section === 'GOODS' ? PRICE_RULE_V3 : 'MANUAL',
        priceDate: priceStamp(),
        priceUpdatedAt: new Date(),
        stock: d.stock,
        warehouseId: d.warehouseId || null,
      },
    });
    await logActivity('ADMIN', `افزودن کالای ${product.nameFa} به میز ${d.section === 'GOODS' ? 'کالا' : 'نرم‌افزار'}`, `پایهٔ فروش: ${product.price} (${PRICE_RULE_V3})`);
    return NextResponse.json({ ok: true, product });
  }

  const priceParsed = priceSchema.safeParse(body);
  if (priceParsed.success) {
    // کارشناس قیمت را پیشنهاد می‌دهد؛ پس از تأیید پشتیبانی/ادمین جایگزین می‌شود
    const pr = await proposeExpertPrice(priceParsed.data.productId, priceParsed.data.newPrice, priceParsed.data.reason ?? null, `EXPERT:${session?.username ?? '?'}`);
    await logActivity('ADMIN', `پیشنهاد اصلاح قیمت کالا`, `شناسه: ${priceParsed.data.productId} → ${priceParsed.data.newPrice}`);
    return NextResponse.json({ ok: true, proposal: pr });
  }

  const decideParsed = decideSchema.safeParse(body);
  if (decideParsed.success) {
    const by = `${session?.role === 'OWNER' ? 'OWNER' : 'ADMIN'}:${session?.username}`;
    const ok = await applyProposal(decideParsed.data.proposalId, by, decideParsed.data.approve);
    if (!ok) return NextResponse.json({ error: 'NOT_PENDING', message: 'این پیشنهاد قبلاً تصمیم‌گیری شده است' }, { status: 409 });
    await logActivity('ADMIN', decideParsed.data.approve ? 'تأیید و اعمال پیشنهاد قیمت' : 'ردّ پیشنهاد قیمت');
    return NextResponse.json({ ok: true });
  }

  const patchParsed = patchSchema.safeParse(body);
  if (patchParsed.success) {
    const { productId, action: _action, ...data } = patchParsed.data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) if (v !== undefined) patch[k] = v;
    if ('basePrice' in patch) {
      // پلن v3: پایهٔ فروش مستقل ثبت می‌شود؛ افزودنی پرداخت = کارشناس + پلتفرم
      patch.priceRule = PRICE_RULE_V3;
      patch.priceDate = priceStamp();
      patch.priceUpdatedAt = new Date();
    }
    await db.product.update({ where: { id: productId }, data: patch });
    await logActivity('ADMIN', 'ویرایش کالای میز کالا', productId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'INVALID_ACTION', message: 'عملیات نامعتبر است' }, { status: 400 });
}
