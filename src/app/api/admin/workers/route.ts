import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

/** همکاران: درخواست‌های جذب + امتیازها و سطح‌ها */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const workers = await db.worker.findMany({
    orderBy: [{ status: 'asc' }, { points: 'desc' }, { createdAt: 'desc' }],
    include: { orderItems: { select: { id: true, settledAt: true } } },
  });
  return NextResponse.json({
    workers: workers.map((w) => ({
      id: w.id,
      fullName: w.fullName,
      nationalId: w.nationalId,
      mobile: w.mobile,
      city: w.city,
      field: w.field,
      resume: w.resume,
      status: w.status,
      level: w.level,
      points: w.points,
      createdAt: w.createdAt,
      jobsCount: w.orderItems.length,
      // محرمانگی: هیچ سهم یا مبلغ تسویه‌ای به رابط کاربری ارسال نمی‌شود؛
      // مبالغ فقط در پایگاه داده و گزارش‌های ایمیل بک‌اند ثبت می‌شوند.
      settledJobsCount: w.orderItems.filter((i) => i.settledAt).length,
    })),
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['approve', 'reject', 'set-level']),
  level: z.enum(['BRONZE', 'SILVER', 'GOLD']).optional(),
});

/** تأیید/رد درخواست همکاری + تنظیم سطح دستی */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'درخواست نامعتبر است' }, { status: 400 });
  }
  const w = await db.worker.findUnique({ where: { id: parsed.data.id } });
  if (!w) return NextResponse.json({ error: 'NOT_FOUND', message: 'همکار یافت نشد' }, { status: 404 });

  if (parsed.data.action === 'approve') {
    await db.worker.update({ where: { id: w.id }, data: { status: 'APPROVED' } });
    await queueReport('WORKER', `تأیید همکار جدید — ${w.fullName}`, [
      `نام: ${w.fullName} | کد ملی: ${w.nationalId} | رشته: ${w.field} | شهر: ${w.city}`,
      `موبایل: ${w.mobile}`,
      `این همکار اکنون در تسویهٔ سفارش‌ها قابل انتخاب است.`,
      `زمان: ${formatJalaliTime(new Date())}`,
    ].join('\n'));
    await logActivity('ADMIN', `تأیید همکار ${w.fullName}`);
    return NextResponse.json({ ok: true, status: 'APPROVED' });
  }
  if (parsed.data.action === 'reject') {
    await db.worker.update({ where: { id: w.id }, data: { status: 'REJECTED' } });
    await queueReport('WORKER', `رد درخواست همکاری — ${w.fullName}`, [
      `نام: ${w.fullName} | کد ملی: ${w.nationalId} | موبایل: ${w.mobile}`,
      `زمان: ${formatJalaliTime(new Date())}`,
    ].join('\n'));
    await logActivity('ADMIN', `رد همکار ${w.fullName}`);
    return NextResponse.json({ ok: true, status: 'REJECTED' });
  }
  if (parsed.data.action === 'set-level' && parsed.data.level) {
    await db.worker.update({ where: { id: w.id }, data: { level: parsed.data.level } });
    await logActivity('ADMIN', `تنظیم سطح ${w.fullName}`, parsed.data.level);
    return NextResponse.json({ ok: true, level: parsed.data.level });
  }
  return NextResponse.json({ error: 'UNKNOWN_ACTION' }, { status: 400 });
}
