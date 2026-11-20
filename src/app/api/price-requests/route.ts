import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const schema = z.object({
  targetType: z.enum(['SERVICE', 'PART']).default('SERVICE'),
  key: z.string().trim().min(1).max(40),
  newPrice: z.number().int().min(0).max(2_000_000_000),
  reason: z.string().trim().max(300).optional().nullable(),
});

/** پیشنهاد اصلاح قیمت توسط کارشناس — پس از تأیید پشتیبانی جایگزین می‌شود */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'دادهٔ نامعتبر' }, { status: 400 });
  }
  const { targetType, key, newPrice, reason } = parsed.data;
  let oldPrice = 0;
  let serviceName = '';
  if (targetType === 'PART') {
    const part = await db.part.findUnique({ where: { key } });
    if (!part) return NextResponse.json({ error: 'NOT_FOUND', message: 'قطعه یافت نشد' }, { status: 404 });
    oldPrice = part.basePrice;
    serviceName = part.nameFa;
  } else {
    const svc = await db.service.findUnique({ where: { key } });
    if (!svc) return NextResponse.json({ error: 'NOT_FOUND', message: 'خدمت یافت نشد' }, { status: 404 });
    if (svc.percentValue != null) {
      return NextResponse.json({ error: 'PERCENT_SERVICE', message: 'خدمات کارمزدی درصدی با این فرم اصلاح نمی‌شوند' }, { status: 400 });
    }
    oldPrice = svc.baseRate;
    serviceName = svc.nameFa;
  }
  if (newPrice === oldPrice) {
    return NextResponse.json({ error: 'SAME_PRICE', message: 'قیمت جدید با قیمت فعلی یکسان است' }, { status: 400 });
  }
  const row = await db.priceChangeRequest.create({
    data: { targetType, serviceKey: key, serviceName, oldPrice, newPrice, reason: reason ?? null, proposedBy: 'EXPERT' },
  });
  await logActivity('ADMIN', `پیشنهاد اصلاح قیمت ${serviceName}`, `${oldPrice} → ${newPrice} | ${reason ?? '—'}`);
  return NextResponse.json({ ok: true, id: row.id, message: 'پیشنهاد ثبت شد؛ پس از تأیید پشتیبانی جایگزین می‌شود.' });
}
