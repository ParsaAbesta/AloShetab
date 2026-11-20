import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/** قیمت‌گذاری: فهرست خدمات با نرخ پایه برای ویرایش */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const services = await db.service.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json({ services });
}

const patchSchema = z.object({
  id: z.string().min(1),
  baseRate: z.number().int().min(0).max(5_000_000_000).optional(),
  active: z.boolean().optional(),
  remoteCapable: z.boolean().optional(),
  nameFa: z.string().trim().min(2).max(80).optional(),
  nameEn: z.string().trim().min(2).max(80).optional(),
  descFa: z.string().trim().max(2000).optional(),
  descEn: z.string().trim().max(2000).optional(),
});

/** ویرایش نرخ پایه و سایر مشخصات خدمت */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'دادهٔ نامعتبر است' }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  const svc = await db.service.update({ where: { id }, data });
  await logActivity('ADMIN', `ویرایش خدمت ${svc.nameFa}`, `نرخ پایه: ${svc.baseRate}`);
  return NextResponse.json({ ok: true, service: svc });
}
