// ─── پیام ۲۰ (V5.0): پاداش سقف‌دار دوره‌ای معرف — محاسبه و انتقال لحظه‌ای ──────────
// قاعدهٔ مالک: «هر پنج فاکتور از جانب آن معرف، مبلغ ۵۰۰ هزارتومان پاداش دوره‌ای»
// و «در زمان فاکتور پنجم، ۵۰۰ هزار تومان از مقدار واریزی به حساب ملی کسر شده و
// به حساب مهر واریز شود.»
//
// پیاده‌سازی:
//  • در لحظهٔ تسویهٔ هر فاکتور (خدمات: پس از رضایت مشتری | کالا: هنگام تحویل)،
//    فاکتورهای قطعی‌شدهٔ دورهٔ یک‌ماههٔ شمسیِ از جانب معرف شمرده می‌شود
//    (خدمات تسویه‌شده + کالای تحویل‌شدهٔ معرفی‌شده‌ها — شمارش یکپارچهٔ دو میز).
//  • اگر این فاکتور، پنجمین/دهمین/... فاکتور دوره باشد (count % 5 == 0):
//    بدهی پاداش ۵۰۰٬۰۰۰ تومان صادر و بلافاصله از واریزی همان فاکتور به بانک ملی
//    کسر و به بانک مهر منتقل می‌شود (سقف‌دار — مبلغ ثابت، نه درصدی).
//  • اگر سهم شرکتِ همان فاکتور کمتر از ۵۰۰٬۰۰۰ باشد، مابه‌التفاوت به‌صورت
//    «بدهی پاداش شرکت» در تنظیمات (COMPANY_BONUS_DEBT) می‌ماند و از واریزی‌های
//    ملیِ تسویه‌های بعدی (هر سفارشی) تا تسویهٔ کامل کسر می‌شود — هیچ تومانی گم نمی‌شود.
//  • ثبت رویداد فقط در دیتابیس + ایمیل بک‌اند (محرمانه — در API/فرانت عمومی نیست).
import { db } from '@/lib/db';
import { getSettings, setSetting } from '@/lib/settings';
import { jalaliPeriodKey, periodRange } from '@/lib/referral';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

const DEBT_KEY = 'COMPANY_BONUS_DEBT';

/** فاکتورهای قطعی‌شدهٔ دورهٔ شمسی جاری از جانب یک معرف — خدمات + کالا (شمارش یکپارچه) */
export async function countReferrerInvoices(refCode: string): Promise<number> {
  const { start, end } = periodRange(jalaliPeriodKey(new Date()));
  const [svc, goods] = await Promise.all([
    db.order.count({
      where: { referralCode: refCode, status: { not: 'CANCELLED' }, settledAt: { gte: start, lt: end } },
    }),
    db.productOrder.count({
      where: { referrerCode: refCode, status: 'DELIVERED', updatedAt: { gte: start, lt: end } },
    }),
  ]);
  return svc + goods;
}

export interface BonusOutcome {
  invoices: number; // شمارش فاکتورهای دورهٔ معرف (۰ اگر بدون معرف)
  triggered: boolean; // این فاکتور، پنجمین/دهمین/... دوره است
  bonusDue: number; // بدهی تازه‌صادره در همین تسویه (۵۰۰٬۰۰۰ یا ۰)
  funded: number; // مبلغی که همین تسویه از ملی به مهر منتقل کرد
  debtLeft: number; // بدهی تأمین‌نشدهٔ باقی‌مانده
  melliAmount: number; // واریزی نهایی به بانک ملی = companyShare − funded
}

/** سریال‌سازی فراخوانی‌ها — جلوگیری از دو-تریگرِ هم‌زمان در درخواست‌های موازی */
let chain: Promise<unknown> = Promise.resolve();

/**
 * اعمال پاداش سقف‌دار دوره‌ای در لحظهٔ تسویهٔ یک فاکتور.
 * refCode = کد معرف همان فاکتور (null → فقط تسویهٔ بدهی قبلی شرکت)؛
 * companyShare = سود خالص شرکتِ همین فاکتور (پیش از کسر پاداش).
 */
export function applyPeriodicBonusAtSettlement(refCode: string | null | undefined, companyShare: number): Promise<BonusOutcome> {
  const run = chain.then(() => doApply(refCode, companyShare));
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function doApply(refCode: string | null | undefined, companyShare: number): Promise<BonusOutcome> {
  const share = Math.max(0, Math.round(companyShare));
  const s = await getSettings();
  const enable = s.PERIODIC_BONUS_ENABLE === '1';
  const per = Math.max(parseInt(s.PERIODIC_BONUS_INVOICES || '5', 10) || 5, 1);
  const reward = Math.max(parseInt(s.PERIODIC_BONUS_REWARD || '500000', 10) || 0, 0);

  let funded = 0;
  let debt = Math.max(0, parseInt(s.COMPANY_BONUS_DEBT || '0', 10) || 0);

  // ۱) تسویهٔ بدهی قبلی از همین سهم (اگر دورهٔ قبلی مابه‌التفاوت مانده باشد)
  const take1 = Math.min(share, debt);
  if (take1 > 0) {
    debt -= take1;
    funded += take1;
    await setSetting(DEBT_KEY, String(debt));
  }

  // ۲) شمارش یکپارچهٔ فاکتورهای دورهٔ معرف — فاکتور جاری همین حالا قطعی شده است
  let invoices = 0;
  let triggered = false;
  if (refCode) {
    invoices = await countReferrerInvoices(refCode);
    if (enable && reward > 0 && invoices > 0 && invoices % per === 0) {
      triggered = true;
      debt += reward;
      await setSetting(DEBT_KEY, String(debt));
      // ۳) انتقال فوری از واریزی ملی همین فاکتور به مهر
      const take2 = Math.min(share - funded, debt);
      if (take2 > 0) {
        debt -= take2;
        funded += take2;
        await setSetting(DEBT_KEY, String(debt));
      }
      await queueReport(
        'REFERRAL',
        `⚡ پاداش سقف‌دار دوره‌ای معرف — تریگر لحظه‌ای (V5.0)`,
        [
          `فاکتور ${invoices.toLocaleString('fa-IR')}-ام دورهٔ شمسی ${jalaliPeriodKey(new Date())} از جانب معرف ${refCode} قطعی شد`,
          `قاعده: هر ${per.toLocaleString('fa-IR')} فاکتور → ${reward.toLocaleString('fa-IR')} تومان`,
          `${reward.toLocaleString('fa-IR')} تومان از واریزی به بانک ملی کسر و به بانک مهر منتقل شد (پرداخت به معرف از جریان مهر)`,
          funded < reward ? `⚠ تأمین‌نشدهٔ همین پاداش: ${(reward - Math.min(funded, reward)).toLocaleString('fa-IR')} تومان — از واریزی‌های ملی بعدی کسر می‌شود` : 'تأمین کامل در همین فاکتور',
          `زمان: ${formatJalaliTime(new Date())}`,
        ].join('\n')
      );
      await logActivity('SYSTEM', `تریگر پاداش دوره‌ای معرف ${refCode}`, `فاکتور: ${invoices} | پاداش: ${reward} | منتقل‌شده: ${funded} | بدهی: ${debt}`);
    }
  }

  return { invoices, triggered, bonusDue: triggered ? reward : 0, funded, debtLeft: debt, melliAmount: share - funded };
}
