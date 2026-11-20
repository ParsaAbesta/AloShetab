import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/** فهرست پیشنهادهای اصلاح قیمت (پشتیبانی) */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const items = await db.priceChangeRequest.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200 });
  const pending = items.filter((i) => i.status === 'PENDING').length;
  return NextResponse.json({ items, pending });
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']),
});

/** تأیید پشتیبانی → قیمت اصلاح‌شدهٔ کارشناس جایگزین می‌شود */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'دادهٔ نامعتبر' }, { status: 400 });
  }
  const { id, action } = parsed.data;
  const row = await db.priceChangeRequest.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: 'NOT_FOUND', message: 'پیشنهاد یافت نشد' }, { status: 404 });
  if (row.status !== 'PENDING') {
    return NextResponse.json({ error: 'ALREADY_DECIDED', message: 'این پیشنهاد قبلاً بررسی شده است' }, { status: 409 });
  }
  if (action === 'APPROVE') {
    if (row.targetType === 'PART') {
      await db.part.update({ where: { key: row.serviceKey }, data: { basePrice: row.newPrice } });
    } else {
      await db.service.update({ where: { key: row.serviceKey }, data: { baseRate: row.newPrice } });
    }
    await db.priceChangeRequest.update({ where: { id }, data: { status: 'APPROVED', decidedAt: new Date() } });
    await logActivity('ADMIN', 'اصلاح قیمت تأیید و اعمال شد', `${row.serviceName}: ${row.oldPrice} → ${row.newPrice}`);
    return NextResponse.json({ ok: true, message: `قیمت «${row.serviceName}» به ${row.newPrice.toLocaleString('fa-IR')} تغییر کرد.` });
  }
  await db.priceChangeRequest.update({ where: { id }, data: { status: 'REJECTED', decidedAt: new Date() } });
  await logActivity('ADMIN', 'اصلاح قیمت رد شد', `${row.serviceName}: ${row.oldPrice} → ${row.newPrice}`);
  return NextResponse.json({ ok: true, message: 'پیشنهاد رد شد.' });
}
