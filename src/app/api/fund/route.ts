import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

const schema = z.object({
  kind: z.enum(['SUPPORT', 'CONTRIBUTE']),
  fullName: z.string().trim().min(3).max(120),
  mobile: z.string().trim().regex(/^09\d{9}$/, 'تلفن همراه باید با ۰۹ شروع شده و ۱۱ رقم باشد'),
  category: z.string().trim().max(40).optional().nullable(),
  amount: z.number().int().min(0).max(100_000_000_000).optional().nullable(),
  message: z.string().trim().min(10).max(2000),
});

const CAT_FA: Record<string, string> = {
  FINANCIAL: 'مشارکت مالی',
  NON_FINANCIAL: 'مشارکت غیرمالی',
  SERVICE: 'مشارکت خدمتی',
};

/** ثبت درخواست حمایت یا مشارکت در صندوق حمایت هلدینگ */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'دادهٔ نامعتبر';
    return NextResponse.json({ error: 'INVALID_INPUT', message: msg }, { status: 400 });
  }
  const { kind, fullName, mobile, category, amount, message } = parsed.data;

  const fr = await db.fundRequest.create({
    data: { kind, fullName, mobile, category: category ?? null, amount: amount ?? null, message },
  });

  await queueReport(
    'FUND',
    kind === 'SUPPORT' ? `درخواست حمایت از صندوق — ${fullName}` : `مشارکت در صندوق حمایت — ${fullName}`,
    [
      kind === 'SUPPORT' ? 'نوع: درخواست حمایت' : 'نوع: مشارکت در صندوق',
      `نام: ${fullName} | همراه: ${mobile}`,
      category ? `نوع مشارکت: ${CAT_FA[category] ?? category}` : '',
      amount ? `مبلغ پیشنهادی: ${amount.toLocaleString('fa-IR')} تومان` : '',
      `شرح: ${message}`,
      `زمان ثبت: ${formatJalaliTime(new Date())}`,
    ].filter(Boolean).join('\n')
  );
  await logActivity('CUSTOMER', kind === 'SUPPORT' ? 'درخواست حمایت صندوق' : 'مشارکت در صندوق', `نام: ${fullName}`);

  return NextResponse.json({ ok: true, id: fr.id });
}
