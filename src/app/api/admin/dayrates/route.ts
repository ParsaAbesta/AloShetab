import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { logActivity } from '@/lib/reports';
import { tehranDateKey } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

/** نرخ روزهای خاص (تعطیلات رسمی/پرمشغول) */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const rates = await db.dayRate.findMany({ orderBy: { date: 'asc' } });
  return NextResponse.json({ rates });
}

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاریخ باید به قالب میلادی yyyy-mm-dd باشد'),
  labelFa: z.string().trim().min(2).max(120),
  labelEn: z.string().trim().max(120).optional().nullable(),
  multiplier: z.number().min(0.1).max(10),
});

/** ثبت/بروزرسانی نرخ یک روز خاص */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'دادهٔ نامعتبر' }, { status: 400 });
  }
  const { date, labelFa, labelEn, multiplier } = parsed.data;
  const rate = await db.dayRate.upsert({
    where: { date },
    update: { labelFa, labelEn: labelEn ?? '', multiplier },
    create: { date, labelFa, labelEn: labelEn ?? '', multiplier },
  });
  await logActivity('ADMIN', `ثبت نرخ روز ${date}`, `${labelFa} ×${multiplier}`);
  return NextResponse.json({ ok: true, rate });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const date = new URL(req.url).searchParams.get('date') ?? '';
  if (!date) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  await db.dayRate.deleteMany({ where: { date } });
  await logActivity('ADMIN', `حذف نرخ روز ${date}`);
  return NextResponse.json({ ok: true });
}

/** روز فعلی تهران — برای راهنمای فرم ادمین */
export async function PUT() {
  if (!(await isAdmin())) return unauthorized();
  return NextResponse.json({ today: tehranDateKey(new Date()) });
}
