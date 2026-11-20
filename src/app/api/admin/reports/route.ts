import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

/**
 * محرمانگی: بدنهٔ گزارش‌های تسویه حاوی مبالغ سهم‌ها (۴/۷ مجری، ۱/۷ معرف، ۲/۷ ألو شتاب) است؛
 * این مبالغ فقط باید در پایگاه داده و ایمیل بک‌اند باقی بمانند و هرگز در رابط کاربری نمایش داده نشوند.
 * بنابراین در پاسخ این API، مبالغِ خطوط مربوط به سهم‌ها ماسک می‌شوند (خود ایمیل ارسالی کامل است).
 */
const SHARE_LINE_PATTERNS = ['سهم انجام‌دهنده', 'حق معرف', 'سهم خالص ألو شتاب', 'انجام‌دهنده:', 'ألو شتاب:'];
const AMOUNT_RE = /[\d۰-۹٠-٩][\d۰-۹٠-٩٬,.\u066C]*/g; // ارقام فارسی/عربی/لاتین با جداکنندهٔ هزارگان

function sanitizeBody(body: string): string {
  return body
    .split('\n')
    .map((line) =>
      SHARE_LINE_PATTERNS.some((p) => line.includes(p))
        ? line.replace(AMOUNT_RE, '•••')
        : line
    )
    .join('\n');
}

/** گزارش‌ها: آرشیو کامل صف گزارش ایمیل‌شده */
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const type = new URL(req.url).searchParams.get('type') ?? '';
  const reports = await db.reportItem.findMany({
    where: type && type !== 'ALL' ? { type } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const contactMessages = await db.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const activities = await db.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return NextResponse.json({
    reports: reports.map((r) => ({ ...r, body: sanitizeBody(r.body) })),
    contactMessages,
    activities: activities.map((a) => ({ ...a, detail: a.detail ? sanitizeBody(a.detail) : a.detail })),
    types: ['ORDER', 'PAYMENT', 'STATUS', 'RATING', 'WORKER', 'REFERRAL', 'CONTACT', 'SYSTEM', 'PRODUCT', 'INVEST', 'FUND'],
  });
}
