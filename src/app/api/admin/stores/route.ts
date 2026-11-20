import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { logActivity } from '@/lib/reports';
import { runFeedCycle, syncProductFromStore, syncTgjuReference } from '@/lib/pricefeed';

export const dynamic = 'force-dynamic';

const KIND_FA: Record<string, string> = {
  ONLINE: 'فروشگاه اینترنتی',
  MARKETPLACE: 'بازار آنلاین',
  PRICE_AGGREGATOR: 'مقایسه‌گر قیمت',
  PHYSICAL: 'فروشگاه حضوری',
  SERVICE: 'ارائه‌دهندهٔ خدمات',
};

/** فهرست فروشگاه‌ها (پیام ۱۳) — راه‌های ارتباطی، آدرس، وضعیت اتصال لحظه‌ای
 *  و آمار «فروش به بالاترین / خرید از پایین‌ترین توافقی» هر فروشگاه */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();

  const stores = await db.store.findMany({
    orderBy: [{ kind: 'asc' }, { nameFa: 'asc' }],
    include: {
      offers: { where: { active: true }, select: { offeredPrice: true, negotiatedPrice: true, fetchedAt: true, fetchedShamsi: true } },
      _count: { select: { offers: true } },
    },
  });

  const latestQuotes = await db.liveQuote.findMany({ orderBy: { fetchedAt: 'desc' }, take: 6 });

  const rows = stores.map((st) => {
    const offered = st.offers.map((o) => o.offeredPrice).filter((v) => v > 0);
    const negotiated = st.offers.map((o) => o.negotiatedPrice ?? o.offeredPrice).filter((v) => v > 0);
    return {
      id: st.id,
      key: st.key,
      nameFa: st.nameFa,
      nameEn: st.nameEn,
      kind: st.kind,
      kindFa: KIND_FA[st.kind] ?? st.kind,
      website: st.website,
      phone: st.phone,
      address: st.address,
      city: st.city,
      feedType: st.feedType,
      feedQueryTemplate: st.feedQueryTemplate,
      priceMode: st.priceMode,
      lastSyncAt: st.lastSyncAt,
      lastSyncStatus: st.lastSyncStatus,
      lastSyncNote: st.lastSyncNote,
      active: st.active,
      verified: st.verified,
      notes: st.notes,
      offersCount: st._count.offers,
      highestOffer: offered.length ? Math.max(...offered) : null, // فروش به بالاترین ارائه‌شده
      lowestBuy: negotiated.length ? Math.min(...negotiated) : null, // خرید از پایین‌ترین توافقی
      freshestShamsi: st.offers.sort((a, b) => (a.fetchedAt > b.fetchedAt ? -1 : 1))[0]?.fetchedShamsi ?? null,
    };
  });

  return NextResponse.json({ stores: rows, quotes: latestQuotes });
}

const upsertSchema = z.object({
  action: z.literal('upsert'),
  key: z.string().trim().min(2).max(60),
  nameFa: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().max(120).default(''),
  kind: z.enum(['ONLINE', 'MARKETPLACE', 'PRICE_AGGREGATOR', 'PHYSICAL', 'SERVICE']).default('ONLINE'),
  website: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  city: z.string().trim().max(60).default('تهران'),
  feedType: z.enum(['TGJU', 'DIGIKALA', 'TOROB', 'SNAPP_MARKET', 'NONE']).default('NONE'),
  feedQueryTemplate: z.string().trim().max(300).optional().nullable(),
  active: z.boolean().default(true),
  verified: z.boolean().default(false),
  notes: z.string().trim().max(400).optional().nullable(),
});

const patchSchema = z.object({
  action: z.literal('patch'),
  id: z.string().trim().min(1),
  active: z.boolean().optional(),
  verified: z.boolean().optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  notes: z.string().trim().max(400).optional().nullable(),
  feedQueryTemplate: z.string().trim().max(300).optional().nullable(),
});

const syncRefSchema = z.object({ action: z.literal('sync-reference') });
const syncProductSchema = z.object({
  action: z.literal('sync-product'),
  productId: z.string().trim().min(1),
  storeId: z.string().trim().min(1),
});

/** ثبت/ویرایش فروشگاه، همگام‌سازی مرجع لحظه‌ای، و دریافت قیمت لحظه‌ای کالا */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = await req.json().catch(() => null);

  const up = upsertSchema.safeParse(body);
  if (up.success) {
    const { action: _a, ...d } = up.data;
    const st = await db.store.upsert({ where: { key: d.key }, update: d, create: d });
    await logActivity('ADMIN', `ثبت/بروزرسانی فروشگاه ${st.nameFa}`, `اتصال لحظه‌ای: ${st.feedType}`);
    return NextResponse.json({ ok: true, store: st });
  }

  const patch = patchSchema.safeParse(body);
  if (patch.success) {
    const { id, action: _action, ...data } = patch.data;
    const p: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) if (v !== undefined) p[k] = v;
    const st = await db.store.update({ where: { id }, data: p });
    await logActivity('ADMIN', `بروزرسانی فروشگاه ${st.nameFa}`);
    return NextResponse.json({ ok: true, store: st });
  }

  const syncRef = syncRefSchema.safeParse(body);
  if (syncRef.success) {
    // اتصال به سایت نوسان قیمت — نرخ‌های لحظه‌ای ارز/طلا (tgju.org)
    const r = await runFeedCycle();
    await logActivity('ADMIN', 'همگام‌سازی نرخ‌های لحظه‌ای مرجع (TGJU)', r.tgju?.ok ? `${r.tgju.count} نرخ` : r.tgju?.error ?? 'خطا');
    return NextResponse.json({ ok: r.tgju?.ok === true, result: r });
  }

  const syncProd = syncProductSchema.safeParse(body);
  if (syncProd.success) {
    const r = await syncProductFromStore(syncProd.data.productId, syncProd.data.storeId);
    await logActivity('ADMIN', 'دریافت قیمت لحظه‌ای کالا از فروشگاه', `${r.status} — ${r.message.slice(0, 120)}`);
    return NextResponse.json({ ok: r.status === 'OK', result: r });
  }

  void syncTgjuReference; // (در runFeedCycle اجرا می‌شود)
  return NextResponse.json({ error: 'INVALID_ACTION', message: 'عملیات نامعتبر است' }, { status: 400 });
}
