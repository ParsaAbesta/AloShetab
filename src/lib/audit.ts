// ─── پیام ۱۱: حسابدار هوشمند — حسابرسی شبانه و توقف/ادامه عملیات ──
// هر شب (و با فرمان دستی) تمام عملیات بررسی می‌شود؛ در صورت مشاهدهٔ خطا
// (ضرر و زیان) عملیات تا تأیید مالک/مدیر متوقف می‌شود؛ پس از ۳ ساعت بدون
// تأیید مالک، تأیید ادمین نیز پذیرفته است؛ پس از دریافت فرمان ادامه، فعال می‌شود.
import { db } from '@/lib/db';
import { getSettings, setSetting } from '@/lib/settings';
import { formatJalali, tehranDateKey } from '@/lib/jalali';
import { queueReport } from '@/lib/reports';

interface Anomaly {
  code: string;
  severity: 'HIGH' | 'MEDIUM';
  ref: string; // کد سفارش یا شناسه
  detail: string;
}

export interface AuditResult {
  reportId: string;
  dateShamsi: string;
  anomalyCount: number;
  status: 'OK' | 'ANOMALY_FROZEN';
  frozen: boolean;
  totals: Record<string, number>;
}

/** اجرای حسابرسی کامل */
export async function runAudit(actor = 'SYSTEM'): Promise<AuditResult> {
  const now = new Date();
  const dateKey = tehranDateKey(now);
  const dateShamsi = formatJalali(now, 'en');
  const anomalies: Anomaly[] = [];

  // ─── جمع‌بندی‌ها ───
  const paidOrders = await db.order.findMany({
    where: { status: { in: ['PAID', 'SCHEDULED', 'IN_PROGRESS', 'DONE'] } },
    include: { items: true, payments: true, parts: true },
  });
  const receiptsService = paidOrders.reduce((s, o) => s + o.total, 0);
  const productOrders = await db.productOrder.findMany({ include: { services: true, stages: true } });
  const receiptsGoods = productOrders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((s, o) => s + o.total, 0);
  const unpaidReferrals = await db.referral.aggregate({ _sum: { amount: true }, where: { paid: false } });
  const settledNotPaid = paidOrders.filter((o) => !o.paidAt).length;
  const doneNotSettled = await db.order.count({ where: { status: 'DONE', settledAt: null } });

  const totals: Record<string, number> = {
    receiptsService,
    receiptsGoods,
    receiptsTotal: receiptsService + receiptsGoods,
    paidOrdersCount: paidOrders.length,
    productOrdersCount: productOrders.length,
    unpaidReferralsAmount: unpaidReferrals._sum.amount ?? 0,
    doneNotSettled,
    paidWithNoPaymentRecord: 0,
  };

  // ─── کنترل‌ها ───
  for (const o of paidOrders) {
    // ۱) سفارش پرداخت‌شده بدون رکورد پرداخت موفق
    const okPay = o.payments.some((p) => p.status === 'SUCCESS') || o.needsExpertise;
    if (!okPay) {
      anomalies.push({
        code: 'PAID_NO_PAYMENT',
        severity: 'HIGH',
        ref: o.code,
        detail: `سفارش ${o.code} به مبلغ ${o.total.toLocaleString('fa-IR')} تومان پرداخت‌شده است اما هیچ رکورد پرداخت موفق ندارد.`,
      });
      totals.paidWithNoPaymentRecord += 1;
    }
    // ۲) مبالغ منفی یا صفر نامعقول
    if (o.total < 0 || (!o.needsExpertise && o.total === 0)) {
      anomalies.push({
        code: 'NEGATIVE_AMOUNT',
        severity: 'HIGH',
        ref: o.code,
        detail: `سفارش ${o.code} مبلغ نامعتبر (${o.total}) دارد.`,
      });
    }
    // ۳) جمع اقلام با مبلغ کل نمی‌خواند (بیش از ۱٪ اختلاف)
    const itemsSum = o.items.reduce((s, i) => s + i.lineTotal + i.detailsExtra, 0) + o.partsTotal;
    if (!o.needsExpertise && itemsSum > 0 && o.total > 0) {
      const diff = Math.abs(itemsSum - o.total) / Math.max(itemsSum, 1);
      if (diff > 0.05) {
        anomalies.push({
          code: 'TOTAL_MISMATCH',
          severity: 'MEDIUM',
          ref: o.code,
          detail: `سفارش ${o.code}: جمع اقلام ${itemsSum.toLocaleString('fa-IR')} با مبلغ نهایی ${o.total.toLocaleString('fa-IR')} بیش از ۵٪ اختلاف دارد.`,
        });
      }
    }
  }

  // ۴) سفارش کالا با مبلغ نامعتبر
  for (const po of productOrders) {
    if (po.status === 'CANCELLED') continue;
    const expected = po.unitPrice * po.qty;
    if (expected !== po.total) {
      anomalies.push({
        code: 'PRODUCT_TOTAL_MISMATCH',
        severity: 'HIGH',
        ref: po.code,
        detail: `سفارش کالای ${po.code}: واحد×تعداد (${expected.toLocaleString('fa-IR')}) با مبلغ کل (${po.total.toLocaleString('fa-IR')}) نمی‌خواند.`,
      });
    }
    if (po.total <= 0) {
      anomalies.push({
        code: 'PRODUCT_ZERO_AMOUNT',
        severity: 'HIGH',
        ref: po.code,
        detail: `سفارش کالای ${po.code} مبلغ صفر یا نامعتبر دارد.`,
      });
    }
    // ۵) سفارش کالای ارسال‌شده بدون مراحل فاکتور
    if ((po.status === 'SENT' || po.status === 'DELIVERED') && po.stages.length === 0) {
      anomalies.push({
        code: 'MISSING_INVOICE_STAGES',
        severity: 'MEDIUM',
        ref: po.code,
        detail: `سفارش کالای ${po.code} ارسال/تحویل شده ولی هیچ مرحله‌ای از مسیر فاکتور توسط ادمین ثبت نشده است.`,
      });
    }
  }

  // ۶) تسویه انجام‌شده بدون پرداخت ثبت‌شده
  if (settledNotPaid > 0) {
    anomalies.push({
      code: 'SETTLED_UNPAID',
      severity: 'MEDIUM',
      ref: 'ORDERS',
      detail: `${settledNotPaid} سفارش وضعیت پرداخت‌شده دارد ولی زمان پرداخت (paidAt) ثبت نشده است.`,
    });
  }

  // ─── وضعیت توقف قبلی ───
  const s = await getSettings();
  const alreadyFrozen = s.OPERATIONS_FROZEN === 'true';

  let status: 'OK' | 'ANOMALY_FROZEN' = 'OK';
  let frozenUntil: Date | null = null;
  let frozen = false;

  if (anomalies.length > 0 && !alreadyFrozen) {
    // توقف عملیات تا تأیید مالک/مدیر (۳ ساعت مهلت)
    status = 'ANOMALY_FROZEN';
    frozenUntil = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    frozen = true;
    await setSetting('OPERATIONS_FROZEN', 'true');
    await setSetting('FROZEN_AT', now.toISOString());
    await queueReport(
      'SYSTEM',
      `🛑 توقف عملیات — خطای حسابرسی ${dateShamsi}`,
      [
        `حسابدار هوشمند الو شتاب — گزارش حسابرسی شبانه (${dateShamsi})`,
        `تعداد خطاهای مشاهده‌شده: ${anomalies.length}`,
        '',
        ...anomalies.map((a) => `• [${a.severity === 'HIGH' ? 'بحرانی' : 'هشدار'}] ${a.detail}`),
        '',
        'تمام عملیات تا تأیید مالک/مدیر متوقف شده است.',
        'پس از ۳ ساعت بدون تأیید مالک، تأیید ادمین برای ادامهٔ عملیات لازم است.',
        'پس از بررسی و دریافت فرمان ادامه، سیستم دوباره فعال می‌شود.',
      ].join('\n')
    );
  } else if (anomalies.length === 0 && alreadyFrozen) {
    // حسابرسی سالم ولی توقف از قبل فعال است — گزارشی ثبت نمی‌شود؛ ادمین/مالک تصمیم می‌گیرد
    anomalies.push({
      code: 'STILL_FROZEN',
      severity: 'MEDIUM',
      ref: 'SYSTEM',
      detail: 'حسابرسی فعلی بدون خطای جدید است اما توقف عملیات از قبل فعال است تا فرمان ادامه صادر شود.',
    });
  }

  const report = await db.auditReport.create({
    data: {
      dateKey,
      dateShamsi,
      totalsJson: JSON.stringify(totals),
      anomaliesJson: JSON.stringify(anomalies),
      anomalyCount: anomalies.length,
      status,
      frozenUntil,
    },
  });

  // گزارش شبانهٔ حسابرسی به ایمیل و پنل (مالک و ادمین)
  await queueReport(
    'SYSTEM',
    `گزارش حسابرسی شبانهٔ حسابدار هوشمند — ${dateShamsi}`,
    [
      `حسابدار هوشمند الو شتاب — گزارش حسابرسی (${dateShamsi})`,
      `وضعیت: ${status === 'OK' ? 'سالم ✅' : 'خطا و توقف عملیات 🛑'}`,
      '',
      'جمع‌بندی:',
      `• دریافتی خدمات: ${receiptsService.toLocaleString('fa-IR')} تومان (${paidOrders.length} سفارش)`,
      `• دریافتی کالا: ${receiptsGoods.toLocaleString('fa-IR')} تومان (${productOrders.length} سفارش)`,
      `• حق معرف پرداخت‌نشده: ${(unpaidReferrals._sum.amount ?? 0).toLocaleString('fa-IR')} تومان`,
      `• سفارش انجام‌شده بدون تسویه: ${doneNotSettled}`,
      '',
      anomalies.length === 0
        ? 'هیچ خطا (ضرر و زیان) مشاهده نشد.'
        : `خطاها:\n${anomalies.map((a) => `• ${a.detail}`).join('\n')}`,
    ].join('\n')
  );

  return { reportId: report.id, dateShamsi, anomalyCount: anomalies.length, status, frozen, totals };
}

