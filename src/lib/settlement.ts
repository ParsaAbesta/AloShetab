// ─── موتور تسویهٔ خودکار — پلن ۱۸ (V4.0): کارشناس ۶۷٪ اجرت؛ پورسانت معرف فقط فاکتور اول ──────────
import { db } from '@/lib/db';
import { ORDER_STATUS } from '@/lib/constants';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';
import { allocateAmounts } from '@/lib/pricing';
import { settleServices18, bankRouting18, plan18SettingsFromRecord } from '@/lib/plan18';
import { applyPeriodicBonusAtSettlement } from '@/lib/bonus';
import { getSettings } from '@/lib/settings';

/**
 * تسویهٔ خودکار سفارش خدمات پس از ثبت رضایت مشتری — پلن ۱۸ (V4.0):
 *  • مبنای همهٔ سهم‌ها «اجرت کارشناس» است (grossTotal پس از ضرایب تقویمی) — افزودنی ۳۳٪ حذف شد؛
 *  • دستمزد کارشناس = ۶۷٪ اجرت → بانک مهر | سود میز خدمات = ۳۳٪ اجرت؛
 *  • حق معرف فقط یک‌بار (فاکتور اول معرفی‌شده: ۱۰٪ اجرت — همان فاکتورِ تخفیف ۱۰٪ مشتری)
 *    که در لحظهٔ ثبت در Referral ثبت شده، از سهم شرکت پرداخت می‌شود؛
 *    سهم خالص شرکت خدمات = باقیمانده (فاکتور اول ≈ ۱۳٪ — فاکتورهای بعدی: ۳۳٪ کامل)؛
 *  • اقلام بدون همکار، سهمشان نزد شرکت (امانی) باقی می‌ماند تا ادمین همکار تعیین کند؛
 *  • جریان بانکی گزارش می‌شود: بانک ملی ← سود خالص شرکت | بانک مهر ← کارشناس + معرف؛
 *  • پیام ۲۰ (V5.0): در فاکتور پنجم/دهمِ... دورهٔ معرف، ۵۰۰ هزار تومان از واریزی ملی
 *    کسر و به مهر منتقل می‌شود (پاداش سقف‌دار دوره‌ای — موتور bonus.ts)؛
 *  • کل عملیات در یک تراکنش دیتابیس انجام می‌شود (اتوماسیون و دستکاری‌ناپذیر).
 */
