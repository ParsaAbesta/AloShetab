import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdmin, getSession, unauthorized } from '@/lib/adminAuth';
import { runAudit, resolveFreeze, checkFreezeEscalation } from '@/lib/audit';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/** گزارش‌های حسابرسی + وضعیت توقف عملیات */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  await checkFreezeEscalation();
  const reports = await db.auditReport.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  const session = await getSession();
  return NextResponse.json({ reports, role: session?.role ?? 'ADMIN' });
}

/** اجرای حسابرسی (حسابدار هوشمند) */
export async function POST() {
  if (!(await isAdmin())) return unauthorized();
  const result = await runAudit('ADMIN');
  await logActivity('ADMIN', 'اجرای حسابرسی حسابدار هوشمند', `خطاها: ${result.anomalyCount}`);
  return NextResponse.json(result);
}

/** فرمان ادامهٔ عملیات — مالک همیشه؛ ادمین فقط پس از ۳ ساعت */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const session = await getSession();
  const role = session?.role === 'OWNER' ? 'OWNER' : 'ADMIN';
  try {
    await resolveFreeze(role, session?.username ?? '?');
    await logActivity('ADMIN', 'فرمان ادامهٔ عملیات پس از حسابرسی', role);
    return NextResponse.json({ ok: true, resumed: true, by: role });
  } catch (err) {
    return NextResponse.json(
      { error: 'NOT_ALLOWED', message: err instanceof Error ? err.message : 'اجازهٔ ادامه نیست' },
      { status: 403 }
    );
  }
}
