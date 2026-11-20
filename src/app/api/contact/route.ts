import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { queueReport } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(3).max(120),
  phone: z.string().trim().min(7).max(20),
  subject: z.string().trim().max(120).optional().nullable(),
  message: z.string().trim().min(5).max(2000),
});

/** فرم «ارتباط با ما» */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'لطفاً نام، تلفن و پیام را کامل وارد کنید' }, { status: 400 });
  }
  await db.contactMessage.create({
    data: { name: parsed.data.name, phone: parsed.data.phone, subject: parsed.data.subject ?? null, message: parsed.data.message },
  });
  await queueReport(
    'CONTACT',
    `پیام تماس از ${parsed.data.name}`,
    [`نام: ${parsed.data.name}`, `تلفن: ${parsed.data.phone}`, parsed.data.subject ? `موضوع: ${parsed.data.subject}` : '', `پیام: ${parsed.data.message}`, `زمان: ${formatJalaliTime(new Date())}`].filter(Boolean).join('\n')
  );
  return NextResponse.json({ ok: true });
}
