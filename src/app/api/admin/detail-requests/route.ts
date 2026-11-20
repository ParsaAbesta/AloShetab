import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/** فهرست درخواست‌های «افزودن ریز جزئیات» (پشتیبانی) */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const items = await db.detailRequest.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200 });
  const pending = items.filter((i) => i.status === 'PENDING').length;
  return NextResponse.json({ items, pending });
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']),
});

/** تأیید/رد درخواست — تأیید = افزودن دائمی به ریز جزئیات خدمت */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'دادهٔ نامعتبر' }, { status: 400 });
  }
  const { id, action } = parsed.data;
  const row = await db.detailRequest.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: 'NOT_FOUND', message: 'درخواست یافت نشد' }, { status: 404 });
  if (row.status !== 'PENDING') {
    return NextResponse.json({ error: 'ALREADY_DECIDED', message: 'این درخواست قبلاً بررسی شده است' }, { status: 409 });
  }
  const svc = await db.service.findUnique({ where: { key: row.serviceKey }, select: { id: true, nameFa: true } });
  if (!svc) return NextResponse.json({ error: 'SERVICE_GONE', message: 'خدمت مربوطه دیگر موجود نیست' }, { status: 404 });

  if (action === 'APPROVE') {
    const maxSort = await db.serviceDetail.aggregate({ where: { serviceId: svc.id }, _max: { sortOrder: true } });
    const detail = await db.serviceDetail.create({
      data: { serviceId: svc.id, nameFa: row.name, price: row.price ?? 0, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
    });
    await db.detailRequest.update({ where: { id }, data: { status: 'APPROVED', detailId: detail.id } });
    await logActivity('ADMIN', 'ریز جزئیات تأیید و افزوده شد', `${svc.nameFa}: «${row.name}»`);
    return NextResponse.json({ ok: true, message: `«${row.name}» برای همیشه به ${svc.nameFa} افزوده شد.` });
  }
  await db.detailRequest.update({ where: { id }, data: { status: 'REJECTED' } });
  await logActivity('ADMIN', 'ریز جزئیات رد شد', `${svc.nameFa}: «${row.name}»`);
  return NextResponse.json({ ok: true, message: 'درخواست رد شد.' });
}
