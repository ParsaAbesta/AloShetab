// ─── پیام ۱۹ (V4.1): معرفی یکپارچه بین دو میز + پاداش سقف‌دار دوره‌ای ──────────
// ۱) تشخیص «فاکتور اول» مشتری معرفی‌شده به‌صورت یکپارچه (خدمات + کالا) —
//    باگ V4.0: هر میز جداگانه فاکتور اول می‌شمرد و معرف دوبار پورسانت یک‌بارمصرف می‌گرفت؛
// ۲) پاداش سقف‌دار دوره‌ای معرف (پیام ۲۰ — V5.0): جبران ضعف انگیزهٔ پورسانت یک‌بارمصرف —
//    در هر دورهٔ یک‌ماههٔ شمسی، به ازای هر ۵ فاکتور قطعی‌شدهٔ از جانب هر معرف
//    (سفارش‌های خدمات تسویه‌شده + سفارش‌های کالای تحویل‌شدهٔ معرفی‌شده‌ها)
//    مبلغ ثابت ۵۰۰٬۰۰۰ تومان پاداش؛ تعداد پاداش = ⌊فاکتورها ÷ ۵⌋ —
//    مبلغ ثابت (نه درصدی) = سقف‌دار؛ از سهم شرکت (بانک ملی) تأمین و به معرف
//    واریز می‌شود (جریان مهر) — محرمانه؛ فقط دیتابیس + ایمیل بک‌اند.
import { db } from '@/lib/db';
import { jalaliToDate, toJalali } from '@/lib/jalali';
import { getSettings } from '@/lib/settings';

/** فاکتور اول مشتری = هیچ سفارش غیرلغوشده‌ای (خدمات یا کالا) برای او ثبت نشده باشد */
export async function isFirstInvoiceAnyDesk(p: { nationalId?: string | null; mobile?: string | null }): Promise<boolean> {
  let customerId: string | null = null;
  if (p.nationalId) {
    const c = await db.customer.findUnique({ where: { nationalId: p.nationalId }, select: { id: true } });
    customerId = c?.id ?? null;
  } else if (p.mobile) {
    const c = await db.customer.findFirst({ where: { OR: [{ mobile: p.mobile }, { landline: p.mobile }] }, select: { id: true } });
    customerId = c?.id ?? null;
  }
  const [svc, goods] = await Promise.all([
    customerId ? db.order.count({ where: { customerId, status: { not: 'CANCELLED' } } }) : Promise.resolve(0),
    p.mobile ? db.productOrder.count({ where: { mobile: p.mobile, status: { not: 'CANCELLED' } } }) : Promise.resolve(0),
  ]);
  return svc === 0 && goods === 0;
}

/** کلید دورهٔ یک‌ماههٔ شمسی برای تاریخ — '1405-08' */
export function jalaliPeriodKey(date: Date = new Date()): string {
  const j = toJalali(date);
  return `${j.jy}-${String(j.jm).padStart(2, '0')}`;
}

/** بازهٔ زمانی دورهٔ شمسی '1405-08' → [start, end) */
export function periodRange(periodKey: string): { start: Date; end: Date; labelFa: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(periodKey.trim());
  if (!m) throw new Error('BAD_PERIOD');
  const jy = parseInt(m[1], 10);
  const jm = parseInt(m[2], 10);
  if (jm < 1 || jm > 12) throw new Error('BAD_PERIOD');
  const start = jalaliToDate(jy, jm, 1);
  const njm = jm === 12 ? 1 : jm + 1;
  const njy = jm === 12 ? jy + 1 : jy;
  const end = jalaliToDate(njy, njm, 1);
  return { start, end, labelFa: periodKey };
}

export interface PeriodicBonusRow {
  referrerNat: string;
  referrerName: string;
  invoices: number; // فاکتورهای قطعی‌شدهٔ دوره از جانب معرف (خدمات + کالا)
  batches: number; // تعداد پاداش = ⌊فاکتورها ÷ ۵⌋
  bonus: number; // batches × مبلغ ثابت هر پاداش
}

export interface PeriodicBonusResult {
  periodKey: string;
  enable: boolean;
  invoicesPerReward: number; // هر چند فاکتور (۵)
  rewardToman: number; // مبلغ ثابت هر پاداش (۵۰۰٬۰۰۰ تومان)
  debt: number; // بدهی تأمین‌نشدهٔ پاداش شرکت (کسر از واریزی‌های ملی بعدی)
  rows: PeriodicBonusRow[];
  total: number;
}

/** محاسبهٔ پاداش سقف‌دار دوره‌ای هر معرف (پیام ۲۰ — V5.0): هر ۵ فاکتور → ۵۰۰ هزار تومان */
export async function computePeriodicBonuses(periodKey: string): Promise<PeriodicBonusResult> {
  const s = await getSettings();
  const per = Math.max(parseInt(s.PERIODIC_BONUS_INVOICES || '5', 10) || 5, 1);
  const reward = Math.max(parseInt(s.PERIODIC_BONUS_REWARD || '500000', 10) || 0, 0);
  const enable = s.PERIODIC_BONUS_ENABLE === '1';
  const { start, end } = periodRange(periodKey);

  // خدمات: سفارش‌های تسویه‌شدهٔ دورهٔ معرفی‌شده‌های هر معرف — هر سفارش یک فاکتور
  const orders = await db.order.findMany({
    where: { settledAt: { gte: start, lt: end }, referralCode: { not: null }, status: { not: 'CANCELLED' } },
    select: { referralCode: true },
  });
  // کالا: سفارش‌های تحویل‌شدهٔ دوره — هر سفارش یک فاکتور
  const goods = await db.productOrder.findMany({
    where: { referrerCode: { not: null }, status: 'DELIVERED', updatedAt: { gte: start, lt: end } },
    select: { referrerCode: true },
  });

  const count = new Map<string, number>();
  for (const o of orders) count.set(o.referralCode as string, (count.get(o.referralCode as string) ?? 0) + 1);
  for (const g of goods) count.set(g.referrerCode as string, (count.get(g.referrerCode as string) ?? 0) + 1);

  const keys = Array.from(count.keys());
  const names = await db.customer.findMany({
    where: { nationalId: { in: keys } },
    select: { nationalId: true, fullName: true },
  });
  const nameOf = new Map(names.map((c) => [c.nationalId, c.fullName]));

  const rows: PeriodicBonusRow[] = [];
  for (const key of keys) {
    const invoices = count.get(key) ?? 0;
    const batches = Math.floor(invoices / per); // سقف‌دار: فقط پاداش‌های کاملِ ۵تایی
    const bonus = enable ? batches * reward : 0;
    if (bonus <= 0) continue;
    rows.push({ referrerNat: key, referrerName: nameOf.get(key) ?? key, invoices, batches, bonus });
  }
  rows.sort((a, b) => b.bonus - a.bonus);
  return {
    periodKey,
    enable,
    invoicesPerReward: per,
    rewardToman: reward,
    debt: Math.max(0, parseInt(s.COMPANY_BONUS_DEBT || '0', 10) || 0),
    rows,
    total: rows.reduce((t, r) => t + r.bonus, 0),
  };
}
