import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/** فهرست همهٔ قطعات (ادمین) */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const parts = await db.part.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json({ parts });
}

const patchSchema = z.object({
  key: z.string().min(1),
  basePrice: z.number().int().min(0).max(2_000_000_000).optional(),
  active: z.boolean().optional(),
  nameFa: z.string().trim().min(2).max(80).optional(),
});

/** ویرایش قطعه (قیمت پایه / فعال‌سازی) */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'دادهٔ نامعتبر' }, { status: 400 });
  }
  const { key, ...data } = parsed.data;
  const part = await db.part.update({ where: { key }, data }).catch(() => null);
  if (!part) return NextResponse.json({ error: 'NOT_FOUND', message: 'قطعه یافت نشد' }, { status: 404 });
  await logActivity('ADMIN', 'ویرایش قطعه', `${part.nameFa} | ${JSON.stringify(data)}`);
  return NextResponse.json({ ok: true, part });
}
