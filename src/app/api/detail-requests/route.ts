import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const schema = z.object({
  serviceKey: z.string().trim().min(1).max(40),
  name: z.string().trim().min(3).max(80),
  price: z.number().int().min(0).max(2_000_000_000).optional().nullable(),
  contact: z.string().trim().regex(/^(09\d{9}|[\w.+-]+@[\w-]+\.[\w.]{2,})$/, 'موبایل ۰۹… یا ایمیل معتبر وارد کنید'),
  note: z.string().trim().max(300).optional().nullable(),
});

/** «[+] افزودن ریز جزئیات» — پیشنهاد مشتری؛ پس از تأیید پشتیبانی برای همیشه اضافه می‌شود */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'دادهٔ نامعتبر' }, { status: 400 });
  }
  const svc = await db.service.findUnique({ where: { key: parsed.data.serviceKey }, select: { nameFa: true, active: true } });
  if (!svc || !svc.active) {
    return NextResponse.json({ error: 'SERVICE_NOT_FOUND', message: 'خدمت یافت نشد' }, { status: 404 });
  }
  const dup = await db.serviceDetail.findFirst({ where: { service: { key: parsed.data.serviceKey }, nameFa: parsed.data.name } });
  if (dup) {
    return NextResponse.json({ error: 'DUPLICATE', message: 'این ریز جزئیات از قبل وجود دارد' }, { status: 409 });
  }
  const reqRow = await db.detailRequest.create({
    data: {
      serviceKey: parsed.data.serviceKey,
      serviceName: svc.nameFa,
      name: parsed.data.name,
      price: parsed.data.price ?? null,
      contact: parsed.data.contact,
      note: parsed.data.note ?? null,
    },
  });
  await logActivity('CUSTOMER', `درخواست ریز جزئیات برای ${svc.nameFa}`, `«${parsed.data.name}» | تماس: ${parsed.data.contact}`);
  return NextResponse.json({ ok: true, id: reqRow.id, message: 'ثبت شد؛ پس از بررسی و تأیید پشتیبانی، برای همیشه به فهرست افزوده می‌شود.' });
}