export async function settleOrder(orderId: string): Promise<{ ok: true; workerTotal: number; companyTotal: number; referralAmount: number; banks: ReturnType<typeof bankRouting18> } | { ok: false; reason: string }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { worker: true, service: true } }, rating: true, referral: true, customer: true },
  });
  if (!order) return { ok: false, reason: 'ORDER_NOT_FOUND' };
  if (order.status !== ORDER_STATUS.DONE) return { ok: false, reason: 'NOT_DONE' };
  if (!order.rating) return { ok: false, reason: 'NO_RATING' };
  if (order.settledAt) return { ok: false, reason: 'ALREADY_SETTLED' };

  const settings = await getSettings();
  const plan = plan18SettingsFromRecord(settings as unknown as Record<string, string>);

  // سهم هر قلم از «اجرت» (grossTotal) — مبنای دستمزد ۶۷٪ کارشناس (پیام ۱۷)
  const grossAlloc = allocateAmounts(order.grossTotal, order.items.map((it) => it.lineTotal || 0));
  const referralAmount = order.referral && !order.referral.paid ? order.referral.amount : 0;

  let workerTotal = 0;
  await db.$transaction(async (tx) => {
    for (let idx = 0; idx < order.items.length; idx++) {
      const item = order.items[idx];
      const itemAmount = item.itemAmount ?? 0;
      const approved = !!(item.workerId && item.worker && item.worker.status === 'APPROVED');
      const workerShare = approved ? Math.round((grossAlloc[idx] ?? 0) * plan.servicesExpertPct) : 0;
      workerTotal += workerShare;
      await tx.orderItem.update({
        where: { id: item.id },
        data: { itemAmount, workerShare, companyShare: Math.max(0, itemAmount - workerShare), settledAt: new Date() },
      });
    }
    await tx.order.update({ where: { id: order.id }, data: { settledAt: new Date() } });
  });

  // تجمیع سطح سفارش: وصولی بخش خدمات − کارشناس − معرف (فقط فاکتور اول) = سود خالص شرکت
  const st = settleServices18({
    grossFee: order.grossTotal,
    referred: !!order.referralCode,
    isFirstInvoice: false, // رکورد Referral فقط در فاکتور اول ساخته می‌شود (V4.0)؛ مبلغش از همان‌جا کسر می‌شود
    collectedServices: order.total - order.partsTotal,
    settings: plan,
  });
  // ─── پیام ۱۹ (V4.1): قفل «سود بلاصاحب → بانک ملی» ───
  // باگ V4.0: کسر ۶۷٪ کل اجرت (حتی برای اقلامِ بدون همکار تأییدشده) → سهم پرداخت‌نشده
  // هیچ‌جا نمی‌رفت (نشتی). اصلاح: کسر بر مبنای «دستمزد پرداختی واقعی» (workerTotal)؛
  // هر تومانی که به کارشناس/معرف پرداخت نمی‌شود = سود بلاصاحب → بانک ملی.
  const rawCompany = st.collected - workerTotal - referralAmount;
  const companyTotal = Math.max(0, rawCompany);
  const unclaimedWorker = order.items
    .filter((it) => !(it.workerId && it.worker && it.worker.status === 'APPROVED'))
    .reduce((t, it) => t + (it.itemAmount ?? 0), 0);
  // ─── پیام ۲۰ (V5.0): پاداش سقف‌دار دوره‌ای — در فاکتور پنجم/دهمِ معرف، ۵۰۰ هزار تومان
  // از واریزی ملی کسر و به مهر منتقل می‌شود؛ بدهی تأمین‌نشده از تسویه‌های بعدی جبران می‌شود ───
  const bonus = await applyPeriodicBonusAtSettlement(order.referralCode ?? null, companyTotal);
  const melliAmount = bonus.melliAmount;
  const banks = bankRouting18({ company: melliAmount, expert: workerTotal, referrer: referralAmount });
  banks.mehr.amount += bonus.funded; // پاداش معرف از جریان مهر پرداخت می‌شود

  await queueReport(
    'STATUS',
    `تسویهٔ خودکار سفارش ${order.code} انجام شد (پلن ۱۸ — V5.0)`,
    [
      `کد سفارش: ${order.code} | مشتری: ${order.customer.fullName}`,
      `مبلغ کل پرداختی: ${order.total.toLocaleString('fa-IR')} تومان (اجرت کارشناس: ${order.grossTotal.toLocaleString('fa-IR')} تومان)`,
      `دستمزد کارشناس (۶۷٪ اجرت → بانک مهر): ${workerTotal.toLocaleString('fa-IR')} تومان`,
      order.referral
        ? `حق معرف — فقط فاکتور اول معرفی‌شده (V4.0) (برای واریز در تب «معرفی‌ها»): ${order.referral.amount.toLocaleString('fa-IR')} تومان — معرف: ${order.referral.referrerNat}`
        : 'پورسانت معرفی برای این سفارش وجود ندارد (پورسانت معرف فقط در فاکتور اول پرداخت می‌شود)',
      `سود خالص شرکت خدمات: ${companyTotal.toLocaleString('fa-IR')} تومان | واریزی به بانک ملی: ${melliAmount.toLocaleString('fa-IR')} تومان`,
      bonus.triggered
        ? `⚡ پاداش سقف‌دار دوره‌ای معرف (پیام ۲۰ — V5.0): این فاکتور، ${bonus.invoices.toLocaleString('fa-IR')}-ام دورهٔ معرف ${order.referralCode} است — ۵۰۰٬۰۰۰ تومان از واریزی ملی کسر و به بانک مهر منتقل شد${bonus.debtLeft > 0 ? ` | مابه‌التفاوت از تسویه‌های بعدی: ${bonus.debtLeft.toLocaleString('fa-IR')} تومان` : ''}`
        : bonus.funded > 0
          ? `پاداش دوره‌ای معرف (→ بانک مهر): ${bonus.funded.toLocaleString('fa-IR')} تومان | بدهی باقی‌ماندهٔ شرکت: ${bonus.debtLeft.toLocaleString('fa-IR')} تومان`
          : '',
      order.partsTotal ? `خرید قطعات (در گردش — بانک مهر): ${order.partsTotal.toLocaleString('fa-IR')} تومان` : '',
      unclaimedWorker > 0
        ? `سود بلاصاحب اقلام بدون همکار تأییدشده (→ بانک ملی): ${Math.min(unclaimedWorker, companyTotal).toLocaleString('fa-IR')} تومان — تا تعیین همکار نزد شرکت (امانی، V4.1)`
        : '',
      rawCompany < 0 ? '⚠ SERVICES_COMPANY_NEGATIVE — تخفیف فاکتور اول از سهم شرکت بیشتر شده؛ برای بازبینی مالک' : '',
      `مقصد بانکی: ملی (${banks.melli.card}) ← سود شرکت | مهر (${banks.mehr.card}) ← کارشناس + معرف + پاداش دوره‌ای`,
      `امتیاز مشتری: مهارت ${order.rating.skill}/۵ + اخلاق ${order.rating.ethics}/۵`,
      `زمان تسویه: ${formatJalaliTime(new Date())}`,
    ].filter(Boolean).join('\n')
  );
  await logActivity('SYSTEM', `تسویهٔ خودکار ${order.code}`, `کارشناس(مهر): ${workerTotal} | شرکت(ملی): ${melliAmount} | معرف: ${referralAmount} | بلاصاحب→ملی: ${unclaimedWorker}${bonus.funded > 0 ? ` | پاداش دوره‌ای(مهر): ${bonus.funded}` : ''}${rawCompany < 0 ? ' | SERVICES_COMPANY_NEGATIVE' : ''}`);

  return { ok: true, workerTotal, companyTotal, referralAmount, banks };
}
