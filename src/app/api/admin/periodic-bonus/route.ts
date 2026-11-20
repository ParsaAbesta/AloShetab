import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';
import { computePeriodicBonuses, jalaliPeriodKey, periodRange } from '@/lib/referral';
import { getSettings, setSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** پاداش سقف‌دار دوره‌ای معرف (پیام ۱۹ — V4.1) — پیش‌نمایش دورهٔ شمسی */
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const url = new URL(req.url);
  const period = url.searchParams.get('period')?.trim() || jalaliPeriodKey(new Date());
  try {
    const result = await computePeriodicBonuses(period);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'BAD_PERIOD', message: 'دوره نامعتبر است — قالب: 1405-08' }, { status: 400 });
  }
}

const postSchema = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/) });

/** بستن دوره و صدور سند پاداش‌ها (ایمیل مالک) — یک‌بار برای هر دوره */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT', message: 'قالب دوره: 1405-08' }, { status: 400 });
  const period = parsed.data.period;

  const s = await getSettings();
  if (s.PERIODIC_BONUS_ENABLE !== '1') {
    return NextResponse.json({ error: 'BONUS_DISABLED', message: 'پاداش دوره‌ای غیرفعال است' }, { status: 403 });
  }
  const closed = (s.PERIODIC_BONUS_PERIODS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (closed.includes(period)) {
    return NextResponse.json({ error: 'PERIOD_CLOSED', message: `دورهٔ ${period} قبلاً بسته شده است` }, { status: 409 });
  }

  const result = await computePeriodicBonuses(period);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'EMPTY_PERIOD', message: 'پاداشی برای این دوره محاسبه نشد' }, { status: 400 });
  }

  const lines: string[] = [
    `دورهٔ یک‌ماههٔ شمسی: ${period} (${periodRange(period).labelFa})`,
    `قاعدهٔ پاداش (پیام ۲۰ — V5.0): به ازای هر ${result.invoicesPerReward.toLocaleString('fa-IR')} فاکتور قطعی‌شده از جانب هر معرف → ${result.rewardToman.toLocaleString('fa-IR')} تومان پاداش ثابت`,
    `مکانیزم: در لحظهٔ فاکتور پنجم/دهمِ... دوره، مبلغ پاداش از واریزی به بانک ملی کسر و به بانک مهر منتقل می‌شود${result.debt > 0 ? ` | بدهی تأمین‌نشدهٔ فعلی: ${result.debt.toLocaleString('fa-IR')} تومان` : ' | بدهی تأمین‌نشده: ندارد'}`,
    `تعداد معرف مشمول: ${result.rows.length}`,
    '— ردیف‌ها —',
    ...result.rows.map((r, i) =>
      `${i + 1}) ${r.referrerName} (${r.referrerNat}) — فاکتورها: ${r.invoices} | پاداش: ${r.batches} × ${result.rewardToman.toLocaleString('fa-IR')} = ${r.bonus.toLocaleString('fa-IR')} تومان`
    ),
    `جمع پاداش‌های دوره: ${result.total.toLocaleString('fa-IR')} تومان`,
    'تأمین: از سهم شرکت (بانک ملی) — واریز به معرف: از طریق بانک مهر',
    `زمان صدور: ${formatJalaliTime(new Date())}`,
  ];
  await queueReport('REFERRAL', `سند پاداش سقف‌دار دوره‌ای معرف — دورهٔ ${period} (V5.0)`, lines.join('\n'));
  await logActivity('ADMIN', `بستن دورهٔ پاداش ${period}`, `معرف‌ها: ${result.rows.length} | جمع: ${result.total}`);

  await setSetting('PERIODIC_BONUS_PERIODS', [...closed, period].join(','));

  return NextResponse.json({ ok: true, period, rows: result.rows, total: result.total });
}
