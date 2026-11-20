import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateDailyReport } from '@/lib/inventory';
import { runAudit, checkFreezeEscalation } from '@/lib/audit';
import { getSettings } from '@/lib/settings';
import { runFeedCycle } from '@/lib/pricefeed';

export const dynamic = 'force-dynamic';

/** 🕐 کرن داخلی — برای زمان‌بندی خارجی (Task Scheduler / cron / uptime-monitor):
 *   GET /api/tick?key=ALOSHETAB_TICK_SECRET
 *  هر فراخوانی:
 *   ۱) اگر امروز گزارش روزانهٔ قیمت تولید نشده → تولید و ارسال به پنل + ایمیل ادمین
 *   ۲) اگر گزارش حسابرسی «شبانهٔ» امروز ثبت نشده (پس از ۲۱:۰۰ تهران) → اجرای حسابدار هوشمند
 *   ۳) بررسی اسکِیلِیشن توقف حسابرسی (۳ ساعت)
 *  مالک می‌تواند با Task Scheduler ویندوز هر شب ساعت ۲۱:۳۰ این آدرس را صدا بزند. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key') ?? '';
  const s = await getSettings();
  // کلید کرن در تنظیمات نگهداری می‌شود؛ مقدار پیش‌فرض ثابت برای استقرار اولیه
  const expected = s.TICK_SECRET ?? 'AloShetab-Tick-1405';
  if (key !== expected) {
    return NextResponse.json({ error: 'INVALID_KEY' }, { status: 401 });
  }

  const results: Record<string, unknown> = { tick: new Date().toISOString() };

  // ۰) پیام ۱۳: اتصال به سایت نوسان قیمت — نرخ‌های لحظه‌ای مرجع (tgju.org)
  //    «قیمت‌ها از بروزترین‌ها بروز شود» — وضعیت اتصال در پنل ادمین ثبت می‌شود
  try {
    results.liveFeed = await runFeedCycle();
  } catch (e) {
    results.liveFeedError = e instanceof Error ? e.message : 'خطا';
  }

  // ۱) گزارش روزانهٔ قیمت (تکرار در یک روز خودکار جلوگیری می‌شود)
  try {
    results.dailyReport = await generateDailyReport('SYSTEM');
  } catch (e) {
    results.dailyReportError = e instanceof Error ? e.message : 'خطا';
  }

  // ۲) حسابرسی شبانه پس از ۲۱:۰۰ تهران (یک بار در روز)
  const now = new Date();
  const tehranHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', hour: '2-digit', hour12: false }).format(now)) % 24;
  if (tehranHour >= 21) {
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now);
    const existing = await db.auditReport.findFirst({ where: { dateKey: todayKey } });
    if (!existing) {
      try {
        results.audit = await runAudit('SYSTEM');
      } catch (e) {
        results.auditError = e instanceof Error ? e.message : 'خطا';
      }
    } else {
      results.audit = { skipped: 'امروز قبلاً حسابرسی اجرا شده', status: existing.status };
    }
  }

  // ۳) اسکِیلِیشن توقف
  results.escalated = await checkFreezeEscalation();

  return NextResponse.json(results);
}
