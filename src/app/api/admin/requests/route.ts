import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

const RANGE_FA: Record<string, string> = {
  UNDER_50M: 'زیر ۵۰ میلیون تومان',
  M_50_200: '۵۰ تا ۲۰۰ میلیون تومان',
  M_200_1B: '۲۰۰ میلیون تا ۱ میلیارد تومان',
  OVER_1B: 'بالای ۱ میلیارد تومان',
};
const CAT_FA: Record<string, string> = {
  FINANCIAL: 'مشارکت مالی',
  NON_FINANCIAL: 'مشارکت غیرمالی',
  SERVICE: 'مشارکت خدمتی',
};

/** درخواست‌های سرمایه‌گذاری + صندوق حمایت برای ادمین */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const investors = await db.investorRequest.findMany({ orderBy: { createdAt: 'desc' } });
  const funds = await db.fundRequest.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({
    investors: investors.map((r) => ({ ...r, rangeLabel: RANGE_FA[r.amountRange] ?? r.amountRange })),
    funds: funds.map((r) => ({ ...r, categoryLabel: r.category ? (CAT_FA[r.category] ?? r.category) : null })),
    newInvestors: investors.filter((r) => r.status === 'NEW').length,
    newFunds: funds.filter((r) => r.status === 'NEW').length,
  });
}

const patchSchema = z.object({
  kind: z.enum(['INVESTOR', 'FUND']),
  id: z.string().min(1),
  status: z.string().min(2).max(20),
});

const INV_FA: Record<string, string> = { NEW: 'جدید', CONTACTED: 'تماس گرفته شد', APPROVED: 'تأیید شد', REJECTED: 'رد شد' };
const FUND_FA: Record<string, string> = { NEW: 'جدید', CONTACTED: 'تماس گرفته شد', DONE: 'انجام شد', REJECTED: 'رد شد' };

/** تغییر وضعیت درخواست‌ها */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  const { kind, id, status } = parsed.data;

  if (kind === 'INVESTOR') {
    if (!INV_FA[status]) return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 });
    const r = await db.investorRequest.findUnique({ where: { id } });
    if (!r) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    await db.investorRequest.update({ where: { id }, data: { status } });
    await logActivity('ADMIN', `وضعیت سرمایه‌گذار ${r.fullName} → ${INV_FA[status]}`, formatJalaliTime(new Date()));
    return NextResponse.json({ ok: true, status });
  }
  if (!FUND_FA[status]) return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 });
  const r = await db.fundRequest.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  await db.fundRequest.update({ where: { id }, data: { status } });
  await logActivity('ADMIN', `وضعیت درخواست صندوق ${r.fullName} → ${FUND_FA[status]}`, formatJalaliTime(new Date()));
  return NextResponse.json({ ok: true, status });
}
