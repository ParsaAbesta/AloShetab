import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

const schema = z.object({
  fullName: z.string().trim().min(3).max(120),
  nationalId: z.string().trim().regex(/^\d{10}$/, 'کد ملی باید ۱۰ رقم باشد'),
  mobile: z.string().trim().regex(/^09\d{9}$/, 'تلفن همراه باید با ۰۹ شروع شده و ۱۱ رقم باشد'),
  city: z.string().trim().min(2).max(60),
  field: z.string().trim().min(2).max(120),
  resume: z.string().trim().max(4000).optional().nullable(),
});

/** جذب همکار — ثبت مستقیم درخواست در پنل ادمین الو شتاب (PRD §8) */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'اطلاعات فرم نامعتبر است';
    return NextResponse.json({ error: 'INVALID_INPUT', message: msg }, { status: 400 });
  }

  // کد ملی تکراری: اگر قبلاً درخواست داده، وضعیت فعلی را برمی‌گردانیم
  const existing = await db.worker.findUnique({ where: { nationalId: parsed.data.nationalId } });
  if (existing) {
    if (existing.status === 'REJECTED') {
      await db.worker.update({
        where: { id: existing.id },
        data: { ...parsed.data, resume: parsed.data.resume ?? null, status: 'PENDING' },
      });
      await queueReport('WORKER', `درخواست مجدد همکاری ${parsed.data.fullName}`, [
        `نام: ${parsed.data.fullName} | کد ملی: ${parsed.data.nationalId}`,
        `موبایل: ${parsed.data.mobile} | شهر: ${parsed.data.city} | رشته: ${parsed.data.field}`,
        parsed.data.resume ? `سوابق: ${parsed.data.resume}` : '',
        `زمان: ${formatJalaliTime(new Date())}`,
      ].filter(Boolean).join('\n'));
      return NextResponse.json({ ok: true, status: 'PENDING' });
    }
    return NextResponse.json({
      ok: true,
      status: existing.status,
      message: existing.status === 'APPROVED' ? 'شما همکار تأییدشدهٔ ألو شتاب هستید' : 'درخواست همکاری شما قبلاً ثبت شده و در انتظار بررسی ادمین است',
    });
  }

  await db.worker.create({
    data: { ...parsed.data, resume: parsed.data.resume ?? null, status: 'PENDING' },
  });
  await queueReport(
    'WORKER',
    `درخواست جذب همکار جدید — ${parsed.data.fullName}`,
    [
      `نام: ${parsed.data.fullName} | کد ملی: ${parsed.data.nationalId}`,
      `موبایل: ${parsed.data.mobile} | شهر: ${parsed.data.city}`,
      `رشتهٔ تخصصی: ${parsed.data.field}`,
      parsed.data.resume ? `سوابق: ${parsed.data.resume}` : '',
      `زمان: ${formatJalaliTime(new Date())}`,
    ].filter(Boolean).join('\n')
  );
  await logActivity('CUSTOMER', `درخواست جذب همکار: ${parsed.data.fullName}`, `رشته: ${parsed.data.field} | شهر: ${parsed.data.city}`);
  return NextResponse.json({ ok: true, status: 'PENDING' });
}
