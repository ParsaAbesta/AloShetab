import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, getSession, unauthorized } from '@/lib/adminAuth';
import { generateDailyReport, applyDailyReport } from '@/lib/inventory';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/** گزارش‌های روزانهٔ قیمت — فهرست */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const reports = await db.dailyPriceReport.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
  return NextResponse.json({ reports });
}

/** تولید گزارش روزانه (بدون تکرار در یک روز) یا تأیید و لحاظ کردن قیمت‌های جدید */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const session = await getSession();
  const body = await req.json().catch(() => null);
  const schema = z.object({
    action: z.enum(['generate', 'approve', 'reject']),
    reportId: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  const by = `${session?.role === 'OWNER' ? 'OWNER' : 'ADMIN'}:${session?.username}`;

  if (parsed.data.action === 'generate') {
    const r = await generateDailyReport(by);
    await logActivity('ADMIN', 'تولید گزارش روزانهٔ قیمت میز کالا', `${r.dateShamsi} — ${r.itemCount} قلم`);
    return NextResponse.json({ ok: true, report: r });
  }

  if (!parsed.data.reportId) return NextResponse.json({ error: 'REPORT_ID_REQUIRED' }, { status: 400 });
  const report = await db.dailyPriceReport.findUnique({ where: { id: parsed.data.reportId } });
  if (!report) return NextResponse.json({ error: 'NOT_FOUND', message: 'گزارش یافت نشد' }, { status: 404 });
  if (report.status !== 'PENDING') return NextResponse.json({ error: 'NOT_PENDING', message: 'این گزارش قبلاً تصمیم‌گیری شده' }, { status: 409 });

  if (parsed.data.action === 'approve') {
    // تأیید ادمین → لحاظ شدن قیمت‌های جدید در میز کالا
    const r = await applyDailyReport(parsed.data.reportId, by);
    await logActivity('ADMIN', 'تأیید گزارش روزانهٔ قیمت — قیمت‌های جدید لحاظ شد', `${r.applied} قلم`);
    return NextResponse.json({ ok: true, applied: r.applied });
  }

  await db.dailyPriceReport.update({ where: { id: parsed.data.reportId }, data: { status: 'REJECTED', approvedBy: by, approvedAt: new Date() } });
  await logActivity('ADMIN', 'ردّ گزارش روزانهٔ قیمت');
  return NextResponse.json({ ok: true });
}
