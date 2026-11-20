import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

const schema = z.object({
  fullName: z.string().trim().min(3).max(120),
  mobile: z.string().trim().regex(/^09\d{9}$/, 'تلفن همراه باید با ۰۹ شروع شده و ۱۱ رقم باشد'),
  nationalId: z.string().trim().regex(/^\d{10}$/).optional().nullable(),
  amountRange: z.enum(['UNDER_50M', 'M_50_200', 'M_200_1B', 'OVER_1B']),
  message: z.string().trim().max(2000).optional().nullable(),
});

const RANGE_FA: Record<string, string> = {
  UNDER_50M: 'زیر ۵۰ میلیون تومان',
  M_50_200: '۵۰ تا ۲۰۰ میلیون تومان',
  M_200_1B: '۲۰۰ میلیون تا ۱ میلیارد تومان',
  OVER_1B: 'بالای ۱ میلیارد تومان',
};

/** ثبت درخواست سرمایه‌گذاری در هلدینگ ألو شتاب */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'دادهٔ نامعتبر';
    return NextResponse.json({ error: 'INVALID_INPUT', message: msg }, { status: 400 });
  }
  const { fullName, mobile, nationalId, amountRange, message } = parsed.data;

  const inv = await db.investorRequest.create({
    data: { fullName, mobile, nationalId: nationalId ?? null, amountRange, message: message ?? null },
  });

  await queueReport(
    'INVEST',
    `درخواست سرمایه‌گذاری جدید — ${fullName}`,
    [
      `نام: ${fullName} | همراه: ${mobile}`,
      nationalId ? `کد ملی: ${nationalId}` : '',
      `بازهٔ سرمایهٔ پیشنهادی: ${RANGE_FA[amountRange] ?? amountRange}`,
      message ? `پیام: ${message}` : '',
      `زمان ثبت: ${formatJalaliTime(new Date())}`,
    ].filter(Boolean).join('\n')
  );
  await logActivity('CUSTOMER', 'درخواست سرمایه‌گذاری جدید', `نام: ${fullName} | بازه: ${amountRange}`);

  return NextResponse.json({ ok: true, id: inv.id });
}