/** پس از ۳ ساعت بدون تأیید مالک، تأیید ادمین مجاز می‌شود (اِسکِیلِیشن) */
export async function checkFreezeEscalation(): Promise<boolean> {
  const s = await getSettings();
  if (s.OPERATIONS_FROZEN !== 'true') return false;
  const frozenAt = s.FROZEN_AT ? new Date(s.FROZEN_AT) : null;
  if (frozenAt && Date.now() - frozenAt.getTime() >= 3 * 60 * 60 * 1000) {
    const latest = await db.auditReport.findFirst({
      where: { status: 'ANOMALY_FROZEN' },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && !latest.escalatedToAdmin) {
      await db.auditReport.update({ where: { id: latest.id }, data: { escalatedToAdmin: true } });
    }
    return true;
  }
  return false;
}

/** فرمان ادامهٔ عملیات — مالک همیشه؛ ادمین فقط پس از اسکِیلِیشن */
export async function resolveFreeze(byRole: 'OWNER' | 'ADMIN', byName: string): Promise<void> {
  const s = await getSettings();
  if (s.OPERATIONS_FROZEN !== 'true') return;
  const frozenAt = s.FROZEN_AT ? new Date(s.FROZEN_AT) : null;
  const threeHours = frozenAt ? Date.now() - frozenAt.getTime() >= 3 * 60 * 60 * 1000 : true;
  if (byRole === 'ADMIN' && !threeHours) {
    throw new Error('تأیید ادمین تا ۳ ساعت پس از توقف مجاز نیست — تأیید مالک/مدیر لازم است');
  }
  await setSetting('OPERATIONS_FROZEN', 'false');
  await setSetting('FROZEN_AT', '');
  const latest = await db.auditReport.findFirst({
    where: { status: 'ANOMALY_FROZEN' },
    orderBy: { createdAt: 'desc' },
  });
  if (latest) {
    await db.auditReport.update({
      where: { id: latest.id },
      data: {
        status: 'RESOLVED',
        resolvedBy: `${byRole === 'OWNER' ? 'مالک' : 'ادمین'} (${byName})`,
        resolvedAt: new Date(),
      },
    });
  }
  await queueReport(
    'SYSTEM',
    '✅ ادامهٔ عملیات — توقف حسابرسی رفع شد',
    `توقف عملیات توسط ${byRole === 'OWNER' ? 'مالک/مدیر' : 'ادمین (پس از مهلت ۳ ساعته)'} تأیید و رفع شد. سیستم دوباره فعال است.\nتأییدکننده: ${byName}\nزمان: ${formatJalali(new Date())}`
  );
}
