import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/** فهرست انبارها و مراجع قیمت — تلفن تماس، سایت، آدرس و لینک کالا برای هماهنگی‌های بعدی */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const warehouses = await db.warehouse.findMany({
    orderBy: [{ kind: 'asc' }, { nameFa: 'asc' }],
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ warehouses });
}

const upsertSchema = z.object({
  key: z.string().trim().min(2).max(60),
  nameFa: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().max(120).default(''),
  kind: z.enum(['COMPUTER', 'APPLIANCE', 'MARKETPLACE', 'SERVICES', 'PRICE_AGGREGATOR']).default('COMPUTER'),
  website: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  city: z.string().trim().max(60).default('تهران'),
  linkTemplate: z.string().trim().max(300).optional().nullable(),
  active: z.boolean().default(true),
  priceListFresh: z.boolean().default(true),
  verified: z.boolean().default(false),
  notes: z.string().trim().max(400).optional().nullable(),
});

const patchSchema = z.object({
  id: z.string().trim().min(1),
  active: z.boolean().optional(),
  priceListFresh: z.boolean().optional(),
  verified: z.boolean().optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  notes: z.string().trim().max(400).optional().nullable(),
});

/** افزودن انبار/مرجع یا بروزرسانی وضعیت آن (تأیید فعال بودن، بروز بودن قیمت) */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = await req.json().catch(() => null);

  const up = upsertSchema.safeParse(body);
  if (up.success) {
    const d = up.data;
    const wh = await db.warehouse.upsert({
      where: { key: d.key },
      update: { ...d, verifiedAt: d.verified ? new Date() : null },
      create: { ...d, verifiedAt: d.verified ? new Date() : null },
    });
    await logActivity('ADMIN', `ثبت/بروزرسانی انبار ${wh.nameFa}`, `تأییدشده: ${wh.verified ? 'بله' : 'خیر'}`);
    return NextResponse.json({ ok: true, warehouse: wh });
  }

  const patch = patchSchema.safeParse(body);
  if (patch.success) {
    const { id, ...data } = patch.data;
    const p: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) if (v !== undefined) p[k] = v;
    if (p.verified === true) p.verifiedAt = new Date();
    const wh = await db.warehouse.update({ where: { id }, data: p });
    await logActivity('ADMIN', `بروزرسانی انبار ${wh.nameFa}`);
    return NextResponse.json({ ok: true, warehouse: wh });
  }

  return NextResponse.json({ error: 'INVALID_INPUT', message: 'دادهٔ نامعتبر' }, { status: 400 });
}
